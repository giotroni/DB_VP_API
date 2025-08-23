<?php
/**
 * auth.php - Gestione delle richieste di autenticazione
 */

// Headers JSON e CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Gestisci preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../DB/config.php';
require_once 'AuthAPI.php';

// Gestione delle richieste API
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    session_start();
    
    $authAPI = new AuthAPI();
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'login':
            $email = $input['email'] ?? $input['username'] ?? '';
            $password = $input['password'] ?? '';
            
            if (empty($email) || empty($password)) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Email/Username e password sono richiesti'
                ]);
                exit;
            }
            
            $result = $authAPI->authenticate($email, $password);
            echo json_encode($result);
            break;
            
        case 'reset_password':
            $newPassword = $input['new_password'] ?? '';
            
            if (empty($newPassword)) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Nuova password richiesta'
                ]);
                exit;
            }
            
            $result = $authAPI->resetPassword($newPassword);
            echo json_encode($result);
            break;
            
        case 'logout':
            $result = $authAPI->logout();
            echo json_encode($result);
            break;
            
        case 'check_auth':
            $result = $authAPI->checkAuthentication();
            echo json_encode($result);
            break;
            
        case 'get_user_tasks':
            if (!$authAPI->isAuthenticated()) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Non autenticato'
                ]);
                exit;
            }
            
            $user = $authAPI->getCurrentUser();
            $commessaId = $input['commessa_id'] ?? null;
            $tasks = $authAPI->getUserTasks($user['id'], $commessaId);
            echo json_encode([
                'success' => true,
                'data' => $tasks
            ]);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non valida'
            ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Metodo non supportato'
    ]);
}
?>