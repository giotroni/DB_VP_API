<?php
/**
 * Script di utilità per crittografare le password nella tabella ANA_COLLABORATORI
 * Eseguire questo script per convertire password in plain text a password hashate
 */

require_once '../DB/config.php';

class PasswordHasher {
    private $db;
    
    public function __construct() {
        $this->db = getDatabase();
    }
    
    /**
     * Mostra tutte le password non hashate
     */
    public function checkPasswords() {
        echo "=== CONTROLLO PASSWORD NELLA TABELLA ANA_COLLABORATORI ===\n\n";
        
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, PWD 
                FROM ANA_COLLABORATORI 
                WHERE PWD IS NOT NULL AND PWD != ''";
                
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        
        $collaboratori = $stmt->fetchAll();
        
        if (empty($collaboratori)) {
            echo "Nessun collaboratore trovato con password.\n";
            return;
        }
        
        echo "Collaboratori trovati con password:\n";
        echo "ID\t\tNome\t\t\tEmail\t\t\tPassword Hashata?\n";
        echo str_repeat("-", 80) . "\n";
        
        foreach ($collaboratori as $collab) {
            $isHashed = $this->isPasswordHashed($collab['PWD']);
            $status = $isHashed ? "✅ SÌ" : "❌ NO (Plain Text)";
            
            printf("%-15s %-20s %-30s %s\n", 
                $collab['ID_COLLABORATORE'], 
                substr($collab['Collaboratore'], 0, 18), 
                substr($collab['Email'], 0, 28),
                $status
            );
        }
        
        echo "\n";
    }
    
    /**
     * Crittografa tutte le password in plain text
     */
    public function hashAllPasswords() {
        echo "=== CRITTOGRAFIA PASSWORD IN PLAIN TEXT ===\n\n";
        
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, PWD 
                FROM ANA_COLLABORATORI 
                WHERE PWD IS NOT NULL AND PWD != ''";
                
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        
        $collaboratori = $stmt->fetchAll();
        $hashCount = 0;
        
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
                    echo "✅ Password crittografata per: {$collab['Collaboratore']} ({$collab['Email']})\n";
                    $hashCount++;
                } else {
                    echo "❌ Errore crittografia per: {$collab['Collaboratore']}\n";
                }
            } else {
                echo "⏭️  Password già hashata per: {$collab['Collaboratore']}\n";
            }
        }
        
        echo "\n=== COMPLETATO ===\n";
        echo "Password crittografate: {$hashCount}\n";
        
        if ($hashCount > 0) {
            echo "\nOra i collaboratori possono accedere all'app consuntivazione con:\n";
            echo "- Email: il loro indirizzo email nel database\n";
            echo "- Password: la loro password originale (ora hashata nel DB)\n";
        }
    }
    
    /**
     * Crittografa la password di un collaboratore specifico
     */
    public function hashPasswordForUser($email, $newPassword) {
        echo "=== AGGIORNAMENTO PASSWORD PER UTENTE ===\n\n";
        
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        
        $sql = "UPDATE ANA_COLLABORATORI 
                SET PWD = :hashed_password 
                WHERE Email = :email";
                
        $stmt = $this->db->prepare($sql);
        $result = $stmt->execute([
            ':hashed_password' => $hashedPassword,
            ':email' => $email
        ]);
        
        if ($result && $stmt->rowCount() > 0) {
            echo "✅ Password aggiornata per utente: {$email}\n";
            echo "Nuova password: {$newPassword}\n";
            echo "Password hashata salvata nel database.\n";
        } else {
            echo "❌ Errore: utente non trovato o password non aggiornata.\n";
        }
    }
    
    /**
     * Testa la verifica di una password
     */
    public function testPasswordVerification($email, $testPassword) {
        echo "=== TEST VERIFICA PASSWORD ===\n\n";
        
        $sql = "SELECT PWD FROM ANA_COLLABORATORI WHERE Email = :email";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':email' => $email]);
        
        $user = $stmt->fetch();
        
        if (!$user) {
            echo "❌ Utente non trovato: {$email}\n";
            return;
        }
        
        $isValid = password_verify($testPassword, $user['PWD']);
        
        if ($isValid) {
            echo "✅ Password corretta per: {$email}\n";
        } else {
            echo "❌ Password non corretta per: {$email}\n";
        }
        
        echo "Password testata: {$testPassword}\n";
        echo "Hash nel DB: " . substr($user['PWD'], 0, 50) . "...\n";
    }
    
    /**
     * Controlla se una password è già hashata
     */
    private function isPasswordHashed($password) {
        // Le password hashate con password_hash() iniziano con $2y$ o $2b$
        return (strlen($password) >= 60 && (strpos($password, '$2y$') === 0 || strpos($password, '$2b$') === 0));
    }
}

// Gestione comandi da riga di comando
if (php_sapi_name() === 'cli') {
    $hasher = new PasswordHasher();
    
    echo "UTILITÀ GESTIONE PASSWORD V&P\n";
    echo "==============================\n\n";
    
    if (count($argv) < 2) {
        echo "Utilizzo:\n";
        echo "php password_hasher.php check                              - Controlla stato password\n";
        echo "php password_hasher.php hash_all                          - Crittografa tutte le password plain text\n";
        echo "php password_hasher.php set_password email@domain.com pwd - Imposta password per utente\n";
        echo "php password_hasher.php test email@domain.com password    - Testa verifica password\n";
        exit;
    }
    
    $command = $argv[1];
    
    switch ($command) {
        case 'check':
            $hasher->checkPasswords();
            break;
            
        case 'hash_all':
            echo "⚠️  ATTENZIONE: Questa operazione crittograferà tutte le password in plain text.\n";
            echo "Continuare? (y/N): ";
            $confirm = trim(fgets(STDIN));
            if (strtolower($confirm) === 'y') {
                $hasher->hashAllPasswords();
            } else {
                echo "Operazione annullata.\n";
            }
            break;
            
        case 'set_password':
            if (count($argv) < 4) {
                echo "Errore: specificare email e password\n";
                echo "Esempio: php password_hasher.php set_password mario@company.com nuovapassword\n";
                exit;
            }
            $hasher->hashPasswordForUser($argv[2], $argv[3]);
            break;
            
        case 'test':
            if (count($argv) < 4) {
                echo "Errore: specificare email e password da testare\n";
                echo "Esempio: php password_hasher.php test mario@company.com password123\n";
                exit;
            }
            $hasher->testPasswordVerification($argv[2], $argv[3]);
            break;
            
        default:
            echo "Comando non riconosciuto: {$command}\n";
    }
} else {
    // Esecuzione da web (solo per test in sviluppo)
    header('Content-Type: text/plain; charset=utf-8');
    
    $hasher = new PasswordHasher();
    
    if (isset($_GET['action'])) {
        switch ($_GET['action']) {
            case 'check':
                $hasher->checkPasswords();
                break;
                
            case 'test':
                if (isset($_GET['email']) && isset($_GET['password'])) {
                    $hasher->testPasswordVerification($_GET['email'], $_GET['password']);
                } else {
                    echo "Parametri mancanti: email e password richiesti\n";
                }
                break;
                
            default:
                echo "Azione non supportata via web per sicurezza.\n";
                echo "Usa la riga di comando per operazioni di modifica.\n";
        }
    } else {
        echo "UTILITÀ GESTIONE PASSWORD V&P\n";
        echo "==============================\n\n";
        echo "Azioni disponibili via web (solo lettura):\n";
        echo "?action=check - Controlla stato password\n";
        echo "?action=test&email=user@domain.com&password=pwd - Testa password\n";
        echo "\nPer modifiche, usa la riga di comando.\n";
    }
}
?>