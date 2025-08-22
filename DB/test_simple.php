<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    require_once 'config.php';
    
    $response = [
        'success' => true,
        'message' => 'Server PHP funzionante',
        'timestamp' => date('Y-m-d H:i:s'),
        'method' => $_SERVER['REQUEST_METHOD'],
        'data' => [
            'server_time' => time(),
            'php_version' => PHP_VERSION,
            'memory_usage' => memory_get_usage(true),
            'database_test' => 'Tentativo connessione...'
        ]
    ];
    
    // Test connessione database
    try {
        $db = getDatabase();
        $stmt = $db->query("SELECT COUNT(*) as count FROM ANA_COLLABORATORI");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $response['data']['database_test'] = "OK - {$result['count']} collaboratori trovati";
        $response['data']['database_connected'] = true;
    } catch (Exception $e) {
        $response['data']['database_test'] = 'Errore: ' . $e->getMessage();
        $response['data']['database_connected'] = false;
    }
    
} catch (Exception $e) {
    $response = [
        'success' => false,
        'message' => 'Errore server: ' . $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s'),
        'error_details' => [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ];
}

echo json_encode($response, JSON_PRETTY_PRINT);
?>