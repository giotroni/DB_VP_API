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
            
            // Verifica la password - supporta sia password in chiaro che hashate
            $passwordMatch = false;
            
            // Prima prova con password in chiaro (per compatibilità con CSV esistente)
            if ($password === $user['PWD']) {
                $passwordMatch = true;
            }
            // Altrimenti prova con password hashate
            elseif (password_verify($password, $user['PWD'])) {
                $passwordMatch = true;
            }
            
            if (!$passwordMatch) {
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
            $_SESSION['user_username'] = $user['User'];
            $_SESSION['logged_in'] = true;
            
            return [
                'success' => true,
                'message' => 'Login effettuato con successo',
                'user' => [
                    'id' => $user['ID_COLLABORATORE'],
                    'nome' => explode(' ', $user['Collaboratore'])[0] ?? $user['Collaboratore'],
                    'cognome' => explode(' ', $user['Collaboratore'], 2)[1] ?? '',
                    'email' => $user['Email'],
                    'ruolo' => $user['Ruolo'],
                    'username' => $user['User']
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
            'nome' => explode(' ', $_SESSION['user_name'])[0] ?? $_SESSION['user_name'],
            'cognome' => explode(' ', $_SESSION['user_name'], 2)[1] ?? '',
            'email' => $_SESSION['user_email'],
            'ruolo' => $_SESSION['user_role'],
            'username' => $_SESSION['user_username'] ?? ''
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
    
    /**
     * Ottieni la lista di tutti i collaboratori (solo per Admin/Manager)
     */
    public function getCollaboratoriList() {
        try {
            // Verifica che l'utente corrente sia Admin o Manager
            $currentUser = $this->getCurrentUser();
            if (!$currentUser || !in_array($currentUser['ruolo'], ['Admin', 'Manager'])) {
                return [];
            }
            
            $sql = "SELECT 
                        ID_COLLABORATORE,
                        Collaboratore,
                        Email,
                        User,
                        Ruolo,
                        PIVA,
                        Data_Creazione
                    FROM ANA_COLLABORATORI 
                    ORDER BY Collaboratore";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            
            return $stmt->fetchAll();
            
        } catch (Exception $e) {
            error_log('Errore nel recupero della lista collaboratori: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Cambia la password dell'utente autenticato
     */
    public function changePassword($currentPassword, $newPassword) {
        try {
            // Verifica che l'utente sia autenticato
            if (!$this->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            // Validazione lunghezza nuova password
            if (strlen($newPassword) < 6) {
                return [
                    'success' => false,
                    'message' => 'La nuova password deve essere lunga almeno 6 caratteri'
                ];
            }
            
            $user = $this->getCurrentUser();
            
            // Verifica la password attuale
            $sql = "SELECT PWD FROM ANA_COLLABORATORI WHERE ID_COLLABORATORE = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch();
            
            if (!$userData) {
                return [
                    'success' => false,
                    'message' => 'Utente non trovato'
                ];
            }
            
            // Verifica password attuale
            if (!password_verify($currentPassword, $userData['PWD'])) {
                return [
                    'success' => false,
                    'message' => 'Password attuale non corretta'
                ];
            }
            
            // Hash della nuova password
            $hashedNewPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            // Aggiorna la password nel database
            $updateSql = "UPDATE ANA_COLLABORATORI SET PWD = ?, Data_Modifica = NOW() WHERE ID_COLLABORATORE = ?";
            $updateStmt = $this->db->prepare($updateSql);
            $updateResult = $updateStmt->execute([$hashedNewPassword, $user['id']]);
            
            if ($updateResult) {
                // Invia email di conferma
                $this->sendPasswordChangeNotification($user);
                
                return [
                    'success' => true,
                    'message' => 'Password cambiata con successo'
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
                'message' => 'Errore interno: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Invia notifica email per cambio password
     */
    private function sendPasswordChangeNotification($user) {
        try {
            $to = $user['email'];
            $subject = "Conferma Cambio Password - Sistema Consuntivazione V&P";
            $headers = "From: noreply@vepsystem.com\r\n";
            $headers .= "Reply-To: noreply@vepsystem.com\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            
            $message = "
            <html>
            <head>
                <title>Conferma Cambio Password</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .footer { background-color: #e9ecef; padding: 15px; text-align: center; font-size: 12px; }
                    .alert { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class='header'>
                    <h2>🔐 Conferma Cambio Password</h2>
                </div>
                <div class='content'>
                    <p>Ciao <strong>{$user['name']}</strong>,</p>
                    
                    <div class='alert'>
                        <strong>✅ Password cambiata con successo!</strong><br>
                        La tua password per accedere al Sistema di Consuntivazione V&P è stata modificata correttamente.
                    </div>
                    
                    <p><strong>Dettagli del cambio:</strong></p>
                    <ul>
                        <li><strong>Utente:</strong> {$user['name']} ({$user['email']})</li>
                        <li><strong>Data e ora:</strong> " . date('d/m/Y H:i:s') . "</li>
                        <li><strong>IP:</strong> " . ($_SERVER['REMOTE_ADDR'] ?? 'N/A') . "</li>
                    </ul>
                    
                    <p>Se non hai effettuato tu questa modifica, contatta immediatamente l'amministratore del sistema.</p>
                    
                    <p>Puoi accedere al sistema utilizzando la nuova password al seguente link:<br>
                    <a href='#' style='color: #007bff;'>Sistema Consuntivazione V&P</a></p>
                </div>
                <div class='footer'>
                    <p>Questo messaggio è stato generato automaticamente dal Sistema di Consuntivazione V&P.<br>
                    Non rispondere a questa email.</p>
                </div>
            </body>
            </html>
            ";
            
            // Invia l'email
            mail($to, $subject, $message, $headers);
            
        } catch (Exception $e) {
            // Log dell'errore ma non bloccare il processo
            error_log("Errore invio email cambio password: " . $e->getMessage());
        }
    }
    
    /**
     * Password dimenticata - invia nuova password via email
     */
    public function forgotPassword($email) {
        try {
            // Cerca l'utente per email
            $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email FROM ANA_COLLABORATORI WHERE Email = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Email non trovata nel sistema'
                ];
            }
            
            // Genera una nuova password temporanea
            $newPassword = $this->generateTemporaryPassword();
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            
            // Aggiorna la password nel database
            $updateSql = "UPDATE ANA_COLLABORATORI SET PWD = ?, Data_Modifica = NOW() WHERE ID_COLLABORATORE = ?";
            $updateStmt = $this->db->prepare($updateSql);
            $updateResult = $updateStmt->execute([$hashedPassword, $user['ID_COLLABORATORE']]);
            
            if ($updateResult) {
                // Invia la nuova password via email
                $emailSent = $this->sendNewPasswordEmail($user, $newPassword);
                
                if ($emailSent) {
                    return [
                        'success' => true,
                        'message' => 'Nuova password inviata via email'
                    ];
                } else {
                    return [
                        'success' => false,
                        'message' => 'Password aggiornata ma errore nell\'invio email. Contatta l\'amministratore.'
                    ];
                }
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore durante l\'aggiornamento della password'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore interno: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Genera una password temporanea sicura
     */
    private function generateTemporaryPassword($length = 10) {
        $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        $password = '';
        
        for ($i = 0; $i < $length; $i++) {
            $password .= $characters[random_int(0, strlen($characters) - 1)];
        }
        
        return $password;
    }
    
    /**
     * Invia email con nuova password
     */
    private function sendNewPasswordEmail($user, $newPassword) {
        try {
            $to = $user['Email'];
            $subject = "Nuova Password - Sistema Consuntivazione V&P";
            $headers = "From: noreply@vepsystem.com\r\n";
            $headers .= "Reply-To: noreply@vepsystem.com\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            
            $message = "
            <html>
            <head>
                <title>Nuova Password</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .footer { background-color: #e9ecef; padding: 15px; text-align: center; font-size: 12px; }
                    .password-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center; }
                    .password { font-size: 18px; font-weight: bold; font-family: monospace; color: #856404; }
                </style>
            </head>
            <body>
                <div class='header'>
                    <h2>🔑 Nuova Password Generata</h2>
                </div>
                <div class='content'>
                    <p>Ciao <strong>{$user['Collaboratore']}</strong>,</p>
                    
                    <p>Hai richiesto il reset della password per accedere al Sistema di Consuntivazione V&P.</p>
                    
                    <div class='password-box'>
                        <p><strong>La tua nuova password temporanea è:</strong></p>
                        <div class='password'>{$newPassword}</div>
                    </div>
                    
                    <p><strong>Importante:</strong></p>
                    <ul>
                        <li>Accedi al sistema con questa password temporanea</li>
                        <li>Cambia immediatamente la password dal menu utente</li>
                        <li>Usa una password sicura di almeno 6 caratteri</li>
                        <li>Non condividere questa password con nessuno</li>
                    </ul>
                    
                    <p><strong>Dettagli richiesta:</strong></p>
                    <ul>
                        <li><strong>Email:</strong> {$user['Email']}</li>
                        <li><strong>Data e ora:</strong> " . date('d/m/Y H:i:s') . "</li>
                        <li><strong>IP:</strong> " . ($_SERVER['REMOTE_ADDR'] ?? 'N/A') . "</li>
                    </ul>
                    
                    <p>Se non hai richiesto tu questo reset, contatta immediatamente l'amministratore del sistema.</p>
                    
                    <p style='text-align: center; margin-top: 30px;'>
                        <a href='#' style='background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;'>
                            Accedi al Sistema V&P
                        </a>
                    </p>
                </div>
                <div class='footer'>
                    <p>Questo messaggio è stato generato automaticamente dal Sistema di Consuntivazione V&P.<br>
                    Non rispondere a questa email.</p>
                </div>
            </body>
            </html>
            ";
            
            // Invia l'email
            $result = mail($to, $subject, $message, $headers);
            
            // Log per debug
            if ($result) {
                error_log("Email reset password inviata con successo a: " . $to);
            } else {
                error_log("Errore invio email reset password a: " . $to);
            }
            
            return $result;
            
        } catch (Exception $e) {
            error_log("Errore invio email reset password: " . $e->getMessage());
            return false;
        }
    }
}
?>