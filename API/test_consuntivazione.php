<?php
// Test diretto per ConsuntivazioneAPI
header('Content-Type: application/json');

try {
    // Simulazione richiesta get_commesse
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = array(); // Evita errori
    
    // Simula input JSON
    $GLOBALS['HTTP_RAW_POST_DATA'] = json_encode(['action' => 'get_commesse']);
    
    ob_start();
    include 'ConsuntivazioneAPI.php';
    $output = ob_get_clean();
    
    echo json_encode([
        'success' => true,
        'message' => 'Test completato',
        'output' => $output,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Errore test: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>