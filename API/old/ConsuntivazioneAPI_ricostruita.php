<?php
/**
 * ConsuntivazioneAPI - Gestione delle consuntivazioni (versione ricostruita)
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

class ConsuntivazioneAPI {
    private $db;
    public $authAPI;

    public function __construct() {
        $this->db = getDatabase();
        $this->authAPI = new AuthAPI();
    }
    
    private function getStatistiche($user) {
        try {
            $sql = "SELECT 
                        SUM(gg) as totale_ore,
                        SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi + Spese_Fatturate_VP) as totale_spese,
                        COUNT(*) as numero_giornate
                    FROM FACT_GIORNATE 
                    WHERE ID_COLLABORATORE = ?";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user['id']]);
            $stats = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'data' => [
                    'totale_ore' => $stats['totale_ore'] ?? 0,
                    'totale_spese' => $stats['totale_spese'] ?? 0,
                    'numero_giornate' => $stats['numero_giornate'] ?? 0
                ]
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore nel calcolo statistiche: ' . $e->getMessage()];
        }
    }
    
    private function getTasksPerCommessa($commessaId) {
        try {
            $sql = "SELECT ID_TASK, Descrizione, Stato_Task FROM ANA_TASK WHERE ID_COMMESSA = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$commessaId]);
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return ['success' => true, 'data' => $tasks];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore nel recupero task: ' . $e->getMessage()];
        }
    }
    
    private function getCommesse() {
        try {
            $sql = "SELECT c.ID_COMMESSA, c.Titolo, cl.Ragione_Sociale 
                    FROM ANA_COMMESSE c 
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE 
                    WHERE c.Stato_Commessa = 'Attiva'
                    ORDER BY c.Titolo";
            $stmt = $this->db->query($sql);
            $commesse = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return ['success' => true, 'data' => $commesse];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore nel recupero commesse: ' . $e->getMessage()];
        }
    }
    
    private function getGiornate($user) {
        try {
            $sql = "SELECT g.*, t.Descrizione as task_desc, c.Titolo as commessa_titolo 
                    FROM FACT_GIORNATE g 
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK 
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA 
                    WHERE g.ID_COLLABORATORE = ? 
                    ORDER BY g.Data DESC";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user['id']]);
            $giornate = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return ['success' => true, 'data' => $giornate];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore nel recupero giornate: ' . $e->getMessage()];
        }
    }
    
    private function salvaConsuntivazione($user, $data) {
        try {
            // Validazione base
            if (!$data['id_task'] || !$data['data_consuntivazione'] || !$data['ore']) {
                return ['success' => false, 'message' => 'Campi obbligatori mancanti'];
            }

            // Genera ID_GIORNATA automatico
            $lastIdQuery = "SELECT ID_GIORNATA FROM FACT_GIORNATE ORDER BY ID_GIORNATA DESC LIMIT 1";
            $lastIdStmt = $this->db->query($lastIdQuery);
            $lastId = $lastIdStmt->fetchColumn();
            
            if ($lastId) {
                $lastNumber = intval(substr($lastId, 3));
                $newNumber = $lastNumber + 1;
            } else {
                $newNumber = 1;
            }
            
            $newId = 'DAY' . str_pad($newNumber, 9, '0', STR_PAD_LEFT);

            // Inserimento completo
            $sql = "INSERT INTO FACT_GIORNATE (ID_GIORNATA, ID_COLLABORATORE, ID_TASK, Data, gg, Tipo, Desk, Spese_Viaggi, Vitto_alloggio, Altri_costi, Spese_Fatturate_VP, Note, Confermata) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                $newId,
                $user['id'],
                $data['id_task'],
                $data['data_consuntivazione'],
                $data['ore'],
                $data['tipo'] ?? 'Campo',
                $data['desk'] ?? 'No',
                $data['spese_viaggio'] ?? 0,
                $data['vitto_alloggio'] ?? 0,
                $data['altre_spese'] ?? 0,
                $data['spese_fatturate_vp'] ?? 0,
                $data['note'] ?? '',
                'No'
            ]);

            if ($result) {
                return ['success' => true, 'message' => 'Salvato con successo', 'id' => $newId];
            } else {
                return ['success' => false, 'message' => 'Errore database'];
            }

        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore: ' . $e->getMessage()];
        }
    }
}

// Gestione delle richieste API
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    session_start();
    
    $consuntivazioneAPI = new ConsuntivazioneAPI();
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'salva_consuntivazione':
            try {
                if (!$consuntivazioneAPI->authAPI->isAuthenticated()) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Utente non autenticato'
                    ]);
                    break;
                }
                $user = $consuntivazioneAPI->authAPI->getCurrentUser();
                if (!$user) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Impossibile ottenere i dati utente'
                    ]);
                    break;
                }
                $result = $consuntivazioneAPI->salvaConsuntivazione($user, $input);
                echo json_encode($result);
            } catch (Exception $e) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Errore durante il salvataggio: ' . $e->getMessage()
                ]);
            }
            break;
            
        case 'get_statistiche':
            if (!$consuntivazioneAPI->authAPI->isAuthenticated()) {
                echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
                break;
            }
            $user = $consuntivazioneAPI->authAPI->getCurrentUser();
            echo json_encode($consuntivazioneAPI->getStatistiche($user));
            break;
            
        case 'get_commesse':
            echo json_encode($consuntivazioneAPI->getCommesse());
            break;
            
        case 'get_tasks_per_commessa':
            $commessaId = $input['commessa_id'] ?? '';
            if (!$commessaId) {
                echo json_encode(['success' => false, 'message' => 'ID commessa mancante']);
                break;
            }
            echo json_encode($consuntivazioneAPI->getTasksPerCommessa($commessaId));
            break;
            
        case 'get_giornate':
            if (!$consuntivazioneAPI->authAPI->isAuthenticated()) {
                echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
                break;
            }
            $user = $consuntivazioneAPI->authAPI->getCurrentUser();
            echo json_encode($consuntivazioneAPI->getGiornate($user));
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
        'message' => 'Metodo non supportato'
    ]);
}
?>