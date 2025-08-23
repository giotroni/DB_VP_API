<?php
// Test per la funzionalità di password dimenticata

require_once 'API/AuthAPI.php';
require_once 'DB/config.php';

// Inizializza l'API
$authAPI = new AuthAPI();

// Test con email di esempio
$testEmail = 'test@example.com'; // Sostituisci con un'email valida presente nel database

echo "<h2>Test Reset Password</h2>";
echo "<p>Testing email: $testEmail</p>";

// Testa la funzione forgotPassword
$result = $authAPI->forgotPassword($testEmail);

echo "<h3>Risultato:</h3>";
echo "<pre>";
print_r($result);
echo "</pre>";

// Test di controllo: verifica se ci sono utenti nel database
echo "<h3>Verifica utenti nel database:</h3>";
try {
    $pdo = new PDO($dsn, $username, $password, $options);
    $stmt = $pdo->query("SELECT ID_COLLABORATORE, Collaboratore, Email FROM ANA_COLLABORATORI LIMIT 5");
    $users = $stmt->fetchAll();
    
    echo "<table border='1' cellpadding='5'>";
    echo "<tr><th>ID</th><th>Nome</th><th>Email</th></tr>";
    foreach ($users as $user) {
        echo "<tr>";
        echo "<td>{$user['ID_COLLABORATORE']}</td>";
        echo "<td>{$user['Collaboratore']}</td>";
        echo "<td>{$user['Email']}</td>";
        echo "</tr>";
    }
    echo "</table>";
    
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}

// Test con email di un utente reale
if (!empty($users)) {
    $realEmail = $users[0]['Email'];
    echo "<h3>Test con email reale: $realEmail</h3>";
    
    $realResult = $authAPI->forgotPassword($realEmail);
    echo "<pre>";
    print_r($realResult);
    echo "</pre>";
}
?>