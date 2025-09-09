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
            $sql = "
                SELECT COUNT(*) as total 
                FROM {$this->table} c
                LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
            ";
            
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
            $conditions[] = "c.Commessa LIKE :commessa";
            $params[':commessa'] = '%' . $_GET['commessa'] . '%';
        }
        
        // Filtro per tipo commessa
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "c.Tipo_Commessa = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per cliente
        if (isset($_GET['cliente']) && !empty($_GET['cliente'])) {
            $conditions[] = "c.ID_CLIENTE = :cliente";
            $params[':cliente'] = $_GET['cliente'];
        }
        
        // Filtro per collaboratore
        if (isset($_GET['collaboratore']) && !empty($_GET['collaboratore'])) {
            $conditions[] = "c.ID_COLLABORATORE = :collaboratore";
            $params[':collaboratore'] = $_GET['collaboratore'];
        }
        
        // Filtro per stato
        if (isset($_GET['stato']) && !empty($_GET['stato'])) {
            $conditions[] = "c.Stato_Commessa = :stato";
            $params[':stato'] = $_GET['stato'];
        }
        
        // Filtro per anno-mese basato su FACT_GIORNATE
        if (isset($_GET['anno_mese']) && !empty($_GET['anno_mese'])) {
            $annoMese = $_GET['anno_mese'];
            
            // Valida il formato YYYY-MM o solo YYYY
            if (preg_match('/^\d{4}-\d{2}$/', $annoMese)) {
                // Formato YYYY-MM
                $conditions[] = "c.ID_COMMESSA IN (
                    SELECT DISTINCT t.ID_COMMESSA 
                    FROM ANA_TASK t
                    JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
                    WHERE DATE_FORMAT(g.Data, '%Y-%m') = :anno_mese
                )";
                $params[':anno_mese'] = $annoMese;
            } elseif (preg_match('/^\d{4}$/', $annoMese)) {
                // Formato YYYY (solo anno)
                $conditions[] = "c.ID_COMMESSA IN (
                    SELECT DISTINCT t.ID_COMMESSA 
                    FROM ANA_TASK t
                    JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
                    WHERE YEAR(g.Data) = :anno
                )";
                $params[':anno'] = $annoMese;
            }
        }
        
        // Filtro per data apertura (da)
        if (isset($_GET['data_da']) && !empty($_GET['data_da'])) {
            $conditions[] = "c.Data_Apertura_Commessa >= :data_da";
            $params[':data_da'] = $_GET['data_da'];
        }
        
        // Filtro per data apertura (a)
        if (isset($_GET['data_a']) && !empty($_GET['data_a'])) {
            $conditions[] = "c.Data_Apertura_Commessa <= :data_a";
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
     * Override handleRequest to support custom action 'maturato'
     * Usage: GET /API/index.php?resource=commesse&action=maturato&id=COM0001
     */
    public function handleRequest($id = null) {
        if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'maturato') {
            // Permetti chiamate con o senza id: se non c'è id calcoliamo per tutte le commesse
            $commessaId = $id ?? ($_GET['id'] ?? null);
            $this->getMaturatoMensile($commessaId);
            return;
        }

        // Fallback al comportamento di base
        parent::handleRequest($id);
    }

    /**
     * Calcola il maturato mensile per una commessa.
     * Restituisce JSON con array di mesi (YYYY-MM) contenenti:
     * - giorni_campo: totale giorni di tipo 'Campo'
     * - valore_campo: somma (gg * tariffa_gg) per i task di campo
     * - monitor_multiplier: somma dei Valore_gg dei task di tipo 'Monitoraggio' presenti nel mese
     * - valore_monitoraggio: monitor_multiplier * valore_campo
     * - totale_maturato: valore_campo + valore_monitoraggio
     */
    public function getMaturatoMensile($commessaId) {
        try {
            // Se non è specificata una singola commessa, calcoliamo per tutte le commesse
            if (empty($commessaId)) {
                $allSql = "SELECT ID_COMMESSA FROM ANA_COMMESSE";
                $allStmt = $this->db->prepare($allSql);
                $allStmt->execute();
                $commesse = $allStmt->fetchAll(PDO::FETCH_COLUMN);

                $allResults = [];
                foreach ($commesse as $cid) {
                    $allResults[] = $this->computeMaturatoForCommessa($cid);
                }

                sendSuccessResponse([
                    'maturato_per_commessa' => $allResults
                ]);
                return;
            }

            // Altrimenti calcola per la singola commessa richiesta
            $single = $this->computeMaturatoForCommessa($commessaId);
            sendSuccessResponse($single);

        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il calcolo del maturato: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Calcolo effettivo del maturato per una singola commessa (riutilizzabile)
     * Restituisce un array con 'id_commessa' e 'maturato_mensile'
     */
    private function computeMaturatoForCommessa($commessaId) {
        // Recupera nome commessa
        $commessaName = null;
        try {
            $cstmt = $this->db->prepare("SELECT Commessa, ID_COLLABORATORE FROM ANA_COMMESSE WHERE ID_COMMESSA = :id LIMIT 1");
            $cstmt->bindValue(':id', $commessaId);
            $cstmt->execute();
            $cinfo = $cstmt->fetch(PDO::FETCH_ASSOC);
            if ($cinfo) {
                $commessaName = $cinfo['Commessa'] ?? null;
                $commessa_default_collab = $cinfo['ID_COLLABORATORE'] ?? null;
            } else {
                $commessa_default_collab = null;
            }
        } catch (PDOException $e) {
            $commessa_default_collab = null;
        }
        // 1) Recupera, per ogni task di tipo 'Campo', la somma di gg per mese
        $sql = "SELECT t.ID_TASK, t.ID_COLLABORATORE, MAX(t.Valore_gg) AS valore_gg, DATE_FORMAT(g.Data, '%Y-%m') AS ym, SUM(g.gg) AS giorni, MAX(g.Data) AS ref_date
            FROM ANA_TASK t
            JOIN FACT_GIORNATE g ON t.ID_TASK = g.ID_TASK
            WHERE t.ID_COMMESSA = :id AND g.Tipo = 'Campo'
            GROUP BY t.ID_TASK, t.ID_COLLABORATORE, ym";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(':id', $commessaId);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $monthly = [];

        // Prepared statement per determinare la tariffa attiva al riferimento di data
        $tarStmt = $this->db->prepare("SELECT Tariffa_gg FROM ANA_TARIFFE_COLLABORATORI WHERE ID_COLLABORATORE = :collab AND (ID_COMMESSA = :commessa OR ID_COMMESSA = '' OR ID_COMMESSA IS NULL) AND Dal <= :ref_date ORDER BY Dal DESC LIMIT 1");

        foreach ($rows as $r) {
            $ym = $r['ym'];
            $gg = floatval($r['giorni']);
            $refDate = $r['ref_date'];
            $collab = $r['ID_COLLABORATORE'];

            // Preferisci Valore_gg dichiarato nel task se presente (>0), altrimenti cerca la tariffa dal listino
            $taskValoreGg = floatval($r['valore_gg']);

            if ($taskValoreGg > 0) {
                $valore = $gg * $taskValoreGg;
            } else {
                $tarStmt->bindValue(':collab', $collab);
                $tarStmt->bindValue(':commessa', $commessaId);
                $tarStmt->bindValue(':ref_date', $refDate);
                $tarStmt->execute();
                $tariffa = floatval($tarStmt->fetchColumn()) ?: 0;
                $valore = $gg * $tariffa;
            }

            if (!isset($monthly[$ym])) {
                $monthly[$ym] = [
                    'giorni_campo' => 0,
                    'valore_campo' => 0,
                    'monitor_multiplier' => 0
                ];
            }

            $monthly[$ym]['giorni_campo'] += $gg;
            $monthly[$ym]['valore_campo'] += $valore;
        }

        // 2) Calcola il multiplicatore di monitoraggio prendendo i task di tipo 'Monitoraggio' dalla tabella ANA_TASK
        $sqlMon = "SELECT SUM(COALESCE(Valore_gg,0)) AS monitor_valore_sum, COUNT(*) AS monitor_tasks
                   FROM ANA_TASK
                   WHERE ID_COMMESSA = :id AND Tipo = 'Monitoraggio'";

        $stmt = $this->db->prepare($sqlMon);
        $stmt->bindValue(':id', $commessaId);
        $stmt->execute();
        $monSummary = $stmt->fetch(PDO::FETCH_ASSOC);

        $monitor_sum = floatval($monSummary['monitor_valore_sum'] ?? 0);
        $monitor_tasks = intval($monSummary['monitor_tasks'] ?? 0);

        // Recupera dettagli dei task di monitoraggio (ID_COLLABORATORE e nome collaboratore)
        $monitorDetails = [];
        try {
            $mdSql = "SELECT t.ID_TASK, t.ID_COLLABORATORE, c.Collaboratore
                      FROM ANA_TASK t
                      LEFT JOIN ANA_COLLABORATORI c ON t.ID_COLLABORATORE = c.ID_COLLABORATORE
                      WHERE t.ID_COMMESSA = :id AND t.Tipo = 'Monitoraggio'";
            $mdStmt = $this->db->prepare($mdSql);
            $mdStmt->bindValue(':id', $commessaId);
            $mdStmt->execute();
            $monitorRows = $mdStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($monitorRows as $mr) {
                $monitorDetails[] = [
                    'ID_TASK' => $mr['ID_TASK'],
                    'ID_COLLABORATORE' => $mr['ID_COLLABORATORE'],
                    'Collaboratore' => $mr['Collaboratore'] ?? null
                ];
            }
        } catch (PDOException $e) {
            // ignore, lasciamo monitorDetails vuoto
        }

        if ($monitor_tasks > 0 && $monitor_sum > 0) {
            foreach ($monthly as $ymKey => $_) {
                if (!isset($monthly[$ymKey])) continue;
                $monthly[$ymKey]['monitor_multiplier'] = $monitor_sum;
            }
        }

        // Inizializza valore_spese e contatori di costo per ogni mese
        foreach ($monthly as $ymKey => $_) {
            $monthly[$ymKey]['valore_spese'] = 0;
            // Costo_gg: somma dei costi giornalieri (tariffa * gg) per il mese
            $monthly[$ymKey]['costo_gg'] = 0;
        }

        // Recupera tasks della commessa per calcolare le spese come in TaskAPI
        try {
            $tasksSql = "SELECT ID_TASK, Spese_Comprese, Valore_Spese_std FROM ANA_TASK WHERE ID_COMMESSA = :id";
            $tasksStmt = $this->db->prepare($tasksSql);
            $tasksStmt->bindValue(':id', $commessaId);
            $tasksStmt->execute();
            $tasksList = $tasksStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            $tasksList = [];
        }

        // Se ci sono tasks, aggrega le spese presenti in FACT_GIORNATE per task e mese
        $speseByTaskMonth = [];
        if (!empty($tasksList)) {
            $ids = array_map(function($t){ return $t['ID_TASK']; }, $tasksList);
            // costruisci placeholder
            $placeholders = rtrim(str_repeat('?,', count($ids)), ',');
                        $aggSql = "SELECT ID_TASK, DATE_FORMAT(Data, '%Y-%m') AS ym, 
                                                SUM(
                                                    COALESCE(CAST(REPLACE(Spese_Viaggi, ',', '.') AS DECIMAL(10,2)),0) +
                                                    COALESCE(CAST(REPLACE(Vitto_alloggio, ',', '.') AS DECIMAL(10,2)),0) +
                                                    COALESCE(CAST(REPLACE(Altri_costi, ',', '.') AS DECIMAL(10,2)),0)
                                                ) AS spese_sum,
                                                SUM(
                                                    COALESCE(CAST(REPLACE(Spese_Fatturate_VP, ',', '.') AS DECIMAL(10,2)),0)
                                                ) AS spese_fatturate_sum,
                                                SUM(CAST(REPLACE(gg, ',', '.') AS DECIMAL(10,2))) AS gg_sum
                                             FROM FACT_GIORNATE
                                             WHERE ID_TASK IN ($placeholders)
                                             GROUP BY ID_TASK, ym";

            try {
                $aggStmt = $this->db->prepare($aggSql);
                foreach ($ids as $i => $tid) {
                    $aggStmt->bindValue($i+1, $tid);
                }
                $aggStmt->execute();
                $aggRows = $aggStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($aggRows as $ar) {
                    $speseByTaskMonth[$ar['ID_TASK']][$ar['ym']] = [
                        'spese_sum' => floatval($ar['spese_sum']),
                        'spese_fatturate_sum' => floatval($ar['spese_fatturate_sum'] ?? 0),
                        'gg_sum' => floatval($ar['gg_sum'])
                    ];
                }
            } catch (PDOException $e) {
                // ignore aggregation errors
                $speseByTaskMonth = [];
            }
        }

        // Applica la logica di calcolo spese (per task) su ogni mese presente in $monthly
        foreach ($tasksList as $task) {
            $taskId = $task['ID_TASK'];
            $speseComprese = ($task['Spese_Comprese'] ?? '') === 'Si';
            $valoreStd = floatval($task['Valore_Spese_std'] ?? 0);

            foreach ($monthly as $ymKey => $_) {
                // Se c'è valore standard e il task ha giornate nel mese aggiungilo al valore di ricavo
                // Per il costo delle spese usiamo sempre le spese effettive registrate meno la quota già fatturata a VP
                $taskMonth = $speseByTaskMonth[$taskId][$ymKey] ?? null;
                $ggInMonth = $taskMonth['gg_sum'] ?? 0;
                $speseSum = $taskMonth['spese_sum'] ?? 0;
                $speseFatturate = $taskMonth['spese_fatturate_sum'] ?? 0;

                if ($valoreStd > 0) {
                    if ($ggInMonth > 0) {
                        $monthly[$ymKey]['valore_spese'] += $valoreStd;
                    }
                } else {
                    $monthly[$ymKey]['valore_spese'] += $speseSum;
                }

                // Nota: il costo spese non viene più considerato nel calcolo del costo totale
                // (viene comunque mantenuto il calcolo di valore_spese per il ricavo se necessario)
            }
        }

        // 3) Costruisci il risultato ordinato per mese
        ksort($monthly);

        $result = [];
        // Commissione e id_account (ID_COLLABORATORE della commessa)
        $commissione = 0;
        if (isset($cinfo['Commissione'])) {
            $commissione = floatval($cinfo['Commissione']);
        } else {
            // tentativo di recuperare nuovamente se non presente
            try {
                $cc = $this->db->prepare("SELECT Commissione FROM ANA_COMMESSE WHERE ID_COMMESSA = :id LIMIT 1");
                $cc->bindValue(':id', $commessaId);
                $cc->execute();
                $commissione = floatval($cc->fetchColumn()) ?: 0;
            } catch (PDOException $e) {
                $commissione = 0;
            }
        }

        $id_account = $commessa_default_collab ?? null;

        foreach ($monthly as $ym => $v) {
            $valore_campo = floatval($v['valore_campo']);
            $monitor_mult = floatval($v['monitor_multiplier']);
            $valore_monitor = ($monitor_mult > 0) ? ($valore_campo * $monitor_mult) : 0;
            $totale = $valore_campo + $valore_monitor;

            // valore accounting: valore_campo * commissione
            $valore_accounting = $valore_campo * floatval($commissione);

            // valore spese già calcolato in $v['valore_spese']
            $valore_spese = floatval($v['valore_spese'] ?? 0);

            // valore monitoraggio e totale mensile
            $valore_monitoraggio = $valore_monitor;
            $valore_totale_mese = $valore_campo + $valore_monitoraggio + $valore_spese;

            // Calcolo Costo_gg: ricostruiamo il costo a partire dalle giornate per quel mese
            // Per ottenere il costo effettivo usiamo la stessa logica: se il task definisce Valore_gg usiamolo,
            // altrimenti cerchiamo la tariffa attiva nel listino. Per semplicità e per evitare query molto costose
            // ricostruiamo con una query aggregata su FACT_GIORNATE unendola ad ANA_TASK e ANA_TARIFFE_COLLABORATORI.
            try {
                // Recupera tutte le giornate di tipo 'Campo' per la commessa e il mese specifico
                // Prendiamo l'ID_COLLABORATORE dalla giornata (g.ID_COLLABORATORE): è chi ha effettivamente svolto la giornata
                $costoGgSql = "SELECT g.ID_TASK, g.Data, g.gg, t.Valore_gg AS task_valore_gg, g.ID_COLLABORATORE AS giornata_collab
                               FROM FACT_GIORNATE g
                               LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                               WHERE t.ID_COMMESSA = :cid AND DATE_FORMAT(g.Data, '%Y-%m') = :ym AND g.Tipo = 'Campo'";

                $cgStmt = $this->db->prepare($costoGgSql);
                $cgStmt->bindValue(':cid', $commessaId);
                $cgStmt->bindValue(':ym', $ym);
                $cgStmt->execute();
                $cggRows = $cgStmt->fetchAll(PDO::FETCH_ASSOC);

                $costo_gg_tot = 0;

                foreach ($cggRows as $cr) {
                    // Normalizza e calcola frazione di giornata
                    $ggRaw = $cr['gg'] ?? 0;
                    $ggSum = floatval(str_replace(',', '.', $ggRaw));
                    $taskVal = floatval($cr['task_valore_gg'] ?? 0);
                    // Usa il collaboratore che ha effettuato la giornata
                    $collabId = $cr['giornata_collab'];
                    $refDate = $cr['Data'];

                    // Usa sempre la tariffa del collaboratore che ha effettuato la giornata,
                    // indipendentemente dal valore eventualmente impostato nel task.
                    $rate = $this->getTariffaAttiva($collabId, $refDate, $commessaId);

                    $costo_gg_tot += $ggSum * floatval($rate);
                }
            } catch (PDOException $e) {
                $costo_gg_tot = 0;
            }

            // Costo totale: somma del costo delle giornate (Costo_gg) e del valore spese (Valore_spese)
            $costo_tot = $costo_gg_tot + $valore_spese;

            $entry = [
                'year_month' => $ym,
                'giorni_campo' => round(floatval($v['giorni_campo']), 3),
                'valore_campo' => round($valore_campo, 2),
                'monitor_multiplier' => round($monitor_mult, 3),
                'valore_monitoraggio' => round($valore_monitoraggio, 2),
                'valore_spese' => round($valore_spese, 2),
                'totale_maturato' => round($totale, 2),
                'Costo_gg' => round($costo_gg_tot, 2),
                'Costo_TOT' => round($costo_tot, 2),
                'Valore_TOT' => round($valore_totale_mese, 2),
                'valore_accounting' => round($valore_accounting, 2),
                'id_account' => $id_account,
                'margine' => round(($valore_totale_mese - $costo_tot - $valore_accounting), 2)
            ];

            $result[] = $entry;
        }

        return [
            'id_commessa' => $commessaId,
            'Commessa' => $commessaName,
            'ID_COLLABORATORE' => $commessa_default_collab,
            'monitor_tasks' => $monitorDetails,
            'maturato_mensile' => $result
        ];
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

    /**
     * Recupera la tariffa attiva per un collaboratore a una data specifica,
     * dando priorità a tariffe per commessa.
     */
    private function getTariffaAttiva($collaboratoreId, $data, $commessaId = null) {
        try {
            if (empty($collaboratoreId) || empty($data)) return 0;

            // Prima prova a cercare una tariffa specifica per la commessa
            $sql = "SELECT Tariffa_gg FROM ANA_TARIFFE_COLLABORATORI 
                    WHERE ID_COLLABORATORE = :collab ";

            if (!empty($commessaId)) {
                $sql .= " AND (ID_COMMESSA = :commessa OR ID_COMMESSA = '' OR ID_COMMESSA IS NULL)";
            } else {
                $sql .= " AND (ID_COMMESSA = '' OR ID_COMMESSA IS NULL)";
            }

            $sql .= " AND Dal <= :ref_date ORDER BY Dal DESC LIMIT 1";

            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':collab', $collaboratoreId);
            if (!empty($commessaId)) $stmt->bindValue(':commessa', $commessaId);
            $stmt->bindValue(':ref_date', $data);
            $stmt->execute();
            $val = $stmt->fetchColumn();
            return floatval($val) ?: 0;

        } catch (PDOException $e) {
            return 0;
        }
    }
}
?>