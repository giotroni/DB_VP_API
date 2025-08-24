<?php
/**
 * ClientiAPI - Gestione CRUD per la tabella ANA_CLIENTI
 */

require_once 'BaseAPI.php';

class ClientiAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('ANA_CLIENTI', 'ID_CLIENTE');
        
        $this->requiredFields = ['Cliente'];
        $this->validationRules = [
            'ID_CLIENTE' => ['max_length' => 50],
            'Cliente' => ['required' => true, 'max_length' => 255],
            'Ragione_Sociale' => ['max_length' => 255],
            'Indirizzo' => ['max_length' => 255],
            'Citta' => ['max_length' => 255],
            'CAP' => ['max_length' => 10, 'pattern' => '/^\d{5}$/'],
            'Provincia' => ['max_length' => 10],
            'P_IVA' => ['max_length' => 20, 'pattern' => '/^\d{11}$/']
        ];
    }
    
    /**
     * Validazione input per clienti
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
            if (!isset($this->validationRules[$field])) {
                continue;
            }
            
            $rules = $this->validationRules[$field];
            
            // Verifica lunghezza massima
            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']} caratteri)";
            }
            
            // Verifica pattern
            if (isset($rules['pattern']) && !empty($value) && !preg_match($rules['pattern'], $value)) {
                if ($field === 'CAP') {
                    $errors[] = "CAP deve essere di 5 cifre";
                } elseif ($field === 'P_IVA') {
                    $errors[] = "Partita IVA deve essere di 11 cifre";
                } else {
                    $errors[] = "Formato '$field' non valido";
                }
            }
        }
        
        // Validazione P.IVA univoca
        if (isset($data['P_IVA']) && !empty($data['P_IVA'])) {
            $checkPiva = $this->checkUniqueField('P_IVA', $data['P_IVA'], $data['ID_CLIENTE'] ?? null);
            if (!$checkPiva) {
                $errors[] = "Partita IVA già esistente";
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Genera nuovo ID cliente
     */
    protected function generateId() {
        try {
            // Trova il prossimo numero disponibile
            $sql = "SELECT ID_CLIENTE FROM {$this->table} WHERE ID_CLIENTE LIKE 'CLI%' ORDER BY ID_CLIENTE DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 3)) + 1;
            } else {
                $number = 1;
            }
            
            return 'CLI' . str_pad($number, 4, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'CLI' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // Normalizza i dati
        if (isset($data['Cliente'])) {
            $data['Cliente'] = trim($data['Cliente']);
        }
        
        if (isset($data['CAP'])) {
            $data['CAP'] = preg_replace('/\D/', '', $data['CAP']);
        }
        
        if (isset($data['P_IVA'])) {
            $data['P_IVA'] = preg_replace('/\D/', '', $data['P_IVA']);
        }
        
        if (isset($data['Provincia'])) {
            $data['Provincia'] = strtoupper(trim($data['Provincia']));
        }
        
        return $data;
    }
    
    /**
     * Costruisce clausola WHERE per filtri
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per nome cliente
        if (isset($_GET['cliente']) && !empty($_GET['cliente'])) {
            $conditions[] = "Cliente LIKE :cliente";
            $params[':cliente'] = '%' . $_GET['cliente'] . '%';
        }
        
        // Filtro per città
        if (isset($_GET['citta']) && !empty($_GET['citta'])) {
            $conditions[] = "Citta LIKE :citta";
            $params[':citta'] = '%' . $_GET['citta'] . '%';
        }
        
        // Filtro per provincia
        if (isset($_GET['provincia']) && !empty($_GET['provincia'])) {
            $conditions[] = "Provincia = :provincia";
            $params[':provincia'] = strtoupper($_GET['provincia']);
        }
        
        // Filtro per P.IVA
        if (isset($_GET['piva']) && !empty($_GET['piva'])) {
            $conditions[] = "P_IVA LIKE :piva";
            $params[':piva'] = '%' . $_GET['piva'] . '%';
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_CLIENTE', 'Cliente', 'Citta', 'Provincia', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Cliente';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Cliente';
        }
        
        return "$sortField $sortOrder";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se il cliente ha commesse associate
            $sql = "SELECT COUNT(*) as count FROM ANA_COMMESSE WHERE ID_CLIENTE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: cliente ha commesse associate'
                ];
            }
            
            // Verifica se il cliente ha fatture associate
            $sql = "SELECT COUNT(*) as count FROM FACT_FATTURE WHERE ID_CLIENTE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result['count'] > 0) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: cliente ha fatture associate'
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
     * Post-processing del record (aggiunge statistiche)
     */
    protected function processRecord($record) {
        try {
            // Aggiungi statistiche cliente
            $stats = $this->getClientStats($record['ID_CLIENTE']);
            $record['statistics'] = $stats;
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Recupera statistiche cliente
     */
    private function getClientStats($clientId) {
        try {
            $stats = [];
            
            // Numero commesse
            $sql = "SELECT COUNT(*) as count FROM ANA_COMMESSE WHERE ID_CLIENTE = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $clientId);
            $stmt->execute();
            $stats['commesse_totali'] = $stmt->fetchColumn();
            
            // Numero commesse attive
            $sql = "SELECT COUNT(*) as count FROM ANA_COMMESSE WHERE ID_CLIENTE = :id AND Stato_Commessa = 'In corso'";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $clientId);
            $stmt->execute();
            $stats['commesse_attive'] = $stmt->fetchColumn();
            
            // Fatturato totale
            $sql = "SELECT SUM(Fatturato_TOT) as total FROM FACT_FATTURE WHERE ID_CLIENTE = :id AND TIPO = 'Fattura'";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $clientId);
            $stmt->execute();
            $stats['fatturato_totale'] = floatval($stmt->fetchColumn()) ?: 0;
            
            // Ultima fattura
            $sql = "SELECT Data FROM FACT_FATTURE WHERE ID_CLIENTE = :id ORDER BY Data DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $clientId);
            $stmt->execute();
            $stats['ultima_fattura'] = $stmt->fetchColumn();
            
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