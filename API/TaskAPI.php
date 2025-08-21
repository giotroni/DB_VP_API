<?php
/**
 * TaskAPI - Versione stabile con query separate
 */

require_once 'BaseAPI.php';

class TaskAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('ANA_TASK', 'ID_TASK');
        
        $this->requiredFields = ['Task', 'ID_COMMESSA'];
        $this->validationRules = [
            'ID_TASK' => ['max_length' => 50],
            'Task' => ['required' => true, 'max_length' => 255],
            'Desc_Task' => ['max_length' => 65535],
            'ID_COMMESSA' => ['required' => true, 'max_length' => 50],
            'ID_COLLABORATORE' => ['max_length' => 50],
            'Tipo' => ['enum' => ['Campo', 'Ufficio', 'Monitoraggio', 'Promo', 'Sviluppo', 'Formazione']],
            'Data_Apertura_Task' => ['date' => true],
            'Stato_Task' => ['enum' => ['In corso', 'Sospeso', 'Chiuso', 'Archiviato']],
            'gg_previste' => ['numeric' => true, 'min' => 0],
            'Spese_Comprese' => ['enum' => ['Si', 'No']],
            'Valore_Spese_std' => ['numeric' => true, 'min' => 0],
            'Valore_gg' => ['numeric' => true, 'min' => 0]
        ];
    }
    
    /**
     * Override getAll per aggiungere i campi calcolati
     */
    protected function getAll() {
        try {
            $params = [];
            $whereClause = $this->buildWhereClause($params);
            $orderBy = $this->getOrderBy();
            
            // Query semplice sulla tabella principale
            $sql = "SELECT * FROM {$this->table}";
            
            if (!empty($whereClause)) {
                $sql .= " WHERE $whereClause";
            }
            
            $sql .= " ORDER BY $orderBy";
            
            // Paginazione
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = max(1, min(1000, intval($_GET['limit'] ?? 20))); // Aumentato limite max
            $offset = ($page - 1) * $limit;
            
            $sql .= " LIMIT $limit OFFSET $offset";
            
            $stmt = $this->db->prepare($sql);
            
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $stmt->execute();
            $records = $stmt->fetchAll();
            
            // Post-process ogni record per aggiungere i dati correlati
            $processedRecords = [];
            foreach ($records as $record) {
                $processedRecords[] = $this->processRecord($record);
            }
            
            // Conta totale per paginazione
            $total = $this->getTotalCount($whereClause, $params);
            
            $result = [
                'data' => $processedRecords,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ];
            
            sendSuccessResponse($result);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il recupero dei dati: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Override getById per aggiungere i dati correlati
     */
    protected function getById($id) {
        try {
            $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            
            $record = $stmt->fetch();
            if (!$record) {
                sendErrorResponse('Record non trovato', 404);
                return;
            }
            
            $processedRecord = $this->processRecord($record);
            sendSuccessResponse($processedRecord);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il recupero del record: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Post-processing di ogni record per aggiungere dati correlati
     */
    protected function processRecord($record) {
        try {
            // Aggiungi giorni effettuati da FACT_GIORNATE
            $record['gg_effettuate'] = $this->getGiorniEffettuati($record['ID_TASK']);
            
            // Aggiungi nome commessa e dati correlati
            $commessaData = $this->getCommessaData($record['ID_COMMESSA']);
            $record['commessa_nome'] = $commessaData['commessa_nome'];
            $record['cliente_nome'] = $commessaData['cliente_nome'];
            $record['responsabile_commessa'] = $commessaData['responsabile_commessa'];
            
            // Aggiungi nome collaboratore se presente
            if (!empty($record['ID_COLLABORATORE'])) {
                $record['collaboratore_nome'] = $this->getCollaboratoreNome($record['ID_COLLABORATORE']);
            } else {
                $record['collaboratore_nome'] = null;
            }
            
            // Calcola valori maturati del task
            $valoriMaturati = $this->calcolaValoriMaturati($record['ID_TASK'], $record);
            $record['valore_gg_maturato'] = $valoriMaturati['valore_gg'];
            $record['valore_spese_maturato'] = $valoriMaturati['valore_spese'];
            $record['valore_tot_maturato'] = $valoriMaturati['valore_tot'];
            
            return $record;
            
        } catch (Exception $e) {
            // In caso di errore, restituisci il record originale con valori di default
            $record['gg_effettuate'] = 0;
            $record['commessa_nome'] = 'N/A';
            $record['cliente_nome'] = 'N/A';
            $record['responsabile_commessa'] = 'N/A';
            $record['collaboratore_nome'] = 'N/A';
            $record['valore_gg_maturato'] = 0;
            $record['valore_spese_maturato'] = 0;
            $record['valore_tot_maturato'] = 0;
            return $record;
        }
    }
    
    /**
     * Calcola giorni effettuati dalla tabella FACT_GIORNATE
     */
    private function getGiorniEffettuati($taskId) {
        try {
            // Prima verifichiamo se ci sono record per debug
            $debugSql = "SELECT COUNT(*) as count, gg FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $debugStmt = $this->db->prepare($debugSql);
            $debugStmt->bindValue(':id', $taskId);
            $debugStmt->execute();
            $debug = $debugStmt->fetch();
            
            // Query principale con gestione del formato decimale italiano
            $sql = "SELECT SUM(CAST(REPLACE(gg, ',', '.') AS DECIMAL(10,2))) as total 
                    FROM FACT_GIORNATE 
                    WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $result = $stmt->fetchColumn();
            
            return floatval($result) ?: 0;
        } catch (Exception $e) {
            // In caso di errore, proviamo una query più semplice
            try {
                $simpleSql = "SELECT gg FROM FACT_GIORNATE WHERE ID_TASK = :id";
                $simpleStmt = $this->db->prepare($simpleSql);
                $simpleStmt->bindValue(':id', $taskId);
                $simpleStmt->execute();
                $rows = $simpleStmt->fetchAll();
                
                $total = 0;
                foreach ($rows as $row) {
                    $gg = str_replace(',', '.', $row['gg']);
                    $total += floatval($gg);
                }
                return $total;
            } catch (Exception $e2) {
                return 0;
            }
        }
    }
    
    /**
     * Ottieni dati commessa, cliente e responsabile con una sola query
     */
    private function getCommessaData($commessaId) {
        try {
            $sql = "SELECT c.Commessa, cl.Cliente, cr.Collaboratore as Responsabile_Commessa
                    FROM ANA_COMMESSE c 
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE 
                    LEFT JOIN ANA_COLLABORATORI cr ON c.ID_COLLABORATORE = cr.ID_COLLABORATORE
                    WHERE c.ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $result = $stmt->fetch();
            
            return [
                'commessa_nome' => $result['Commessa'] ?? 'N/A',
                'cliente_nome' => $result['Cliente'] ?? 'N/A',
                'responsabile_commessa' => $result['Responsabile_Commessa'] ?? 'N/A'
            ];
        } catch (Exception $e) {
            return [
                'commessa_nome' => 'N/A',
                'cliente_nome' => 'N/A',
                'responsabile_commessa' => 'N/A'
            ];
        }
    }
    
    /**
     * Ottieni nome collaboratore
     */
    private function getCollaboratoreNome($collaboratoreId) {
        try {
            $sql = "SELECT Collaboratore FROM ANA_COLLABORATORI WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratoreId);
            $stmt->execute();
            $result = $stmt->fetchColumn();
            return $result ?: 'N/A';
        } catch (Exception $e) {
            return 'N/A';
        }
    }
    
    /**
     * Calcola valori maturati del task
     */
    private function calcolaValoriMaturati($taskId, $taskData) {
        try {
            $valoreGg = $this->calcolaValoreGg($taskId, $taskData);
            $valoreSpese = $this->calcolaValoreSpese($taskId, $taskData);
            $valoreTot = $valoreGg + $valoreSpese;
            
            return [
                'valore_gg' => round($valoreGg, 2),
                'valore_spese' => round($valoreSpese, 2),
                'valore_tot' => round($valoreTot, 2)
            ];
        } catch (Exception $e) {
            return [
                'valore_gg' => 0,
                'valore_spese' => 0,
                'valore_tot' => 0
            ];
        }
    }
    
    /**
     * Calcola Valore_gg: somma giornate Campo * tariffa
     */
    private function calcolaValoreGg($taskId, $taskData) {
        try {
            // Debug: Prima prova una query semplificata per vedere se trova giornate
            $sqlDebug = "SELECT g.gg, g.ID_COLLABORATORE, g.Tipo 
                         FROM FACT_GIORNATE g 
                         WHERE g.ID_TASK = :task_id";
            
            $stmtDebug = $this->db->prepare($sqlDebug);
            $stmtDebug->bindValue(':task_id', $taskId);
            $stmtDebug->execute();
            $giornateDebug = $stmtDebug->fetchAll();
            
            // Se non ci sono giornate per questo task, ritorna 0
            if (empty($giornateDebug)) {
                return 0;
            }
            
            // Calcola basandosi sul Valore_gg del task (prezzo fisso)
            $prezzoGg = floatval($taskData['Valore_gg'] ?? 0);
            if ($prezzoGg > 0) {
                // Somma tutte le giornate di tipo Campo
                $totaleGg = 0;
                foreach ($giornateDebug as $g) {
                    if ($g['Tipo'] === 'Campo') {
                        $totaleGg += floatval(str_replace(',', '.', $g['gg']));
                    }
                }
                return $totaleGg * $prezzoGg;
            }
            
            // Fallback: usa le tariffe dei collaboratori
            $sql = "SELECT g.gg, g.ID_COLLABORATORE, 
                           COALESCE(t.Tariffa_gg, tg.Tariffa_gg, 0) as tariffa
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TARIFFE_COLLABORATORI t ON g.ID_COLLABORATORE = t.ID_COLLABORATORE 
                                                          AND (t.ID_COMMESSA = :commessa_id OR t.ID_COMMESSA IS NULL)
                                                          AND g.Data BETWEEN t.Dal AND COALESCE(t.Al, '9999-12-31')
                    LEFT JOIN ANA_TARIFFE_COLLABORATORI tg ON g.ID_COLLABORATORE = tg.ID_COLLABORATORE
                                                            AND tg.ID_COMMESSA IS NULL
                                                            AND g.Data BETWEEN tg.Dal AND COALESCE(tg.Al, '9999-12-31')
                    WHERE g.ID_TASK = :task_id 
                      AND g.Tipo = 'Campo'
                    ORDER BY t.ID_COMMESSA DESC, t.Dal DESC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':task_id', $taskId);
            $stmt->bindValue(':commessa_id', $taskData['ID_COMMESSA']);
            $stmt->execute();
            $giornate = $stmt->fetchAll();
            
            $totaleValore = 0;
            foreach ($giornate as $giornata) {
                $gg = floatval(str_replace(',', '.', $giornata['gg']));
                $tariffa = floatval($giornata['tariffa']);
                $totaleValore += $gg * $tariffa;
            }
            
            return $totaleValore;
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Calcola Valore_Spese in base alle regole business
     */
    private function calcolaValoreSpese($taskId, $taskData) {
        try {
            // Se Spese_Comprese = 'Si', il valore spese è sempre 0
            if (isset($taskData['Spese_Comprese']) && $taskData['Spese_Comprese'] === 'Si') {
                return 0;
            }
            
            // Se Spese_Comprese = 'No', verifica se ci sono spese standard
            $speseStandard = floatval($taskData['Valore_Spese_std'] ?? 0);
            
            if ($speseStandard > 0) {
                // Usa le spese standard
                return $speseStandard;
            } else {
                // Somma le spese dalle giornate del task
                $sql = "SELECT SUM(
                           COALESCE(CAST(REPLACE(Spese_Viaggi, ',', '.') AS DECIMAL(10,2)), 0) +
                           COALESCE(CAST(REPLACE(Vitto_alloggio, ',', '.') AS DECIMAL(10,2)), 0) +
                           COALESCE(CAST(REPLACE(Altri_costi, ',', '.') AS DECIMAL(10,2)), 0)
                       ) as totale_spese
                        FROM FACT_GIORNATE 
                        WHERE ID_TASK = :task_id";
                
                $stmt = $this->db->prepare($sql);
                $stmt->bindValue(':task_id', $taskId);
                $stmt->execute();
                $totaleSpese = $stmt->fetchColumn();
                
                return floatval($totaleSpese) ?: 0;
            }
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Conta il totale dei record per la paginazione
     */
    private function getTotalCount($whereClause, $params) {
        try {
            $sql = "SELECT COUNT(*) as total FROM {$this->table}";
            
            if (!empty($whereClause)) {
                $sql .= " WHERE $whereClause";
            }
            
            $stmt = $this->db->prepare($sql);
            
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $stmt->execute();
            return intval($stmt->fetchColumn());
            
        } catch (PDOException $e) {
            return 0;
        }
    }
    
    /**
     * Validazione input per task
     */
    protected function validateInput($data, $requireAll = true) {
        $errors = [];
        
        // Verifica campi richiesti
        if ($requireAll) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || empty(trim($data[$field]))) {
                    $errors[] = "Campo '$field' richiesto";
                }
            }
        }
        
        // Validazione specifiche per ogni campo
        foreach ($data as $field => $value) {
            if (!isset($this->validationRules[$field]) || $value === null || $value === '') {
                continue;
            }
            
            $rules = $this->validationRules[$field];
            
            // Lunghezza massima
            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']} caratteri)";
            }
            
            // Valore numerico
            if (isset($rules['numeric']) && !is_numeric($value)) {
                $errors[] = "Campo '$field' deve essere numerico";
            }
            
            // Valore minimo
            if (isset($rules['min']) && is_numeric($value) && floatval($value) < $rules['min']) {
                $errors[] = "Campo '$field' deve essere almeno {$rules['min']}";
            }
            
            // Valori consentiti (enum)
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) {
                $allowedValues = implode(', ', $rules['enum']);
                $errors[] = "Campo '$field' deve essere uno tra: $allowedValues";
            }
            
            // Formato data
            if (isset($rules['date']) && !$this->isValidDate($value)) {
                $errors[] = "Campo '$field' deve essere una data valida (formato YYYY-MM-DD)";
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Genera nuovo ID task
     */
    protected function generateId() {
        try {
            $sql = "SELECT ID_TASK FROM {$this->table} WHERE ID_TASK LIKE 'TAS%' ORDER BY ID_TASK DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 3)) + 1;
            } else {
                $number = 1;
            }
            
            return 'TAS' . str_pad($number, 5, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'TAS' . str_pad(rand(1, 99999), 5, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        if (isset($data['Task'])) {
            $data['Task'] = trim($data['Task']);
        }
        
        if (isset($data['Desc_Task'])) {
            $data['Desc_Task'] = trim($data['Desc_Task']);
        }
        
        if (!isset($data['Tipo']) || empty($data['Tipo'])) {
            $data['Tipo'] = 'Campo';
        }
        
        if (!isset($data['Stato_Task']) || empty($data['Stato_Task'])) {
            $data['Stato_Task'] = 'In corso';
        }
        
        if (!isset($data['Spese_Comprese']) || empty($data['Spese_Comprese'])) {
            $data['Spese_Comprese'] = 'No';
        }
        
        if (isset($data['Data_Apertura_Task']) && !empty($data['Data_Apertura_Task'])) {
            $data['Data_Apertura_Task'] = date('Y-m-d', strtotime($data['Data_Apertura_Task']));
        }
        
        if (isset($data['Spese_Comprese']) && $data['Spese_Comprese'] === 'Si') {
            $data['Valore_Spese_std'] = null;
        }
        
        return $data;
    }
    
    /**
     * Utility functions
     */
    private function isValidDate($date) {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
}
?>