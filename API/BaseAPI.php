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
            $limit = isset($_GET['limit']) ? min(100, max(1, intval($_GET['limit']))) : 50;
            $offset = ($page - 1) * $limit;
            
            // Costruzione query base
            $sql = "SELECT * FROM {$this->table}";
            $params = [];
            
            // Aggiunta filtri personalizzati
            $whereClause = $this->buildWhereClause($params);
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
            $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            
            $data = $stmt->fetch();
            
            if (!$data) {
                sendErrorResponse('Record non trovato', 404);
                return;
            }
            
            // Post-processing del record
            $data = $this->processRecord($data);
            
            sendSuccessResponse($data);
            
        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il recupero del record: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Crea un nuovo record
     */
    protected function create() {
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
            
            // Generazione ID se necessario
            if (!isset($data[$this->primaryKey])) {
                $data[$this->primaryKey] = $this->generateId();
            }
            
            // Costruzione query INSERT
            $fields = array_keys($data);
            $placeholders = ':' . implode(', :', $fields);
            $sql = "INSERT INTO {$this->table} (" . implode(', ', $fields) . ") VALUES ($placeholders)";
            
            $stmt = $this->db->prepare($sql);
            
            // Bind dei parametri
            foreach ($data as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }
            
            $stmt->execute();
            
            // Recupera il record appena creato
            $newId = $data[$this->primaryKey];
            $this->getById($newId);
            
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                sendErrorResponse('Record già esistente o violazione constraint', 409);
            } else {
                sendErrorResponse('Errore durante la creazione: ' . $e->getMessage(), 500);
            }
        }
    }
    
    /**
     * Aggiorna un record esistente
     */
    protected function update($id) {
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
            
            // Validazione input (permette campi parziali per update)
            $validation = $this->validateInput($input, false);
            if (!$validation['valid']) {
                sendErrorResponse('Dati non validi: ' . implode(', ', $validation['errors']), 400);
                return;
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
        // In futuro implementare autenticazione JWT
        return 'SYSTEM';
    }
}
?>