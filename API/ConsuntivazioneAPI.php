<?php
/**
 * ConsuntivazioneAPI - Gestione delle consuntivazioni (inserimento giornate e spese)
 */

// Evita output prima dell'header JSON
ob_start();

// Headers JSON e CORS
function setJSONHeaders() {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

// Gestisci preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    setJSONHeaders();
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
     * Salva una nuova consuntivazione
     */
    public function salvaConsuntivazione($data) {
        try {
            // Verifica autenticazione
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Validazione dati obbligatori
            $errors = $this->validateConsuntivazione($data);
            if (!empty($errors)) {
                return [
                    'success' => false,
                    'message' => 'Dati non validi',
                    'errors' => $errors
                ];
            }
            
            // Genera ID univoco per la giornata
            $idGiornata = $this->generateGiornataId();
            
            // Prepara i dati per l'inserimento
            $insertData = [
                'ID_GIORNATA' => $idGiornata,
                'Data' => $data['data'],
                'ID_COLLABORATORE' => $user['id'],
                'ID_TASK' => $data['task'],
                'Tipo' => $data['tipo'] ?? 'Campo',
                'Desk' => $data['desk'] ?? 'No',
                'gg' => $data['giornate_lavorate'],
                'Spese_Viaggi' => $data['spese_viaggio'] ?? 0,
                'Vitto_alloggio' => $data['vitto_alloggio'] ?? 0,
                'Altri_costi' => $data['altre_spese'] ?? 0,
                'Note' => $data['note'] ?? '',
                'ID_UTENTE_CREAZIONE' => $user['id']
            ];
            
            // Inserimento nel database
            $sql = "INSERT INTO FACT_GIORNATE (
                        ID_GIORNATA, Data, ID_COLLABORATORE, ID_TASK, Tipo, Desk, gg,
                        Spese_Viaggi, Vitto_alloggio, Altri_costi, Note, ID_UTENTE_CREAZIONE
                    ) VALUES (
                        :ID_GIORNATA, :Data, :ID_COLLABORATORE, :ID_TASK, :Tipo, :Desk, :gg,
                        :Spese_Viaggi, :Vitto_alloggio, :Altri_costi, :Note, :ID_UTENTE_CREAZIONE
                    )";
                    
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute($insertData);
            
            if ($result) {
                // Ottieni i dati della consuntivazione appena inserita con informazioni correlate
                $consuntivazione = $this->getConsuntivazioneById($idGiornata);
                
                return [
                    'success' => true,
                    'message' => 'Consuntivazione salvata con successo',
                    'data' => $consuntivazione
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore durante il salvataggio'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il salvataggio: ' . $e->getMessage()
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
                    WHERE g.ID_COLLABORATORE = :user_id
                    ORDER BY g.Data DESC, g.Data_Creazione DESC
                    LIMIT :limit";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':user_id', $user['id'], PDO::PARAM_STR);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            
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
                     WHERE ID_COLLABORATORE = :user_id 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt1 = $this->db->prepare($sql1);
            $stmt1->execute([':user_id' => $user['id']]);
            $oreMese = $stmt1->fetch()['ore_mese'];
            
            // Progetti attivi
            $sql2 = "SELECT COUNT(DISTINCT t.ID_COMMESSA) as progetti_attivi
                     FROM ANA_TASK t
                     LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                     WHERE t.ID_COLLABORATORE = :user_id 
                     AND t.Stato_Task IN ('In corso', 'Sospeso')
                     AND c.Stato_Commessa IN ('In corso', 'Sospesa')";
            
            $stmt2 = $this->db->prepare($sql2);
            $stmt2->execute([':user_id' => $user['id']]);
            $progettiAttivi = $stmt2->fetch()['progetti_attivi'];
            
            // Spese del mese
            $sql3 = "SELECT COALESCE(SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi), 0) as spese_mese
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = :user_id 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt3 = $this->db->prepare($sql3);
            $stmt3->execute([':user_id' => $user['id']]);
            $speseMese = $stmt3->fetch()['spese_mese'];
            
            // Giorni lavorati questo mese
            $sql4 = "SELECT COUNT(DISTINCT Data) as giorni_lavorati
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = :user_id 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt4 = $this->db->prepare($sql4);
            $stmt4->execute([':user_id' => $user['id']]);
            $giorniLavorati = $stmt4->fetch()['giorni_lavorati'];
            
            return [
                'success' => true,
                'data' => [
                    'ore_mese' => number_format($oreMese, 1),
                    'progetti_attivi' => $progettiAttivi,
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
     * Validazione dati consuntivazione
     */
    private function validateConsuntivazione($data) {
        $errors = [];
        
        // Data obbligatoria e non futura
        if (empty($data['data'])) {
            $errors[] = 'Data è obbligatoria';
        } else {
            $dataConsuntivazione = new DateTime($data['data']);
            $oggi = new DateTime();
            if ($dataConsuntivazione > $oggi) {
                $errors[] = 'La data non può essere futura';
            }
        }
        
        // Task obbligatorio
        if (empty($data['task'])) {
            $errors[] = 'Task è obbligatorio';
        }
        
        // Giornate lavorate obbligatorie e valide
        if (!isset($data['giornate_lavorate']) || $data['giornate_lavorate'] <= 0) {
            $errors[] = 'Giornate lavorate deve essere maggiore di 0';
        } else if ($data['giornate_lavorate'] > 1) {
            $errors[] = 'Giornate lavorate non può essere superiore a 1';
        }
        
        // Validazione spese (devono essere numeriche e positive)
        $campiSpese = ['spese_viaggio', 'vitto_alloggio', 'altre_spese'];
        foreach ($campiSpese as $campo) {
            if (isset($data[$campo]) && !is_numeric($data[$campo])) {
                $errors[] = "Il campo $campo deve essere numerico";
            }
            if (isset($data[$campo]) && $data[$campo] < 0) {
                $errors[] = "Il campo $campo non può essere negativo";
            }
        }
        
        return $errors;
    }
    
    /**
     * Genera ID univoco per la giornata
     */
    private function generateGiornataId() {
        $prefix = 'GIO';
        $timestamp = date('YmdHis');
        $random = mt_rand(100, 999);
        return $prefix . $timestamp . $random;
    }
    
    /**
     * Ottieni una consuntivazione per ID
     */
    private function getConsuntivazioneById($id) {
        $sql = "SELECT 
                    g.*,
                    t.Task,
                    c.Commessa,
                    cl.Cliente
                FROM FACT_GIORNATE g
                LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                WHERE g.ID_GIORNATA = :id";
                
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        
        return $stmt->fetch();
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
                    WHERE ID_COMMESSA = :commessa_id
                    AND Stato_Task = 'In corso'
                    ORDER BY Task";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':commessa_id' => $commessaId]);
            
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
    
    // Pulisci buffer output per evitare caratteri extra
    while (ob_get_level()) {
        ob_end_clean();
    }
    ob_start();
    
    $consuntivazioneAPI = new ConsuntivazioneAPI();
    $input = json_decode(file_get_contents('php://input'), true);
    
    setJSONHeaders();
    
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    // Pulisci output buffer e invia solo JSON
    ob_clean();
    
    switch ($action) {
        case 'salva_consuntivazione':
            $result = $consuntivazioneAPI->salvaConsuntivazione($input);
            echo json_encode($result);
            break;
            
        case 'get_ultime_consuntivazioni':
            $limit = $input['limit'] ?? 10;
            $result = $consuntivazioneAPI->getUltimeConsuntivazioni($limit);
            echo json_encode($result);
            break;
            
        case 'get_statistiche':
            $result = $consuntivazioneAPI->getStatistiche();
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
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non valida'
            ]);
    }
} else {
    setJSONHeaders();
    echo json_encode([
        'success' => false,
        'message' => 'Metodo non supportato'
    ]);
}
?>