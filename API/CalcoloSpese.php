<?php
/**
 * CalcoloSpese - Regole di calcolo delle spese, in un punto solo
 *
 * Le regole sono state decise il 02/08/2026 e separate in due categorie il
 * 07/08/2026 (vedi docs/REGOLE-SPESE.md). Prima del 03/08/2026 la logica era
 * replicata in TaskAPI, GiornateAPI, CommesseAPI e nel front-end, ed era
 * divergente: il forfait veniva contato una volta per task, una per giornata e
 * una per mese a seconda di chi leggeva il dato.
 *
 * Il prezzo di vendita delle spese vive su ANA_TASK in due categorie
 * indipendenti, ciascuna col proprio regime:
 *
 *   VIAGGI          Spese_Comprese_Viaggi + Valore_Spese_std_Viaggi
 *   VITTO/ALLOGGIO  Spese_Comprese_Vitto_Alloggio + Valore_Spese_std_Vitto_Alloggio
 *                   (comprende anche Altri_costi)
 *
 * Le due grandezze economiche restano indipendenti:
 *
 *  RICAVO  = quanto si addebita al cliente, categoria per categoria
 *            - 0 se la giornata non è di campo o è da remoto (Desk = 'Si')
 *            - 0 sui viaggi se la giornata ha Viaggio = 'No', cioè il
 *              consulente si è fermato in loco e la trasferta non c'è stata
 *            - 0 se la categoria è compresa nel valore giornata
 *            - la diaria della categoria, INTERA per ogni giornata di campo
 *              (anche per le mezze giornate: la trasferta c'è comunque)
 *            - altrimenti le spese effettive lorde di quella categoria
 *
 *  COSTO   = quanto V&P ha sborsato, SEMPRE le spese lorde di tutte e tre le
 *            voci, in ogni regime e a prescindere dal flag Viaggio.
 *            Non è ridotto da Spese_Fatturate_VP: quella quota è pagata con la
 *            carta di credito V&P, quindi è un esborso aziendale a tutti gli
 *            effetti — serve solo a non riconoscerla al consulente.
 *
 * Da non confondere con FACT_GIORNATE.Costo_Spese calcolato in GiornateAPI, che
 * vale "spese lorde - Spese_Fatturate_VP": quello è il rimborso dovuto al
 * collaboratore, non il costo di commessa.
 */

class CalcoloSpese {

    // ------------------------------------------------------------------
    // Espressioni SQL
    // ------------------------------------------------------------------

    /**
     * Espressione SQL che somma le spese lorde di una giornata: è il COSTO.
     * I campi sono testuali su alcune installazioni, da qui il REPLACE.
     *
     * @param string $alias prefisso della tabella FACT_GIORNATE nella query
     */
    public static function sqlSpeseLorde($alias = '') {
        return '(' . self::sqlSpeseViaggi($alias) . ' + ' . self::sqlSpeseVitto($alias) . ')';
    }

    /**
     * La componente viaggi delle spese di una giornata.
     */
    public static function sqlSpeseViaggi($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "COALESCE(CAST(REPLACE({$p}Spese_Viaggi, ',', '.') AS DECIMAL(10,2)), 0)";
    }

    /**
     * La componente vitto/alloggio, che comprende anche gli altri costi:
     * viaggiano insieme perché seguono lo stesso regime sul task.
     */
    public static function sqlSpeseVitto($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "(COALESCE(CAST(REPLACE({$p}Vitto_alloggio, ',', '.') AS DECIMAL(10,2)), 0) +
                 COALESCE(CAST(REPLACE({$p}Altri_costi, ',', '.') AS DECIMAL(10,2)), 0))";
    }

    /**
     * Condizione SQL che isola le giornate su cui le spese sono addebitabili:
     * di campo e non da remoto.
     */
    public static function sqlGiornateAddebitabili($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "({$p}Tipo = 'Campo' AND COALESCE({$p}Desk, 'No') <> 'Si')";
    }

    /**
     * Condizione SQL più stretta, per i soli viaggi: serve anche che il viaggio
     * sia stato effettuato.
     */
    public static function sqlViaggiAddebitabili($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "(" . self::sqlGiornateAddebitabili($alias) . " AND COALESCE({$p}Viaggio, 'Si') = 'Si')";
    }

    // ------------------------------------------------------------------
    // Il regime di spesa del task
    // ------------------------------------------------------------------

    /**
     * Legge un campo del task, ripiegando sul nome storico solo quando quello
     * nuovo manca del tutto: è il caso di un record letto da uno schema su cui
     * la migration non è ancora passata.
     *
     * Il ripiego guarda la presenza della chiave, non il suo valore: se il
     * campo nuovo c'è ma è vuoto, vuoto è la risposta giusta. Altrimenti
     * azzerare una diaria in Management non avrebbe effetto, perché il vecchio
     * Valore_Spese_std la rimetterebbe in gioco.
     */
    private static function campoTask($taskData, $nuovo, $storico) {
        if (array_key_exists($nuovo, $taskData)) {
            return $taskData[$nuovo];
        }
        return $taskData[$storico] ?? null;
    }

    /**
     * Il regime di una categoria, dichiarato in colonna dal 17/08/2026.
     *
     * Prima era dedotto — "compreso, altrimenti diaria se c'è un importo,
     * altrimenti costi reali" — e quell'implicito ha reso indistinguibile un
     * forfait una tantum da una tariffa a trasferta. Il ripiego sulla deduzione
     * resta solo per i record letti da uno schema su cui la migration non è
     * ancora passata.
     *
     * @return string Compreso | Diaria | Corpo | Reali
     */
    public static function regime($taskData, $categoria) {
        $nuovo = 'Regime_Spese_' . $categoria;
        if (!empty($taskData[$nuovo])) {
            return $taskData[$nuovo];
        }
        $compreso = self::campoTask($taskData, 'Spese_Comprese_' . $categoria, 'Spese_Comprese');
        if ($compreso === 'Si') {
            return 'Compreso';
        }
        $storico = $categoria === 'Viaggi' ? 'Valore_Spese_std' : null;
        $diaria  = $storico
            ? self::campoTask($taskData, 'Valore_Spese_std_' . $categoria, $storico)
            : ($taskData['Valore_Spese_std_' . $categoria] ?? null);
        return floatval($diaria ?? 0) > 0 ? 'Diaria' : 'Reali';
    }

    /**
     * L'importo associato al regime: diaria giornaliera se `Diaria`, importo
     * a corpo se `Corpo`, 0 negli altri casi (dove non ha significato).
     */
    public static function importo($taskData, $categoria) {
        $regime = self::regime($taskData, $categoria);
        if ($regime !== 'Diaria' && $regime !== 'Corpo') {
            return 0.0;
        }
        $nuovo = 'Valore_Spese_' . $categoria;
        if (array_key_exists($nuovo, $taskData) && $taskData[$nuovo] !== null) {
            return floatval($taskData[$nuovo]);
        }
        $storico = $categoria === 'Viaggi' ? 'Valore_Spese_std' : null;
        $vecchio = $storico
            ? self::campoTask($taskData, 'Valore_Spese_std_' . $categoria, $storico)
            : ($taskData['Valore_Spese_std_' . $categoria] ?? null);
        return floatval($vecchio ?? 0);
    }

    public static function speseCompreseViaggi($taskData) {
        return self::regime($taskData, 'Viaggi') === 'Compreso';
    }

    public static function speseCompreseVitto($taskData) {
        return self::regime($taskData, 'Vitto_Alloggio') === 'Compreso';
    }

    /**
     * La diaria viaggi: quanto si addebita per OGNI giornata con trasferta.
     * 0 se il regime non è `Diaria`.
     */
    public static function diariaViaggi($taskData) {
        return self::regime($taskData, 'Viaggi') === 'Diaria'
            ? self::importo($taskData, 'Viaggi')
            : 0.0;
    }

    /**
     * La diaria vitto/alloggio, per ogni giornata addebitabile.
     */
    public static function diariaVitto($taskData) {
        return self::regime($taskData, 'Vitto_Alloggio') === 'Diaria'
            ? self::importo($taskData, 'Vitto_Alloggio')
            : 0.0;
    }

    /**
     * Il forfait a corpo: un importo pattuito UNA VOLTA per il task, non per
     * giornata. Nasce dagli ordini che quotano le spese su una riga separata
     * con quantità uno — l'ordine Lavazza 1020201558 scrive
     * "SPESE DI VITTO E ALLOGGIO 1 UR x 1.000,00".
     *
     * 0 se il regime non è `Corpo`.
     */
    public static function forfaitViaggi($taskData) {
        return self::regime($taskData, 'Viaggi') === 'Corpo'
            ? self::importo($taskData, 'Viaggi')
            : 0.0;
    }

    public static function forfaitVitto($taskData) {
        return self::regime($taskData, 'Vitto_Alloggio') === 'Corpo'
            ? self::importo($taskData, 'Vitto_Alloggio')
            : 0.0;
    }

    // ------------------------------------------------------------------
    // Le condizioni sulla giornata
    // ------------------------------------------------------------------

    /**
     * Le spese si addebitano solo sulle giornate di campo svolte in trasferta.
     */
    public static function giornataAddebitabile($giornata) {
        $tipo = $giornata['Tipo'] ?? '';
        $desk = $giornata['Desk'] ?? 'No';
        return $tipo === 'Campo' && $desk !== 'Si';
    }

    /**
     * Il consulente ha viaggiato quel giorno? Le giornate inserite prima del
     * 07/08/2026 non hanno il campo: valgono 'Si', come il default in tabella.
     */
    public static function viaggioEffettuato($giornata) {
        $viaggio = $giornata['Viaggio'] ?? 'Si';
        return $viaggio !== 'No';
    }

    /**
     * I viaggi si addebitano solo se la giornata è addebitabile e il viaggio
     * c'è stato davvero.
     */
    public static function viaggioAddebitabile($giornata) {
        return self::giornataAddebitabile($giornata) && self::viaggioEffettuato($giornata);
    }

    // ------------------------------------------------------------------
    // Ricavo per singola giornata
    // ------------------------------------------------------------------

    /**
     * Ricavo viaggi di una singola giornata.
     *
     * Il regime `Corpo` è l'unico che non si decide guardando la sola giornata:
     * l'importo è del task e va appoggiato a una giornata precisa, altrimenti
     * la somma per giornata e quella per task divergono — ed è esattamente la
     * classe di difetti che `CalcoloSpese` esiste per chiudere. Chi legge
     * l'insieme delle giornate marca la prima addebitabile con
     * `prima_con_viaggio`; senza quel flag il forfait non viene riconosciuto.
     */
    public static function ricavoViaggiGiornata($taskData, $giornata) {
        if (!self::viaggioAddebitabile($giornata)) {
            return 0.0;
        }
        switch (self::regime($taskData, 'Viaggi')) {
            case 'Compreso':
                return 0.0;
            case 'Diaria':
                return self::diariaViaggi($taskData);
            case 'Corpo':
                return !empty($giornata['prima_con_viaggio'])
                    ? self::forfaitViaggi($taskData)
                    : 0.0;
            default:
                return self::costoViaggiGiornata($giornata);
        }
    }

    /**
     * Ricavo vitto/alloggio (e altri costi) di una singola giornata.
     * Il flag Viaggio non c'entra: chi si ferma mangia e dorme comunque.
     *
     * Per il regime `Corpo` vale quanto detto sopra, col flag
     * `prima_addebitabile`.
     */
    public static function ricavoVittoGiornata($taskData, $giornata) {
        if (!self::giornataAddebitabile($giornata)) {
            return 0.0;
        }
        switch (self::regime($taskData, 'Vitto_Alloggio')) {
            case 'Compreso':
                return 0.0;
            case 'Diaria':
                return self::diariaVitto($taskData);
            case 'Corpo':
                return !empty($giornata['prima_addebitabile'])
                    ? self::forfaitVitto($taskData)
                    : 0.0;
            default:
                return self::costoVittoGiornata($giornata);
        }
    }

    /**
     * Ricavo spese complessivo di una giornata: le due categorie sommate.
     *
     * @param array $taskData  ANA_TASK: i quattro campi di regime
     * @param array $giornata  FACT_GIORNATE: Tipo, Desk, Viaggio e i campi di spesa
     */
    public static function ricavoGiornata($taskData, $giornata) {
        return self::ricavoViaggiGiornata($taskData, $giornata)
             + self::ricavoVittoGiornata($taskData, $giornata);
    }

    // ------------------------------------------------------------------
    // Ricavo aggregato su più giornate
    // ------------------------------------------------------------------

    /**
     * Ricavo spese aggregato su più giornate.
     *
     * Le due categorie hanno basi di conteggio diverse — i viaggi si fermano
     * alle giornate con Viaggio = 'Si' — quindi servono aggregati distinti.
     *
     * @param array $taskData
     * @param array $aggregati con le chiavi:
     *        n_addebitabili  conteggio di righe giornata addebitabili (non somma dei gg)
     *        n_con_viaggio   di cui con viaggio effettuato
     *        viaggi_sum      somma di Spese_Viaggi sulle giornate con viaggio
     *        vitto_sum       somma di Vitto_alloggio + Altri_costi sulle addebitabili
     */
    /**
     * Questa finestra di aggregazione ospita il forfait a corpo?
     *
     * Su un aggregato che copre tutto il task la risposta è "sì, se il task è
     * partito". Su un aggregato parziale — il maturato mese per mese — la
     * risposta la deve dare il chiamante con `ospita_forfait_viaggi` /
     * `ospita_forfait_vitto`, altrimenti il forfait si moltiplica per il numero
     * di mesi: è lo stesso errore che il monitoraggio faceva prima del 16/08.
     */
    private static function ospitaForfait($aggregati, $categoria, $conteggio) {
        $chiave = 'ospita_forfait_' . $categoria;
        if (array_key_exists($chiave, $aggregati)) {
            return !empty($aggregati[$chiave]);
        }
        return $conteggio > 0;
    }

    public static function ricavoAggregato($taskData, $aggregati) {
        $nAddebitabili = intval($aggregati['n_addebitabili'] ?? 0);
        $nConViaggio   = intval($aggregati['n_con_viaggio'] ?? 0);

        switch (self::regime($taskData, 'Viaggi')) {
            case 'Compreso':
                $ricavoViaggi = 0.0;
                break;
            case 'Diaria':
                $ricavoViaggi = self::diariaViaggi($taskData) * $nConViaggio;
                break;
            case 'Corpo':
                // Una volta sola, e solo se il task è partito: senza questa
                // condizione le commesse mai avviate esporrebbero ricavo.
                // Chi aggrega su più finestre — il maturato mese per mese —
                // deve dire QUALE finestra ospita il forfait, altrimenti ogni
                // mese con giornate se lo prende per intero.
                $ricavoViaggi = self::ospitaForfait($aggregati, 'viaggi', $nConViaggio)
                    ? self::forfaitViaggi($taskData) : 0.0;
                break;
            default:
                $ricavoViaggi = floatval($aggregati['viaggi_sum'] ?? 0);
        }

        switch (self::regime($taskData, 'Vitto_Alloggio')) {
            case 'Compreso':
                $ricavoVitto = 0.0;
                break;
            case 'Diaria':
                $ricavoVitto = self::diariaVitto($taskData) * $nAddebitabili;
                break;
            case 'Corpo':
                $ricavoVitto = self::ospitaForfait($aggregati, 'vitto', $nAddebitabili)
                    ? self::forfaitVitto($taskData) : 0.0;
                break;
            default:
                $ricavoVitto = floatval($aggregati['vitto_sum'] ?? 0);
        }

        return $ricavoViaggi + $ricavoVitto;
    }

    // ------------------------------------------------------------------
    // Costo
    // ------------------------------------------------------------------

    /**
     * Costo spese di una giornata: l'esborso lordo, sempre.
     */
    public static function costoGiornata($giornata) {
        return self::costoViaggiGiornata($giornata) + self::costoVittoGiornata($giornata);
    }

    public static function costoViaggiGiornata($giornata) {
        return floatval($giornata['Spese_Viaggi'] ?? 0);
    }

    public static function costoVittoGiornata($giornata) {
        return floatval($giornata['Vitto_alloggio'] ?? 0)
             + floatval($giornata['Altri_costi'] ?? 0);
    }
}
