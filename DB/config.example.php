<?php
/**
 * Configurazione Database MySQL - TEMPLATE
 *
 * Copiare questo file in `DB/config.php` e inserire le credenziali reali.
 * `DB/config.php` è escluso dal versionamento (vedi .gitignore) per non
 * esporre le credenziali su GitHub.
 *
 *   cp DB/config.example.php DB/config.php
 */

// Configurazioni del database - MODIFICARE CON I PROPRI PARAMETRI

define('DB_HOST', 'localhost');          // Indirizzo del server MySQL
define('DB_NAME', 'nome_database');      // Nome del database
define('DB_USER', 'utente_database');    // Username MySQL
define('DB_PASS', 'password_database');  // Password MySQL

define('DB_CHARSET', 'utf8mb4');         // Charset del database

// Password per l'accesso al visualizzatore di log (DB/log_viewer.php)
define('LOG_VIEWER_PASSWORD', 'password_log_viewer');

// Classe per la gestione della connessione al database
class DatabaseConnection {
    private static $instance = null;
    private $connection;

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

            // Opzioni PDO di base
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];

            // Aggiungi opzione MySQL in modo sicuro se la costante è definita
            if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
                // Usa constant() per recuperare il valore della costante senza errore
                $key = constant('PDO::MYSQL_ATTR_INIT_COMMAND');
                $options[$key] = "SET NAMES " . DB_CHARSET;
            }

            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);

            // Fallback: forza SET NAMES se l'opzione di init non era disponibile
            if (!defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
                try {
                    $this->connection->exec("SET NAMES " . DB_CHARSET);
                } catch (PDOException $e) {
                    // Log the error but don't expose credentials
                    error_log("Failed to set names on DB connection: " . $e->getMessage());
                }
            }

        } catch(PDOException $e) {
            // Log utile per debug remoto (non stampare la password)
            error_log("DB connection error in " . __FILE__ . ": " . $e->getMessage());
            // Messaggio generico per l'utente
            die("Errore di connessione al database. Vedi error log.");
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->connection;
    }

    // Metodo per testare la connessione
    public function testConnection() {
        try {
            $stmt = $this->connection->query("SELECT 1");
            return true;
        } catch(PDOException $e) {
            return false;
        }
    }
}

// Funzione di utilità per ottenere la connessione
function getDatabase() {
    return DatabaseConnection::getInstance()->getConnection();
}

// Headers per API JSON (senza invio automatico)
function setJSONHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

// Funzione per gestire errori API
function sendErrorResponse($message, $code = 400) {
    setJSONHeaders();
    http_response_code($code);
    // Normalize message: if an array/object is passed, extract 'message' and optional 'error_reason'
    $payload = ['success' => false, 'timestamp' => date('Y-m-d H:i:s')];
    if (is_array($message) || is_object($message)) {
        $m = (array)$message;
        $payload['error'] = isset($m['message']) ? $m['message'] : json_encode($m);
        if (isset($m['error_reason'])) {
            $payload['error_reason'] = $m['error_reason'];
        }
        // include any remaining fields under 'details' for debugging (non-sensitive)
        $remaining = $m;
        unset($remaining['message'], $remaining['error_reason']);
        if (!empty($remaining)) {
            $payload['details'] = $remaining;
        }
    } else {
        $payload['error'] = $message;
    }

    echo json_encode($payload);
    exit;
}

// Funzione per gestire risposte di successo API
function sendSuccessResponse($data, $message = 'Operazione completata con successo') {
    setJSONHeaders();
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Configurazioni aggiuntive
define('API_VERSION', '1.0.0');
define('TIMEZONE', 'Europe/Rome');

// Imposta il timezone
date_default_timezone_set(TIMEZONE);

// Creazione automatica cartella logs
$logsDir = __DIR__ . '/logs';
if (!file_exists($logsDir)) {
    if (!mkdir($logsDir, 0755, true)) {
        die("Impossibile creare la cartella logs: $logsDir");
    }
}

// Verifica che la cartella sia scrivibile
if (!is_writable($logsDir)) {
    chmod($logsDir, 0755);
    if (!is_writable($logsDir)) {
        die("La cartella logs non è scrivibile: $logsDir");
    }
}

// Log degli errori
ini_set('log_errors', 1);
ini_set('error_log', $logsDir . '/php_errors.log');
?>
