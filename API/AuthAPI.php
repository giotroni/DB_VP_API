<?php
/**
 * AuthAPI - Sistema di autenticazione per l'app di consuntivazione
 */

require_once '../DB/config.php';

class AuthAPI {
    private $db;
    
    public function __construct() {
        $this->db = getDatabase();
    }
    
    /**
     * Autentica un utente con email e password crittografata
     */
    public function authenticate($email, $password) {
        try {
            // Cerca l'utente solo per email
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, PWD, Ruolo 
                    FROM ANA_COLLABORATORI 
                    WHERE Email = :email
                    AND PWD IS NOT NULL 
                    AND PWD != ''";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':email' => $email]);
            
            $user = $stmt->fetch();
            
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Utente non trovato'
                ];
            }
            
            // Verifica password (considerando che potrebbe essere in plain text nel DB)
            if ($this->verifyPassword($password, $user['PWD'])) {
                // Genera session token (semplice per questa implementazione)
                $sessionToken = $this->generateSessionToken();
                
                // Salva la sessione (in un'implementazione reale dovresti usare Redis o database)
                $_SESSION['user_id'] = $user['ID_COLLABORATORE'];
                $_SESSION['user_name'] = $user['Collaboratore'];
                $_SESSION['user_email'] = $user['Email'];
                $_SESSION['user_role'] = $user['Ruolo'];
                $_SESSION['session_token'] = $sessionToken;
                $_SESSION['login_time'] = time();
                
                return [
                    'success' => true,
                    'message' => 'Login effettuato con successo',
                    'user' => [
                        'id' => $user['ID_COLLABORATORE'],
                        'name' => $user['Collaboratore'],
                        'email' => $user['Email'],
                        'role' => $user['Ruolo']
                    ],
                    'session_token' => $sessionToken
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Password non corretta'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante l\'autenticazione: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Verifica se l'utente è autenticato
     */
    public function isAuthenticated() {
        if (!isset($_SESSION['user_id']) || !isset($_SESSION['session_token'])) {
            return false;
        }
        
        // Verifica che la sessione non sia scaduta (24 ore)
        if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time']) > 86400) {
            $this->logout();
            return false;
        }
        
        return true;
    }
    
    /**
     * Ottieni i dati dell'utente corrente
     */
    public function getCurrentUser() {
        if (!$this->isAuthenticated()) {
            return null;
        }
        
        return [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role' => $_SESSION['user_role']
        ];
    }
    
    /**
     * Logout utente
     */
    public function logout() {
        session_unset();
        session_destroy();
        return [
            'success' => true,
            'message' => 'Logout effettuato con successo'
        ];
    }
    
    /**
     * Verifica password crittografata (usa solo password_verify per hash)
     */
    private function verifyPassword($inputPassword, $storedPassword) {
        // Verifica password hashata con password_hash() (metodo sicuro)
        if (password_verify($inputPassword, $storedPassword)) {
            return true;
        }
        
        // Fallback per password con hash MD5/SHA1 legacy (se necessario)
        // Decommenta solo se hai password legacy con hash diversi
        /*
        if (md5($inputPassword) === $storedPassword) {
            return true;
        }
        
        if (sha1($inputPassword) === $storedPassword) {
            return true;
        }
        */
        
        return false;
    }
    
    /**
     * Genera un token di sessione semplice
     */
    private function generateSessionToken() {
        return bin2hex(random_bytes(32));
    }
    
    /**
     * Ottieni le commesse accessibili per l'utente corrente
     */
    public function getUserCommesse($userId) {
        try {
            $sql = "SELECT DISTINCT c.ID_COMMESSA, c.Commessa, cl.Cliente
                    FROM ANA_COMMESSE c
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    LEFT JOIN ANA_TASK t ON c.ID_COMMESSA = t.ID_COMMESSA
                    WHERE (c.ID_COLLABORATORE = :user_id OR t.ID_COLLABORATORE = :user_id)
                    AND c.Stato_Commessa IN ('In corso', 'Sospesa')
                    ORDER BY c.Commessa";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':user_id' => $userId]);
            
            return $stmt->fetchAll();
            
        } catch (Exception $e) {
            return [];
        }
    }
    
    /**
     * Ottieni i task per una commessa specifica accessibili all'utente
     */
    public function getUserTasks($userId, $commessaId = null) {
        try {
            $sql = "SELECT t.ID_TASK, t.Task, t.Tipo, t.Stato_Task, c.Commessa
                    FROM ANA_TASK t
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    WHERE t.ID_COLLABORATORE = :user_id
                    AND t.Stato_Task IN ('In corso', 'Sospeso')";
                    
            $params = [':user_id' => $userId];
            
            if ($commessaId) {
                $sql .= " AND t.ID_COMMESSA = :commessa_id";
                $params[':commessa_id'] = $commessaId;
            }
            
            $sql .= " ORDER BY c.Commessa, t.Task";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            return $stmt->fetchAll();
            
        } catch (Exception $e) {
            return [];
        }
    }
}

// Gestione delle richieste API
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    session_start();
    
    $authAPI = new AuthAPI();
    $input = json_decode(file_get_contents('php://input'), true);
    
    setJSONHeaders();
    
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'login':
            $email = $input['email'] ?? $input['username'] ?? '';
            $password = $input['password'] ?? '';
            
            if (empty($email) || empty($password)) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Email e password sono richiesti'
                ]);
                exit;
            }
            
            $result = $authAPI->authenticate($email, $password);
            echo json_encode($result);
            break;
            
        case 'logout':
            $result = $authAPI->logout();
            echo json_encode($result);
            break;
            
        case 'check':
            if ($authAPI->isAuthenticated()) {
                $user = $authAPI->getCurrentUser();
                echo json_encode([
                    'success' => true,
                    'authenticated' => true,
                    'user' => $user
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'authenticated' => false
                ]);
            }
            break;
            
        case 'get_commesse':
            if (!$authAPI->isAuthenticated()) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Non autenticato'
                ]);
                exit;
            }
            
            $user = $authAPI->getCurrentUser();
            $commesse = $authAPI->getUserCommesse($user['id']);
            echo json_encode([
                'success' => true,
                'data' => $commesse
            ]);
            break;
            
        case 'get_tasks':
            if (!$authAPI->isAuthenticated()) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Non autenticato'
                ]);
                exit;
            }
            
            $user = $authAPI->getCurrentUser();
            $commessaId = $input['commessa_id'] ?? null;
            $tasks = $authAPI->getUserTasks($user['id'], $commessaId);
            echo json_encode([
                'success' => true,
                'data' => $tasks
            ]);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non valida'
            ]);
    }
} else {
    setJSONHeaders();
    echo json_encode([
        'success' => false,
        'message' => 'Metodo non supportato'
    ]);
}
?>