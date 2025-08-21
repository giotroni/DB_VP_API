<?php
/**
 * CommesseAPI - Gestione CRUD per la tabella ANA_COMMESSE
 */

require_once 'BaseAPI.php';

class CommesseAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('ANA_COMMESSE', 'ID_COMMESSA');
        
        $this->requiredFields = ['Commessa', 'Tipo_Commessa'];
        $this->validationRules = [
            'ID_COMMESSA' => ['max_length' => 50],
            'Commessa' => ['required' => true, 'max_length' => 255],
            'Desc_Commessa' => ['max_length' => 65535],
            'Tipo_Commessa' => ['required' => true, 'enum' => ['Cliente', 'Interna']],
            'ID_CLIENTE' => ['max_length' => 50],
            'Commissione' => ['numeric' => true, 'min' => 0, 'max' => 1],
            'ID_COLLABORATORE' => ['max_length' => 50],
            'Data_Apertura_Commessa' => ['date' => true],
            'Stato_Commessa' => ['enum' => ['In corso', 'Sospesa', 'Chiusa', 'Archiviata']],
            'Documento_Offerta' => ['max_length' => 500],
            'Documento_Ordine' => ['max_length' => 500]
        ];
    }
    
    /**
     * Validazione input per commesse
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
            if (!isset($this->validationRules[$field]) || empty($value)) {
                continue;
            }
            
            $rules = $this->validationRules[$field];
            
            // Verifica lunghezza massima
            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']} caratteri)";
            }
            
            // Verifica enum
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) {
                $errors[] = "Valore '$field' non valido. Valori consentiti: " . implode(', ', $rules['enum']);
            }
            
            // Verifica numerico
            if (isset($rules['numeric']) && !is_numeric($value)) {
                $errors[] = "Campo '$field' deve essere numerico";
            }
            
            // Verifica range numerico
            if (isset($rules['min']) && floatval($value) < $rules['min']) {
                $errors[] = "Campo '$field' deve essere >= {$rules['min']}";
            }
            
            if (isset($rules['max']) && floatval($value) > $rules['max']) {
                $errors[] = "Campo '$field' deve essere <= {$rules['max']}";
            }
            
            // Verifica data
            if (isset($rules['date']) && !$this->isValidDate($value)) {
                $errors[] = "Formato data '$field' non valido (YYYY-MM-DD)";
            }
        }
        
        // Validazioni business logic
        $businessValidation = $this->validateBusinessRules($data);
        if (!$businessValidation['valid']) {
            $errors = array_merge($errors, $businessValidation['errors']);
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Validazioni business logic specifiche
     */
    private function validateBusinessRules($data) {
        $errors = [];
        
        // Se tipo è "Cliente", deve avere un cliente associato
        if (isset($data['Tipo_Commessa']) && $data['Tipo_Commessa'] === 'Cliente') {
            if (!isset($data['ID_CLIENTE']) || empty($data['ID_CLIENTE'])) {
                $errors[] = "Commesse di tipo 'Cliente' devono avere un cliente associato";
            } else {
                // Verifica che il cliente esista
                if (!$this->existsInTable('ANA_CLIENTI', 'ID_CLIENTE', $data['ID_CLIENTE'])) {
                    $errors[] = "Cliente specificato non esistente";
                }
            }
        }
        
        // Se tipo è "Interna", non deve avere cliente
        if (isset($data['Tipo_Commessa']) && $data['Tipo_Commessa'] === 'Interna') {
            if (isset($data['ID_CLIENTE']) && !empty($data['ID_CLIENTE'])) {
                $errors[] = "Commesse di tipo 'Interna' non possono avere un cliente associato";
            }
        }
        
        // Verifica che il collaboratore esista se specificato
        if (isset($data['ID_COLLABORATORE']) && !empty($data['ID_COLLABORATORE'])) {
            if (!$this->existsInTable('ANA_COLLABORATORI', 'ID_COLLABORATORE', $data['ID_COLLABORATORE'])) {
                $errors[] = "Collaboratore specificato non esistente";
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Genera nuovo ID commessa
     */
    protected function generateId() {
        try {
            // Trova il prossimo numero disponibile
            $sql = "SELECT ID_COMMESSA FROM {$this->table} WHERE ID_COMMESSA LIKE 'COM%' ORDER BY ID_COMMESSA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 3)) + 1;
            } else {
                $number = 1;
            }
            
            return 'COM' . str_pad($number, 4, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'COM' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // Normalizza i dati
        if (isset($data['Commessa'])) {
            $data['Commessa'] = trim($data['Commessa']);
        }
        
        if (isset($data['Desc_Commessa'])) {
            $data['Desc_Commessa'] = trim($data['Desc_Commessa']);
        }
        
        // Imposta stato predefinito se non specificato
        if (!isset($data['Stato_Commessa']) || empty($data['Stato_Commessa'])) {
            $data['Stato_Commessa'] = 'In corso';
        }
        
        // Imposta commissione a 0 se non specificata
        if (!isset($data['Commissione']) || empty($data['Commissione'])) {
            $data['Commissione'] = 0;
        }
        
        // Se tipo è "Interna", rimuovi ID_CLIENTE
        if (isset($data['Tipo_Commessa']) && $data['Tipo_Commessa'] === 'Interna') {
            $data['ID_CLIENTE'] = null;
        }
        
        // Valida e formatta la data
        if (isset($data['Data_Apertura_Commessa']) && !empty($data['Data_Apertura_Commessa'])) {
            $data['Data_Apertura_Commessa'] = date('Y-m-d', strtotime($data['Data_Apertura_Commessa']));
        }
        
        return $data;
    }
    
    /**
     * Override getAll per includere il nome del cliente direttamente
     */
    protected function getAll() {
        try {
            $params = [];
            $whereClause = $this->buildWhereClause($params);
            $orderBy = $this->getOrderBy();
            
            // Query con JOIN per includere il nome del cliente
            $sql = "
                SELECT c.*, cl.Cliente as Cliente
                FROM {$this->table} c
                LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
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
            $total = $this->getTotalCountCommesse($whereClause, $params);
            
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
     * Conta il totale delle commesse per la paginazione
     */
    private function getTotalCountCommesse($whereClause, $params) {
        try {
            $sql = "SELECT COUNT(*) as total FROM {$this->table} c";
            
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
     * Costruisce clausola WHERE per filtri
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per nome commessa
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            $conditions[] = "Commessa LIKE :commessa";
            $params[':commessa'] = '%' . $_GET['commessa'] . '%';
        }
        
        // Filtro per tipo commessa
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "Tipo_Commessa = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per cliente
        if (isset($_GET['cliente']) && !empty($_GET['cliente'])) {
            $conditions[] = "ID_CLIENTE = :cliente";
            $params[':cliente'] = $_GET['cliente'];
        }
        
        // Filtro per collaboratore
        if (isset($_GET['collaboratore']) && !empty($_GET['collaboratore'])) {
            $conditions[] = "ID_COLLABORATORE = :collaboratore";
            $params[':collaboratore'] = $_GET['collaboratore'];
        }
        
        // Filtro per stato
        if (isset($_GET['stato']) && !empty($_GET['stato'])) {
            $conditions[] = "Stato_Commessa = :stato";
            $params[':stato'] = $_GET['stato'];
        }
        
        // Filtro per data apertura (da)
        if (isset($_GET['data_da']) && !empty($_GET['data_da'])) {
            $conditions[] = "Data_Apertura_Commessa >= :data_da";
            $params[':data_da'] = $_GET['data_da'];
        }
        
        // Filtro per data apertura (a)
        if (isset($_GET['data_a']) && !empty($_GET['data_a'])) {
            $conditions[] = "Data_Apertura_Commessa <= :data_a";
            $params[':data_a'] = $_GET['data_a'];
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_COMMESSA', 'Commessa', 'Tipo_Commessa', 'Stato_Commessa', 'Data_Apertura_Commessa', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Data_Apertura_Commessa';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Data_Apertura_Commessa';
        }
        
        return "$sortField $sortOrder";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se la commessa ha task associati
            $sql = "SELECT COUNT(*) as count FROM ANA_TASK WHERE ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: commessa ha task associati'
                ];
            }
            
            // Verifica se la commessa ha fatture associate
            $sql = "SELECT COUNT(*) as count FROM FACT_FATTURE WHERE ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: commessa ha fatture associate'
                ];
            }
            
            // Verifica se la commessa ha tariffe associate
            $sql = "SELECT COUNT(*) as count FROM ANA_TARIFFE_COLLABORATORI WHERE ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: commessa ha tariffe associate'
                ];
            }
            
            return ['canDelete' => true, 'message' => ''];
            
        } catch (PDOException $e) {
            return [
                'canDelete' => false,
                'message' => 'Errore durante la verifica dei vincoli'
            ];
        }
    }
    
    /**
     * Post-processing del record (aggiunge dati correlati)
     */
    protected function processRecord($record) {
        try {
            // Aggiungi informazioni cliente se presente
            if (!empty($record['ID_CLIENTE'])) {
                $clientInfo = $this->getRelatedData('ANA_CLIENTI', 'ID_CLIENTE', $record['ID_CLIENTE'], ['Cliente']);
                $record['cliente_info'] = $clientInfo;
            }
            
            // Aggiungi informazioni collaboratore se presente
            if (!empty($record['ID_COLLABORATORE'])) {
                $collabInfo = $this->getRelatedData('ANA_COLLABORATORI', 'ID_COLLABORATORE', $record['ID_COLLABORATORE'], ['Collaboratore', 'Email']);
                $record['collaboratore_info'] = $collabInfo;
            }
            
            // Aggiungi statistiche commessa
            $stats = $this->getCommessaStats($record['ID_COMMESSA']);
            $record['statistics'] = $stats;
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Recupera statistiche commessa
     */
    private function getCommessaStats($commessaId) {
        try {
            $stats = [];
            
            // Numero task
            $sql = "SELECT COUNT(*) as count FROM ANA_TASK WHERE ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $stats['task_totali'] = $stmt->fetchColumn();
            
            // Task attivi
            $sql = "SELECT COUNT(*) as count FROM ANA_TASK WHERE ID_COMMESSA = :id AND Stato_Task = 'In corso'";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $stats['task_attivi'] = $stmt->fetchColumn();
            
            // Giornate lavorate
            $sql = "SELECT SUM(g.gg) as total 
                    FROM FACT_GIORNATE g 
                    JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK 
                    WHERE t.ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $stats['giornate_lavorate'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Fatturato totale
            $sql = "SELECT SUM(Fatturato_TOT) as total FROM FACT_FATTURE WHERE ID_COMMESSA = :id AND TIPO = 'Fattura'";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $stats['fatturato_totale'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Ultima attività
            $sql = "SELECT MAX(g.Data) as ultima_data 
                    FROM FACT_GIORNATE g 
                    JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK 
                    WHERE t.ID_COMMESSA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $stats['ultima_attivita'] = $stmt->fetchColumn();
            
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