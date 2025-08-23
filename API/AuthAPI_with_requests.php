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
     * Autentica un utente con email/username e password crittografata
     */
    public function authenticate($emailOrUsername, $password) {
        try {
            // Cerca l'utente per email O username usando parametri posizionali
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User, PWD, Ruolo 
                    FROM ANA_COLLABORATORI 
                    WHERE (Email = ? OR User = ?)
                    AND PWD IS NOT NULL 
                    AND PWD != ''";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$emailOrUsername, $emailOrUsername]);
            
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
     * Reset password - genera una password semplice e la invia via email
     */
    public function resetPassword($emailOrUsername) {
        try {
            // Cerca l'utente per email O username usando parametri posizionali
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User 
                    FROM ANA_COLLABORATORI 
                    WHERE (Email = ? OR User = ?)";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$emailOrUsername, $emailOrUsername]);
            
            $user = $stmt->fetch();
            
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Utente non trovato'
                ];
            }
            
            // Genera password semplice (8 caratteri: 4 lettere + 4 numeri)
            $newPassword = $this->generateSimplePassword();
            
            // Hash della password
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            // Aggiorna la password nel database
            $updateSql = "UPDATE ANA_COLLABORATORI 
                         SET PWD = ?, 
                             Data_Modifica = NOW(),
                             ID_UTENTE_MODIFICA = 'SYSTEM_RESET'
                         WHERE ID_COLLABORATORE = ?";
                         
            $updateStmt = $this->db->prepare($updateSql);
            $updateResult = $updateStmt->execute([
                $hashedPassword,
                $user['ID_COLLABORATORE']
            ]);
            
            if (!$updateResult) {
                return [
                    'success' => false,
                    'message' => 'Errore durante l\'aggiornamento della password'
                ];
            }
            
            // Invia email con la nuova password
            $emailSent = $this->sendPasswordResetEmail($user, $newPassword);
            
            if ($emailSent) {
                return [
                    'success' => true,
                    'message' => 'Una nuova password è stata generata e inviata al tuo indirizzo email.'
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Password aggiornata ma errore nell\'invio dell\'email. Contatta l\'amministratore.'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il reset della password: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Genera una password semplice (8 caratteri: lettere e numeri)
     */
    private function generateSimplePassword() {
        $letters = 'abcdefghijklmnopqrstuvwxyz';
        $numbers = '0123456789';
        
        $password = '';
        
        // 4 lettere casuali
        for ($i = 0; $i < 4; $i++) {
            $password .= $letters[rand(0, strlen($letters) - 1)];
        }
        
        // 4 numeri casuali
        for ($i = 0; $i < 4; $i++) {
            $password .= $numbers[rand(0, strlen($numbers) - 1)];
        }
        
        // Mescola i caratteri
        return str_shuffle($password);
    }
    
    /**
     * Invia email con la nuova password
     */
    private function sendPasswordResetEmail($user, $newPassword) {
        try {
            $to = $user['Email'];
            $nome = $user['Collaboratore'];
            $username = $user['User'] ?? $user['Email'];
            
            $subject = "Reset Password - Sistema Consuntivazione V&P";
            
            $message = "
            <html>
            <head>
                <title>Reset Password - Sistema Consuntivazione</title>
            </head>
            <body>
                <h2>Reset Password Effettuato</h2>
                <p>Ciao {$nome},</p>
                
                <p>È stata generata una nuova password per il tuo account nel sistema di consuntivazione di Vaglio & Partners.</p>
                
                <h3>Le tue nuove credenziali:</h3>
                <ul>
                    <li><strong>Username:</strong> {$username}</li>
                    <li><strong>Email:</strong> {$to}</li>
                    <li><strong>Nuova Password:</strong> <span style='background-color: #f0f0f0; padding: 5px; font-family: monospace;'>{$newPassword}</span></li>
                </ul>
                
                <p><strong>Importante:</strong> Per motivi di sicurezza, ti consigliamo di cambiare questa password al primo accesso.</p>
                
                <p>Puoi accedere al sistema usando sia il tuo username che la tua email.</p>
                
                <p>Se non hai richiesto questo reset, contatta immediatamente l'amministratore del sistema.</p>
                
                <hr>
                <p><em>Questo messaggio è stato generato automaticamente dal sistema di consuntivazione V&P.</em></p>
            </body>
            </html>
            ";
            
            // Headers per email HTML
            $headers = array(
                'MIME-Version: 1.0',
                'Content-type: text/html; charset=UTF-8',
                'From: noreply@vagliopartners.com',
                'Reply-To: info@vagliopartners.com',
                'X-Mailer: PHP/' . phpversion()
            );
            
            // Invia l'email
            $result = mail($to, $subject, $message, implode("\r\n", $headers));
            
            if ($result) {
                error_log("Email di reset password inviata con successo a: " . $to);
                return true;
            } else {
                error_log("Errore nell'invio dell'email di reset password a: " . $to);
                return false;
            }
            
        } catch (Exception $e) {
            error_log("Errore durante l'invio dell'email di reset password: " . $e->getMessage());
            return false;
        }
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
                    WHERE (c.ID_COLLABORATORE = ? OR t.ID_COLLABORATORE = ?)
                    AND c.Stato_Commessa IN ('In corso', 'Sospesa')
                    ORDER BY c.Commessa";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$userId, $userId]);
            
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
                    
            $params = ['user_id' => $userId];
            
            if ($commessaId) {
                $sql .= " AND t.ID_COMMESSA = :commessa_id";
                $params['commessa_id'] = $commessaId;
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
                    'message' => 'Email/Username e password sono richiesti'
                ]);
                exit;
            }
            
            $result = $authAPI->authenticate($email, $password);
            echo json_encode($result);
            break;
            
        case 'reset_password':
            $emailOrUsername = $input['email'] ?? $input['username'] ?? '';
            
            if (empty($emailOrUsername)) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Email o Username sono richiesti'
                ]);
                exit;
            }
            
            $result = $authAPI->resetPassword($emailOrUsername);
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