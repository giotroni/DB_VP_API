<?php
/**
 * AttivitaAPI - Registro delle attività sul database e dei log applicativi
 *
 * Alimenta la sezione Statistiche di Management. Risponde a una domanda sola:
 * "cos'è successo nel gestionale negli ultimi giorni, e chi l'ha fatto".
 *
 * Non esiste una tabella di audit: la cronologia viene ricostruita dalle colonne
 * Data_Creazione / Data_Modifica che tutte le tabelle principali già portano.
 * Il limite è dichiarato e va tenuto presente leggendo la pagina:
 *   - le cancellazioni non lasciano traccia;
 *   - di ogni record si vedono solo l'ultima modifica e la creazione, non lo
 *     storico completo né quali campi siano cambiati.
 * Un audit vero richiede una tabella dedicata scritta da BaseAPI: è un lavoro a
 * sé, e comunque non potrebbe raccontare la settimana appena passata.
 *
 * Le giornate (FACT_GIORNATE) sono marcate come area 'Consuntivazione' perché è
 * da lì che vengono inserite dai collaboratori.
 *
 * Sola lettura, e riservata al ruolo Admin: mostra chi ha toccato cosa in tutto
 * il gestionale, comprese le fatture.
 */

class AttivitaAPI {

    /** Giorni coperti dalla pagina quando la richiesta non dice altro. */
    const GIORNI_DEFAULT = 7;

    /** Tetto agli eventi restituiti: la pagina è un registro, non un export. */
    const MAX_EVENTI = 500;

    /** Righe di log lette dal fondo di ciascun file. */
    const MAX_RIGHE_LOG = 200;

    private $db;

    public function __construct() {
        $this->db = getDatabase();
    }

    public function handleRequest($id = null) {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            sendErrorResponse('Metodo HTTP non supportato', 405);
            return;
        }

        // Il controllo di accesso sta qui, non solo nella sidebar: nascondere la
        // voce di menu non impedisce di chiamare l'endpoint a mano.
        if ($this->getCurrentUserRole() !== 'Admin') {
            sendErrorResponse('Sezione riservata agli amministratori', 403);
            return;
        }

        $giorni = isset($_GET['giorni']) ? intval($_GET['giorni']) : self::GIORNI_DEFAULT;
        $giorni = max(1, min(90, $giorni));

        $eventi = $this->getEventiDatabase($giorni);
        $log = $this->getRigheLog($giorni);

        sendSuccessResponse([
            'periodo' => [
                'giorni' => $giorni,
                'dal' => date('Y-m-d H:i:s', strtotime("-$giorni days")),
                'al' => date('Y-m-d H:i:s')
            ],
            'riepilogo' => $this->riepiloga($eventi, $log),
            'eventi' => $eventi,
            'log' => $log
        ], 'Registro attività');
    }

    /**
     * Ruolo dell'utente in sessione. Stessa logica di BaseAPI::getCurrentUserRole():
     * questa classe non estende BaseAPI perché non c'è una tabella dietro.
     */
    private function getCurrentUserRole() {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        return $_SESSION['user_role'] ?? null;
    }

    // ========================================================================
    // EVENTI DAL DATABASE
    // ========================================================================

    /**
     * Le tabelle da cui si ricostruisce la cronologia, con come descrivere il
     * record a parole. Aggiungere una tabella qui la fa comparire nel registro.
     *
     * Tutti i valori sono costanti scritte in questo file: nessun dato della
     * richiesta finisce nella query (l'unico parametro, i giorni, è un intero).
     */
    private function fontiDati() {
        return [
            [
                'entita' => 'Giornata', 'area' => 'Consuntivazione',
                'tabella' => 'FACT_GIORNATE', 'alias' => 'g', 'pk' => 'ID_GIORNATA',
                'from' => "FACT_GIORNATE g
                           LEFT JOIN ANA_COLLABORATORI col ON col.ID_COLLABORATORE = g.ID_COLLABORATORE
                           LEFT JOIN ANA_TASK tsk ON tsk.ID_TASK = g.ID_TASK",
                'descrizione' => "CONCAT(
                        DATE_FORMAT(g.Data, '%d/%m/%Y'), ' · ', COALESCE(col.Collaboratore, '—'),
                        COALESCE(CONCAT(' · ', tsk.Task), ''),
                        ' · ', COALESCE(g.gg, 0), ' gg')"
            ],
            [
                'entita' => 'Fattura', 'area' => 'Management',
                'tabella' => 'FACT_FATTURE', 'alias' => 'f', 'pk' => 'ID_FATTURA',
                'from' => "FACT_FATTURE f
                           LEFT JOIN ANA_CLIENTI cli ON cli.ID_CLIENTE = f.ID_CLIENTE",
                'descrizione' => "CONCAT(
                        REPLACE(f.TIPO, '_', ' '), ' ', COALESCE(f.NR, ''),
                        ' · ', COALESCE(cli.Cliente, '—'),
                        ' · ', FORMAT(COALESCE(f.Fatturato_TOT, 0), 2), ' EUR')"
            ],
            [
                'entita' => 'Commessa', 'area' => 'Management',
                'tabella' => 'ANA_COMMESSE', 'alias' => 'cm', 'pk' => 'ID_COMMESSA',
                'from' => "ANA_COMMESSE cm
                           LEFT JOIN ANA_CLIENTI cli2 ON cli2.ID_CLIENTE = cm.ID_CLIENTE",
                'descrizione' => "CONCAT(COALESCE(cm.Commessa, cm.ID_COMMESSA), COALESCE(CONCAT(' · ', cli2.Cliente), ''))"
            ],
            [
                'entita' => 'Task', 'area' => 'Management',
                'tabella' => 'ANA_TASK', 'alias' => 'tk', 'pk' => 'ID_TASK',
                'from' => "ANA_TASK tk
                           LEFT JOIN ANA_COMMESSE cm2 ON cm2.ID_COMMESSA = tk.ID_COMMESSA",
                'descrizione' => "CONCAT(COALESCE(tk.Task, tk.ID_TASK), COALESCE(CONCAT(' · ', cm2.Commessa), ''))"
            ],
            [
                'entita' => 'Cliente', 'area' => 'Management',
                'tabella' => 'ANA_CLIENTI', 'alias' => 'cl', 'pk' => 'ID_CLIENTE',
                'from' => "ANA_CLIENTI cl",
                'descrizione' => "COALESCE(cl.Cliente, cl.Ragione_Sociale, cl.ID_CLIENTE)"
            ],
            [
                'entita' => 'Collaboratore', 'area' => 'Management',
                'tabella' => 'ANA_COLLABORATORI', 'alias' => 'cb', 'pk' => 'ID_COLLABORATORE',
                'from' => "ANA_COLLABORATORI cb",
                'descrizione' => "CONCAT(COALESCE(cb.Collaboratore, cb.ID_COLLABORATORE), ' · ', COALESCE(cb.Ruolo, '—'))"
            ],
            [
                'entita' => 'Tariffa', 'area' => 'Management',
                'tabella' => 'ANA_TARIFFE_COLLABORATORI', 'alias' => 'tf', 'pk' => 'ID_TARIFFA',
                'from' => "ANA_TARIFFE_COLLABORATORI tf
                           LEFT JOIN ANA_COLLABORATORI cb2 ON cb2.ID_COLLABORATORE = tf.ID_COLLABORATORE",
                'descrizione' => "CONCAT(COALESCE(cb2.Collaboratore, tf.ID_COLLABORATORE), ' · tariffa ', tf.ID_TARIFFA)"
            ],
        ];
    }

    /**
     * Creazioni e modifiche degli ultimi $giorni giorni, dalla più recente.
     */
    private function getEventiDatabase($giorni) {
        $soglia = "DATE_SUB(NOW(), INTERVAL " . intval($giorni) . " DAY)";
        $blocchi = [];

        foreach ($this->fontiDati() as $f) {
            $a = $f['alias'];

            // Creazione
            $blocchi[] = "
                SELECT '{$f['entita']}' AS entita, '{$f['area']}' AS area, '{$f['tabella']}' AS tabella,
                       'creazione' AS tipo,
                       $a.{$f['pk']} AS id_record,
                       {$f['descrizione']} AS descrizione,
                       $a.Data_Creazione AS data_ora,
                       $a.ID_UTENTE_CREAZIONE AS utente_id,
                       COALESCE(usr.Collaboratore, $a.ID_UTENTE_CREAZIONE, '—') AS utente
                FROM {$f['from']}
                LEFT JOIN ANA_COLLABORATORI usr ON usr.ID_COLLABORATORE = $a.ID_UTENTE_CREAZIONE
                WHERE $a.Data_Creazione >= $soglia";

            // Modifica. Il confronto con Data_Creazione evita che ogni inserimento
            // produca anche una modifica: la colonna nasce uguale alla creazione.
            // I record importati dal vecchio archivio hanno Data_Creazione nulla,
            // e senza il caso esplicito il confronto darebbe NULL: le loro
            // modifiche non comparirebbero mai nel registro.
            $blocchi[] = "
                SELECT '{$f['entita']}' AS entita, '{$f['area']}' AS area, '{$f['tabella']}' AS tabella,
                       'modifica' AS tipo,
                       $a.{$f['pk']} AS id_record,
                       {$f['descrizione']} AS descrizione,
                       $a.Data_Modifica AS data_ora,
                       $a.ID_UTENTE_MODIFICA AS utente_id,
                       COALESCE(usr.Collaboratore, $a.ID_UTENTE_MODIFICA, '—') AS utente
                FROM {$f['from']}
                LEFT JOIN ANA_COLLABORATORI usr ON usr.ID_COLLABORATORE = $a.ID_UTENTE_MODIFICA
                WHERE $a.Data_Modifica >= $soglia
                  AND ($a.Data_Creazione IS NULL OR $a.Data_Modifica > $a.Data_Creazione)";
        }

        $sql = "SELECT * FROM (" . implode(" UNION ALL ", $blocchi) . ") AS attivita
                ORDER BY data_ora DESC
                LIMIT " . self::MAX_EVENTI;

        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            // Una tabella assente in un ambiente non deve far fallire la pagina.
            error_log('AttivitaAPI::getEventiDatabase - ' . $e->getMessage());
            return [];
        }
    }

    // ========================================================================
    // LOG APPLICATIVI
    // ========================================================================

    /**
     * I file di log scritti dall'applicazione. Percorsi fissi: nessun parametro
     * della richiesta partecipa, quindi non c'è modo di farsi leggere altro.
     */
    private function fileLog() {
        return [
            ['nome' => 'Errori API', 'origine' => 'Management', 'path' => __DIR__ . '/logs/api_errors.log'],
            ['nome' => 'Errori PHP', 'origine' => 'Sistema', 'path' => __DIR__ . '/../DB/logs/php_errors.log'],
            ['nome' => 'Sistema', 'origine' => 'Sistema', 'path' => __DIR__ . '/../DB/logs/system.log'],
            ['nome' => 'Upload consuntivazione', 'origine' => 'Consuntivazione', 'path' => __DIR__ . '/../DB/uploads/consuntivazioni/upload_errors.log'],
        ];
    }

    private function getRigheLog($giorni) {
        $soglia = strtotime("-$giorni days");
        $righe = [];

        foreach ($this->fileLog() as $file) {
            if (!is_readable($file['path'])) {
                continue;
            }

            foreach ($this->tail($file['path'], self::MAX_RIGHE_LOG) as $riga) {
                $riga = trim($riga);
                if ($riga === '') {
                    continue;
                }

                $timestamp = $this->estraiTimestamp($riga);
                // Le righe senza data sono continuazioni (stack trace): fuori dal
                // registro, che è una lista di eventi datati.
                if ($timestamp === null || $timestamp < $soglia) {
                    continue;
                }

                $righe[] = [
                    'file' => $file['nome'],
                    'origine' => $file['origine'],
                    'data_ora' => date('Y-m-d H:i:s', $timestamp),
                    'livello' => $this->estraiLivello($riga),
                    'messaggio' => mb_substr($riga, 0, 500)
                ];
            }
        }

        usort($righe, function ($a, $b) {
            return strcmp($b['data_ora'], $a['data_ora']);
        });

        return array_slice($righe, 0, self::MAX_EVENTI);
    }

    /**
     * Le ultime $n righe di un file, senza caricarlo tutto in memoria.
     */
    private function tail($path, $n) {
        $dimensione = @filesize($path);
        if ($dimensione === false) {
            return [];
        }

        // 256 KB dal fondo bastano largamente per $n righe di log.
        $finestra = 262144;
        $handle = @fopen($path, 'rb');
        if (!$handle) {
            return [];
        }

        if ($dimensione > $finestra) {
            fseek($handle, -$finestra, SEEK_END);
            fgets($handle); // scarta la prima riga, probabilmente troncata
        }

        $righe = [];
        while (($riga = fgets($handle)) !== false) {
            $righe[] = $riga;
        }
        fclose($handle);

        return array_slice($righe, -$n);
    }

    /**
     * I quattro formati di data prodotti dai log del gestionale.
     */
    private function estraiTimestamp($riga) {
        $formati = [
            '/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{2}:\d{2})/', // api_errors.log
            '/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/',              // system.log, upload_errors.log
            '/^\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2})[^\]]*\]/',        // php_errors.log
        ];

        foreach ($formati as $regex) {
            if (preg_match($regex, $riga, $m)) {
                $ts = strtotime($m[1]);
                return $ts === false ? null : $ts;
            }
        }

        return null;
    }

    private function estraiLivello($riga) {
        $minuscola = strtolower($riga);
        if (strpos($minuscola, 'fatal') !== false || strpos($minuscola, 'exception') !== false) {
            return 'errore';
        }
        if (strpos($minuscola, 'error') !== false || strpos($minuscola, 'errore') !== false) {
            return 'errore';
        }
        if (strpos($minuscola, 'warning') !== false || strpos($minuscola, 'deprecated') !== false) {
            return 'avviso';
        }
        return 'info';
    }

    // ========================================================================
    // RIEPILOGO
    // ========================================================================

    private function riepiloga($eventi, $log) {
        $perEntita = [];
        $perUtente = [];
        $creazioni = 0;
        $modifiche = 0;

        foreach ($eventi as $e) {
            $perEntita[$e['entita']] = ($perEntita[$e['entita']] ?? 0) + 1;
            $perUtente[$e['utente']] = ($perUtente[$e['utente']] ?? 0) + 1;
            if ($e['tipo'] === 'creazione') {
                $creazioni++;
            } else {
                $modifiche++;
            }
        }

        arsort($perEntita);
        arsort($perUtente);

        $errori = 0;
        foreach ($log as $r) {
            if ($r['livello'] === 'errore') {
                $errori++;
            }
        }

        return [
            'eventi_totali' => count($eventi),
            'creazioni' => $creazioni,
            'modifiche' => $modifiche,
            'utenti_attivi' => count($perUtente),
            'righe_log' => count($log),
            'errori_log' => $errori,
            'per_entita' => $perEntita,
            'per_utente' => $perUtente,
            'troncato' => count($eventi) >= self::MAX_EVENTI
        ];
    }
}
