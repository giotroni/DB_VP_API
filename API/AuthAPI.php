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
                    WHERE (Email = ? OR User = ?)";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$emailOrUsername, $emailOrUsername]);
            
            $user = $stmt->fetch();
            
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Credenziali non valide'
                ];
            }
            
            // Verifica la password usando password_verify() per password hashate con password_hash()
            if (!password_verify($password, $user['PWD'])) {
                return [
                    'success' => false,
                    'message' => 'Password non corretta'
                ];
            }
            
            // Avvia la sessione e salva i dati dell'utente
            if (session_status() == PHP_SESSION_NONE) {
                session_start();
            }
            
            $_SESSION['user_id'] = $user['ID_COLLABORATORE'];
            $_SESSION['user_name'] = $user['Collaboratore'];
            $_SESSION['user_email'] = $user['Email'];
            $_SESSION['user_role'] = $user['Ruolo'];
            $_SESSION['logged_in'] = true;
            
            return [
                'success' => true,
                'message' => 'Login effettuato con successo',
                'user' => [
                    'id' => $user['ID_COLLABORATORE'],
                    'name' => $user['Collaboratore'],
                    'email' => $user['Email'],
                    'role' => $user['Ruolo']
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante l\'autenticazione: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Reset password dell'utente corrente
     */
    public function resetPassword($newPassword) {
        try {
            if (!$this->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $userId = $_SESSION['user_id'];
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            $sql = "UPDATE ANA_COLLABORATORI SET PWD = ? WHERE ID_COLLABORATORE = ?";
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([$hashedPassword, $userId]);
            
            if ($result) {
                return [
                    'success' => true,
                    'message' => 'Password aggiornata con successo'
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
                'message' => 'Errore durante il reset della password: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Logout dell'utente
     */
    public function logout() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        // Distrugge tutti i dati della sessione
        $_SESSION = array();
        
        // Se si desidera terminare completamente la sessione, cancellare anche il cookie di sessione
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        session_destroy();
        
        return [
            'success' => true,
            'message' => 'Logout effettuato con successo'
        ];
    }
    
    /**
     * Verifica se l'utente è autenticato
     */
    public function isAuthenticated() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    }
    
    /**
     * Ottieni le informazioni dell'utente corrente
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
     * Verifica lo stato di autenticazione
     */
    public function checkAuthentication() {
        if ($this->isAuthenticated()) {
            return [
                'success' => true,
                'authenticated' => true,
                'user' => $this->getCurrentUser()
            ];
        } else {
            return [
                'success' => true,
                'authenticated' => false,
                'user' => null
            ];
        }
    }
    
    /**
     * Ottieni i task dell'utente
     */
    public function getUserTasks($userId, $commessaId = null) {
        try {
            $sql = "SELECT 
                        t.ID_TASK,
                        t.Task,
                        t.Desc_Task as Descrizione,
                        t.ID_COMMESSA,
                        c.Commessa,
                        cl.Cliente
                    FROM ANA_TASK t
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE t.ID_COLLABORATORE = ?
                    AND t.Stato_Task = 'In corso'";
            
            $params = [$userId];
            
            if ($commessaId) {
                $sql .= " AND t.ID_COMMESSA = ?";
                $params[] = $commessaId;
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
?>