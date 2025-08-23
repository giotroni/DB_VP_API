<?php
/**
 * ConsuntivazioneAPI Semplificata - Solo per test commesse/task
 */

// Evita output prima dell'header JSON
ob_start();

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

class ConsuntivazioneAPISimple {
    private $db;
    
    public function __construct() {
        $this->db = getDatabase();
    }
    
    public function getCommesse() {
        try {
            $sql = "SELECT 
                        c.ID_COMMESSA,
                        c.Commessa,
                        cl.Cliente
                    FROM ANA_COMMESSE c
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE c.Stato_Commessa = 'In corso'
                    ORDER BY c.Commessa";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            
            $commesse = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'data' => $commesse,
                'count' => count($commesse)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore nel caricamento delle commesse: ' . $e->getMessage()
            ];
        }
    }
    
    public function getTasks($commessaId) {
        try {
            if (!$commessaId) {
                return [
                    'success' => false,
                    'message' => 'ID Commessa richiesto'
                ];
            }
            
            $sql = "SELECT 
                        ID_TASK,
                        Task,
                        Desc_Task as Descrizione,
                        Tipo
                    FROM ANA_TASK
                    WHERE ID_COMMESSA = :commessa_id
                    AND Stato_Task = 'In corso'
                    AND Tipo != 'Monitoraggio'
                    ORDER BY Task";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':commessa_id' => $commessaId]);
            
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'data' => $tasks,
                'count' => count($tasks)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore nel caricamento dei task: ' . $e->getMessage()
            ];
        }
    }
    
    public function salvaConsuntivazione($data) {
        try {
            // Validazione dati base
            if (!isset($data['data']) || !isset($data['commessa']) || !isset($data['task']) || !isset($data['giornate_lavorate'])) {
                return [
                    'success' => false,
                    'message' => 'Dati obbligatori mancanti'
                ];
            }
            
            // Per ora usiamo un collaboratore fisso per test (dovrebbe venire dall'autenticazione)
            $idCollaboratore = 'CONS003'; // Giorgio Troni - da sostituire con autenticazione
            
            // Genera ID univoco per la giornata
            $idGiornata = 'GIO' . date('YmdHis') . mt_rand(100, 999);
            
            // Prepara i dati per l'inserimento
            $insertData = [
                'ID_GIORNATA' => $idGiornata,
                'Data' => $data['data'],
                'ID_COLLABORATORE' => $idCollaboratore,
                'ID_TASK' => $data['task'],
                'Tipo' => $data['tipo'] ?? 'Campo',
                'Desk' => $data['desk'] ?? 'No',
                'gg' => floatval($data['giornate_lavorate']),
                'Spese_Viaggi' => floatval($data['spese_viaggio'] ?? 0),
                'Vitto_alloggio' => floatval($data['vitto_alloggio'] ?? 0),
                'Altri_costi' => floatval($data['altre_spese'] ?? 0),
                'Spese_Fatturate_VP' => floatval($data['spese_fatturate_vp'] ?? 0),
                'Confermata' => 'No', // Default a No, può essere confermata successivamente
                'Note' => $data['note'] ?? '',
                'Data_Creazione' => date('Y-m-d H:i:s'),
                'ID_UTENTE_CREAZIONE' => $idCollaboratore
            ];
            
            // Inserimento nel database
            $sql = "INSERT INTO FACT_GIORNATE (
                        ID_GIORNATA, Data, ID_COLLABORATORE, ID_TASK, Tipo, Desk,
                        gg, Spese_Viaggi, Vitto_alloggio, Altri_costi, Spese_Fatturate_VP,
                        Confermata, Note, Data_Creazione, ID_UTENTE_CREAZIONE
                    ) VALUES (
                        :ID_GIORNATA, :Data, :ID_COLLABORATORE, :ID_TASK, :Tipo, :Desk,
                        :gg, :Spese_Viaggi, :Vitto_alloggio, :Altri_costi, :Spese_Fatturate_VP,
                        :Confermata, :Note, :Data_Creazione, :ID_UTENTE_CREAZIONE
                    )";
            
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute($insertData);
            
            if ($success) {
                return [
                    'success' => true,
                    'message' => 'Consuntivazione salvata con successo',
                    'data' => [
                        'id_giornata' => $idGiornata,
                        'data_inserimento' => date('Y-m-d H:i:s')
                    ]
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore nel salvataggio della consuntivazione'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore nel salvataggio: ' . $e->getMessage()
            ];
        }
    }
}

// Gestione delle richieste API
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // Pulisci buffer output per evitare caratteri extra
    while (ob_get_level()) {
        ob_end_clean();
    }
    ob_start();
    
    $api = new ConsuntivazioneAPISimple();
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    // Pulisci output buffer e invia solo JSON
    ob_clean();
    
    switch ($action) {
        case 'get_commesse':
            $result = $api->getCommesse();
            echo json_encode($result);
            break;
            
        case 'get_tasks':
            $commessaId = $input['commessa_id'] ?? null;
            $result = $api->getTasks($commessaId);
            echo json_encode($result);
            break;
            
        case 'salva_consuntivazione':
            $result = $api->salvaConsuntivazione($input);
            echo json_encode($result);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non valida: ' . $action
            ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Solo richieste POST sono supportate'
    ]);
}
?>