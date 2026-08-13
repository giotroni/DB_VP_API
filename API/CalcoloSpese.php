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

    public static function speseCompreseViaggi($taskData) {
        return self::campoTask($taskData, 'Spese_Comprese_Viaggi', 'Spese_Comprese') === 'Si';
    }

    public static function speseCompreseVitto($taskData) {
        return self::campoTask($taskData, 'Spese_Comprese_Vitto_Alloggio', 'Spese_Comprese') === 'Si';
    }

    /**
     * La diaria viaggi concordata sul task, 0 se non ce n'è una o se i viaggi
     * sono già compresi nel valore giornata.
     */
    public static function diariaViaggi($taskData) {
        if (self::speseCompreseViaggi($taskData)) {
            return 0.0;
        }
        return floatval(self::campoTask($taskData, 'Valore_Spese_std_Viaggi', 'Valore_Spese_std') ?? 0);
    }

    /**
     * La diaria vitto/alloggio. Non ha un equivalente storico: prima del
     * 07/08/2026 esisteva un solo forfait, che è diventato quello dei viaggi.
     */
    public static function diariaVitto($taskData) {
        if (self::speseCompreseVitto($taskData)) {
            return 0.0;
        }
        return floatval($taskData['Valore_Spese_std_Vitto_Alloggio'] ?? 0);
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
     */
    public static function ricavoViaggiGiornata($taskData, $giornata) {
        if (!self::viaggioAddebitabile($giornata)) {
            return 0.0;
        }
        if (self::speseCompreseViaggi($taskData)) {
            return 0.0;
        }
        $diaria = self::diariaViaggi($taskData);
        if ($diaria > 0) {
            return $diaria;
        }
        return self::costoViaggiGiornata($giornata);
    }

    /**
     * Ricavo vitto/alloggio (e altri costi) di una singola giornata.
     * Il flag Viaggio non c'entra: chi si ferma mangia e dorme comunque.
     */
    public static function ricavoVittoGiornata($taskData, $giornata) {
        if (!self::giornataAddebitabile($giornata)) {
            return 0.0;
        }
        if (self::speseCompreseVitto($taskData)) {
            return 0.0;
        }
        $diaria = self::diariaVitto($taskData);
        if ($diaria > 0) {
            return $diaria;
        }
        return self::costoVittoGiornata($giornata);
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
    public static function ricavoAggregato($taskData, $aggregati) {
        $nAddebitabili = intval($aggregati['n_addebitabili'] ?? 0);
        $nConViaggio   = intval($aggregati['n_con_viaggio'] ?? 0);

        $ricavoViaggi = 0.0;
        if (!self::speseCompreseViaggi($taskData)) {
            $diaria = self::diariaViaggi($taskData);
            $ricavoViaggi = $diaria > 0
                ? $diaria * $nConViaggio
                : floatval($aggregati['viaggi_sum'] ?? 0);
        }

        $ricavoVitto = 0.0;
        if (!self::speseCompreseVitto($taskData)) {
            $diaria = self::diariaVitto($taskData);
            $ricavoVitto = $diaria > 0
                ? $diaria * $nAddebitabili
                : floatval($aggregati['vitto_sum'] ?? 0);
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
