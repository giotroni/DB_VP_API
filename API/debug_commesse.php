<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

try {
    echo "Starting debug...\n";
    
    // Test 1: Include config
    require_once '../DB/config.php';
    echo "Config loaded...\n";
    
    // Test 2: Database connection
    $db = getDatabase();
    echo "Database connected...\n";
    
    // Test 3: Query commesse
    $sql = "SELECT 
                c.ID_COMMESSA,
                c.Commessa,
                cl.Cliente
            FROM ANA_COMMESSE c
            LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
            WHERE c.Stato_Commessa = 'In corso'
            ORDER BY c.Commessa
            LIMIT 5";
    
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $commesse = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Test completato con successo',
        'commesse_count' => count($commesse),
        'commesse' => $commesse,
        'debug_info' => [
            'php_version' => PHP_VERSION,
            'memory_usage' => memory_get_usage(true),
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\n", $e->getTraceAsString())
    ], JSON_PRETTY_PRINT);
}
?>