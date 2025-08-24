<?php
/**
 * Test per CommesseAPI
 */

require_once 'API/CommesseAPI.php';

try {
    // Simula una richiesta POST per creare una commessa
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/json';
    
    $testData = [
        'action' => 'create',
        'Commessa' => 'Test Commessa',
        'Desc_Commessa' => 'Test descrizione',
        'Tipo_Commessa' => 'Interna',
        'ID_CLIENTE' => null,
        'Commissione' => 0,
        'ID_COLLABORATORE' => null,
        'Data_Apertura_Commessa' => date('Y-m-d'),
        'Stato_Commessa' => 'In corso',
        'ID_COMMESSA' => 'TEST001'
    ];
    
    // Simula il body della richiesta
    $input = json_encode($testData);
    file_put_contents('php://input', $input);
    
    echo "=== TEST COMMESSE API ===\n";
    echo "Dati da inviare: " . json_encode($testData, JSON_PRETTY_PRINT) . "\n\n";
    
    // Crea istanza API
    $api = new CommesseAPI();
    
    // Prova a gestire la richiesta
    ob_start();
    $api->handleRequest();
    $output = ob_get_clean();
    
    echo "Risposta API:\n";
    echo $output . "\n";
    
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}