<?php
/**
 * TaskAPI - Versione stabile con query separate
 */

require_once 'BaseAPI.php';
require_once __DIR__ . '/CalcoloSpese.php';

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
            'Data_Inizio' => ['date' => true],
            'Data_Fine' => ['date' => true],
            'Stato_Task' => ['enum' => ['In corso', 'Sospeso', 'Chiuso', 'Archiviato']],
            'gg_previste' => ['numeric' => true, 'min' => 0],
            'Spese_Comprese_Viaggi' => ['enum' => ['Si', 'No']],
            'Spese_Comprese_Vitto_Alloggio' => ['enum' => ['Si', 'No']],
            'Valore_Spese_std_Viaggi' => ['numeric' => true, 'min' => 0],
            'Valore_Spese_std_Vitto_Alloggio' => ['numeric' => true, 'min' => 0],
            'Valore_gg' => ['numeric' => true, 'min' => 0]
        ];
    }
    
    /**
     * Un task 'Campo' attivo su una commessa di tipo 'Cliente' deve avere un
     * prezzo di vendita: senza Valore_gg le giornate che ci vengono
     * consuntivate producono costo ma ricavo zero, e il margine della commessa
     * risulta sbagliato senza che nulla lo segnali.
     *
     * Il vincolo NON si applica alle commesse 'Interna', dove l'assenza di
     * prezzo è corretta: il lavoro interno non si vende, è puro costo.
     * Non si applica nemmeno ai task non attivi, così un task storico
     * incompleto può comunque essere sospeso o chiuso.
     *
     * @return string|null messaggio di errore, oppure null se va bene
     */
    private function verificaValoreGgObbligatorio($tipo, $commessaId, $statoTask, $valoreGg) {
        if ($tipo !== 'Campo' || empty($commessaId)) {
            return null;
        }

        // Stato assente in creazione: in ANA_TASK il default è 'In corso'
        $stato = $statoTask ?: 'In corso';
        if ($stato !== 'In corso') {
            return null;
        }

        if ($valoreGg !== null && $valoreGg !== '' && floatval($valoreGg) > 0) {
            return null;
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT Tipo_Commessa, Commessa FROM ANA_COMMESSE WHERE ID_COMMESSA = :id LIMIT 1"
            );
            $stmt->bindValue(':id', $commessaId);
            $stmt->execute();
            $commessa = $stmt->fetch();
        } catch (PDOException $e) {
            // In caso di errore non blocchiamo il salvataggio
            return null;
        }

        if (!$commessa || ($commessa['Tipo_Commessa'] ?? '') !== 'Cliente') {
            return null;
        }

        return "Il task è di tipo 'Campo' sulla commessa cliente \"{$commessa['Commessa']}\": "
             . "per tenerlo 'In corso' devi indicare il Valore Giorno (€), altrimenti le giornate "
             . "consuntivate risulterebbero a ricavo zero. In alternativa mettilo in stato 'Sospeso'.";
    }

    /**
     * Override create per impedire la creazione di un secondo task Monitoraggio attivo
     * sulla stessa commessa.
     */
    protected function create() {
        $input = $this->getRequestBody();

        $errore = $this->verificaValoreGgObbligatorio(
            $input['Tipo']        ?? null,
            $input['ID_COMMESSA'] ?? null,
            $input['Stato_Task']  ?? null,
            $input['Valore_gg']   ?? null
        );
        if ($errore !== null) {
            sendErrorResponse($errore, 400);
            return;
        }

        if (($input['Tipo'] ?? '') === 'Monitoraggio' && !empty($input['ID_COMMESSA'])) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT COUNT(*) FROM ANA_TASK
                     WHERE ID_COMMESSA = :commessa_id
                       AND Tipo = 'Monitoraggio'
                       AND Stato_Task NOT IN ('Chiuso', 'Archiviato')"
                );
                $stmt->bindValue(':commessa_id', $input['ID_COMMESSA']);
                $stmt->execute();
                if (intval($stmt->fetchColumn()) > 0) {
                    sendErrorResponse(
                        'Esiste già un task Monitoraggio attivo per questa commessa. Chiuderlo prima di crearne uno nuovo.',
                        409
                    );
                    return;
                }
            } catch (PDOException $e) {
                sendErrorResponse('Errore nella verifica task Monitoraggio: ' . $e->getMessage(), 500);
                return;
            }
        }

        parent::create();
    }

    /**
     * Override update per impedire sovrapposizioni temporali tra task Monitoraggio
     * della stessa commessa.
     */
    protected function update($id) {
        $input = $this->getRequestBody();

        // Il valore obbligatorio va verificato sullo stato in cui il task
        // resterà dopo il salvataggio: l'aggiornamento può essere parziale,
        // quindi i campi assenti si leggono dal record attuale.
        try {
            $curStmt = $this->db->prepare(
                "SELECT Tipo, ID_COMMESSA, Stato_Task, Valore_gg FROM ANA_TASK WHERE ID_TASK = :id"
            );
            $curStmt->bindValue(':id', $id);
            $curStmt->execute();
            $attuale = $curStmt->fetch() ?: [];
        } catch (PDOException $e) {
            $attuale = [];
        }

        $errore = $this->verificaValoreGgObbligatorio(
            array_key_exists('Tipo', $input)        ? $input['Tipo']        : ($attuale['Tipo']        ?? null),
            array_key_exists('ID_COMMESSA', $input) ? $input['ID_COMMESSA'] : ($attuale['ID_COMMESSA'] ?? null),
            array_key_exists('Stato_Task', $input)  ? $input['Stato_Task']  : ($attuale['Stato_Task']  ?? null),
            array_key_exists('Valore_gg', $input)   ? $input['Valore_gg']   : ($attuale['Valore_gg']   ?? null)
        );
        if ($errore !== null) {
            sendErrorResponse($errore, 400);
            return;
        }

        // Recupera tipo e commessa: prima dall'input, poi dal record esistente se non forniti
        $tipo       = $input['Tipo']        ?? null;
        $commessaId = $input['ID_COMMESSA'] ?? null;
        $dataApertura = $input['Data_Apertura_Task'] ?? null;
        $dataFine     = $input['Data_Fine']           ?? null;

        if ($tipo === null || $commessaId === null || $dataApertura === null) {
            // Carica il record corrente per completare i dati mancanti
            try {
                $cur = $this->db->prepare("SELECT Tipo, ID_COMMESSA, Data_Apertura_Task, Data_Fine FROM ANA_TASK WHERE ID_TASK = :id");
                $cur->bindValue(':id', $id);
                $cur->execute();
                $row = $cur->fetch();
                if ($row) {
                    $tipo         = $tipo         ?? $row['Tipo'];
                    $commessaId   = $commessaId   ?? $row['ID_COMMESSA'];
                    $dataApertura = $dataApertura ?? $row['Data_Apertura_Task'];
                    // Data_Fine può essere sovrascritta a NULL esplicitamente
                    if (!array_key_exists('Data_Fine', $input)) {
                        $dataFine = $row['Data_Fine'];
                    }
                }
            } catch (PDOException $e) {
                // non bloccante per il controllo, continua
            }
        }

        if ($tipo === 'Monitoraggio' && $commessaId && $dataApertura) {
            try {
                // Recupera tutti gli altri task Monitoraggio della stessa commessa
                $stmt = $this->db->prepare(
                    "SELECT ID_TASK, Task, Data_Apertura_Task, Data_Fine
                     FROM ANA_TASK
                     WHERE ID_COMMESSA = :commessa_id
                       AND Tipo = 'Monitoraggio'
                       AND ID_TASK != :task_id"
                );
                $stmt->bindValue(':commessa_id', $commessaId);
                $stmt->bindValue(':task_id', $id);
                $stmt->execute();
                $altri = $stmt->fetchAll(\PDO::FETCH_ASSOC);

                $fineEffettiva = $dataFine ?: '9999-12-31';

                foreach ($altri as $altro) {
                    $altroInizio = $altro['Data_Apertura_Task'] ?: '0000-01-01';
                    $altroFine   = $altro['Data_Fine']           ?: '9999-12-31';

                    // Sovrapposizione: i due intervalli si intersecano se inizio_A <= fine_B && inizio_B <= fine_A
                    if ($dataApertura <= $altroFine && $altroInizio <= $fineEffettiva) {
                        sendErrorResponse(
                            "Sovrapposizione temporale con il task Monitoraggio \"{$altro['Task']}\" " .
                            "(dal " . ($altro['Data_Apertura_Task'] ?: '—') .
                            " al " . ($altro['Data_Fine'] ?: 'aperto') . "). " .
                            "Modifica le date in modo che i periodi non si sovrappongano.",
                            409
                        );
                        return;
                    }
                }
            } catch (PDOException $e) {
                sendErrorResponse('Errore nella verifica sovrapposizione Monitoraggio: ' . $e->getMessage(), 500);
                return;
            }
        }

        parent::update($id);
    }

    /**
     * Override getAll per aggiungere i campi calcolati
     */
    protected function getAll() {
        try {
            $params = [];
            $whereClause = $this->buildScopedWhereClause($params);
            $orderBy = $this->getOrderBy();

            // Query semplice sulla tabella principale
            $sql = "SELECT * FROM {$this->table}";
            
            if (!empty($whereClause)) {
                $sql .= " WHERE $whereClause";
            }
            
            $sql .= " ORDER BY $orderBy";
            
            // Paginazione
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = max(1, min(1000, intval($_GET['limit'] ?? 1000))); // Aumentato limite di default
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
            $processedRecords = $this->applyRoleProjection($processedRecords);

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
            $params = [];
            $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";

            // Anche sul singolo record vale la restrizione di ruolo
            $roleScope = $this->getRoleScopeClause($params);
            if (!empty($roleScope)) {
                $sql .= " AND (" . $roleScope . ")";
            }

            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();

            $record = $stmt->fetch();
            if (!$record) {
                sendErrorResponse('Record non trovato', 404);
                return;
            }

            $processedRecord = $this->applyRoleProjection($this->processRecord($record));
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
            $record['costo_spese_maturato'] = $valoriMaturati['costo_spese'];

            // Calcola valori maturati filtrati per periodo se necessario
            if ($filtriPeriodo['attivo']) {
                $valoriMaturatiFiltrati = $this->calcolaValoriMaturatiFiltrati($record['ID_TASK'], $record, $filtriPeriodo);
                $record['valore_gg_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_gg'];
                $record['valore_spese_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_spese'];
                $record['valore_tot_maturato_filtrato'] = $valoriMaturatiFiltrati['valore_tot'];
                $record['costo_spese_maturato_filtrato'] = $valoriMaturatiFiltrati['costo_spese'];
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
            $record['costo_spese_maturato'] = 0;
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
            $costoSpese = $this->calcolaCostoSpeseFiltrato($taskId, $filtriPeriodo);

            return [
                'valore_gg' => round($valoreGg, 2),
                'valore_spese' => round($valoreSpese, 2),
                'valore_tot' => round($valoreTot, 2),
                'costo_spese' => round($costoSpese, 2)
            ];
        } catch (Exception $e) {
            return [
                'valore_gg' => 0,
                'valore_spese' => 0,
                'valore_tot' => 0,
                'costo_spese' => 0
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

            // Se il task è ancora attivo, cede il calcolo al task Monitoraggio più vecchio attivo
            // (tra task attivi della stessa commessa, valorizza solo quello con Data_Apertura_Task minore)
            if (!in_array($taskData['Stato_Task'] ?? '', ['Chiuso', 'Archiviato'])) {
                $dataApertura = $taskData['Data_Apertura_Task'] ?? '9999-12-31';
                $checkSql = "SELECT COUNT(*) FROM ANA_TASK
                             WHERE ID_COMMESSA = :commessa_id
                               AND Tipo = 'Monitoraggio'
                               AND Stato_Task NOT IN ('Chiuso', 'Archiviato')
                               AND ID_TASK != :task_id
                               AND (Data_Apertura_Task < :data_apertura
                                    OR (Data_Apertura_Task = :data_apertura2 AND ID_TASK < :task_id2))";
                $checkStmt = $this->db->prepare($checkSql);
                $checkStmt->bindValue(':commessa_id', $taskData['ID_COMMESSA']);
                $checkStmt->bindValue(':task_id',       $taskId);
                $checkStmt->bindValue(':data_apertura',  $dataApertura);
                $checkStmt->bindValue(':data_apertura2', $dataApertura);
                $checkStmt->bindValue(':task_id2',       $taskId);
                $checkStmt->execute();
                if (intval($checkStmt->fetchColumn()) > 0) {
                    return 0;
                }
            }

            // Filtra le giornate nell'intervallo di attività del task di monitoraggio
            $params = [
                ':commessa_id'         => $taskData['ID_COMMESSA'],
                ':task_id_monitoraggio' => $taskId
            ];
            $dateClause = '';
            if (!empty($taskData['Data_Apertura_Task'])) {
                $dateClause .= " AND g.Data >= :data_apertura";
                $params[':data_apertura'] = $taskData['Data_Apertura_Task'];
            }
            if (!empty($taskData['Data_Fine'])) {
                $dateClause .= " AND g.Data <= :data_fine";
                $params[':data_fine'] = $taskData['Data_Fine'];
            }
            
            $sql = "SELECT SUM(CAST(REPLACE(g.gg, ',', '.') AS DECIMAL(10,2)) * CAST(REPLACE(t.Valore_gg, ',', '.') AS DECIMAL(10,2))) as totale_valore_commessa
                    FROM FACT_GIORNATE g
                    JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    WHERE t.ID_COMMESSA = :commessa_id 
                      AND t.ID_TASK != :task_id_monitoraggio
                      AND g.Tipo = 'Campo'
                      {$dateClause}";
            
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
     * Calcola valore per task di monitoraggio filtrato per periodo
     */
    private function calcolaValoreMonitoraggioFiltrato($taskId, $taskData, $filtriPeriodo) {
        try {
            $prezzoGgMonitoraggio = floatval($taskData['Valore_gg'] ?? 0);
            if ($prezzoGgMonitoraggio <= 0) {
                return 0;
            }

            // Se il task è ancora attivo, cede il calcolo al task Monitoraggio più vecchio attivo
            if (!in_array($taskData['Stato_Task'] ?? '', ['Chiuso', 'Archiviato'])) {
                $dataApertura = $taskData['Data_Apertura_Task'] ?? '9999-12-31';
                $checkSql = "SELECT COUNT(*) FROM ANA_TASK
                             WHERE ID_COMMESSA = :commessa_id
                               AND Tipo = 'Monitoraggio'
                               AND Stato_Task NOT IN ('Chiuso', 'Archiviato')
                               AND ID_TASK != :task_id
                               AND (Data_Apertura_Task < :data_apertura
                                    OR (Data_Apertura_Task = :data_apertura2 AND ID_TASK < :task_id2))";
                $checkStmt = $this->db->prepare($checkSql);
                $checkStmt->bindValue(':commessa_id', $taskData['ID_COMMESSA']);
                $checkStmt->bindValue(':task_id',       $taskId);
                $checkStmt->bindValue(':data_apertura',  $dataApertura);
                $checkStmt->bindValue(':data_apertura2', $dataApertura);
                $checkStmt->bindValue(':task_id2',       $taskId);
                $checkStmt->execute();
                if (intval($checkStmt->fetchColumn()) > 0) {
                    return 0;
                }
            }

            $params = [
                ':commessa_id'          => $taskData['ID_COMMESSA'],
                ':task_id_monitoraggio' => $taskId
            ];
            
            // Filtro periodo (anno-mese o anno)
            $whereClause = '';
            if ($filtriPeriodo['tipo'] === 'anno_mese') {
                $whereClause = "AND DATE_FORMAT(g.Data, '%Y-%m') = :periodo";
                $params[':periodo'] = $filtriPeriodo['valore'];
            } elseif ($filtriPeriodo['tipo'] === 'anno') {
                $whereClause = "AND YEAR(g.Data) = :anno";
                $params[':anno'] = $filtriPeriodo['valore'];
            }
            
            // Filtra le giornate nell'intervallo di attività del task di monitoraggio
            if (!empty($taskData['Data_Apertura_Task'])) {
                $whereClause .= " AND g.Data >= :data_apertura";
                $params[':data_apertura'] = $taskData['Data_Apertura_Task'];
            }
            if (!empty($taskData['Data_Fine'])) {
                $whereClause .= " AND g.Data <= :data_fine";
                $params[':data_fine'] = $taskData['Data_Fine'];
            }
            
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

            // Senza prezzo di vendita il task non matura ricavo.
            // Qui c'era un fallback sulle tariffe dei collaboratori: non ha mai
            // funzionato (interrogava una colonna 'Al' inesistente, l'eccezione
            // veniva assorbita e tornava comunque 0) ed era concettualmente
            // sbagliato, perché usare la tariffa di costo come prezzo di vendita
            // produce margine zero per costruzione e inventerebbe ricavo sulle
            // commesse interne, dove l'assenza di prezzo è voluta.
            // I task Campo delle commesse cliente sono ora obbligati ad avere
            // Valore_gg (vedi verificaValoreGgObbligatorio).
            return 0;
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Ricavo spese del task limitato al periodo filtrato. Stessa regola della
     * versione totale: la diaria si conta una volta per giornata di campo del
     * periodo, non una volta sola perché il periodo contiene giornate.
     */
    private function calcolaValoreSpeseFilrato($taskId, $taskData, $filtriPeriodo) {
        try {
            $agg = $this->aggregaSpeseTask($taskId, $filtriPeriodo);
            return CalcoloSpese::ricavoAggregato($taskData, $agg);
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Costo spese del task limitato al periodo filtrato.
     */
    private function calcolaCostoSpeseFiltrato($taskId, $filtriPeriodo) {
        try {
            $agg = $this->aggregaSpeseTask($taskId, $filtriPeriodo);
            return $agg['spese_lorde'];
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
            // CORREZIONE: conta solo le giornate di tipo 'Campo' (Promo, Formazione etc. non concorrono alla quota)
            $sql = "SELECT SUM(CAST(REPLACE(gg, ',', '.') AS DECIMAL(10,2))) as total 
                    FROM FACT_GIORNATE 
                    WHERE ID_TASK = :id AND Tipo = 'Campo'";
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
            $costoSpese = $this->calcolaCostoSpese($taskId);

            return [
                'valore_gg' => round($valoreGg, 2),
                'valore_spese' => round($valoreSpese, 2),
                'valore_tot' => round($valoreTot, 2),
                'costo_spese' => round($costoSpese, 2)
            ];
        } catch (Exception $e) {
            return [
                'valore_gg' => 0,
                'valore_spese' => 0,
                'valore_tot' => 0,
                'costo_spese' => 0
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

            // Senza prezzo di vendita il task non matura ricavo: vedi la nota
            // in calcolaValoreGgFiltrato() sul perché il fallback sulle tariffe
            // dei collaboratori è stato rimosso invece che riparato.
            $totaleValore = 0;
            
            return $totaleValore;
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Ricavo spese del task: per ciascuna delle due categorie, la diaria per
     * ogni giornata di campo oppure le spese effettive se è a consuntivo.
     * Regole in CalcoloSpese.
     */
    private function calcolaValoreSpese($taskId, $taskData) {
        try {
            $agg = $this->aggregaSpeseTask($taskId);
            return CalcoloSpese::ricavoAggregato($taskData, $agg);
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Costo spese del task: l'esborso lordo di TUTTE le giornate, comprese
     * quelle da remoto, quelle senza viaggio e quelle dei task con le spese
     * comprese. Il costo non dipende da come la spesa è stata venduta.
     */
    private function calcolaCostoSpese($taskId) {
        try {
            $agg = $this->aggregaSpeseTask($taskId);
            return $agg['spese_lorde'];
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Aggrega in una sola query i numeri che servono al calcolo spese.
     *
     * I conteggi sono di righe, non somme dei gg: la diaria si paga intera
     * anche per le mezze giornate. Viaggi e vitto/alloggio hanno basi diverse
     * perché i viaggi si fermano alle giornate in cui la trasferta c'è stata.
     *
     * @param array $filtriPeriodo se valorizzato, restringe al periodo
     */
    private function aggregaSpeseTask($taskId, $filtriPeriodo = null) {
        $whereClause = '';
        $params = [':task_id' => $taskId];

        if ($filtriPeriodo) {
            if ($filtriPeriodo['tipo'] === 'anno_mese') {
                $whereClause = "AND DATE_FORMAT(Data, '%Y-%m') = :periodo";
                $params[':periodo'] = $filtriPeriodo['valore'];
            } elseif ($filtriPeriodo['tipo'] === 'anno') {
                $whereClause = "AND YEAR(Data) = :anno";
                $params[':anno'] = $filtriPeriodo['valore'];
            }
        }

        $addebitabili = CalcoloSpese::sqlGiornateAddebitabili();
        $conViaggio   = CalcoloSpese::sqlViaggiAddebitabili();
        $lorde        = CalcoloSpese::sqlSpeseLorde();
        $viaggi       = CalcoloSpese::sqlSpeseViaggi();
        $vitto        = CalcoloSpese::sqlSpeseVitto();

        $sql = "SELECT
                    SUM(CASE WHEN {$addebitabili} THEN 1 ELSE 0 END) AS n_addebitabili,
                    SUM(CASE WHEN {$conViaggio}   THEN 1 ELSE 0 END) AS n_con_viaggio,
                    SUM({$lorde}) AS spese_lorde,
                    SUM(CASE WHEN {$conViaggio}   THEN {$viaggi} ELSE 0 END) AS viaggi_sum,
                    SUM(CASE WHEN {$addebitabili} THEN {$vitto}  ELSE 0 END) AS vitto_sum
                FROM FACT_GIORNATE
                WHERE ID_TASK = :task_id {$whereClause}";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'n_addebitabili' => intval($row['n_addebitabili'] ?? 0),
            'n_con_viaggio'  => intval($row['n_con_viaggio'] ?? 0),
            'spese_lorde'    => floatval($row['spese_lorde'] ?? 0),
            'viaggi_sum'     => floatval($row['viaggi_sum'] ?? 0),
            'vitto_sum'      => floatval($row['vitto_sum'] ?? 0)
        ];
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
    /**
     * Il ruolo 'User' vede solo i task delle commesse che gli sono assegnate.
     */
    protected function getRoleScopeClause(&$params, $alias = '') {
        if (!$this->isRestrictedUser()) {
            return null;
        }

        return "{$alias}ID_COMMESSA IN (" . $this->visibleCommesseSubquery($params) . ")";
    }

    /**
     * Esclusi i prezzi di vendita (Valore_gg e i quattro campi di regime spese)
     * e i valori maturati: la scheda task del ruolo 'User' mostra solo i giorni
     * effettuati sui previsti.
     */
    protected function getRestrictedUserFields() {
        return [
            'ID_TASK', 'Task', 'Desc_Task', 'ID_COMMESSA', 'ID_COLLABORATORE',
            'Tipo', 'Data_Apertura_Task', 'Data_Inizio', 'Data_Fine',
            'Stato_Task', 'gg_previste',
            'gg_effettuate', 'gg_effettuate_filtrate',
            'commessa_nome', 'cliente_nome', 'responsabile_commessa', 'collaboratore_nome'
        ];
    }

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
        
        foreach (['Spese_Comprese_Viaggi', 'Spese_Comprese_Vitto_Alloggio'] as $flag) {
            if (!isset($data[$flag]) || empty($data[$flag])) {
                $data[$flag] = 'No';
            }
        }

        if (isset($data['Data_Apertura_Task']) && !empty($data['Data_Apertura_Task'])) {
            $data['Data_Apertura_Task'] = date('Y-m-d', strtotime($data['Data_Apertura_Task']));
        }
        
        if (isset($data['Data_Inizio']) && !empty($data['Data_Inizio'])) {
            $data['Data_Inizio'] = date('Y-m-d', strtotime($data['Data_Inizio']));
        }
        
        // Normalizza Data_Fine e applica logica di chiusura automatica
        if (isset($data['Data_Fine']) && !empty($data['Data_Fine'])) {
            $data['Data_Fine'] = date('Y-m-d', strtotime($data['Data_Fine']));
            // Se Data_Fine è oggi o nel passato → chiudi automaticamente il task
            if ($data['Data_Fine'] <= date('Y-m-d')) {
                $data['Stato_Task'] = 'Chiuso';
            }
        }
        
        // Se il task viene chiuso/archiviato, imposta Data_Fine a oggi se non già presente
        if (isset($data['Stato_Task']) && in_array($data['Stato_Task'], ['Chiuso', 'Archiviato'])) {
            if (empty($data['Data_Fine'])) {
                $data['Data_Fine'] = date('Y-m-d');
            }
        }
        
        // Una categoria compresa nel valore giornata non ha diaria: il form la
        // nasconde, qui la si azzera perché non resti un valore orfano che
        // riemergerebbe se il regime tornasse a 'No'.
        if (($data['Spese_Comprese_Viaggi'] ?? null) === 'Si') {
            $data['Valore_Spese_std_Viaggi'] = null;
        }
        if (($data['Spese_Comprese_Vitto_Alloggio'] ?? null) === 'Si') {
            $data['Valore_Spese_std_Vitto_Alloggio'] = null;
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