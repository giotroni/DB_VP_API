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

// Small diagnostic logging to capture PHP errors/fatals during multipart handling (useful for 500 debugging)
$logDir = __DIR__ . '/../DB/uploads/consuntivazioni';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/upload_errors.log';
@ini_set('log_errors', '1');
@ini_set('error_log', $logFile);
set_error_handler(function($errno, $errstr, $errfile, $errline) use ($logFile) {
    $msg = date('[Y-m-d H:i:s] ') . "PHP Error [$errno] $errstr in $errfile:$errline\n";
    error_log($msg, 3, $logFile);
    // return false to allow normal PHP error handling as well
    return false;
});
register_shutdown_function(function() use ($logFile) {
    $err = error_get_last();
    if ($err) {
        $msg = date('[Y-m-d H:i:s] ') . "Shutdown error: " . print_r($err, true) . "\n";
        error_log($msg, 3, $logFile);
    }
});

class ConsuntivazioneAPI {
    private $db;
    private $authAPI;
    private $uploadDir;
    private $uploadUrlBase;
    
    public function __construct() {
        $this->db = getDatabase();
        $this->authAPI = new AuthAPI();
        // Percorso fisico per gli upload (cartella creata in DB/uploads/consuntivazioni)
        $this->uploadDir = realpath(__DIR__ . '/../DB/uploads/consuntivazioni') ?: (__DIR__ . '/../DB/uploads/consuntivazioni');
        // URL base per accedere ai file (serve che la cartella sia raggiungibile dal web)
        $this->uploadUrlBase = '/DB/uploads/consuntivazioni';
    }
    
    /**
     * Ottieni statistiche delle consuntivazioni per il dashboard
     */
    public function getStatistiche($collaboratoreId = null) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Determina quale collaboratore utilizzare
            $targetCollaboratoreId = $collaboratoreId ?: $user['id'];
            
            // Se è richiesto un collaboratore diverso, verifica i permessi
            if ($targetCollaboratoreId !== $user['id']) {
                if (!in_array($user['role'], ['Admin', 'Manager'])) {
                    return [
                        'success' => false,
                        'message' => 'Accesso negato. Solo Admin e Manager possono visualizzare le statistiche di altri collaboratori.'
                    ];
                }
            }
            
            // Ore questo mese
            $sql1 = "SELECT COALESCE(SUM(gg), 0) as ore_mese
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = ? 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt1 = $this->db->prepare($sql1);
            $stmt1->execute([$targetCollaboratoreId]);
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
            $stmt3->execute([$targetCollaboratoreId]);
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
            $stmt4->execute([$targetCollaboratoreId]);
            $giorniLavorati = $stmt4->fetch()['giorni_lavorati'];
            
            // Calcolo del Costo giornaliero - SOLO per giornate di tipo "Campo"
            $sql5 = "SELECT 
                        SUM(
                            g.gg * COALESCE(
                                -- Tariffa specifica per commessa se esiste
                                (SELECT tc.Tariffa_gg 
                                 FROM ANA_TARIFFE_COLLABORATORI tc
                                 WHERE tc.ID_COLLABORATORE = g.ID_COLLABORATORE
                                 AND tc.ID_COMMESSA = c.ID_COMMESSA
                                 AND tc.Dal <= g.Data
                                 ORDER BY tc.Dal DESC
                                 LIMIT 1),
                                -- Altrimenti tariffa standard (ID_COMMESSA è NULL)
                                (SELECT ts.Tariffa_gg
                                 FROM ANA_TARIFFE_COLLABORATORI ts
                                 WHERE ts.ID_COLLABORATORE = g.ID_COLLABORATORE
                                 AND ts.ID_COMMESSA IS NULL
                                 AND ts.Dal <= g.Data
                                 ORDER BY ts.Dal DESC
                                 LIMIT 1),
                                0
                            )
                        ) as costo_gg
                     FROM FACT_GIORNATE g
                     LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                     LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                     WHERE g.ID_COLLABORATORE = ? 
                     AND g.Tipo = 'Campo'
                     AND MONTH(g.Data) = MONTH(CURDATE()) 
                     AND YEAR(g.Data) = YEAR(CURDATE())";
            
            $stmt5 = $this->db->prepare($sql5);
            $stmt5->execute([$targetCollaboratoreId]);
            $costoGg = $stmt5->fetch()['costo_gg'] ?? 0;
            
            return [
                'success' => true,
                'data' => [
                    'ore_mese' => floatval($oreMese),
                    'spese_mese' => floatval($speseMese),
                    'spese_rimborsabili' => floatval(max(0, $speseRimborsabili)),
                    'giorni_lavorati' => intval($giorniLavorati),
                    'costo_gg' => floatval($costoGg) // Restituisce il valore numerico grezzo per evitare problemi di parsing
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
    public function getUltimeConsuntivazioni($limit = 10, $collaboratoreId = null) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Determina quale collaboratore utilizzare
            $targetCollaboratoreId = $collaboratoreId ?: $user['id'];
            
            // Se è richiesto un collaboratore diverso, verifica i permessi
            if ($targetCollaboratoreId !== $user['id']) {
                if (!in_array($user['role'], ['Admin', 'Manager'])) {
                    return [
                        'success' => false,
                        'message' => 'Accesso negato. Solo Admin e Manager possono visualizzare le consuntivazioni di altri collaboratori.'
                    ];
                }
            }
            
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
            $stmt->execute([$targetCollaboratoreId, $limit]);
            
            $consuntivazioni = $stmt->fetchAll();

            // Allego immagini (se presenti)
            $this->attachImagesToList($consuntivazioni);

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
    public function cercaConsuntivazioni($anno = null, $mese = null, $commessaId = null, $collaboratoreId = null) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }
            
            $user = $this->authAPI->getCurrentUser();
            
            // Determina quale collaboratore utilizzare
            $targetCollaboratoreId = $collaboratoreId ?: $user['id'];
            
            // Se è richiesto un collaboratore diverso, verifica i permessi
            if ($targetCollaboratoreId !== $user['id']) {
                if (!in_array($user['role'], ['Admin', 'Manager'])) {
                    return [
                        'success' => false,
                        'message' => 'Accesso negato. Solo Admin e Manager possono visualizzare le consuntivazioni di altri collaboratori.'
                    ];
                }
            }
            
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
                        c.ID_COMMESSA,
                        cl.Cliente,
                        YEAR(g.Data) as Anno,
                        MONTH(g.Data) as Mese,
                        MONTHNAME(g.Data) as Nome_Mese
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    LEFT JOIN ANA_CLIENTI cl ON c.ID_CLIENTE = cl.ID_CLIENTE
                    WHERE g.ID_COLLABORATORE = ?";
            
            $params = [$targetCollaboratoreId];
            
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
            $totaleCostoGg = 0;
            $raggruppatePer_Mese = [];
            
            foreach ($consuntivazioni as &$cons) {
                $totaleGiornate += $cons['gg'];
                $totaleSpese += $cons['Totale_Spese'];
                $totaleFattVP += $cons['Spese_Fatturate_VP'];
                
                // Calcola il costo gg per questa consuntivazione
                $costoGgConsuntivazione = $this->calcolaCostoGgConsuntivazione($targetCollaboratoreId, $cons);
                $totaleCostoGg += $costoGgConsuntivazione;
                
                // Aggiungi il costo_gg ai dati della consuntivazione per l'esportazione CSV
                $cons['costo_gg'] = $costoGgConsuntivazione;
                
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
                        'costo_gg' => 0,
                        'count' => 0
                    ];
                }
                $raggruppatePer_Mese[$chiaveMese]['giornate'] += $cons['gg'];
                $raggruppatePer_Mese[$chiaveMese]['spese'] += $cons['Totale_Spese'];
                $raggruppatePer_Mese[$chiaveMese]['spese_fatturate_vp'] += $cons['Spese_Fatturate_VP'];
                $raggruppatePer_Mese[$chiaveMese]['spese_rimborsabili'] = $raggruppatePer_Mese[$chiaveMese]['spese'] - $raggruppatePer_Mese[$chiaveMese]['spese_fatturate_vp'];
                $raggruppatePer_Mese[$chiaveMese]['costo_gg'] += $costoGgConsuntivazione;
                $raggruppatePer_Mese[$chiaveMese]['count']++;
            }
            // Allego immagini alle consuntivazioni trovate
            $this->attachImagesToList($consuntivazioni);
            
            return [
                'success' => true,
                'data' => [
                    'consuntivazioni' => $consuntivazioni,
                    'statistiche' => [
                        'totale_giornate' => $totaleGiornate,
                        'totale_spese' => $totaleSpese,
                        'totale_spese_fatturate_vp' => $totaleFattVP,
                        'totale_spese_rimborsabili' => max(0, $totaleSpese - $totaleFattVP),
                        'totale_costo_gg' => $totaleCostoGg,
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
     * Calcola il costo gg per una singola consuntivazione
     */
    private function calcolaCostoGgConsuntivazione($collaboratoreId, $consuntivazione) {
        try {
            // IMPORTANTE: calcolo solo per giornate di tipo "Campo"
            if (!isset($consuntivazione['Tipo']) || $consuntivazione['Tipo'] !== 'Campo') {
                return 0;
            }
            
            // Query per ottenere la tariffa appropriata per questa consuntivazione.
            // La commessa viene risolta tramite ID_COMMESSA (non tramite il nome del
            // task, che è una categoria generica condivisa da più commesse).
            // Dà priorità alla tariffa specifica per commessa, con fallback alla
            // tariffa standard (ID_COMMESSA IS NULL). Stessa semantica di
            // GiornateAPI::getTariffaAttiva() per garantire coerenza tra le viste.
            $sql = "SELECT Tariffa_gg
                    FROM ANA_TARIFFE_COLLABORATORI
                    WHERE ID_COLLABORATORE = ?
                    AND Dal <= ?
                    AND (ID_COMMESSA = ? OR ID_COMMESSA IS NULL)
                    ORDER BY ID_COMMESSA DESC, Dal DESC
                    LIMIT 1";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                $collaboratoreId,
                $consuntivazione['Data'],
                $consuntivazione['ID_COMMESSA'] ?? null
            ]);

            $tariffaGg = $stmt->fetchColumn();
            $tariffaGg = $tariffaGg !== false ? floatval($tariffaGg) : 0;

            return $consuntivazione['gg'] * $tariffaGg;
            
        } catch (Exception $e) {
            // In caso di errore, ritorna 0
            return 0;
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
                        Desc_Task as Descrizione,
                        Tipo
                    FROM ANA_TASK
                    WHERE ID_COMMESSA = ?
                    AND Stato_Task = 'In corso'
                    AND Tipo != 'Monitoraggio'
                    ORDER BY Task";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$commessaId]);
            
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
            
            // Allego immagini
            if ($consuntivazione) {
                $consuntivazione['images'] = $this->listImages($consuntivazione['ID_GIORNATA'])['images'] ?? [];
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

    /**
     * Salva una nuova consuntivazione
     */
    public function salvaConsuntivazione($data) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return [
                    'success' => false,
                    'message' => 'Utente non autenticato'
                ];
            }

            $user = $this->authAPI->getCurrentUser();
            if (!$user) {
                return [
                    'success' => false,
                    'message' => 'Errore nel recupero dati utente'
                ];
            }

            // Validazione dati base
            if (!isset($data['data']) || !isset($data['task']) || !isset($data['giornate_lavorate'])) {
                return [
                    'success' => false,
                    'message' => 'Dati obbligatori mancanti (data, task, giornate_lavorate)'
                ];
            }

            // Genera ID univoco per la giornata
            $idGiornata = 'GIO' . date('YmdHis') . mt_rand(100, 999);

            // Prepara i dati per l'inserimento
            $insertData = [
                'ID_GIORNATA' => $idGiornata,
                'Data' => $data['data'],
                'ID_COLLABORATORE' => $user['id'],
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
                'ID_UTENTE_CREAZIONE' => $user['id']
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
                // Se ci sono file uplodati (multipart/form-data), gestiscili
                if (!empty($_FILES) && isset($_FILES['images'])) {
                    $this->saveUploadedImages($idGiornata, $_FILES['images'], $user['id']);
                }
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
                'message' => 'Errore durante il salvataggio: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Salva i metadati delle immagini e sposta i file nella cartella di upload
     */
    public function saveUploadedImages($idGiornata, $filesArray, $uploaderId = null) {
        // $filesArray è la struttura di $_FILES['images'] con array di file
        $count = is_array($filesArray['name']) ? count($filesArray['name']) : 0;

        if ($count === 0) return [];

        // Assicurati che la cartella esista
        if (!is_dir($this->uploadDir)) {
            @mkdir($this->uploadDir, 0755, true);
        }

        $allowed = ['image/jpeg', 'image/png', 'image/webp'];
        $maxSize = 5 * 1024 * 1024; // 5MB

        $inserted = [];

        for ($i = 0; $i < $count; $i++) {
            $error = $filesArray['error'][$i];
            if ($error !== UPLOAD_ERR_OK) continue;

            $tmpName = $filesArray['tmp_name'][$i];
            $origName = basename($filesArray['name'][$i]);
            $size = intval($filesArray['size'][$i]);
            $mime = mime_content_type($tmpName);

            if ($size > $maxSize) continue;
            if (!in_array($mime, $allowed)) continue;

            $ext = pathinfo($origName, PATHINFO_EXTENSION);
            // Genera un identificatore sicuro compatibile con diverse versioni di PHP
            if (function_exists('random_bytes')) {
                $rand = bin2hex(random_bytes(8));
            } elseif (function_exists('openssl_random_pseudo_bytes')) {
                $rand = bin2hex(openssl_random_pseudo_bytes(8));
            } else {
                // Fallback meno crittografico ma operativo per PHP molto vecchi
                $rand = str_replace('.', '', uniqid('', true));
            }
            $unique = $rand . '_' . time();
            $safeName = $unique . '.' . $ext;
            $dest = rtrim($this->uploadDir, '/\\') . DIRECTORY_SEPARATOR . $safeName;

            if (move_uploaded_file($tmpName, $dest)) {
                // Inserisci metadati
                $ins = $this->db->prepare("INSERT INTO GIORNATE_IMMAGINI (ID_GIORNATA, filename, original_name, mime_type, size, uploader_id, visible) VALUES (?, ?, ?, ?, ?, ?, 1)");
                $ins->execute([$idGiornata, $safeName, $origName, $mime, $size, $uploaderId]);
                $inserted[] = $this->db->lastInsertId();
            }
        }

        // Aggiorna flag has_images
        $this->db->prepare("UPDATE FACT_GIORNATE SET has_images = (SELECT COUNT(*) FROM GIORNATE_IMMAGINI WHERE ID_GIORNATA = ?) WHERE ID_GIORNATA = ?")->execute([$idGiornata, $idGiornata]);

        return $inserted;
    }

    /**
     * Restituisce le immagini associate a una giornata
     */
    public function listImages($idGiornata) {
        $images = [];
        if (!$idGiornata) return ['success' => true, 'images' => []];

        $sql = "SELECT id, filename, original_name, mime_type, size, uploaded_at FROM GIORNATE_IMMAGINI WHERE ID_GIORNATA = ? AND visible = 1 ORDER BY uploaded_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$idGiornata]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Costruisci percorso canonico allo script API (es. /test/API/ConsuntivazioneAPI.php)
    $scriptPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/' . basename(__FILE__);
    // Assicura leading slash e rimuovi possibili duplicazioni
    $scriptPath = '/' . ltrim($scriptPath, '/');
        foreach ($rows as $r) {
            // Usa endpoint API relativo per servire l'immagine
            $r['url'] = $scriptPath . '?action=serve_image&id_image=' . $r['id'];
            $images[] = $r;
        }

        return ['success' => true, 'images' => $images];
    }

    /**
     * Allegare immagini a un array di consuntivazioni (per migliorare UI)
     */
    private function attachImagesToList(&$consList) {
        if (!is_array($consList) || count($consList) === 0) return;

        $ids = array_map(function($c) { return $c['ID_GIORNATA']; }, $consList);
        if (count($ids) === 0) return;

        // Preleva tutte le immagini per questi id
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT id, ID_GIORNATA, filename, original_name FROM GIORNATE_IMMAGINI WHERE ID_GIORNATA IN ($placeholders) AND visible = 1 ORDER BY uploaded_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($ids);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Costruisci percorso canonico allo script API per evitare duplicazioni
    $scriptPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/' . basename(__FILE__);
    // Assicura leading slash e rimuovi possibili duplicazioni
    $scriptPath = '/' . ltrim($scriptPath, '/');
        $grouped = [];
        foreach ($rows as $r) {
            $r['url'] = $scriptPath . '?action=serve_image&id_image=' . $r['id'];
            $grouped[$r['ID_GIORNATA']][] = $r;
        }

        foreach ($consList as &$cons) {
            $cons['images'] = $grouped[$cons['ID_GIORNATA']] ?? [];
        }
    }

    /**
     * Elimina immagine (set visible=0 e cancella file fisico) data l'id immagine
     */
    public function deleteImage($idImage) {
        try {
            if (!$this->authAPI->isAuthenticated()) {
                return ['success' => false, 'message' => 'Utente non autenticato'];
            }

            $user = $this->authAPI->getCurrentUser();

            // Recupera la riga
            $sql = "SELECT id, filename, ID_GIORNATA, uploader_id FROM GIORNATE_IMMAGINI WHERE id = ? LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$idImage]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) return ['success' => false, 'message' => 'Immagine non trovata'];

            // Permessi: solo uploader o Admin/Manager possono cancellare
            if ($row['uploader_id'] && $row['uploader_id'] != $user['id'] && !in_array($user['role'], ['Admin','Manager'])) {
                return ['success' => false, 'message' => 'Permessi insufficienti per eliminare l\'immagine'];
            }

            // Cancella fisicamente
            $filePath = rtrim($this->uploadDir, '/\\') . DIRECTORY_SEPARATOR . $row['filename'];
            if (file_exists($filePath)) @unlink($filePath);

            // Elimina o marca come non visibile
            $del = $this->db->prepare("DELETE FROM GIORNATE_IMMAGINI WHERE id = ?");
            $del->execute([$idImage]);

            // Aggiorna flag has_images
            $this->db->prepare("UPDATE FACT_GIORNATE SET has_images = (SELECT COUNT(*) FROM GIORNATE_IMMAGINI WHERE ID_GIORNATA = ?) WHERE ID_GIORNATA = ?")->execute([$row['ID_GIORNATA'], $row['ID_GIORNATA']]);

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Errore eliminazione immagine: ' . $e->getMessage()];
        }
    }

    /**
     * Serve an image binary given image id (with basic auth check)
     */
    public function serveImage($idImage) {
        // No JSON response: invia direttamente il file
        if (!$idImage) {
            http_response_code(400);
            echo 'Invalid image id';
            exit;
        }

        // Recupera filename e mime
        $sql = "SELECT filename, mime_type FROM GIORNATE_IMMAGINI WHERE id = ? LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$idImage]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(404);
            echo 'Image not found';
            exit;
        }

        $filePath = rtrim($this->uploadDir, '/\\') . DIRECTORY_SEPARATOR . $row['filename'];
        if (!file_exists($filePath)) {
            http_response_code(404);
            echo 'File not found';
            exit;
        }

        // Imposta header corretti
        header('Content-Type: ' . ($row['mime_type'] ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($filePath));

        // Output file
        readfile($filePath);
        exit;
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
            $collaboratoreId = $input['collaboratore_id'] ?? null;
            $result = $consuntivazioneAPI->getStatistiche($collaboratoreId);
            echo json_encode($result);
            break;
            
        case 'get_ultime_consuntivazioni':
            $limit = $input['limit'] ?? 10;
            $collaboratoreId = $input['collaboratore_id'] ?? null;
            $result = $consuntivazioneAPI->getUltimeConsuntivazioni($limit, $collaboratoreId);
            echo json_encode($result);
            break;
            
        case 'cerca_consuntivazioni':
            $anno = $input['anno'] ?? null;
            $mese = $input['mese'] ?? null;
            $commessaId = $input['commessa_id'] ?? null;
            $collaboratoreId = $input['collaboratore_id'] ?? null;
            $result = $consuntivazioneAPI->cercaConsuntivazioni($anno, $mese, $commessaId, $collaboratoreId);
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
            // Se la richiesta è multipart/form-data e contiene files, usa $_POST/$_FILES
            $payload = $input ?: $_POST;
            $result = $consuntivazioneAPI->updateConsuntivazione($payload);
            // Se ci sono files inviati, salvali associandoli all'id_giornata
            if (!empty($_FILES) && isset($_FILES['images'])) {
                $idG = $payload['id_giornata'] ?? ($_POST['id_giornata'] ?? null);
                if ($idG) {
                    // il metodo saveUploadedImages gestisce anche l'aggiornamento has_images
                    // Usiamo output buffering e try/catch per catturare eventuale output/exception durante l'upload
                    try {
                        ob_start();
                        $inserted = $consuntivazioneAPI->saveUploadedImages($idG, $_FILES['images'], $_SESSION['user']['id'] ?? null);
                        $ob = ob_get_clean();
                        if ($ob) {
                            if (!isset($result['debug'])) $result['debug'] = '';
                            $result['debug'] .= "\n[upload_output]: " . $ob;
                        }
                        if ($inserted === null) {
                            // No inserted ids returned but no exception: note it
                            if (!isset($result['debug'])) $result['debug'] = '';
                            $result['debug'] .= "\n[upload_info]: saveUploadedImages returned null or empty";
                        }
                    } catch (Throwable $t) {
                        $ob = '';
                        if (ob_get_level()) $ob = ob_get_clean();
                        $result = [
                            'success' => false,
                            'message' => 'Errore durante l\'upload delle immagini: ' . $t->getMessage(),
                            'exception' => $t instanceof Exception ? $t->getTraceAsString() : null,
                            'debug' => $ob
                        ];
                    }
                }
            }
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
            
        case 'salva_consuntivazione':
            // Nota: se la richiesta è multipart/form-data, $input può provenire da $_POST
            $payload = $input ?: $_POST;
            $result = $consuntivazioneAPI->salvaConsuntivazione($payload);
            echo json_encode($result);
            break;

        case 'list_images':
            $idGiornata = $input['id_giornata'] ?? ($_POST['id_giornata'] ?? null);
            $result = $consuntivazioneAPI->listImages($idGiornata);
            echo json_encode($result);
            break;

        case 'delete_image':
            $idImage = $input['id_image'] ?? ($_POST['id_image'] ?? null);
            $result = $consuntivazioneAPI->deleteImage($idImage);
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

        case 'debug_task_structure':
            try {
                $db = getDatabase();
                
                // 1. Controllo commesse
                $sqlCommesse = "SELECT ID_COMMESSA, Commessa, Stato_Commessa FROM ANA_COMMESSE WHERE Stato_Commessa = 'In corso' ORDER BY ID_COMMESSA LIMIT 3";
                $stmtCommesse = $db->query($sqlCommesse);
                $commesse = $stmtCommesse->fetchAll(PDO::FETCH_ASSOC);
                
                $debug = [
                    'success' => true,
                    'commesse_in_corso' => $commesse,
                    'task_analysis' => []
                ];
                
                // 2. Per ogni commessa, analizza i task
                foreach ($commesse as $commessa) {
                    $commessaId = $commessa['ID_COMMESSA'];
                    
                    // Tutti i task
                    $sqlAllTasks = "SELECT ID_TASK, Task, Desc_Task, Tipo, Stato_Task FROM ANA_TASK WHERE ID_COMMESSA = ? ORDER BY ID_TASK";
                    $stmtAllTasks = $db->prepare($sqlAllTasks);
                    $stmtAllTasks->execute([$commessaId]);
                    $allTasks = $stmtAllTasks->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Task filtrati (come nell'API)
                    $sqlFilteredTasks = "SELECT ID_TASK, Task, Desc_Task, Tipo, Stato_Task FROM ANA_TASK WHERE ID_COMMESSA = ? AND Stato_Task = 'In corso' AND Tipo != 'Monitoraggio' ORDER BY Task";
                    $stmtFilteredTasks = $db->prepare($sqlFilteredTasks);
                    $stmtFilteredTasks->execute([$commessaId]);
                    $filteredTasks = $stmtFilteredTasks->fetchAll(PDO::FETCH_ASSOC);
                    
                    $debug['task_analysis'][$commessaId] = [
                        'commessa_nome' => $commessa['Commessa'],
                        'tutti_task' => $allTasks,
                        'task_filtrati' => $filteredTasks,
                        'count_tutti' => count($allTasks),
                        'count_filtrati' => count($filteredTasks)
                    ];
                }
                
                // 3. Stati e tipi globali
                $sqlStati = "SELECT DISTINCT Stato_Task, COUNT(*) as count FROM ANA_TASK GROUP BY Stato_Task";
                $stmtStati = $db->query($sqlStati);
                $debug['stati_task_globali'] = $stmtStati->fetchAll(PDO::FETCH_ASSOC);
                
                $sqlTipi = "SELECT DISTINCT Tipo, COUNT(*) as count FROM ANA_TASK GROUP BY Tipo";
                $stmtTipi = $db->query($sqlTipi);
                $debug['tipi_task_globali'] = $stmtTipi->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode($debug);
                
            } catch (Exception $e) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Errore debug: ' . $e->getMessage()
                ]);
            }
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non valida: ' . $action
            ]);
    }
} else if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    // Se non è POST e neppure GET, rispondi con errore; per GET lasciamo il codice più sotto
    echo json_encode([
        'success' => false,
        'message' => 'Metodo non supportato'
    ]);
}

// Supporta la chiamata GET per servire immagini: /API/ConsuntivazioneAPI.php?action=serve_image&id_image=123
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action === 'serve_image') {
        $consuntivazioneAPI = new ConsuntivazioneAPI();
        $idImage = $_GET['id_image'] ?? null;
        $consuntivazioneAPI->serveImage($idImage);
    }
}
?>