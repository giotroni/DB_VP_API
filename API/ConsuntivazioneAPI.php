<?php
/**
 * ConsuntivazioneAPI - Gestione delle consuntivazioni (versione pulita)
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
    private $authAPI;
    
    public function __construct() {
        $this->db = getDatabase();
        $this->authAPI = new AuthAPI();
    }
    
    /**
     * Ottieni statistiche delle consuntivazioni per il dashboard
     */
    public function getStatistiche() {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Ore questo mese
            $sql1 = "SELECT COALESCE(SUM(gg), 0) as ore_mese
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = ? 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt1 = $this->db->prepare($sql1);
            $stmt1->execute([$user['id']]);
            $oreMese = $stmt1->fetch()['ore_mese'];
            
            // Spese del mese
            $sql3 = "SELECT COALESCE(SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi), 0) as spese_mese
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = ? 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt3 = $this->db->prepare($sql3);
            $stmt3->execute([$user['id']]);
            $speseMese = $stmt3->fetch()['spese_mese'];
            
            // Giorni lavorati questo mese
            $sql4 = "SELECT COUNT(DISTINCT Data) as giorni_lavorati
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = ? 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt4 = $this->db->prepare($sql4);
            $stmt4->execute([$user['id']]);
            $giorniLavorati = $stmt4->fetch()['giorni_lavorati'];
            
            return [
                'success' => true,
                'data' => [
                    'ore_mese' => number_format($oreMese, 1),
                    'spese_mese' => number_format($speseMese, 2),
                    'giorni_lavorati' => $giorniLavorati
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il recupero delle statistiche: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Ottieni le ultime consuntivazioni dell'utente
     */
    public function getUltimeConsuntivazioni($limit = 10) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            $sql = "SELECT 
                        g.ID_GIORNATA,
                        g.Data,
                        g.gg,
                        g.Tipo,
                        g.Spese_Viaggi,
                        g.Vitto_alloggio,
                        g.Altri_costi,
                        (g.Spese_Viaggi + g.Vitto_alloggio + g.Altri_costi) as Totale_Spese,
                        g.Note,
                        t.Task,
                        c.Commessa,
                        cl.Cliente
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE g.ID_COLLABORATORE = ?
                    ORDER BY g.Data DESC, g.Data_Creazione DESC
                    LIMIT ?";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user['id'], $limit]);
            
            $consuntivazioni = $stmt->fetchAll();
            
            return [
                'success' => true,
                'data' => $consuntivazioni
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il recupero delle consuntivazioni: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Ottieni tutte le commesse disponibili
     */
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
                'data' => $commesse
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore nel caricamento delle commesse: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Ottieni i task per una specifica commessa
     */
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
                        Desc_Task as Descrizione
                    FROM ANA_TASK
                    WHERE ID_COMMESSA = ?
                    AND Stato_Task = 'In corso'
                    ORDER BY Task";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$commessaId]);
            
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'data' => $tasks
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore nel caricamento dei task: ' . $e->getMessage()
            ];
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
        case 'get_statistiche':
            $result = $consuntivazioneAPI->getStatistiche();
            echo json_encode($result);
            break;
            
        case 'get_ultime_consuntivazioni':
            $limit = $input['limit'] ?? 10;
            $result = $consuntivazioneAPI->getUltimeConsuntivazioni($limit);
            echo json_encode($result);
            break;
            
        case 'get_commesse':
            $result = $consuntivazioneAPI->getCommesse();
            echo json_encode($result);
            break;
            
        case 'get_tasks':
            $commessaId = $input['commessa_id'] ?? null;
            $result = $consuntivazioneAPI->getTasks($commessaId);
            echo json_encode($result);
            break;
            
        case 'test_db':
            try {
                $db = getDatabase();
                $stmt = $db->query("SELECT COUNT(*) as count FROM ANA_COLLABORATORI");
                $result = $stmt->fetch();
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'collaboratori_count' => $result['count'],
                        'db_connected' => true
                    ]
                ]);
            } catch (Exception $e) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Errore database: ' . $e->getMessage()
                ]);
            }
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