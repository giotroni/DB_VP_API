<?php
/**
 * Password Manager API - Backend per l'interfaccia web di gestione password
 */

// Abilita la visualizzazione degli errori per debug
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Gestione preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Funzione per logging errori
function logError($message) {
    error_log("[Password Manager] " . $message);
}

class PasswordManager {
    private $db;
    
    public function __construct() {
        try {
            $this->db = getDatabase();
            if (!$this->db) {
                throw new Exception("Impossibile connettersi al database");
            }
        } catch (Exception $e) {
            logError("Errore connessione database: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Controlla lo stato delle password
     */
    public function checkPasswords() {
        try {
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, PWD 
                    FROM ANA_COLLABORATORI 
                    WHERE PWD IS NOT NULL AND PWD != ''
                    ORDER BY Collaboratore";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            
            $collaboratori = $stmt->fetchAll();
            $result = [];
            
            foreach ($collaboratori as $collab) {
                $result[] = [
                    'id' => $collab['ID_COLLABORATORE'],
                    'name' => $collab['Collaboratore'],
                    'email' => $collab['Email'],
                    'is_hashed' => $this->isPasswordHashed($collab['PWD'])
                ];
            }
            
            return [
                'success' => true,
                'data' => $result
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il controllo password: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Crittografa tutte le password in plain text
     */
    public function hashAllPasswords() {
        try {
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, PWD 
                    FROM ANA_COLLABORATORI 
                    WHERE PWD IS NOT NULL AND PWD != ''";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            
            $collaboratori = $stmt->fetchAll();
            $hashedCount = 0;
            $alreadyHashed = 0;
            $errors = [];
            
            foreach ($collaboratori as $collab) {
                if (!$this->isPasswordHashed($collab['PWD'])) {
                    $hashedPassword = password_hash($collab['PWD'], PASSWORD_DEFAULT);
                    
                    $updateSql = "UPDATE ANA_COLLABORATORI 
                                 SET PWD = :hashed_password 
                                 WHERE ID_COLLABORATORE = :id";
                                 
                    $updateStmt = $this->db->prepare($updateSql);
                    $result = $updateStmt->execute([
                        ':hashed_password' => $hashedPassword,
                        ':id' => $collab['ID_COLLABORATORE']
                    ]);
                    
                    if ($result) {
                        $hashedCount++;
                    } else {
                        $errors[] = "Errore per {$collab['Collaboratore']}";
                    }
                } else {
                    $alreadyHashed++;
                }
            }
            
            $message = "Operazione completata. Password crittografate: {$hashedCount}, già hashate: {$alreadyHashed}";
            if (!empty($errors)) {
                $message .= ". Errori: " . implode(', ', $errors);
            }
            
            return [
                'success' => true,
                'message' => $message,
                'data' => [
                    'hashed_count' => $hashedCount,
                    'already_hashed' => $alreadyHashed,
                    'errors' => $errors
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante la crittografia: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Imposta password per un utente specifico
     */
    public function setUserPassword($email, $password) {
        try {
            if (empty($email) || empty($password)) {
                return [
                    'success' => false,
                    'message' => 'Email e password sono richiesti'
                ];
            }
            
            // Verifica che l'utente esista
            $checkSql = "SELECT ID_COLLABORATORE, Collaboratore FROM ANA_COLLABORATORI WHERE Email = :email";
            $checkStmt = $this->db->prepare($checkSql);
            $checkStmt->execute([':email' => $email]);
            $user = $checkStmt->fetch();
            
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Utente non trovato con email: ' . $email
                ];
            }
            
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            
            $sql = "UPDATE ANA_COLLABORATORI 
                    SET PWD = :hashed_password 
                    WHERE Email = :email";
                    
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                ':hashed_password' => $hashedPassword,
                ':email' => $email
            ]);
            
            if ($result && $stmt->rowCount() > 0) {
                return [
                    'success' => true,
                    'message' => 'Password aggiornata con successo per ' . $user['Collaboratore'],
                    'data' => [
                        'email' => $email,
                        'name' => $user['Collaboratore']
                    ]
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore durante l\'aggiornamento della password'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante l\'impostazione password: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Testa la verifica di una password
     */
    public function testPassword($email, $password) {
        try {
            if (empty($email) || empty($password)) {
                return [
                    'success' => false,
                    'message' => 'Email e password sono richiesti per il test'
                ];
            }
            
            $sql = "SELECT Collaboratore, PWD FROM ANA_COLLABORATORI WHERE Email = :email";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':email' => $email]);
            
            $user = $stmt->fetch();
            
            if (!$user) {
                return [
                    'success' => true,
                    'data' => [
                        'is_valid' => false,
                        'user_found' => false,
                        'message' => 'Utente non trovato'
                    ]
                ];
            }
            
            $isValid = password_verify($password, $user['PWD']);
            
            return [
                'success' => true,
                'data' => [
                    'is_valid' => $isValid,
                    'user_found' => true,
                    'user_name' => $user['Collaboratore'],
                    'message' => $isValid ? 'Password corretta' : 'Password non corretta'
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il test password: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Controlla se una password è già hashata
     */
    private function isPasswordHashed($password) {
        // Le password hashate con password_hash() iniziano con $2y$ o $2b$ e sono lunghe almeno 60 caratteri
        return (strlen($password) >= 60 && (strpos($password, '$2y$') === 0 || strpos($password, '$2b$') === 0));
    }
}

// Gestione delle richieste
try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Fallback per form data
        if (!$input) {
            $input = $_POST;
        }
        
        if (!isset($input['action'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Azione non specificata'
            ]);
            exit;
        }
        
        $manager = new PasswordManager();
        $action = $input['action'];
        
        switch ($action) {
            case 'check':
                $result = $manager->checkPasswords();
                break;
                
            case 'hash_all':
                $result = $manager->hashAllPasswords();
                break;
                
            case 'set_password':
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                $result = $manager->setUserPassword($email, $password);
                break;
                
            case 'test_password':
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                $result = $manager->testPassword($email, $password);
                break;
                
            default:
                $result = [
                    'success' => false,
                    'message' => 'Azione non riconosciuta: ' . $action
                ];
        }
        
        echo json_encode($result);
        
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Endpoint GET per controllo semplice (compatibilità)
        if (isset($_GET['action']) && $_GET['action'] === 'check') {
            $manager = new PasswordManager();
            $result = $manager->checkPasswords();
            echo json_encode($result);
        } else if (isset($_GET['action']) && $_GET['action'] === 'test') {
            $email = $_GET['email'] ?? '';
            $password = $_GET['password'] ?? '';
            
            if ($email && $password) {
                $manager = new PasswordManager();
                $result = $manager->testPassword($email, $password);
                echo json_encode($result);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Parametri email e password richiesti'
                ]);
            }
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Endpoint GET disponibili: ?action=check oppure ?action=test&email=...&password=...'
            ]);
        }
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Metodo non supportato'
        ]);
    }
} catch (Exception $e) {
    logError("Errore generale: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Errore del server: ' . $e->getMessage(),
        'debug' => [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
}
?>