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
            // Determina i filtri periodo attivi
            $filtriPeriodo = $this->getFiltriPeriodo();
            
            // Aggiungi giorni effettuati (totali e filtrati)
            $record['gg_effettuate'] = $this->getGiorniEffettuati($record['ID_TASK']);
            
            if ($filtriPeriodo['attivo']) {
                $record['gg_effettuate_filtrate'] = $this->getGiorniEffettuatiFiltrati($record['ID_TASK'], $filtriPeriodo);
            }
            
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
            
            // Calcola valori maturati del task (totali)
            $valoriMaturati = $this->calcolaValoriMaturati($record['ID_TASK'], $record);
            $record['valore_gg_maturato'] = $valoriMaturati['valore_gg'];
            $record['valore_spese_maturato'] = $valoriMaturati['valore_spese'];
            $record['valore_tot_maturato'] = $valoriMaturati['valore_tot'];
            
            // Calcola valori maturati filtrati per periodo se necessario
            if ($filtriPeriodo['attivo']) {
                $valoriMaturatiFiltrati = $this->calcolaValoriMaturatiFiltrati($record['ID_TASK'], $record, $filtriPeriodo);
                $record['valore_gg_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_gg'];
                $record['valore_spese_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_spese'];
                $record['valore_tot_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_tot'];
            }
            
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
     * Determina i filtri periodo attivi
     */
    private function getFiltriPeriodo() {
        $filtri = ['attivo' => false];
        
        if (isset($_GET['anno_mese']) && !empty($_GET['anno_mese'])) {
            if (preg_match('/^\d{4}-\d{2}$/', $_GET['anno_mese'])) {
                $filtri['attivo'] = true;
                $filtri['tipo'] = 'anno_mese';
                $filtri['valore'] = $_GET['anno_mese'];
            }
        } elseif (isset($_GET['anno']) && !empty($_GET['anno'])) {
            if (preg_match('/^\d{4}$/', $_GET['anno'])) {
                $filtri['attivo'] = true;
                $filtri['tipo'] = 'anno';
                $filtri['valore'] = $_GET['anno'];
            }
        }
        
        return $filtri;
    }
    
    /**
     * Calcola giorni effettuati filtrati per periodo
     */
    private function getGiorniEffettuatiFiltrati($taskId, $filtriPeriodo) {
        try {
            $whereClause = '';
            $params = [':id' => $taskId];
            
            if ($filtriPeriodo['tipo'] === 'anno_mese') {
                $whereClause = "AND DATE_FORMAT(Data, '%Y-%m') = :periodo";
                $params[':periodo'] = $filtriPeriodo['valore'];
            } elseif ($filtriPeriodo['tipo'] === 'anno') {
                $whereClause = "AND YEAR(Data) = :anno";
                $params[':anno'] = $filtriPeriodo['valore'];
            }
            
            $sql = "SELECT SUM(CAST(REPLACE(gg, ',', '.') AS DECIMAL(10,2))) as total 
                    FROM FACT_GIORNATE 
                    WHERE ID_TASK = :id {$whereClause}";
            
            $stmt = $this->db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $result = $stmt->fetchColumn();
            
            return floatval($result) ?: 0;
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Calcola valori maturati filtrati per periodo
     */
    private function calcolaValoriMaturatiFiltrati($taskId, $taskData, $filtriPeriodo) {
        try {
            $valoreGg = $this->calcolaValoreGgFiltrato($taskId, $taskData, $filtriPeriodo);
            $valoreSpese = $this->calcolaValoreSpeseFilrato($taskId, $taskData, $filtriPeriodo);
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
     * Calcola valore per task di monitoraggio
     * Formula: Prezzo/gg del task di monitoraggio × Giornate effettuate negli altri task della commessa
     */
    private function calcolaValoreMonitoraggio($taskId, $taskData) {
        try {
            $prezzoGgMonitoraggio = floatval($taskData['Valore_gg'] ?? 0);
            if ($prezzoGgMonitoraggio <= 0) {
                return 0;
            }
            
            // Calcola il totale del valore delle giornate effettuate negli altri task della stessa commessa
            $sql = "SELECT SUM(CAST(REPLACE(g.gg, ',', '.') AS DECIMAL(10,2)) * CAST(REPLACE(t.Valore_gg, ',', '.') AS DECIMAL(10,2))) as totale_valore_commessa
                    FROM FACT_GIORNATE g
                    JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    WHERE t.ID_COMMESSA = :commessa_id 
                      AND t.ID_TASK != :task_id_monitoraggio
                      AND g.Tipo = 'Campo'";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':commessa_id', $taskData['ID_COMMESSA']);
            $stmt->bindValue(':task_id_monitoraggio', $taskId);
            $stmt->execute();
            
            $totaleValoreCommessa = floatval($stmt->fetchColumn()) ?: 0;
            
            return $prezzoGgMonitoraggio * $totaleValoreCommessa;
            
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Calcola valore per task di monitoraggio filtrato per periodo
     */
    private function calcolaValoreMonitoraggioFiltrato($taskId, $taskData, $filtriPeriodo) {
        try {
            $prezzoGgMonitoraggio = floatval($taskData['Valore_gg'] ?? 0);
            if ($prezzoGgMonitoraggio <= 0) {
                return 0;
            }
            
            // Costruisci WHERE clause per il filtro periodo
            $whereClause = '';
            $params = [
                ':commessa_id' => $taskData['ID_COMMESSA'],
                ':task_id_monitoraggio' => $taskId
            ];
            
            if ($filtriPeriodo['tipo'] === 'anno_mese') {
                $whereClause = "AND DATE_FORMAT(g.Data, '%Y-%m') = :periodo";
                $params[':periodo'] = $filtriPeriodo['valore'];
            } elseif ($filtriPeriodo['tipo'] === 'anno') {
                $whereClause = "AND YEAR(g.Data) = :anno";
                $params[':anno'] = $filtriPeriodo['valore'];
            }
            
            // Calcola il totale del valore delle giornate effettuate negli altri task della stessa commessa nel periodo
            $sql = "SELECT SUM(CAST(REPLACE(g.gg, ',', '.') AS DECIMAL(10,2)) * CAST(REPLACE(t.Valore_gg, ',', '.') AS DECIMAL(10,2))) as totale_valore_commessa
                    FROM FACT_GIORNATE g
                    JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    WHERE t.ID_COMMESSA = :commessa_id 
                      AND t.ID_TASK != :task_id_monitoraggio
                      AND g.Tipo = 'Campo'
                      {$whereClause}";
            
            $stmt = $this->db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            
            $totaleValoreCommessa = floatval($stmt->fetchColumn()) ?: 0;
            
            return $prezzoGgMonitoraggio * $totaleValoreCommessa;
            
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Calcola Valore_gg filtrato per periodo
     */
    private function calcolaValoreGgFiltrato($taskId, $taskData, $filtriPeriodo) {
        try {
            // Gestione speciale per task di monitoraggio
            if (isset($taskData['Tipo']) && $taskData['Tipo'] === 'Monitoraggio') {
                return $this->calcolaValoreMonitoraggioFiltrato($taskId, $taskData, $filtriPeriodo);
            }
            
            $whereClause = '';
            $params = [':task_id' => $taskId];
            
            if ($filtriPeriodo['tipo'] === 'anno_mese') {
                $whereClause = "AND DATE_FORMAT(g.Data, '%Y-%m') = :periodo";
                $params[':periodo'] = $filtriPeriodo['valore'];
            } elseif ($filtriPeriodo['tipo'] === 'anno') {
                $whereClause = "AND YEAR(g.Data) = :anno";
                $params[':anno'] = $filtriPeriodo['valore'];
            }
            
            // Calcola basandosi sul Valore_gg del task (prezzo fisso)
            $prezzoGg = floatval($taskData['Valore_gg'] ?? 0);
            if ($prezzoGg > 0) {
                $sql = "SELECT SUM(CAST(REPLACE(g.gg, ',', '.') AS DECIMAL(10,2))) as total
                        FROM FACT_GIORNATE g
                        WHERE g.ID_TASK = :task_id 
                          AND g.Tipo = 'Campo'
                          {$whereClause}";
                
                $stmt = $this->db->prepare($sql);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
                $stmt->execute();
                $totaleGg = floatval($stmt->fetchColumn()) ?: 0;
                
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
                      {$whereClause}
                    ORDER BY t.ID_COMMESSA DESC, t.Dal DESC";
            
            $params[':commessa_id'] = $taskData['ID_COMMESSA'];
            $stmt = $this->db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
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
     * Calcola Valore_Spese filtrato per periodo
     */
    private function calcolaValoreSpeseFilrato($taskId, $taskData, $filtriPeriodo) {
        try {
            // Se Spese_Comprese = 'Si', il valore spese è sempre 0
            if (isset($taskData['Spese_Comprese']) && $taskData['Spese_Comprese'] === 'Si') {
                return 0;
            }
            
            // Se Spese_Comprese = 'No', verifica se ci sono spese standard
            $speseStandard = floatval($taskData['Valore_Spese_std'] ?? 0);
            
            if ($speseStandard > 0) {
                // Per le spese standard, se c'è un filtro periodo, restituisce spese standard
                // solo se ci sono giornate nel periodo, altrimenti 0
                $giornateFilrate = $this->getGiorniEffettuatiFiltrati($taskId, $filtriPeriodo);
                return $giornateFilrate > 0 ? $speseStandard : 0;
            } else {
                // Somma le spese dalle giornate del task filtrate per periodo
                $whereClause = '';
                $params = [':task_id' => $taskId];
                
                if ($filtriPeriodo['tipo'] === 'anno_mese') {
                    $whereClause = "AND DATE_FORMAT(Data, '%Y-%m') = :periodo";
                    $params[':periodo'] = $filtriPeriodo['valore'];
                } elseif ($filtriPeriodo['tipo'] === 'anno') {
                    $whereClause = "AND YEAR(Data) = :anno";
                    $params[':anno'] = $filtriPeriodo['valore'];
                }
                
                $sql = "SELECT SUM(
                           COALESCE(CAST(REPLACE(Spese_Viaggi, ',', '.') AS DECIMAL(10,2)), 0) +
                           COALESCE(CAST(REPLACE(Vitto_alloggio, ',', '.') AS DECIMAL(10,2)), 0) +
                           COALESCE(CAST(REPLACE(Altri_costi, ',', '.') AS DECIMAL(10,2)), 0)
                       ) as totale_spese
                        FROM FACT_GIORNATE 
                        WHERE ID_TASK = :task_id {$whereClause}";
                
                $stmt = $this->db->prepare($sql);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
                $stmt->execute();
                $totaleSpese = $stmt->fetchColumn();
                
                return floatval($totaleSpese) ?: 0;
            }
        } catch (Exception $e) {
            return 0;
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
            // Gestione speciale per task di monitoraggio
            if (isset($taskData['Tipo']) && $taskData['Tipo'] === 'Monitoraggio') {
                return $this->calcolaValoreMonitoraggio($taskId, $taskData);
            }
            
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
     * Override buildWhereClause per aggiungere filtri personalizzati
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per commessa
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            $conditions[] = "ID_COMMESSA = :commessa";
            $params[':commessa'] = $_GET['commessa'];
        }
        
        // Filtro per stato
        if (isset($_GET['stato']) && !empty($_GET['stato'])) {
            $conditions[] = "Stato_Task = :stato";
            $params[':stato'] = $_GET['stato'];
        }
        
        // Filtro per tipo
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "Tipo = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per collaboratore
        if (isset($_GET['collaboratore']) && !empty($_GET['collaboratore'])) {
            $conditions[] = "ID_COLLABORATORE = :collaboratore";
            $params[':collaboratore'] = $_GET['collaboratore'];
        }
        
        // Filtro per anno-mese basato su FACT_GIORNATE
        if (isset($_GET['anno_mese']) && !empty($_GET['anno_mese'])) {
            $annoMese = $_GET['anno_mese'];
            
            // Valida il formato YYYY-MM
            if (preg_match('/^\d{4}-\d{2}$/', $annoMese)) {
                $conditions[] = "(
                    ID_TASK IN (
                        SELECT DISTINCT ID_TASK 
                        FROM FACT_GIORNATE 
                        WHERE DATE_FORMAT(Data, '%Y-%m') = :anno_mese
                    )
                    OR 
                    (Tipo = 'Monitoraggio' AND ID_COMMESSA IN (
                        SELECT DISTINCT t.ID_COMMESSA 
                        FROM ANA_TASK t
                        JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
                        WHERE DATE_FORMAT(g.Data, '%Y-%m') = :anno_mese_monitoring
                    ))
                )";
                $params[':anno_mese'] = $annoMese;
                $params[':anno_mese_monitoring'] = $annoMese;
            }
        }
        
        // Filtro per solo anno basato su FACT_GIORNATE
        if (isset($_GET['anno']) && !empty($_GET['anno'])) {
            $anno = $_GET['anno'];
            
            // Valida il formato YYYY
            if (preg_match('/^\d{4}$/', $anno)) {
                $conditions[] = "(
                    ID_TASK IN (
                        SELECT DISTINCT ID_TASK 
                        FROM FACT_GIORNATE 
                        WHERE YEAR(Data) = :anno
                    )
                    OR 
                    (Tipo = 'Monitoraggio' AND ID_COMMESSA IN (
                        SELECT DISTINCT t.ID_COMMESSA 
                        FROM ANA_TASK t
                        JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
                        WHERE YEAR(g.Data) = :anno_monitoring
                    ))
                )";
                $params[':anno'] = $anno;
                $params[':anno_monitoring'] = $anno;
            }
        }
        
        // Filtro per range di date delle giornate (usato internamente dal JavaScript)
        if (isset($_GET['start_date']) && isset($_GET['end_date'])) {
            $startDate = $_GET['start_date'];
            $endDate = $_GET['end_date'];
            
            // Valida le date
            if ($this->isValidDate($startDate) && $this->isValidDate($endDate)) {
                $conditions[] = "(
                    ID_TASK IN (
                        SELECT DISTINCT ID_TASK 
                        FROM FACT_GIORNATE 
                        WHERE Data BETWEEN :start_date AND :end_date
                    )
                    OR 
                    (Tipo = 'Monitoraggio' AND ID_COMMESSA IN (
                        SELECT DISTINCT t.ID_COMMESSA 
                        FROM ANA_TASK t
                        JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
                        WHERE g.Data BETWEEN :start_date_monitoring AND :end_date_monitoring
                    ))
                )";
                $params[':start_date'] = $startDate;
                $params[':end_date'] = $endDate;
                $params[':start_date_monitoring'] = $startDate;
                $params[':end_date_monitoring'] = $endDate;
            }
        }
        
        // Filtro per ricerca testuale
        if (isset($_GET['search']) && !empty($_GET['search'])) {
            $search = '%' . $_GET['search'] . '%';
            $conditions[] = "(Task LIKE :search OR Desc_Task LIKE :search)";
            $params[':search'] = $search;
        }
        
        return implode(' AND ', $conditions);
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