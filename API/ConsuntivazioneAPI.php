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
            $sql3 = "SELECT 
                        COALESCE(SUM(COALESCE(Spese_Viaggi, 0) + COALESCE(Vitto_alloggio, 0) + COALESCE(Altri_costi, 0)), 0) as spese_mese,
                        COALESCE(SUM(COALESCE(Spese_Fatturate_VP, 0)), 0) as spese_fatturate_vp
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = ? 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt3 = $this->db->prepare($sql3);
            $stmt3->execute([$user['id']]);
            $speseResult = $stmt3->fetch();
            $speseMese = $speseResult['spese_mese'];
            $speseFattVP = $speseResult['spese_fatturate_vp'];
            $speseRimborsabili = $speseMese - $speseFattVP;
            
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
                    'spese_rimborsabili' => number_format(max(0, $speseRimborsabili), 2),
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
                        COALESCE(g.Spese_Viaggi, 0) as Spese_Viaggi,
                        COALESCE(g.Vitto_alloggio, 0) as Vitto_alloggio,
                        COALESCE(g.Altri_costi, 0) as Altri_costi,
                        COALESCE(g.Spese_Fatturate_VP, 0) as Spese_Fatturate_VP,
                        (COALESCE(g.Spese_Viaggi, 0) + COALESCE(g.Vitto_alloggio, 0) + COALESCE(g.Altri_costi, 0)) as Totale_Spese,
                        g.Note,
                        g.Confermata,
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
     * Cerca consuntivazioni con filtri per anno, mese e commessa
     */
    public function cercaConsuntivazioni($anno = null, $mese = null, $commessaId = null) {
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
                        g.Desk,
                        COALESCE(g.Spese_Viaggi, 0) as Spese_Viaggi,
                        COALESCE(g.Vitto_alloggio, 0) as Vitto_alloggio,
                        COALESCE(g.Altri_costi, 0) as Altri_costi,
                        COALESCE(g.Spese_Fatturate_VP, 0) as Spese_Fatturate_VP,
                        (COALESCE(g.Spese_Viaggi, 0) + COALESCE(g.Vitto_alloggio, 0) + COALESCE(g.Altri_costi, 0)) as Totale_Spese,
                        g.Note,
                        g.Confermata,
                        t.Task,
                        c.Commessa,
                        cl.Cliente,
                        YEAR(g.Data) as Anno,
                        MONTH(g.Data) as Mese,
                        MONTHNAME(g.Data) as Nome_Mese
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE g.ID_COLLABORATORE = ?";
            
            $params = [$user['id']];
            
            // Aggiungi filtro anno
            if ($anno) {
                $sql .= " AND YEAR(g.Data) = ?";
                $params[] = $anno;
            }
            
            // Aggiungi filtro mese
            if ($mese) {
                $sql .= " AND MONTH(g.Data) = ?";
                $params[] = $mese;
            }
            
            // Aggiungi filtro commessa
            if ($commessaId) {
                $sql .= " AND c.ID_COMMESSA = ?";
                $params[] = $commessaId;
            }
            
            $sql .= " ORDER BY g.Data DESC, g.Data_Creazione DESC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            $consuntivazioni = $stmt->fetchAll();
            
            // Calcola statistiche
            $totaleGiornate = 0;
            $totaleSpese = 0;
            $totaleFattVP = 0;
            $raggruppatePer_Mese = [];
            
            foreach ($consuntivazioni as $cons) {
                $totaleGiornate += $cons['gg'];
                $totaleSpese += $cons['Totale_Spese'];
                $totaleFattVP += $cons['Spese_Fatturate_VP'];
                
                $chiaveMese = $cons['Anno'] . '-' . str_pad($cons['Mese'], 2, '0', STR_PAD_LEFT);
                if (!isset($raggruppatePer_Mese[$chiaveMese])) {
                    $raggruppatePer_Mese[$chiaveMese] = [
                        'anno' => $cons['Anno'],
                        'mese' => $cons['Mese'],
                        'nome_mese' => $cons['Nome_Mese'],
                        'giornate' => 0,
                        'spese' => 0,
                        'spese_fatturate_vp' => 0,
                        'spese_rimborsabili' => 0,
                        'count' => 0
                    ];
                }
                $raggruppatePer_Mese[$chiaveMese]['giornate'] += $cons['gg'];
                $raggruppatePer_Mese[$chiaveMese]['spese'] += $cons['Totale_Spese'];
                $raggruppatePer_Mese[$chiaveMese]['spese_fatturate_vp'] += $cons['Spese_Fatturate_VP'];
                $raggruppatePer_Mese[$chiaveMese]['spese_rimborsabili'] = $raggruppatePer_Mese[$chiaveMese]['spese'] - $raggruppatePer_Mese[$chiaveMese]['spese_fatturate_vp'];
                $raggruppatePer_Mese[$chiaveMese]['count']++;
            }
            
            return [
                'success' => true,
                'data' => [
                    'consuntivazioni' => $consuntivazioni,
                    'statistiche' => [
                        'totale_giornate' => $totaleGiornate,
                        'totale_spese' => $totaleSpese,
                        'totale_spese_fatturate_vp' => $totaleFattVP,
                        'totale_spese_rimborsabili' => max(0, $totaleSpese - $totaleFattVP),
                        'numero_consuntivazioni' => count($consuntivazioni)
                    ],
                    'raggruppamento_mese' => array_values($raggruppatePer_Mese)
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante la ricerca delle consuntivazioni: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Ottieni gli anni disponibili per le consuntivazioni
     */
    public function getAnniConsuntivazioni() {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            $sql = "SELECT DISTINCT YEAR(Data) as anno 
                    FROM FACT_GIORNATE 
                    WHERE ID_COLLABORATORE = ? 
                    ORDER BY anno DESC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user['id']]);
            
            $anni = $stmt->fetchAll();
            
            return [
                'success' => true,
                'data' => $anni
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il recupero degli anni: ' . $e->getMessage()
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
    
    /**
     * Ottieni una singola consuntivazione per ID
     */
    public function getConsuntivazione($idGiornata) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            if (!$idGiornata) {
                return [
                    'success' => false,
                    'message' => 'ID Giornata obbligatorio'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            $sql = "SELECT 
                        g.ID_GIORNATA,
                        g.Data,
                        g.gg,
                        g.Tipo,
                        g.Desk,
                        g.ID_TASK,
                        COALESCE(g.Spese_Viaggi, 0) as Spese_Viaggi,
                        COALESCE(g.Vitto_alloggio, 0) as Vitto_alloggio,
                        COALESCE(g.Altri_costi, 0) as Altri_costi,
                        COALESCE(g.Spese_Fatturate_VP, 0) as Spese_Fatturate_VP,
                        g.Note,
                        g.Confermata,
                        t.Task,
                        t.ID_COMMESSA,
                        c.Commessa,
                        cl.Cliente
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE g.ID_GIORNATA = ? AND g.ID_COLLABORATORE = ?";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$idGiornata, $user['id']]);
            
            $consuntivazione = $stmt->fetch();
            
            if (!$consuntivazione) {
                return [
                    'success' => false,
                    'message' => 'Consuntivazione non trovata'
                ];
            }
            
            return [
                'success' => true,
                'data' => $consuntivazione
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante il recupero della consuntivazione: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Aggiorna una consuntivazione (solo se non confermata)
     */
    public function updateConsuntivazione($data) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            $idGiornata = $data['id_giornata'] ?? null;
            
            if (!$idGiornata) {
                return [
                    'success' => false,
                    'message' => 'ID Giornata obbligatorio'
                ];
            }
            
            // Verifica che la consuntivazione esista e non sia confermata
            $checkSql = "SELECT Confermata FROM FACT_GIORNATE WHERE ID_GIORNATA = ? AND ID_COLLABORATORE = ?";
            $checkStmt = $this->db->prepare($checkSql);
            $checkStmt->execute([$idGiornata, $user['id']]);
            $existing = $checkStmt->fetch();
            
            if (!$existing) {
                return [
                    'success' => false,
                    'message' => 'Consuntivazione non trovata'
                ];
            }
            
            if ($existing['Confermata'] === 'Si') {
                return [
                    'success' => false,
                    'message' => 'Non è possibile modificare una consuntivazione già confermata'
                ];
            }
            
            // Aggiorna la consuntivazione
            $sql = "UPDATE FACT_GIORNATE SET 
                        Data = ?,
                        ID_TASK = ?,
                        Tipo = ?,
                        Desk = ?,
                        gg = ?,
                        Spese_Viaggi = ?,
                        Vitto_alloggio = ?,
                        Altri_costi = ?,
                        Spese_Fatturate_VP = ?,
                        Note = ?,
                        Data_Modifica = NOW(),
                        ID_UTENTE_MODIFICA = ?
                    WHERE ID_GIORNATA = ? AND ID_COLLABORATORE = ?";
            
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                $data['data'],
                $data['id_task'],
                $data['tipo'] ?? 'Campo',
                $data['desk'] ?? 'No',
                $data['gg'],
                $data['spese_viaggi'] ?? 0,
                $data['vitto_alloggio'] ?? 0,
                $data['altri_costi'] ?? 0,
                $data['spese_fatturate_vp'] ?? 0,
                $data['note'] ?? '',
                $user['id'], // ID_UTENTE_MODIFICA
                $idGiornata,
                $user['id']  // ID_COLLABORATORE per WHERE
            ]);
            
            if ($result) {
                return [
                    'success' => true,
                    'message' => 'Consuntivazione aggiornata con successo'
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore durante l\'aggiornamento'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante l\'aggiornamento: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Cancella una consuntivazione (solo se non confermata)
     */
    public function deleteConsuntivazione($idGiornata) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            if (!$idGiornata) {
                return [
                    'success' => false,
                    'message' => 'ID Giornata obbligatorio'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Verifica che la consuntivazione esista e non sia confermata
            $checkSql = "SELECT Confermata FROM FACT_GIORNATE WHERE ID_GIORNATA = ? AND ID_COLLABORATORE = ?";
            $checkStmt = $this->db->prepare($checkSql);
            $checkStmt->execute([$idGiornata, $user['id']]);
            $existing = $checkStmt->fetch();
            
            if (!$existing) {
                return [
                    'success' => false,
                    'message' => 'Consuntivazione non trovata'
                ];
            }
            
            if ($existing['Confermata'] === 'Si') {
                return [
                    'success' => false,
                    'message' => 'Non è possibile cancellare una consuntivazione già confermata'
                ];
            }
            
            // Cancella la consuntivazione
            $sql = "DELETE FROM FACT_GIORNATE WHERE ID_GIORNATA = ? AND ID_COLLABORATORE = ?";
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([$idGiornata, $user['id']]);
            
            if ($result) {
                return [
                    'success' => true,
                    'message' => 'Consuntivazione cancellata con successo'
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Errore durante la cancellazione'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Errore durante la cancellazione: ' . $e->getMessage()
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
            
        case 'cerca_consuntivazioni':
            $anno = $input['anno'] ?? null;
            $mese = $input['mese'] ?? null;
            $commessaId = $input['commessa_id'] ?? null;
            $result = $consuntivazioneAPI->cercaConsuntivazioni($anno, $mese, $commessaId);
            echo json_encode($result);
            break;
            
        case 'get_anni_consuntivazioni':
            $result = $consuntivazioneAPI->getAnniConsuntivazioni();
            echo json_encode($result);
            break;
            
        case 'get_consuntivazione':
            $idGiornata = $input['id_giornata'] ?? null;
            $result = $consuntivazioneAPI->getConsuntivazione($idGiornata);
            echo json_encode($result);
            break;
            
        case 'update_consuntivazione':
            $result = $consuntivazioneAPI->updateConsuntivazione($input);
            echo json_encode($result);
            break;
            
        case 'delete_consuntivazione':
            $idGiornata = $input['id_giornata'] ?? null;
            $result = $consuntivazioneAPI->deleteConsuntivazione($idGiornata);
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