<?php
/**
 * Test semplice per verificare il funzionamento base delle API
 */

// Abilita display errori per debug
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== API BASIC TEST ===\n\n";

// Test 1: Verifica se possiamo includere il config
echo "1. Testing config inclusion...\n";
try {
    require_once '../DB/config.php';
    echo "✅ Config loaded successfully\n";
} catch (Exception $e) {
    echo "❌ Config error: " . $e->getMessage() . "\n";
    exit;
}

// Test 2: Verifica connessione database
echo "\n2. Testing database connection...\n";
try {
    $db = DatabaseConnection::getInstance();
    if ($db->testConnection()) {
        echo "✅ Database connection successful\n";
    } else {
        echo "❌ Database connection failed\n";
    }
} catch (Exception $e) {
    echo "❌ Database error: " . $e->getMessage() . "\n";
}

// Test 3: Verifica BaseAPI
echo "\n3. Testing BaseAPI inclusion...\n";
try {
    require_once 'BaseAPI.php';
    echo "✅ BaseAPI loaded successfully\n";
} catch (Exception $e) {
    echo "❌ BaseAPI error: " . $e->getMessage() . "\n";
    exit;
}

// Test 4: Prova una API semplice
echo "\n4. Testing simple API instantiation...\n";
try {
    require_once 'ClientiAPI.php';
    $api = new ClientiAPI();
    echo "✅ ClientiAPI instantiated successfully\n";
} catch (Exception $e) {
    echo "❌ ClientiAPI error: " . $e->getMessage() . "\n";
}

// Test 5: JSON Response
echo "\n5. Testing JSON response...\n";
try {
    header('Content-Type: application/json');
    $response = [
        'success' => true,
        'message' => 'API test successful',
        'timestamp' => date('Y-m-d H:i:s'),
        'server_info' => [
            'php_version' => phpversion(),
            'current_dir' => __DIR__,
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
        ]
    ];
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>