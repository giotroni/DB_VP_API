<?php
/**
 * TariffeAPI - Gestione CRUD per la tabella ANA_TARIFFE_COLLABORATORI
 */

require_once 'BaseAPI.php';

class TariffeAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('ANA_TARIFFE_COLLABORATORI', 'ID_TARIFFA');
        
        $this->requiredFields = ['ID_COLLABORATORE', 'Tariffa_gg', 'Dal'];
        $this->validationRules = [
            'ID_TARIFFA' => ['max_length' => 50],
            'ID_COLLABORATORE' => ['required' => true, 'max_length' => 50],
            'ID_COMMESSA' => ['max_length' => 50],
            'Tariffa_gg' => ['required' => true, 'numeric' => true, 'min' => 0],
            'Spese_comprese' => ['enum' => ['Si', 'No']],
            'Dal' => ['required' => true, 'date' => true]
        ];
    }
    
    /**
     * Validazione input per tariffe
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
        
        // Verifica che il collaboratore esista
        if (isset($data['ID_COLLABORATORE']) && !empty($data['ID_COLLABORATORE'])) {
            if (!$this->existsInTable('ANA_COLLABORATORI', 'ID_COLLABORATORE', $data['ID_COLLABORATORE'])) {
                $errors[] = "Collaboratore specificato non esistente";
            }
        }
        
        // Verifica che la commessa esista se specificata
        if (isset($data['ID_COMMESSA']) && !empty($data['ID_COMMESSA'])) {
            if (!$this->existsInTable('ANA_COMMESSE', 'ID_COMMESSA', $data['ID_COMMESSA'])) {
                $errors[] = "Commessa specificata non esistente";
            }
        }
        
        // Verifica sovrapposizione date per stesso collaboratore/commessa
        if (isset($data['ID_COLLABORATORE'], $data['Dal'])) {
            $overlap = $this->checkDateOverlap($data);
            if (!$overlap['valid']) {
                $errors[] = $overlap['message'];
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Verifica sovrapposizione di date per tariffe
     */
    private function checkDateOverlap($data) {
        try {
            $sql = "SELECT COUNT(*) as count FROM {$this->table} 
                    WHERE ID_COLLABORATORE = :collaboratore 
                    AND Dal <= :dal";
            
            $params = [
                ':collaboratore' => $data['ID_COLLABORATORE'],
                ':dal' => $data['Dal']
            ];
            
            // Se è specificata una commessa, verifica solo per quella commessa
            if (!empty($data['ID_COMMESSA'])) {
                $sql .= " AND (ID_COMMESSA = :commessa OR ID_COMMESSA IS NULL)";
                $params[':commessa'] = $data['ID_COMMESSA'];
            } else {
                // Se non è specificata una commessa, verifica solo tariffe generali
                $sql .= " AND ID_COMMESSA IS NULL";
            }
            
            // Esclude il record corrente se è un aggiornamento
            if (isset($data['ID_TARIFFA'])) {
                $sql .= " AND ID_TARIFFA != :current_id";
                $params[':current_id'] = $data['ID_TARIFFA'];
            }
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->fetchColumn();
            
            if ($count > 0) {
                return [
                    'valid' => false,
                    'message' => 'Esiste già una tariffa per questo collaboratore/commessa alla data specificata'
                ];
            }
            
            return ['valid' => true, 'message' => ''];
            
        } catch (PDOException $e) {
            return [
                'valid' => false,
                'message' => 'Errore durante la verifica delle date'
            ];
        }
    }
    
    /**
     * Genera nuovo ID tariffa
     */
    protected function generateId() {
        try {
            // Trova il prossimo numero disponibile
            $sql = "SELECT ID_TARIFFA FROM {$this->table} WHERE ID_TARIFFA LIKE 'TAR%' ORDER BY ID_TARIFFA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 3)) + 1;
            } else {
                $number = 1;
            }
            
            return 'TAR' . str_pad($number, 5, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'TAR' . str_pad(rand(1, 99999), 5, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // Imposta valore predefinito per spese comprese
        if (!isset($data['Spese_comprese']) || empty($data['Spese_comprese'])) {
            $data['Spese_comprese'] = 'No';
        }
        
        // Valida e formatta la data
        if (isset($data['Dal']) && !empty($data['Dal'])) {
            $data['Dal'] = date('Y-m-d', strtotime($data['Dal']));
        }
        
        // Se ID_COMMESSA è vuoto, impostalo a null
        if (isset($data['ID_COMMESSA']) && empty($data['ID_COMMESSA'])) {
            $data['ID_COMMESSA'] = null;
        }
        
        return $data;
    }
    
    /**
     * Costruisce clausola WHERE per filtri
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per collaboratore
        if (isset($_GET['collaboratore']) && !empty($_GET['collaboratore'])) {
            $conditions[] = "ID_COLLABORATORE = :collaboratore";
            $params[':collaboratore'] = $_GET['collaboratore'];
        }
        
        // Filtro per commessa
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            if ($_GET['commessa'] === 'null' || $_GET['commessa'] === 'generale') {
                $conditions[] = "ID_COMMESSA IS NULL";
            } else {
                $conditions[] = "ID_COMMESSA = :commessa";
                $params[':commessa'] = $_GET['commessa'];
            }
        }
        
        // Filtro per spese comprese
        if (isset($_GET['spese_comprese']) && !empty($_GET['spese_comprese'])) {
            $conditions[] = "Spese_comprese = :spese_comprese";
            $params[':spese_comprese'] = $_GET['spese_comprese'];
        }
        
        // Filtro per data (da)
        if (isset($_GET['data_da']) && !empty($_GET['data_da'])) {
            $conditions[] = "Dal >= :data_da";
            $params[':data_da'] = $_GET['data_da'];
        }
        
        // Filtro per data (a)
        if (isset($_GET['data_a']) && !empty($_GET['data_a'])) {
            $conditions[] = "Dal <= :data_a";
            $params[':data_a'] = $_GET['data_a'];
        }
        
        // Filtro per range tariffa
        if (isset($_GET['tariffa_min']) && !empty($_GET['tariffa_min'])) {
            $conditions[] = "Tariffa_gg >= :tariffa_min";
            $params[':tariffa_min'] = floatval($_GET['tariffa_min']);
        }
        
        if (isset($_GET['tariffa_max']) && !empty($_GET['tariffa_max'])) {
            $conditions[] = "Tariffa_gg <= :tariffa_max";
            $params[':tariffa_max'] = floatval($_GET['tariffa_max']);
        }
        
        // Filtro per tariffe attive alla data odierna
        if (isset($_GET['attive']) && $_GET['attive'] === 'true') {
            $conditions[] = "Dal <= CURDATE()";
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_TARIFFA', 'ID_COLLABORATORE', 'ID_COMMESSA', 'Tariffa_gg', 'Dal', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Dal';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Dal';
        }
        
        return "$sortField $sortOrder, ID_COLLABORATORE ASC";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se ci sono giornate registrate che utilizzano questa tariffa
            // (controllo indiretto tramite collaboratore e date)
            $sql = "SELECT t.ID_COLLABORATORE, t.Dal, COUNT(g.ID_GIORNATA) as count
                    FROM {$this->table} t
                    LEFT JOIN FACT_GIORNATE g ON g.ID_COLLABORATORE = t.ID_COLLABORATORE 
                                                 AND g.Data >= t.Dal
                    WHERE t.ID_TARIFFA = :id
                    GROUP BY t.ID_COLLABORATORE, t.Dal";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result && $result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: potrebbero esistere giornate che fanno riferimento a questa tariffa'
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
            // Aggiungi informazioni collaboratore
            if (!empty($record['ID_COLLABORATORE'])) {
                $collabInfo = $this->getRelatedData('ANA_COLLABORATORI', 'ID_COLLABORATORE', $record['ID_COLLABORATORE'], ['Collaboratore', 'Email']);
                $record['collaboratore_info'] = $collabInfo;
            }
            
            // Aggiungi informazioni commessa se presente
            if (!empty($record['ID_COMMESSA'])) {
                $commessaInfo = $this->getRelatedData('ANA_COMMESSE', 'ID_COMMESSA', $record['ID_COMMESSA'], ['Commessa', 'Tipo_Commessa']);
                $record['commessa_info'] = $commessaInfo;
            } else {
                $record['commessa_info'] = ['tipo' => 'Tariffa generale'];
            }
            
            // Aggiungi informazioni sulla validità della tariffa
            $record['is_active'] = $record['Dal'] <= date('Y-m-d');
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Metodi aggiuntivi specifici per le tariffe
     */
    
    /**
     * Recupera la tariffa attiva per un collaboratore/commessa alla data specificata
     */
    public function getTariffaAttiva($collaboratoreId, $data, $commessaId = null) {
        try {
            $sql = "SELECT * FROM {$this->table} 
                    WHERE ID_COLLABORATORE = :collaboratore 
                    AND Dal <= :data";
            
            $params = [
                ':collaboratore' => $collaboratoreId,
                ':data' => $data
            ];
            
            if ($commessaId) {
                $sql .= " AND (ID_COMMESSA = :commessa OR ID_COMMESSA IS NULL)
                         ORDER BY ID_COMMESSA DESC, Dal DESC"; // Preferisce tariffe specifiche per commessa
                $params[':commessa'] = $commessaId;
            } else {
                $sql .= " AND ID_COMMESSA IS NULL ORDER BY Dal DESC";
            }
            
            $sql .= " LIMIT 1";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            return $stmt->fetch();
            
        } catch (PDOException $e) {
            return null;
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