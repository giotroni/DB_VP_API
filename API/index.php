<?php
/**
 * API Vaglio & Partners - Router principale CORRETTO
 * Gestisce il routing delle richieste API per tutte le tabelle del database
 */

// Per debug - abilita errori solo in sviluppo
if (isset($_GET['debug'])) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Definisci versione API
define('API_VERSION', '1.0.0');

// Cerca il config.php nel percorso corretto
$config_paths = [
    __DIR__ . '/../DB/config.php',
    dirname(__DIR__) . '/DB/config.php',
    $_SERVER['DOCUMENT_ROOT'] . '/gestione_VP/DB/config.php'
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
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'File di configurazione database non trovato',
        'searched_paths' => $config_paths
    ]);
    exit;
}

require_once 'BaseAPI.php';

// Import delle classi API per ogni tabella
require_once 'ClientiAPI.php';
require_once 'CollaboratoriAPI.php';
require_once 'CommesseAPI.php';
require_once 'TaskAPI.php';
require_once 'TariffeAPI.php';
require_once 'GiornateAPI.php';
require_once 'FattureAPI.php';

// Funzioni di supporto
function setJSONHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

function sendSuccessResponse($data, $message = 'Operazione completata con successo') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

function sendErrorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $message,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Set headers per CORS e JSON
setJSONHeaders();

// Gestione richieste OPTIONS per CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Parsing dell'URL per determinare la risorsa e l'azione
    $request_uri = $_SERVER['REQUEST_URI'];
    $path = parse_url($request_uri, PHP_URL_PATH);
    
    // Rimuovi il path base del progetto se presente
    // Il server ha path del tipo: /gestione_VP/API/risorsa
    $path = preg_replace('#^.*/API/?#', '', $path);
    
    // Debug info se richiesto
    if (isset($_GET['debug'])) {
        error_log("Debug API: REQUEST_URI={$request_uri}, PARSED_PATH={$path}");
        sendSuccessResponse([
            'debug' => true,
            'request_uri' => $request_uri,
            'parsed_path' => $path,
            'method' => $_SERVER['REQUEST_METHOD'],
            'get_params' => $_GET,
            'post_params' => $_POST
        ], 'Debug info');
    }
    
    // Parse del path: /risorsa/id o /risorsa
    $path_parts = explode('/', trim($path, '/'));
    $resource = $path_parts[0] ?? '';
    $id = $path_parts[1] ?? null;
    
    // Routing delle richieste
    switch ($resource) {
        case 'clienti':
            $api = new ClientiAPI();
            break;
            
        case 'collaboratori':
            $api = new CollaboratoriAPI();
            break;
            
        case 'commesse':
            $api = new CommesseAPI();
            break;
            
        case 'task':
            $api = new TaskAPI();
            break;
            
        case 'tariffe':
            $api = new TariffeAPI();
            break;
            
        case 'giornate':
            $api = new GiornateAPI();
            break;
            
        case 'fatture':
            $api = new FattureAPI();
            break;
            
        case 'status':
            // Endpoint per verificare lo stato dell'API
            sendSuccessResponse([
                'api_version' => API_VERSION,
                'status' => 'running',
                'database' => DB_NAME ?? 'configured',
                'available_endpoints' => [
                    'clienti',
                    'collaboratori', 
                    'commesse',
                    'task',
                    'tariffe',
                    'giornate',
                    'fatture'
                ]
            ], 'API funzionante');
            break;
            
        case '':
            // Documentazione API principale
            sendSuccessResponse([
                'title' => 'API Vaglio & Partners',
                'version' => API_VERSION,
                'description' => 'API REST per la gestione del database aziendale',
                'endpoints' => [
                    'GET /status' => 'Stato dell\'API',
                    'GET /clienti' => 'Lista clienti',
                    'GET /clienti/{id}' => 'Dettaglio cliente',
                    'POST /clienti' => 'Crea cliente',
                    'PUT /clienti/{id}' => 'Aggiorna cliente',
                    'DELETE /clienti/{id}' => 'Elimina cliente',
                    
                    'GET /collaboratori' => 'Lista collaboratori',
                    'GET /collaboratori/{id}' => 'Dettaglio collaboratore',
                    'POST /collaboratori' => 'Crea collaboratore',
                    'PUT /collaboratori/{id}' => 'Aggiorna collaboratore',
                    'DELETE /collaboratori/{id}' => 'Elimina collaboratore',
                    
                    'GET /commesse' => 'Lista commesse',
                    'GET /commesse/{id}' => 'Dettaglio commessa',
                    'POST /commesse' => 'Crea commessa',
                    'PUT /commesse/{id}' => 'Aggiorna commessa',
                    'DELETE /commesse/{id}' => 'Elimina commessa',
                    
                    'GET /task' => 'Lista task',
                    'GET /task/{id}' => 'Dettaglio task',
                    'POST /task' => 'Crea task',
                    'PUT /task/{id}' => 'Aggiorna task',
                    'DELETE /task/{id}' => 'Elimina task',
                    
                    'GET /tariffe' => 'Lista tariffe',
                    'GET /tariffe/{id}' => 'Dettaglio tariffa',
                    'POST /tariffe' => 'Crea tariffa',
                    'PUT /tariffe/{id}' => 'Aggiorna tariffa',
                    'DELETE /tariffe/{id}' => 'Elimina tariffa',
                    
                    'GET /giornate' => 'Lista giornate',
                    'GET /giornate/{id}' => 'Dettaglio giornata',
                    'POST /giornate' => 'Crea giornata',
                    'PUT /giornate/{id}' => 'Aggiorna giornata',
                    'DELETE /giornate/{id}' => 'Elimina giornata',
                    
                    'GET /fatture' => 'Lista fatture',
                    'GET /fatture/{id}' => 'Dettaglio fattura',
                    'POST /fatture' => 'Crea fattura',
                    'PUT /fatture/{id}' => 'Aggiorna fattura',
                    'DELETE /fatture/{id}' => 'Elimina fattura'
                ]
            ], 'Benvenuto nelle API Vaglio & Partners');
            break;
            
        default:
            sendErrorResponse("Risorsa '$resource' non trovata", 404);
            break;
    }
    
    // Esegui l'operazione tramite la classe API appropriata
    if (isset($api)) {
        $api->handleRequest($id);
    }
    
} catch (Exception $e) {
    sendErrorResponse('Errore interno del server: ' . $e->getMessage(), 500);
} catch (Error $e) {
    sendErrorResponse('Errore fatale: ' . $e->getMessage(), 500);
}
?>