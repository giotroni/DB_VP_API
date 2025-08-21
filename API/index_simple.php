<?php
/**
 * API Router - Versione semplificata e stabile
 */

// Abilita la visualizzazione degli errori per debug
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Headers CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Gestione richieste OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Funzione per inviare risposte JSON
function sendResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

try {
    // 1. Carica configurazione database
    $config_paths = [
        __DIR__ . '/../DB/config.php',
        dirname(__DIR__) . '/DB/config.php'
    ];
    
    $config_loaded = false;
    foreach ($config_paths as $config_path) {
        if (file_exists($config_path)) {
            require_once $config_path;
            $config_loaded = true;
            break;
        }
    }
    
    if (!$config_loaded) {
        sendResponse(false, null, 'Configurazione database non trovata', 500);
    }
    
    // 2. Carica BaseAPI
    if (!file_exists(__DIR__ . '/BaseAPI.php')) {
        sendResponse(false, null, 'BaseAPI.php non trovato', 500);
    }
    require_once 'BaseAPI.php';
    
    // 3. Determina la risorsa richiesta
    $resource = $_GET['resource'] ?? '';
    $id = $_GET['id'] ?? null;
    
    // Se non c'è resource, mostra la documentazione
    if (empty($resource)) {
        sendResponse(true, [
            'title' => 'API Vaglio & Partners',
            'version' => '1.0.0',
            'description' => 'API REST per la gestione del database aziendale',
            'usage' => [
                'status' => 'index.php?resource=status',
                'task' => 'index.php?resource=task&limit=10',
                'task_by_commessa' => 'index.php?resource=task&ID_COMMESSA=COM0001',
                'commesse' => 'index.php?resource=commesse&limit=10',
                'collaboratori' => 'index.php?resource=collaboratori&limit=10'
            ]
        ], 'API Documentazione');
    }
    
    // 4. Gestisci endpoint speciali
    if ($resource === 'status') {
        sendResponse(true, [
            'api_version' => '1.0.0',
            'status' => 'running',
            'database' => defined('DB_NAME') ? DB_NAME : 'configured',
            'available_endpoints' => ['task', 'commesse', 'collaboratori', 'clienti', 'tariffe', 'giornate', 'fatture']
        ], 'API funzionante');
    }
    
    // 5. Carica e instanzia la classe API appropriata
    $api = null;
    switch ($resource) {
        case 'task':
            if (file_exists(__DIR__ . '/TaskAPI.php')) {
                require_once 'TaskAPI.php';
                $api = new TaskAPI();
            }
            break;
            
        case 'commesse':
            if (file_exists(__DIR__ . '/CommesseAPI.php')) {
                require_once 'CommesseAPI.php';
                $api = new CommesseAPI();
            }
            break;
            
        case 'collaboratori':
            if (file_exists(__DIR__ . '/CollaboratoriAPI.php')) {
                require_once 'CollaboratoriAPI.php';
                $api = new CollaboratoriAPI();
            }
            break;
            
        case 'clienti':
            if (file_exists(__DIR__ . '/ClientiAPI.php')) {
                require_once 'ClientiAPI.php';
                $api = new ClientiAPI();
            }
            break;
            
        case 'tariffe':
            if (file_exists(__DIR__ . '/TariffeAPI.php')) {
                require_once 'TariffeAPI.php';
                $api = new TariffeAPI();
            }
            break;
            
        case 'giornate':
            if (file_exists(__DIR__ . '/GiornateAPI.php')) {
                require_once 'GiornateAPI.php';
                $api = new GiornateAPI();
            }
            break;
            
        case 'fatture':
            if (file_exists(__DIR__ . '/FattureAPI.php')) {
                require_once 'FattureAPI.php';
                $api = new FattureAPI();
            }
            break;
            
        default:
            sendResponse(false, null, "Risorsa '$resource' non trovata", 404);
    }
    
    if (!$api) {
        sendResponse(false, null, "Impossibile caricare API per '$resource'", 500);
    }
    
    // 6. Esegui l'operazione API
    $api->handleRequest($id);
    
} catch (Exception $e) {
    sendResponse(false, null, 'Errore: ' . $e->getMessage(), 500);
} catch (Error $e) {
    sendResponse(false, null, 'Errore fatale: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    sendResponse(false, null, 'Errore critico: ' . $e->getMessage(), 500);
}
?>