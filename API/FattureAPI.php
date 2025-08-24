<?php
/**
 * FattureAPI - Gestione CRUD per la tabella FACT_FATTURE
 */

require_once 'BaseAPI.php';

class FattureAPI extends BaseAPI {
    
    public function __construct() {
        parent::__construct('FACT_FATTURE', 'ID_FATTURA');
        
        $this->requiredFields = ['Data', 'ID_CLIENTE', 'NR'];
        $this->validationRules = [
            'ID_FATTURA' => ['max_length' => 50],
            'Data' => ['required' => true, 'date' => true],
            'ID_CLIENTE' => ['required' => true, 'max_length' => 50],
            'TIPO' => ['enum' => ['Fattura', 'Nota_Accredito']],
            'NR' => ['required' => true, 'max_length' => 100],
            'ID_COMMESSA' => ['max_length' => 50],
            'Fatturato_gg' => ['numeric' => true, 'min' => 0],
            'Fatturato_Spese' => ['numeric' => true, 'min' => 0],
            'Fatturato_TOT' => ['numeric' => true, 'min' => 0],
            'Note' => ['max_length' => 65535],
            'Riferimento_Ordine' => ['max_length' => 255],
            'Data_Ordine' => ['date' => true],
            'Tempi_Pagamento' => ['numeric' => true, 'min' => 0, 'max' => 365],
            'Scadenza_Pagamento' => ['date' => true],
            'Data_Pagamento' => ['date' => true],
            'Valore_Pagato' => ['numeric' => true, 'min' => 0]
        ];
    }
    
    /**
     * Validazione input per fatture
     */
    protected function validateInput($data, $requireAll = true) {
        $errors = [];
        
        // Verifica campi richiesti
        if ($requireAll) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || (is_string($data[$field]) && empty(trim($data[$field])))) {
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
        
        // Verifica che il cliente esista
        if (isset($data['ID_CLIENTE']) && !empty($data['ID_CLIENTE'])) {
            if (!$this->existsInTable('ANA_CLIENTI', 'ID_CLIENTE', $data['ID_CLIENTE'])) {
                $errors[] = "Cliente specificato non esistente";
            }
        }
        
        // Verifica che la commessa esista se specificata
        if (isset($data['ID_COMMESSA']) && !empty($data['ID_COMMESSA'])) {
            if (!$this->existsInTable('ANA_COMMESSE', 'ID_COMMESSA', $data['ID_COMMESSA'])) {
                $errors[] = "Commessa specificata non esistente";
            }
        }
        
        // Verifica univocità numero fattura per anno
        if (isset($data['NR'], $data['Data'])) {
            $duplicateCheck = $this->checkDuplicateNumber($data);
            if (!$duplicateCheck['valid']) {
                $errors[] = $duplicateCheck['message'];
            }
        }
        
        // Verifica coerenza date
        if (isset($data['Data_Ordine'], $data['Data']) && !empty($data['Data_Ordine'])) {
            if ($data['Data_Ordine'] > $data['Data']) {
                $errors[] = "La data ordine non può essere successiva alla data fattura";
            }
        }
        
        if (isset($data['Data_Pagamento'], $data['Data']) && !empty($data['Data_Pagamento'])) {
            if ($data['Data_Pagamento'] < $data['Data']) {
                $errors[] = "La data pagamento non può essere precedente alla data fattura";
            }
        }
        
        // Verifica coerenza importi
        if (isset($data['Fatturato_gg'], $data['Fatturato_Spese'], $data['Fatturato_TOT'])) {
            $calcolato = floatval($data['Fatturato_gg']) + floatval($data['Fatturato_Spese']);
            $totale = floatval($data['Fatturato_TOT']);
            
            if (abs($calcolato - $totale) > 0.01) { // Tolleranza per arrotondamenti
                $errors[] = "Il totale fatturato non corrisponde alla somma di giornate e spese (calcolato: $calcolato, dichiarato: $totale)";
            }
        }
        
        // Verifica valore pagato
        if (isset($data['Valore_Pagato'], $data['Fatturato_TOT']) && !empty($data['Valore_Pagato'])) {
            if (floatval($data['Valore_Pagato']) > floatval($data['Fatturato_TOT'])) {
                $errors[] = "Il valore pagato non può essere superiore al totale fatturato";
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Verifica univocità numero fattura per anno
     */
    private function checkDuplicateNumber($data) {
        try {
            $anno = date('Y', strtotime($data['Data']));
            
            $sql = "SELECT COUNT(*) as count FROM {$this->table} 
                    WHERE NR = :numero 
                    AND YEAR(Data) = :anno";
            
            $params = [
                ':numero' => $data['NR'],
                ':anno' => $anno
            ];
            
            // Esclude il record corrente se è un aggiornamento
            if (isset($data['ID_FATTURA'])) {
                $sql .= " AND ID_FATTURA != :current_id";
                $params[':current_id'] = $data['ID_FATTURA'];
            }
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->fetchColumn();
            
            if ($count > 0) {
                return [
                    'valid' => false,
                    'message' => "Numero fattura '$data[NR]' già esistente per l'anno $anno"
                ];
            }
            
            return ['valid' => true, 'message' => ''];
            
        } catch (PDOException $e) {
            return [
                'valid' => false,
                'message' => 'Errore durante la verifica del numero fattura'
            ];
        }
    }
    
    /**
     * Genera nuovo ID fattura
     */
    protected function generateId() {
        try {
            // Genera ID basato su anno: FAT + YY + numero progressivo
            $anno = date('y'); // Anno a 2 cifre
            
            // Trova il prossimo numero disponibile per quest'anno
            $sql = "SELECT ID_FATTURA FROM {$this->table} WHERE ID_FATTURA LIKE 'FAT{$anno}%' ORDER BY ID_FATTURA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 5)) + 1; // FAT + 2 cifre anno + numero
            } else {
                $number = 1;
            }
            
            return 'FAT' . $anno . str_pad($number, 3, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'FAT' . date('y') . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // Valida e formatta le date
        $dateFields = ['Data', 'Data_Ordine', 'Scadenza_Pagamento', 'Data_Pagamento'];
        foreach ($dateFields as $field) {
            if (isset($data[$field]) && !empty($data[$field])) {
                $data[$field] = date('Y-m-d', strtotime($data[$field]));
            }
        }
        
        // Imposta tipo predefinito
        if (!isset($data['TIPO']) || empty($data['TIPO'])) {
            $data['TIPO'] = 'Fattura';
        }
        
        // Imposta importi a 0 se non specificati
        $importiFields = ['Fatturato_gg', 'Fatturato_Spese', 'Fatturato_TOT', 'Valore_Pagato'];
        foreach ($importiFields as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                $data[$field] = 0;
            }
        }
        
        // Calcola automaticamente il totale se non specificato
        if ((!isset($data['Fatturato_TOT']) || $data['Fatturato_TOT'] == 0) && 
            (isset($data['Fatturato_gg']) || isset($data['Fatturato_Spese']))) {
            $data['Fatturato_TOT'] = floatval($data['Fatturato_gg'] ?? 0) + floatval($data['Fatturato_Spese'] ?? 0);
        }
        
        // Calcola scadenza pagamento se non specificata ma ci sono tempi di pagamento
        if (isset($data['Tempi_Pagamento'], $data['Data']) && !empty($data['Tempi_Pagamento']) && 
            (!isset($data['Scadenza_Pagamento']) || empty($data['Scadenza_Pagamento']))) {
            $dataFattura = new DateTime($data['Data']);
            $dataFattura->add(new DateInterval('P' . intval($data['Tempi_Pagamento']) . 'D'));
            $data['Scadenza_Pagamento'] = $dataFattura->format('Y-m-d');
        }
        
        // Normalizza note e riferimenti
        if (isset($data['Note'])) {
            $data['Note'] = trim($data['Note']);
        }
        
        if (isset($data['Riferimento_Ordine'])) {
            $data['Riferimento_Ordine'] = trim($data['Riferimento_Ordine']);
        }
        
        return $data;
    }
    
    /**
     * Costruisce clausola WHERE per filtri
     */
    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per cliente
        if (isset($_GET['cliente']) && !empty($_GET['cliente'])) {
            $conditions[] = "ID_CLIENTE = :cliente";
            $params[':cliente'] = $_GET['cliente'];
        }
        
        // Filtro per commessa
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            $conditions[] = "ID_COMMESSA = :commessa";
            $params[':commessa'] = $_GET['commessa'];
        }
        
        // Filtro per tipo
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "TIPO = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per numero
        if (isset($_GET['numero']) && !empty($_GET['numero'])) {
            $conditions[] = "NR LIKE :numero";
            $params[':numero'] = '%' . $_GET['numero'] . '%';
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
        
        // Filtro per anno
        if (isset($_GET['anno']) && !empty($_GET['anno'])) {
            $conditions[] = "YEAR(Data) = :anno";
            $params[':anno'] = intval($_GET['anno']);
        }
        
        // Filtro per mese/anno
        if (isset($_GET['mese']) && !empty($_GET['mese']) && isset($_GET['anno']) && !empty($_GET['anno'])) {
            $conditions[] = "YEAR(Data) = :anno_mese AND MONTH(Data) = :mese";
            $params[':anno_mese'] = intval($_GET['anno']);
            $params[':mese'] = intval($_GET['mese']);
        }
        
        // Filtro per stato pagamento
        if (isset($_GET['stato_pagamento'])) {
            switch ($_GET['stato_pagamento']) {
                case 'pagata':
                    $conditions[] = "Data_Pagamento IS NOT NULL";
                    break;
                case 'non_pagata':
                    $conditions[] = "Data_Pagamento IS NULL";
                    break;
                case 'scaduta':
                    $conditions[] = "Scadenza_Pagamento < CURDATE() AND Data_Pagamento IS NULL";
                    break;
                case 'in_scadenza':
                    $conditions[] = "Scadenza_Pagamento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND Data_Pagamento IS NULL";
                    break;
            }
        }
        
        // Filtro per range importo
        if (isset($_GET['importo_min']) && !empty($_GET['importo_min'])) {
            $conditions[] = "Fatturato_TOT >= :importo_min";
            $params[':importo_min'] = floatval($_GET['importo_min']);
        }
        
        if (isset($_GET['importo_max']) && !empty($_GET['importo_max'])) {
            $conditions[] = "Fatturato_TOT <= :importo_max";
            $params[':importo_max'] = floatval($_GET['importo_max']);
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_FATTURA', 'Data', 'NR', 'ID_CLIENTE', 'Fatturato_TOT', 'Scadenza_Pagamento', 'Data_Pagamento', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Data';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Data';
        }
        
        return "$sortField $sortOrder, NR ASC";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se la fattura è già stata pagata
            $sql = "SELECT Data_Pagamento FROM {$this->table} WHERE ID_FATTURA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result && !empty($result['Data_Pagamento'])) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: fattura già pagata'
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
            // Aggiungi informazioni cliente
            if (!empty($record['ID_CLIENTE'])) {
                $clienteInfo = $this->getRelatedData('ANA_CLIENTI', 'ID_CLIENTE', $record['ID_CLIENTE'], ['Cliente', 'Ragione_Sociale']);
                $record['cliente_info'] = $clienteInfo;
            }
            
            // Aggiungi informazioni commessa se presente
            if (!empty($record['ID_COMMESSA'])) {
                $commessaInfo = $this->getRelatedData('ANA_COMMESSE', 'ID_COMMESSA', $record['ID_COMMESSA'], ['Commessa', 'Tipo_Commessa']);
                $record['commessa_info'] = $commessaInfo;
            }
            
            // Calcola stato pagamento
            $record['stato_pagamento'] = $this->getStatoPagamento($record);
            
            // Calcola giorni alla scadenza
            if (!empty($record['Scadenza_Pagamento']) && empty($record['Data_Pagamento'])) {
                $oggi = new DateTime();
                $scadenza = new DateTime($record['Scadenza_Pagamento']);
                $diff = $oggi->diff($scadenza);
                
                if ($scadenza < $oggi) {
                    $record['giorni_scadenza'] = -$diff->days; // Negativo se scaduta
                } else {
                    $record['giorni_scadenza'] = $diff->days;
                }
            }
            
            // Calcola percentuale pagata
            if (floatval($record['Fatturato_TOT']) > 0) {
                $record['percentuale_pagata'] = round((floatval($record['Valore_Pagato']) / floatval($record['Fatturato_TOT'])) * 100, 2);
            }
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Determina lo stato del pagamento
     */
    private function getStatoPagamento($record) {
        if (!empty($record['Data_Pagamento'])) {
            if (floatval($record['Valore_Pagato']) >= floatval($record['Fatturato_TOT'])) {
                return 'pagata';
            } else {
                return 'parzialmente_pagata';
            }
        }
        
        if (!empty($record['Scadenza_Pagamento'])) {
            $oggi = date('Y-m-d');
            $scadenza = $record['Scadenza_Pagamento'];
            
            if ($scadenza < $oggi) {
                return 'scaduta';
            } elseif ($scadenza <= date('Y-m-d', strtotime('+7 days'))) {
                return 'in_scadenza';
            }
        }
        
        return 'non_pagata';
    }
    
    /**
     * Metodi aggiuntivi specifici per le fatture
     */
    
    /**
     * Recupera riepilogo fatturato per periodo
     */
    public function getRiepilogoFatturato($dataInizio, $dataFine, $clienteId = null) {
        try {
            $sql = "SELECT 
                        COUNT(*) as numero_fatture,
                        SUM(CASE WHEN TIPO = 'Fattura' THEN Fatturato_TOT ELSE 0 END) as totale_fatture,
                        SUM(CASE WHEN TIPO = 'Nota_Accredito' THEN Fatturato_TOT ELSE 0 END) as totale_note_accredito,
                        SUM(CASE WHEN TIPO = 'Fattura' THEN Fatturato_TOT ELSE -Fatturato_TOT END) as fatturato_netto,
                        SUM(Valore_Pagato) as totale_incassato
                    FROM {$this->table}
                    WHERE Data BETWEEN :data_inizio AND :data_fine";
            
            $params = [
                ':data_inizio' => $dataInizio,
                ':data_fine' => $dataFine
            ];
            
            if ($clienteId) {
                $sql .= " AND ID_CLIENTE = :cliente";
                $params[':cliente'] = $clienteId;
            }
            
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