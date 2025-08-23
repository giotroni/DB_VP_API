<?php
// Test debug per AuthAPI
require_once '../DB/config.php';

// Funzione semplice per testare la connessione
function testDatabase() {
    try {
        echo "<h2>Test Connessione Database</h2>";
        
        // Usa la nuova classe di connessione
        $db = getDatabase();
        echo "<p style='color: green;'>✅ Connessione riuscita!</p>";
        
        // Test conteggio collaboratori
        $stmt = $db->query("SELECT COUNT(*) as count FROM ANA_COLLABORATORI");
        $result = $stmt->fetch();
        echo "<p>Numero collaboratori nel database: " . $result['count'] . "</p>";
        
        // Test query semplice con email
        echo "<h3>Test 1: Query con Email</h3>";
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User FROM ANA_COLLABORATORI WHERE Email = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute(['gtroni@vaglioandpartners.com']);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "<p style='color: green;'>✅ Utente trovato con email:</p>";
            echo "<pre>" . print_r($user, true) . "</pre>";
        } else {
            echo "<p style='color: red;'>❌ Utente NON trovato con email</p>";
        }
        
        // Test query semplice con username
        echo "<h3>Test 2: Query con Username</h3>";
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User FROM ANA_COLLABORATORI WHERE User = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute(['gtroni']);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "<p style='color: green;'>✅ Utente trovato con username:</p>";
            echo "<pre>" . print_r($user, true) . "</pre>";
        } else {
            echo "<p style='color: red;'>❌ Utente NON trovato con username</p>";
        }
        
        // Test query con OR usando parametri posizionali
        echo "<h3>Test 3: Query con OR (parametri posizionali)</h3>";
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User FROM ANA_COLLABORATORI WHERE Email = ? OR User = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute(['gtroni', 'gtroni']);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "<p style='color: green;'>✅ Utente trovato con OR (posizionali):</p>";
            echo "<pre>" . print_r($user, true) . "</pre>";
        } else {
            echo "<p style='color: red;'>❌ Utente NON trovato con OR (posizionali)</p>";
        }
        
        // Test query con OR usando parametri nominati (stesso valore)
        echo "<h3>Test 4: Query con OR (parametri nominati - stesso valore)</h3>";
        $sql = "SELECT ID_COLLABORATORE, Collaboratore, Email, User FROM ANA_COLLABORATORI WHERE Email = :cred OR User = :cred";
        $stmt = $db->prepare($sql);
        $stmt->execute(['cred' => 'gtroni']);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "<p style='color: green;'>✅ Utente trovato con OR (nominati):</p>";
            echo "<pre>" . print_r($user, true) . "</pre>";
        } else {
            echo "<p style='color: red;'>❌ Utente NON trovato con OR (nominati)</p>";
        }
        
        // Test elenco tutti gli utenti per debug
        echo "<h3>Test 5: Elenco tutti gli utenti</h3>";
        $stmt = $db->query("SELECT ID_COLLABORATORE, Collaboratore, Email, User FROM ANA_COLLABORATORI LIMIT 5");
        $users = $stmt->fetchAll();
        echo "<pre>" . print_r($users, true) . "</pre>";
        
    } catch (Exception $e) {
        echo "<p style='color: red;'>❌ ERRORE: " . $e->getMessage() . "</p>";
        echo "<p>Traccia:</p><pre>" . $e->getTraceAsString() . "</pre>";
    }
}

// Esegui test
?>
<!DOCTYPE html>
<html>
<head>
    <title>Debug AuthAPI</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Debug AuthAPI - Test Database</h1>
    <?php testDatabase(); ?>
</body>
</html>