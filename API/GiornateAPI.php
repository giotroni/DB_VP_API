<?php
/**
 * GiornateAPI - Gestione CRUD per la tabella FACT_GIORNATE
 */

require_once 'BaseAPI.php';

class GiornateAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('FACT_GIORNATE', 'ID_GIORNATA');
        
        $this->requiredFields = ['Data', 'ID_COLLABORATORE', 'ID_TASK', 'gg'];
        $this->validationRules = [
            'ID_GIORNATA' => ['max_length' => 50],
            'Data' => ['required' => true, 'date' => true],
            'ID_COLLABORATORE' => ['required' => true, 'max_length' => 50],
            'ID_TASK' => ['required' => true, 'max_length' => 50],
            'Tipo' => ['enum' => ['Campo', 'Promo', 'Sviluppo', 'Formazione']],
            'Desk' => ['enum' => ['Si', 'No']],
            'gg' => ['required' => true, 'numeric' => true, 'min' => 0.5, 'max' => 1],
            'Spese_Viaggi' => ['numeric' => true, 'min' => 0],
            'Vitto_alloggio' => ['numeric' => true, 'min' => 0],
            'Altri_costi' => ['numeric' => true, 'min' => 0],
            'Spese_Fatturate_VP' => ['numeric' => true, 'min' => 0],
            'Note' => ['max_length' => 65535]
        ];
    }
    /**
     * Override del metodo di aggiornamento per gestire correttamente la validazione.
     */
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            sendErrorResponse('Dati JSON non validi', 400);
            return;
        }
        $data[$this->primaryKey] = $id;
        $processedData = $this->preprocessData($data);
        $validation = $this->validateInput($processedData, true);
        if (!$validation['valid']) {
            sendErrorResponse('Validazione fallita', 400, $validation['errors']);
            return;
        }
        unset($processedData[$this->primaryKey]);
        if (empty($processedData)) {
            sendErrorResponse('Nessun dato da aggiornare.', 400);
            return;
        }
        parent::updateRecord($id, $processedData);
    }
    
    protected function validateInput($data, $isUpdate = false) {
        $errors = [];
        if (!$isUpdate) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                    $errors[] = "Il campo '$field' è obbligatorio.";
                }
            }
        }
        foreach ($data as $field => $value) {
            if (!isset($this->validationRules[$field]) || $value === null || $value === '') continue;
            $rules = $this->validationRules[$field];
            if (isset($rules['max_length']) && mb_strlen($value) > $rules['max_length']) $errors[] = "Il campo '$field' è troppo lungo (max {$rules['max_length']} caratteri).";
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) $errors[] = "Il valore per '$field' non è valido.";
            if (isset($rules['numeric']) && !is_numeric($value)) $errors[] = "Il campo '$field' deve essere un numero.";
            if (isset($rules['date']) && !$this->isValidDate($value)) $errors[] = "Formato data per '$field' non valido (YYYY-MM-DD).";
            if (is_numeric($value)) {
                if (isset($rules['min']) && floatval($value) < $rules['min']) $errors[] = "Il valore di '$field' deve essere almeno {$rules['min']}.";
                if (isset($rules['max']) && floatval($value) > $rules['max']) $errors[] = "Il valore di '$field' non può superare {$rules['max']}.";
            }
        }
        if (!empty($errors)) return ['valid' => false, 'errors' => $errors];
        
        $businessValidation = $this->validateBusinessRules($data, $isUpdate);
        if (!$businessValidation['valid']) {
            $errors = array_merge($errors, $businessValidation['errors']);
        }
        return ['valid' => empty($errors), 'errors' => $errors];
    }
    
    public function batchUpdateConfirmation() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!isset($data['ids']) || !is_array($data['ids']) || empty($data['ids'])) { sendErrorResponse("Array 'ids' mancante o vuoto.", 400); return; }
        if (!isset($data['confermata']) || !in_array($data['confermata'], ['Si', 'No'])) { sendErrorResponse("Stato 'confermata' non valido.", 400); return; }
        $ids = $data['ids'];
        $status = $data['confermata'];
        $sanitized_ids = array_filter($ids, function($id) { return !empty($id) && is_string($id) && strlen($id) < 50; });
        if (empty($sanitized_ids)) { sendErrorResponse("Nessun ID valido fornito.", 400); return; }
        try {
            $placeholders = implode(',', array_fill(0, count($sanitized_ids), '?'));
            $sql = "UPDATE {$this->table} SET Confermata = ? WHERE {$this->primaryKey} IN ($placeholders)";
            $stmt = $this->db->prepare($sql);
            if ($stmt === false) { sendErrorResponse("Errore preparazione query.", 500); return; }
            $params = array_merge([$status], $sanitized_ids);
            if (!$stmt->execute($params)) {
                sendErrorResponse("Errore esecuzione query: " . ($stmt->errorInfo()[2] ?? 'Sconosciuto'), 500);
                return;
            }
            sendSuccessResponse(['updated_rows' => $stmt->rowCount()], "Aggiornamento completato.");
        } catch (PDOException $e) {
            sendErrorResponse("Errore database: " . $e->getMessage(), 500);
        }
    }

    public function create() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) { sendErrorResponse('Dati JSON non validi', 400); return; }
        $processedData = $this->preprocessData($data);
        $validation = $this->validateInput($processedData);
        if (!$validation['valid']) { sendErrorResponse('Validazione fallita', 400, $validation['errors']); return; }
        if (empty($processedData[$this->primaryKey])) $processedData[$this->primaryKey] = $this->generateId();
        parent::createRecord($processedData);
    }

    private function validateBusinessRules($data, $isUpdate) {
        $errors = [];
        $currentId = $isUpdate ? ($data[$this->primaryKey] ?? null) : null;
        if (isset($data['ID_COLLABORATORE']) && !$this->existsInTable('ANA_COLLABORATORI', 'ID_COLLABORATORE', $data['ID_COLLABORATORE'])) $errors[] = "Collaboratore non esistente.";
        if (isset($data['ID_TASK']) && !$this->existsInTable('ANA_TASK', 'ID_TASK', $data['ID_TASK'])) $errors[] = "Task non esistente.";
        if (isset($data['Data']) && $data['Data'] > date('Y-m-d')) $errors[] = "Non è possibile registrare giornate future.";
        if (isset($data['Data'], $data['ID_COLLABORATORE'], $data['ID_TASK'])) {
            $duplicate = $this->checkDuplicate($data, $currentId);
            if (!$duplicate['valid']) $errors[] = $duplicate['message'];
        }
        if (isset($data['Data'], $data['ID_COLLABORATORE'], $data['gg'])) {
            $totalCheck = $this->checkDailyTotal($data, $currentId);
            if (!$totalCheck['valid']) $errors[] = $totalCheck['message'];
        }
        return ['valid' => empty($errors), 'errors' => $errors];
    }
    
    private function checkDuplicate($data, $currentId = null) {
        $sql = "SELECT COUNT(*) FROM {$this->table} WHERE Data = :data AND ID_COLLABORATORE = :collaboratore AND ID_TASK = :task";
        $params = [':data' => $data['Data'], ':collaboratore' => $data['ID_COLLABORATORE'], ':task' => $data['ID_TASK']];
        if ($currentId) {
            $sql .= " AND {$this->primaryKey} != :current_id";
            $params[':current_id'] = $currentId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        if ($stmt->fetchColumn() > 0) return ['valid' => false, 'message' => 'Esiste già una giornata registrata per questo collaboratore/task/data.'];
        return ['valid' => true];
    }
    
    private function checkDailyTotal($data, $currentId = null) {
        $sql = "SELECT SUM(gg) FROM {$this->table} WHERE Data = :data AND ID_COLLABORATORE = :collaboratore";
        $params = [':data' => $data['Data'], ':collaboratore' => $data['ID_COLLABORATORE']];
        if ($currentId) {
            $sql .= " AND {$this->primaryKey} != :current_id";
            $params[':current_id'] = $currentId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $currentTotal = floatval($stmt->fetchColumn());
        $newGg = isset($data['gg']) ? floatval($data['gg']) : 0;
        $newTotal = $currentTotal + $newGg;
        if ($newTotal > 1) return ['valid' => false, 'message' => "Il totale giornate per questa data supererebbe 1 (attuale: {$currentTotal} + nuovo: {$newGg} = {$newTotal})."];
        return ['valid' => true];
    }
    
    /**
     * Genera nuovo ID giornata
     **/
    protected function generateId() {
        try {
            // Genera ID basato su data: DAY + YYYYMMDD + numero progressivo
            $today = date('Ymd');
            
            // Trova il prossimo numero disponibile per oggi
            $sql = "SELECT ID_GIORNATA FROM {$this->table} WHERE ID_GIORNATA LIKE 'DAY{$today}%' ORDER BY ID_GIORNATA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 11)) + 1; // DAY + 8 cifre data + numero
            } else {
                $number = 1;
            }
            
            return 'DAY' . $today . str_pad($number, 3, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'DAY' . date('Ymd') . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        }
    }
    protected function preprocessData($data) {
        // Valida e formatta la data
        if (isset($data['Data']) && !empty($data['Data'])) {
            $data['Data'] = date('Y-m-d', strtotime($data['Data']));
        }
        
        // Imposta valori predefiniti
        if (!isset($data['Tipo']) || empty($data['Tipo'])) {
            $data['Tipo'] = 'Campo';
        }
        
        if (!isset($data['Desk']) || empty($data['Desk'])) {
            $data['Desk'] = 'No';
        }
        
        // Imposta spese a 0 se non specificate
        $speseFieds = ['Spese_Viaggi', 'Vitto_alloggio', 'Altri_costi'];
        foreach ($speseFieds as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                $data[$field] = 0;
            }
        }
        
        // Normalizza le note
        if (isset($data['Note'])) {
            $data['Note'] = trim($data['Note']);
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
        
        // Filtro per task
        if (isset($_GET['task']) && !empty($_GET['task'])) {
            $conditions[] = "ID_TASK = :task";
            $params[':task'] = $_GET['task'];
        }
        
        // Filtro per tipo
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "Tipo = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per desk
        if (isset($_GET['desk']) && !empty($_GET['desk'])) {
            $conditions[] = "Desk = :desk";
            $params[':desk'] = $_GET['desk'];
        }
        
        // Filtro per data (da)
        if (isset($_GET['data_da']) && !empty($_GET['data_da'])) {
            $conditions[] = "Data >= :data_da";
            $params[':data_da'] = $_GET['data_da'];
        }
        
        // Filtro per data (a)
        if (isset($_GET['data_a']) && !empty($_GET['data_a'])) {
            $conditions[] = "Data <= :data_a";
            $params[':data_a'] = $_GET['data_a'];
        }
        
        // Filtro per mese/anno
        if (isset($_GET['mese']) && !empty($_GET['mese']) && isset($_GET['anno']) && !empty($_GET['anno'])) {
            $conditions[] = "YEAR(Data) = :anno AND MONTH(Data) = :mese";
            $params[':anno'] = intval($_GET['anno']);
            $params[':mese'] = intval($_GET['mese']);
        }
        
        // Filtro per anno-mese formato YYYY-MM
        if (isset($_GET['anno_mese']) && !empty($_GET['anno_mese'])) {
            $annoMese = $_GET['anno_mese'];
            
            // Valida il formato YYYY-MM
            if (preg_match('/^\d{4}-\d{2}$/', $annoMese)) {
                $conditions[] = "DATE_FORMAT(Data, '%Y-%m') = :anno_mese";
                $params[':anno_mese'] = $annoMese;
            }
        }
        
        // Filtro per solo anno
        if (isset($_GET['anno']) && !empty($_GET['anno']) && !isset($_GET['mese'])) {
            $anno = $_GET['anno'];
            
            // Valida il formato YYYY
            if (preg_match('/^\d{4}$/', $anno)) {
                $conditions[] = "YEAR(Data) = :anno_only";
                $params[':anno_only'] = intval($anno);
            }
        }
        
        // Filtro per commessa (tramite task)
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            $conditions[] = "ID_TASK IN (SELECT ID_TASK FROM ANA_TASK WHERE ID_COMMESSA = :commessa)";
            $params[':commessa'] = $_GET['commessa'];
        }
        
        // Filtro per presenza spese
        if (isset($_GET['con_spese']) && $_GET['con_spese'] === 'true') {
            $conditions[] = "(Spese_Viaggi > 0 OR Vitto_alloggio > 0 OR Altri_costi > 0)";
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_GIORNATA', 'Data', 'ID_COLLABORATORE', 'ID_TASK', 'Tipo', 'gg', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Data';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Data';
        }
        
        return "$sortField $sortOrder, ID_COLLABORATORE ASC";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        // Le giornate possono essere eliminate liberamente
        // In futuro si potrebbe aggiungere controlli per giornate fatturate
        return ['canDelete' => true, 'message' => ''];
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
            
            // Aggiungi informazioni task e commessa
            $taskInfo = null;
            if (!empty($record['ID_TASK'])) {
                $taskFields = ['Task', 'ID_COMMESSA', 'Valore_gg', 'Tipo', 'Spese_Comprese', 'Valore_Spese_std'];
                $taskInfo = $this->getRelatedData('ANA_TASK', 'ID_TASK', $record['ID_TASK'], $taskFields);
                $record['task_info'] = $taskInfo;
                
                if ($taskInfo && !empty($taskInfo['ID_COMMESSA'])) {
                    $commessaInfo = $this->getRelatedData('ANA_COMMESSE', 'ID_COMMESSA', $taskInfo['ID_COMMESSA'], ['Commessa', 'ID_CLIENTE']);
                    $record['commessa_info'] = $commessaInfo;
                    
                    if ($commessaInfo && !empty($commessaInfo['ID_CLIENTE'])) {
                        $clienteInfo = $this->getRelatedData('ANA_CLIENTI', 'ID_CLIENTE', $commessaInfo['ID_CLIENTE'], ['Cliente']);
                        $record['cliente_info'] = $clienteInfo;
                    }
                }
            }
            
            $record['spese_totali'] = floatval($record['Spese_Viaggi']) + floatval($record['Vitto_alloggio']) + floatval($record['Altri_costi']);
            
            $record['valore_calcolato'] = 0;
            if (isset($taskInfo['Valore_gg']) && $taskInfo['Valore_gg'] > 0) {
                $record['valore_calcolato'] = floatval($taskInfo['Valore_gg']) * floatval($record['gg']);
            }

            // Calcolo di 'Valore_spese' secondo le regole di business
            $record['Valore_spese'] = 0;
            if ($taskInfo && $record['Tipo'] === 'Campo' && $record['Desk'] !== 'Si') {
                if (isset($taskInfo['Spese_Comprese']) && $taskInfo['Spese_Comprese'] === 'Si') {
                    $record['Valore_spese'] = 0;
                } else {
                    $speseStd = isset($taskInfo['Valore_Spese_std']) ? floatval($taskInfo['Valore_Spese_std']) : 0;
                    if ($speseStd > 0) {
                        // MODIFICATO: Il valore standard è fisso, non viene più moltiplicato per 'gg'.
                        $record['Valore_spese'] = $speseStd;
                    } else {
                        $record['Valore_spese'] = $record['spese_totali'];
                    }
                }
            }
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Metodi aggiuntivi specifici per le giornate
     */
    
    /**
     * Recupera riepilogo mensile per collaboratore
     */
    public function getRiepilogoMensile($collaboratoreId, $anno, $mese) {
        try {
            $sql = "SELECT 
                        COUNT(*) as giorni_lavorati,
                        SUM(gg) as totale_giornate,
                        SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi) as totale_spese,
                        AVG(gg) as media_giornate_per_giorno
                    FROM {$this->table}
                    WHERE ID_COLLABORATORE = :collaboratore
                    AND YEAR(Data) = :anno
                    AND MONTH(Data) = :mese";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':collaboratore' => $collaboratoreId,
                ':anno' => $anno,
                ':mese' => $mese
            ]);
            
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