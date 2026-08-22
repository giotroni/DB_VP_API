<?php
/**
 * BaseAPI - Classe base per tutte le API CRUD
 * Fornisce funzionalità comuni per la gestione delle richieste HTTP
 */

abstract class BaseAPI {
    protected $db;
    protected $table;
    protected $primaryKey;
    protected $requiredFields = [];
    protected $validationRules = [];

    /**
     * Colonne NOT NULL che la scheda puo' mandare vuote.
     *
     * Ogni scheda del frontend converte i campi vuoti in null prima di
     * salvare, e i campi che non si applicano al caso in corso (il regime
     * spese di un task senza spese, l'attesa di un ordine su un ordine) sono
     * spesso proprio vuoti. Su una colonna NOT NULL quel null diventa
     * "Column X cannot be null", e si vede SOLO in modifica: in creazione i
     * valori predefiniti di preprocessData fanno da rete, e quelli valgono
     * solo li'. Il record si crea e poi non si tocca piu'.
     *
     * In aggiornamento un campo assente vuol dire "non lo cambio" - l'UPDATE
     * elenca solo i campi ricevuti - quindi togliere un valore vuoto lascia
     * in colonna quello che c'era, che e' esattamente cio' che la scheda
     * intendeva dire.
     *
     * Elencare qui le colonne NOT NULL della tabella (le chiavi primarie no:
     * quelle mancano solo per errore, e un errore deve farsi sentire).
     */
    protected $campiObbligatoriDb = [];
    
    public function __construct($table, $primaryKey) {
        $this->db = getDatabase();
        $this->table = $table;
        $this->primaryKey = $primaryKey;
    }
    
    /**
     * Gestisce la richiesta HTTP principale
     */
    public function handleRequest($id = null) {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'GET':
                if ($id) {
                    $this->getById($id);
                } else {
                    $this->getAll();
                }
                break;
                
            case 'POST':
                $this->create();
                break;
                
            case 'PUT':
                if (!$id) {
                    sendErrorResponse('ID richiesto per aggiornamento', 400);
                }
                $this->update($id);
                break;
                
            case 'DELETE':
                if (!$id) {
                    sendErrorResponse('ID richiesto per eliminazione', 400);
                }
                $this->delete($id);
                break;
                
            default:
                sendErrorResponse('Metodo HTTP non supportato', 405);
                break;
        }
    }
    
    /**
     * Recupera tutti i record con filtri opzionali
     */
    protected function getAll() {
        try {
            // Parse dei parametri di query
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
            $limit = isset($_GET['limit']) ? min(1000, max(1, intval($_GET['limit']))) : 1000; // Aumentato limite di default
            $offset = ($page - 1) * $limit;
            
            // Costruzione query base
            $sql = "SELECT * FROM {$this->table}";
            $params = [];
            
            // Filtri della richiesta + restrizione di ruolo
            $whereClause = $this->buildScopedWhereClause($params);
            if ($whereClause) {
                $sql .= " WHERE " . $whereClause;
            }
            
            // Aggiunta ordinamento
            $orderBy = $this->getOrderBy();
            if ($orderBy) {
                $sql .= " ORDER BY " . $orderBy;
            }
            
            // Count totale per paginazione
            $countSql = "SELECT COUNT(*) as total FROM {$this->table}";
            if ($whereClause) {
                $countSql .= " WHERE " . $whereClause;
            }
            
            $countStmt = $this->db->prepare($countSql);
            $countStmt->execute($params);
            $total = $countStmt->fetch()['total'];
            
            // Query principale con paginazione
            $sql .= " LIMIT :limit OFFSET :offset";
            $stmt = $this->db->prepare($sql);
            
            // Bind dei parametri
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            
            $stmt->execute();
            $data = $stmt->fetchAll();
            
            // Post-processing dei dati
            $data = array_map([$this, 'processRecord'], $data);
            $data = $this->applyRoleProjection($data);

            sendSuccessResponse([
                'data' => $data,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il recupero dei dati: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Recupera un singolo record per ID
     */
    protected function getById($id) {
        try {
            $params = [];
            $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";

            // La restrizione di ruolo vale anche sul singolo record: senza,
            // basterebbe conoscere un ID per aggirare il filtro dell'elenco.
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

            $data = $stmt->fetch();

            if (!$data) {
                // Stesso 404 sia che il record non esista sia che non sia
                // visibile: non si conferma l'esistenza di ciò che non si vede.
                sendErrorResponse('Record non trovato', 404);
                return;
            }

            // Post-processing del record
            $data = $this->processRecord($data);
            $data = $this->applyRoleProjection($data);

            sendSuccessResponse($data);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il recupero del record: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Crea un nuovo record
     */
    protected function create() {
        $this->assertWriteAllowed();

        try {
            $input = $this->getRequestBody();

            // Validazione input
            $validation = $this->validateInput($input);
            if (!$validation['valid']) {
                sendErrorResponse('Dati non validi: ' . implode(', ', $validation['errors']), 400);
                return;
            }
            
            // Pre-processing dei dati
            $data = $this->preprocessData($input);
            
            // Aggiunta campi automatici
            $data['Data_Creazione'] = date('Y-m-d H:i:s');
            $data['ID_UTENTE_CREAZIONE'] = $this->getCurrentUserId();
            
            // Generazione ID e inserimento con retry per evitare collisioni in scenari concorrenti
            $providedId = isset($data[$this->primaryKey]) && !empty($data[$this->primaryKey]);

            // Se la PK non è stata fornita dal client, proviamo più volte a generare un ID
            if (!$providedId) {
                $maxAttempts = 6; // numero tentativi (numero ragionevole per collisioni occasionali)
                $attempt = 0;
                $inserted = false;

                while ($attempt < $maxAttempts && !$inserted) {
                    $attempt++;
                    // (ri)genera un ID univoco
                    $data[$this->primaryKey] = $this->generateId();

                    // Ricostruisci campi/placeholders SQL dopo aver inserito la PK
                    $fields = array_keys($data);
                    $placeholders = ':' . implode(', :', $fields);
                    $sql = "INSERT INTO {$this->table} (" . implode(', ', $fields) . ") VALUES ($placeholders)";

                    try {
                        $stmt = $this->db->prepare($sql);
                        // Bind dei parametri aggiornati (solo quelli presenti nei placeholders)
                        foreach ($fields as $key) {
                            $stmt->bindValue(':' . $key, $data[$key]);
                        }
                        $stmt->execute();
                        $inserted = true;
                        $newId = $data[$this->primaryKey];
                        // Recupera il record appena creato
                        $this->getById($newId);
                        return; // terminare la funzione dopo successo
                    } catch (PDOException $e) {
                        // Se è un duplicate key, proviamo di nuovo (fino al maxAttempts)
                        if ($e->getCode() == 23000 && $attempt < $maxAttempts) {
                            // log e ritenta
                            $this->logPDOException($e, "create_retry_attempt_{$attempt}");
                            // piccolo sleep per ridurre probabilità di collisione in burst (microsecond)
                            usleep(20000); // 20ms
                            continue;
                        }
                        // altrimenti rilanciamo l'errore per il catch esterno
                        throw $e;
                    }
                }

                // Se non siamo riusciti ad inserire dopo i tentativi, segnaliamo errore
                if (!$inserted) {
                    sendErrorResponse('Impossibile generare un ID univoco per la risorsa (retry falliti)', 500);
                    return;
                }
            } else {
                // PK fornita dal client: comportamento tradizionale (nessun retry)
                $fields = array_keys($data);
                $placeholders = ':' . implode(', :', $fields);
                $sql = "INSERT INTO {$this->table} (" . implode(', ', $fields) . ") VALUES ($placeholders)";
                $stmt = $this->db->prepare($sql);
                foreach ($fields as $key) {
                    $stmt->bindValue(':' . $key, $data[$key]);
                }
                $stmt->execute();
                $newId = $data[$this->primaryKey];
                $this->getById($newId);
                return;
            }
            
        } catch (PDOException $e) {
            // Log exception for server-side debugging
            $this->logPDOException($e, 'create');

            if ($e->getCode() == 23000) {
                // Try to extract a short reason from the SQLSTATE/driver message
                $errorMsg = $e->getMessage();
                $reason = $this->extractConstraintReason($errorMsg);
                // Return a sanitized message and a machine-friendly reason field
                sendErrorResponse(['message' => 'Record già esistente o violazione constraint', 'error_reason' => $reason], 409);
            } else {
                sendErrorResponse('Errore durante la creazione: ' . $e->getMessage(), 500);
            }
        }
    }

    /**
     * Log PDO exceptions to a file for debugging (non public)
     */
    protected function logPDOException(PDOException $e, $context = '') {
        try {
            $logDir = __DIR__ . '/logs';
            if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
            $logFile = $logDir . '/api_errors.log';
            $entry = date('c') . " [{$context}] PDOException code=" . $e->getCode() . " message=" . str_replace("\n", ' ', $e->getMessage()) . "\n";
            @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
        } catch (Exception $ex) {
            // ignore logging failures
        }
    }

    /**
     * Attempt to infer a short reason from a PDO message (sanitized)
     */
    protected function extractConstraintReason($msg) {
        $lower = strtolower($msg);
        if (strpos($lower, 'duplicate') !== false || strpos($lower, 'duplicate entry') !== false) {
            // try to extract field/key name
            if (preg_match("/for key '(.+?)'/i", $msg, $m)) {
                return 'duplicate_key:' . $m[1];
            }
            return 'duplicate_key';
        }
        if (strpos($lower, 'foreign key') !== false || strpos($lower, 'constraint') !== false) {
            // try to extract constraint name
            if (preg_match("/constraint `?(.+?)`? failed/i", $msg, $m)) {
                return 'fk_violation:' . $m[1];
            }
            if (preg_match("/a foreign key constraint fails/i", $lower)) {
                return 'fk_violation';
            }
            return 'constraint_violation';
        }
        return 'constraint_violation';
    }
    
    /**
     * Aggiorna un record esistente
     */
    protected function update($id) {
        $this->assertWriteAllowed();

        try {
            // Verifica esistenza record
            $existsQuery = "SELECT 1 FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $existsStmt = $this->db->prepare($existsQuery);
            $existsStmt->bindValue(':id', $id);
            $existsStmt->execute();
            
            if (!$existsStmt->fetch()) {
                sendErrorResponse('Record non trovato', 404);
                return;
            }
            
            $input = $this->getRequestBody();

            // Aggiungi l'ID primario ai dati di input in modo che sia disponibile per le regole di validazione
            // che altrimenti rileverebbero il record come un duplicato di se stesso.
            $input[$this->primaryKey] = $id;
            
            // Validazione input (permette campi parziali per update)
            $validation = $this->validateInput($input, false);
            if (!$validation['valid']) {
                sendErrorResponse('Dati non validi: ' . implode(', ', $validation['errors']), 400);
                return;
            }
            
            // Un valore vuoto su una colonna NOT NULL non e' "azzerala": e'
            // "non la sto cambiando". Vedi $campiObbligatoriDb.
            foreach ($this->campiObbligatoriDb as $campo) {
                if (array_key_exists($campo, $input) && ($input[$campo] === null || $input[$campo] === '')) {
                    unset($input[$campo]);
                }
            }

            // Pre-processing dei dati
            $data = $this->preprocessData($input);
            
            // Aggiunta campi automatici
            $data['Data_Modifica'] = date('Y-m-d H:i:s');
            $data['ID_UTENTE_MODIFICA'] = $this->getCurrentUserId();
            
            // Rimuovi chiave primaria se presente
            unset($data[$this->primaryKey]);
            
            if (empty($data)) {
                sendErrorResponse('Nessun campo da aggiornare', 400);
                return;
            }
            
            // Costruzione query UPDATE
            $setClause = [];
            foreach (array_keys($data) as $field) {
                $setClause[] = "$field = :$field";
            }
            
            $sql = "UPDATE {$this->table} SET " . implode(', ', $setClause) . " WHERE {$this->primaryKey} = :id";
            $stmt = $this->db->prepare($sql);
            
            // Bind dei parametri
            foreach ($data as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }
            $stmt->bindValue(':id', $id);
            
            $stmt->execute();
            
            // Recupera il record aggiornato
            $this->getById($id);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante l\'aggiornamento: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Elimina un record
     */
    protected function delete($id) {
        $this->assertWriteAllowed();

        try {
            // Verifica esistenza record
            $existsQuery = "SELECT 1 FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $existsStmt = $this->db->prepare($existsQuery);
            $existsStmt->bindValue(':id', $id);
            $existsStmt->execute();
            
            if (!$existsStmt->fetch()) {
                sendErrorResponse('Record non trovato', 404);
                return;
            }
            
            // Verifica vincoli prima dell'eliminazione
            $constraintCheck = $this->checkDeleteConstraints($id);
            if (!$constraintCheck['canDelete']) {
                sendErrorResponse($constraintCheck['message'], 409);
                return;
            }
            
            $sql = "DELETE FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            
            sendSuccessResponse(['id' => $id], 'Record eliminato con successo');
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante l\'eliminazione: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Recupera il body della richiesta HTTP
     */
    protected function getRequestBody() {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            sendErrorResponse('JSON non valido', 400);
        }
        
        return $data ?? [];
    }
    
    /**
     * Metodi da implementare nelle classi derivate
     */
    abstract protected function validateInput($data, $requireAll = true);
    abstract protected function generateId();
    
    /**
     * Metodi con implementazione di default (sovrascrivibili)
     */
    protected function processRecord($record) {
        return $record;
    }
    
    protected function preprocessData($data) {
        return $data;
    }
    
    protected function buildWhereClause(&$params) {
        return '';
    }
    
    protected function getOrderBy() {
        return $this->primaryKey;
    }
    
    protected function checkDeleteConstraints($id) {
        return ['canDelete' => true, 'message' => ''];
    }
    
    protected function getCurrentUserId() {
        // Avvia la sessione se non è già attiva
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        // Se c'è un utente autenticato, usa il suo ID
        if (isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
            return $_SESSION['user_id'];
        }

        // Fallback per compatibilità con operazioni di sistema
        return 'SYSTEM';
    }

    // ========================================================================
    // AUTORIZZAZIONE PER RUOLO
    //
    // L'autenticazione (chi sei) è gestita da API/index.php, che rifiuta le
    // richieste senza sessione. Qui si decide cosa quel qualcuno può vedere e
    // toccare. Il ruolo 'User' è l'unico limitato: è il collaboratore che
    // consuntiva, e in Management vede la sola sezione Commesse & Task senza
    // alcun dato economico.
    //
    // Le restrizioni sono tre e vivono tutte qui, così che una nuova risorsa
    // sia limitata per default invece che per memoria di chi la scrive:
    //   1. getRoleScopeClause()      - quali righe (condizione SQL)
    //   2. getRestrictedUserFields() - quali colonne (allowlist)
    //   3. assertWriteAllowed()      - la scrittura è vietata
    // ========================================================================

    /**
     * Ruolo dell'utente in sessione ('Admin', 'Manager', 'User', 'Amministrazione').
     */
    protected function getCurrentUserRole() {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        return $_SESSION['user_role'] ?? null;
    }

    /**
     * True per gli utenti a visibilità limitata.
     */
    protected function isRestrictedUser() {
        return $this->getCurrentUserRole() === 'User';
    }

    /**
     * Sottoquery delle commesse visibili all'utente corrente.
     * Usata da quasi tutte le risorse: la visibilità è concessa a livello di
     * commessa (ANA_COMMESSE_VISIBILITA) e da lì discende su task e giornate.
     */
    protected function visibleCommesseSubquery(&$params) {
        $placeholder = $this->newScopeParam($params, $this->getCurrentUserId());
        return "SELECT ID_COMMESSA FROM ANA_COMMESSE_VISIBILITA WHERE ID_COLLABORATORE = $placeholder";
    }

    /**
     * Registra un parametro con nome univoco e lo restituisce.
     *
     * Serve perché il driver è configurato con PDO::ATTR_EMULATE_PREPARES a
     * false: in quella modalità lo stesso placeholder non può comparire più
     * volte nella query. Alcune restrizioni usano la sottoquery delle commesse
     * visibili due o tre volte, quindi ogni occorrenza ha il proprio nome.
     */
    protected function newScopeParam(&$params, $value) {
        static $counter = 0;
        $placeholder = ':scope_p' . (++$counter);
        $params[$placeholder] = $value;
        return $placeholder;
    }

    /**
     * Condizione SQL che limita le righe visibili all'utente corrente.
     * Null o stringa vuota = nessuna restrizione. Da sovrascrivere in ogni
     * risorsa che contiene dati non destinati al ruolo 'User'.
     *
     * @param string $alias prefisso di tabella (es. 'c.') quando la query usa un alias
     */
    protected function getRoleScopeClause(&$params, $alias = '') {
        return null;
    }

    /**
     * Where completa: filtri della richiesta + restrizione di ruolo.
     * È final perché è il punto in cui la restrizione viene applicata: le
     * sottoclassi personalizzano getRoleScopeClause(), non questa.
     */
    final protected function buildScopedWhereClause(&$params, $alias = '') {
        $parts = [];

        $requestFilters = $this->buildWhereClause($params);
        if (!empty($requestFilters)) {
            $parts[] = '(' . $requestFilters . ')';
        }

        $roleScope = $this->getRoleScopeClause($params, $alias);
        if (!empty($roleScope)) {
            $parts[] = '(' . $roleScope . ')';
        }

        return implode(' AND ', $parts);
    }

    /**
     * Colonne visibili al ruolo 'User'. Null = tutte.
     * Serve a non spedire al client dati che il front-end si limita a
     * nascondere: importi, tariffe, commissioni, contatti.
     */
    protected function getRestrictedUserFields() {
        return null;
    }

    /**
     * Applica l'allowlist di colonne a un record o a un elenco di record.
     */
    protected function applyRoleProjection($data) {
        if (!$this->isRestrictedUser()) {
            return $data;
        }

        $allowed = $this->getRestrictedUserFields();
        if ($allowed === null) {
            return $data;
        }

        // Elenco di record
        if (is_array($data) && array_is_list($data)) {
            return array_map(function ($record) use ($allowed) {
                return is_array($record) ? array_intersect_key($record, array_flip($allowed)) : $record;
            }, $data);
        }

        // Record singolo
        return is_array($data) ? array_intersect_key($data, array_flip($allowed)) : $data;
    }

    /**
     * Blocca le scritture per il ruolo 'User'.
     * In Management gli utenti 'User' non hanno alcun pulsante di modifica, e
     * la consuntivazione passa da ConsuntivazioneAPI.php, che ha controlli
     * propri: nessun flusso legittimo scrive da qui con quel ruolo.
     */
    protected function assertWriteAllowed() {
        $this->assertNotRestrictedUser();
    }

    /**
     * Nega l'operazione al ruolo 'User'.
     * Da usare anche sui percorsi di sola lettura che aggirano il filtro di
     * ruolo perché costruiscono SQL proprio (aggregazioni, riepiloghi).
     */
    protected function assertNotRestrictedUser() {
        if ($this->isRestrictedUser()) {
            sendErrorResponse('Operazione non consentita per il tuo ruolo', 403);
        }
    }
}
?>
