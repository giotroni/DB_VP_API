<?php
/**
 * TaskAPI - Gestione CRUD per la tabella ANA_TASK
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
        
        // Verifica che la commessa esista
        if (isset($data['ID_COMMESSA']) && !empty($data['ID_COMMESSA'])) {
            if (!$this->existsInTable('ANA_COMMESSE', 'ID_COMMESSA', $data['ID_COMMESSA'])) {
                $errors[] = "Commessa specificata non esistente";
            }
        }
        
        // Verifica che il collaboratore esista se specificato
        if (isset($data['ID_COLLABORATORE']) && !empty($data['ID_COLLABORATORE'])) {
            if (!$this->existsInTable('ANA_COLLABORATORI', 'ID_COLLABORATORE', $data['ID_COLLABORATORE'])) {
                $errors[] = "Collaboratore specificato non esistente";
            }
        }
        
        // Se spese non comprese, deve avere valore spese standard
        if (isset($data['Spese_Comprese']) && $data['Spese_Comprese'] === 'No') {
            if (!isset($data['Valore_Spese_std']) || empty($data['Valore_Spese_std']) || floatval($data['Valore_Spese_std']) <= 0) {
                $errors[] = "Se le spese non sono comprese, deve essere specificato il valore spese standard";
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
            // Trova il prossimo numero disponibile
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
        // Normalizza i dati
        if (isset($data['Task'])) {
            $data['Task'] = trim($data['Task']);
        }
        
        if (isset($data['Desc_Task'])) {
            $data['Desc_Task'] = trim($data['Desc_Task']);
        }
        
        // Imposta valori predefiniti
        if (!isset($data['Tipo']) || empty($data['Tipo'])) {
            $data['Tipo'] = 'Campo';
        }
        
        if (!isset($data['Stato_Task']) || empty($data['Stato_Task'])) {
            $data['Stato_Task'] = 'In corso';
        }
        
        if (!isset($data['Spese_Comprese']) || empty($data['Spese_Comprese'])) {
            $data['Spese_Comprese'] = 'No';
        }
        
        // Valida e formatta la data
        if (isset($data['Data_Apertura_Task']) && !empty($data['Data_Apertura_Task'])) {
            $data['Data_Apertura_Task'] = date('Y-m-d', strtotime($data['Data_Apertura_Task']));
        }
        
        // Se spese comprese, azzera valore spese standard
        if (isset($data['Spese_Comprese']) && $data['Spese_Comprese'] === 'Si') {
            $data['Valore_Spese_std'] = null;
        }
        
        return $data;
    }
    
    /**
     * Override getAll per includere i giorni effettuati calcolati
     */
    public function getAll() {
        try {
            $params = [];
            $whereClause = $this->buildWhereClause($params);
            $orderBy = $this->getOrderBy();
            
            // Query principale con JOIN per calcolare i giorni effettuati
            $sql = "
                SELECT t.*, 
                       COALESCE(g.gg_effettuate, 0) as gg_effettuate,
                       c.Commessa as commessa_nome,
                       c.Tipo_Commessa,
                       cl.Cliente as cliente_nome,
                       col.Collaboratore as collaboratore_nome
                FROM {$this->table} t
                LEFT JOIN (
                    SELECT ID_TASK, SUM(gg) as gg_effettuate 
                    FROM FACT_GIORNATE 
                    GROUP BY ID_TASK
                ) g ON t.ID_TASK = g.ID_TASK
                LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                LEFT JOIN ANA_COLLABORATORI col ON t.ID_COLLABORATORE = col.ID_COLLABORATORE
            ";
            
            if (!empty($whereClause)) {
                $sql .= " WHERE $whereClause";
            }
            
            $sql .= " ORDER BY $orderBy";
            
            // Paginazione
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;
            
            $sql .= " LIMIT $limit OFFSET $offset";
            
            $stmt = $this->db->prepare($sql);
            
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $stmt->execute();
            $records = $stmt->fetchAll();
            
            // Post-process ogni record
            $processedRecords = [];
            foreach ($records as $record) {
                $processedRecords[] = $this->processRecord($record);
            }
            
            // Conta totale per paginazione
            $total = $this->getTotalCount($whereClause, $params);
            
            return [
                'data' => $processedRecords,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ];
            
        } catch (PDOException $e) {
            throw new Exception("Errore nel recupero dei task: " . $e->getMessage());
        }
    }
    
    /**
     * Override getById per includere i giorni effettuati
     */
    public function getById($id) {
        try {
            $sql = "
                SELECT t.*, 
                       COALESCE(g.gg_effettuate, 0) as gg_effettuate,
                       c.Commessa as commessa_nome,
                       c.Tipo_Commessa,
                       cl.Cliente as cliente_nome,
                       col.Collaboratore as collaboratore_nome
                FROM {$this->table} t
                LEFT JOIN (
                    SELECT ID_TASK, SUM(gg) as gg_effettuate 
                    FROM FACT_GIORNATE 
                    GROUP BY ID_TASK
                ) g ON t.ID_TASK = g.ID_TASK
                LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                LEFT JOIN ANA_COLLABORATORI col ON t.ID_COLLABORATORE = col.ID_COLLABORATORE
                WHERE t.{$this->primaryKey} = :id
            ";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            
            $record = $stmt->fetch();
            if (!$record) {
                return null;
            }
            
            return $this->processRecord($record);
            
        } catch (PDOException $e) {
            throw new Exception("Errore nel recupero del task: " . $e->getMessage());
        }
    }
    
    /**
     * Conta il totale dei record per la paginazione
     */
    private function getTotalCount($whereClause, $params) {
        try {
            $sql = "SELECT COUNT(*) as total FROM {$this->table} t";
            
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
     * Post-processing di ogni record per aggiungere dati calcolati
     */
    protected function processRecord($record) {
        try {
            // Aggiungi statistiche task
            $stats = $this->getTaskStats($record['ID_TASK'], $record['gg_previste'] ?? null);
            $record['statistics'] = $stats;
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Recupera statistiche task
     */
    private function getTaskStats($taskId, $ggPreviste = null) {
        try {
            $stats = [];
            
            // Giornate lavorate
            $sql = "SELECT SUM(gg) as total FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $stats['giornate_lavorate'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Spese sostenute
            $sql = "SELECT SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi) as total FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $stats['spese_sostenute'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Prima giornata lavorata
            $sql = "SELECT MIN(Data) as prima_data FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $stats['prima_giornata'] = $stmt->fetchColumn();
            
            // Ultima giornata lavorata
            $sql = "SELECT MAX(Data) as ultima_data FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $stats['ultima_giornata'] = $stmt->fetchColumn();
            
            // Numero giorni lavorati (distinti)
            $sql = "SELECT COUNT(DISTINCT Data) as giorni FROM FACT_GIORNATE WHERE ID_TASK = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $taskId);
            $stmt->execute();
            $stats['giorni_lavorati'] = intval($stmt->fetchColumn()) ?: 0;
            
            // Calcola progresso se ci sono giornate previste
            if (!empty($ggPreviste) && $ggPreviste > 0) {
                $stats['progresso_percentuale'] = round(($stats['giornate_lavorate'] / $ggPreviste) * 100, 2);
            } else {
                $stats['progresso_percentuale'] = 0;
            }
            
            return $stats;
            
        } catch (PDOException $e) {
            return [];
        }
    }
    
    /**
     * Utility functions
     */
    private function isValidDate($date) {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    private function existsInTable($table, $field, $value) {
        try {
            $sql = "SELECT 1 FROM $table WHERE $field = :value LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':value', $value);
            $stmt->execute();
            return $stmt->fetchColumn() !== false;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    private function getRelatedData($table, $field, $value, $selectFields) {
        try {
            $fields = implode(', ', $selectFields);
            $sql = "SELECT $fields FROM $table WHERE $field = :value LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':value', $value);
            $stmt->execute();
            return $stmt->fetch();
        } catch (PDOException $e) {
            return null;
        }
    }
}
?>