<?php
/**
 * CollaboratoriAPI - Gestione CRUD per la tabella ANA_COLLABORATORI
 */

require_once 'BaseAPI.php';

class CollaboratoriAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('ANA_COLLABORATORI', 'ID_COLLABORATORE');
        
        $this->requiredFields = ['Collaboratore', 'Email'];
        $this->validationRules = [
            'ID_COLLABORATORE' => ['max_length' => 50],
            'Collaboratore' => ['required' => true, 'max_length' => 255],
            'Email' => ['required' => true, 'max_length' => 255, 'email' => true],
            'PWD' => ['min_length' => 6, 'max_length' => 255],
            'Ruolo' => ['enum' => ['Admin', 'Manager', 'User', 'Amministrazione']],
            'PIVA' => ['max_length' => 20, 'pattern' => '/^\d{11}$/']
        ];
    }
    
    /**
     * Validazione input per collaboratori
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
            
            // Verifica lunghezza minima
            if (isset($rules['min_length']) && strlen($value) < $rules['min_length']) {
                $errors[] = "Campo '$field' troppo corto (min {$rules['min_length']} caratteri)";
            }
            
            // Verifica email
            if (isset($rules['email']) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Email non valida";
            }
            
            // Verifica enum
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) {
                $errors[] = "Valore '$field' non valido. Valori consentiti: " . implode(', ', $rules['enum']);
            }
            
            // Verifica pattern
            if (isset($rules['pattern']) && !preg_match($rules['pattern'], $value)) {
                if ($field === 'PIVA') {
                    $errors[] = "P.IVA deve essere di 11 cifre";
                } else {
                    $errors[] = "Formato '$field' non valido";
                }
            }
        }
        
        // Validazione email univoca
        if (isset($data['Email']) && !empty($data['Email'])) {
            $checkEmail = $this->checkUniqueField('Email', $data['Email'], $data['ID_COLLABORATORE'] ?? null);
            if (!$checkEmail) {
                $errors[] = "Email già esistente";
            }
        }
        
        // Validazione P.IVA univoca se presente
        if (isset($data['PIVA']) && !empty($data['PIVA'])) {
            $checkPiva = $this->checkUniqueField('PIVA', $data['PIVA'], $data['ID_COLLABORATORE'] ?? null);
            if (!$checkPiva) {
                $errors[] = "P.IVA già esistente";
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Genera nuovo ID collaboratore
     */
    protected function generateId() {
        try {
            // Trova il prossimo numero disponibile
            $sql = "SELECT ID_COLLABORATORE FROM {$this->table} WHERE ID_COLLABORATORE LIKE 'CONS%' ORDER BY ID_COLLABORATORE DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 4)) + 1;
            } else {
                $number = 1;
            }
            
            return 'CONS' . str_pad($number, 3, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'CONS' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // Normalizza i dati
        if (isset($data['Collaboratore'])) {
            $data['Collaboratore'] = trim($data['Collaboratore']);
        }
        
        if (isset($data['Email'])) {
            $data['Email'] = strtolower(trim($data['Email']));
        }
        
        if (isset($data['PIVA'])) {
            $data['PIVA'] = preg_replace('/\D/', '', $data['PIVA']);
        }
        
        // Hash della password se presente
        if (isset($data['PWD']) && !empty($data['PWD'])) {
            // In produzione, utilizzare un hash più sicuro come password_hash()
            // Per ora manteniamo compatibilità con i dati esistenti
            $data['PWD'] = $data['PWD']; // Mantengo il valore così com'è per compatibilità
        }
        
        // Imposta ruolo predefinito se non specificato
        if (!isset($data['Ruolo']) || empty($data['Ruolo'])) {
            $data['Ruolo'] = 'User';
        }
        
        return $data;
    }
    
    /**
     * Costruisce clausola WHERE per filtri
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per nome collaboratore
        if (isset($_GET['collaboratore']) && !empty($_GET['collaboratore'])) {
            $conditions[] = "Collaboratore LIKE :collaboratore";
            $params[':collaboratore'] = '%' . $_GET['collaboratore'] . '%';
        }
        
        // Filtro per email
        if (isset($_GET['email']) && !empty($_GET['email'])) {
            $conditions[] = "Email LIKE :email";
            $params[':email'] = '%' . $_GET['email'] . '%';
        }
        
        // Filtro per ruolo
        if (isset($_GET['ruolo']) && !empty($_GET['ruolo'])) {
            $conditions[] = "Ruolo = :ruolo";
            $params[':ruolo'] = $_GET['ruolo'];
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_COLLABORATORE', 'Collaboratore', 'Email', 'Ruolo', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Collaboratore';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Collaboratore';
        }
        
        return "$sortField $sortOrder";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se il collaboratore ha commesse associate
            $sql = "SELECT COUNT(*) as count FROM ANA_COMMESSE WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: collaboratore ha commesse associate'
                ];
            }
            
            // Verifica se il collaboratore ha task associati
            $sql = "SELECT COUNT(*) as count FROM ANA_TASK WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: collaboratore ha task associati'
                ];
            }
            
            // Verifica se il collaboratore ha giornate registrate
            $sql = "SELECT COUNT(*) as count FROM FACT_GIORNATE WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: collaboratore ha giornate registrate'
                ];
            }
            
            // Verifica se il collaboratore ha tariffe associate
            $sql = "SELECT COUNT(*) as count FROM ANA_TARIFFE_COLLABORATORI WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: collaboratore ha tariffe associate'
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
     * Post-processing del record (rimuove password e aggiunge statistiche)
     */
    protected function processRecord($record) {
        try {
            // Rimuovi password dalla risposta per sicurezza
            unset($record['PWD']);
            
            // Aggiungi statistiche collaboratore
            $stats = $this->getCollaboratorStats($record['ID_COLLABORATORE']);
            $record['statistics'] = $stats;
            
            return $record;
        } catch (Exception $e) {
            unset($record['PWD']);
            return $record;
        }
    }
    
    /**
     * Recupera statistiche collaboratore
     */
    private function getCollaboratorStats($collaboratorId) {
        try {
            $stats = [];
            
            // Numero commesse assegnate
            $sql = "SELECT COUNT(*) as count FROM ANA_COMMESSE WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratorId);
            $stmt->execute();
            $stats['commesse_assegnate'] = $stmt->fetchColumn();
            
            // Numero task assegnati
            $sql = "SELECT COUNT(*) as count FROM ANA_TASK WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratorId);
            $stmt->execute();
            $stats['task_assegnati'] = $stmt->fetchColumn();
            
            // Giornate lavorate (ultimo mese)
            $sql = "SELECT SUM(gg) as total FROM FACT_GIORNATE WHERE ID_COLLABORATORE = :id AND Data >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratorId);
            $stmt->execute();
            $stats['giornate_ultimo_mese'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Ultima giornata registrata
            $sql = "SELECT Data FROM FACT_GIORNATE WHERE ID_COLLABORATORE = :id ORDER BY Data DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratorId);
            $stmt->execute();
            $stats['ultima_giornata'] = $stmt->fetchColumn();
            
            // Tariffa media attuale
            $sql = "SELECT AVG(Tariffa_gg) as avg_tariffa FROM ANA_TARIFFE_COLLABORATORI WHERE ID_COLLABORATORE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $collaboratorId);
            $stmt->execute();
            $stats['tariffa_media'] = floatval($stmt->fetchColumn()) ?: 0;
            
            return $stats;
            
        } catch (PDOException $e) {
            return [];
        }
    }
    
    /**
     * Verifica unicità di un campo
     */
    private function checkUniqueField($field, $value, $excludeId = null) {
        try {
            $sql = "SELECT COUNT(*) FROM {$this->table} WHERE $field = :value";
            $params = [':value' => $value];
            
            if ($excludeId) {
                $sql .= " AND {$this->primaryKey} != :exclude_id";
                $params[':exclude_id'] = $excludeId;
            }
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            return $stmt->fetchColumn() == 0;
            
        } catch (PDOException $e) {
            return false;
        }
    }
}
?>