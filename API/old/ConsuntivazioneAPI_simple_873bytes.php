<?php
// Versione semplificata del ConsuntivazioneAPI per debug
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    session_start();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'test_simple':
            echo json_encode([
                'success' => true,
                'message' => 'ConsuntivazioneAPI funziona',
                'action' => $action
            ]);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non supportata: ' . $action
            ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Solo metodo POST supportato'
    ]);
}
?>