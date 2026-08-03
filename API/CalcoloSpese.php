<?php
/**
 * CalcoloSpese - Regole di calcolo delle spese, in un punto solo
 *
 * Le regole sono state decise il 02/08/2026 (vedi docs/REGOLE-SPESE.md).
 * Prima di allora la logica era replicata in TaskAPI, GiornateAPI, CommesseAPI
 * e nel front-end, ed era divergente: il forfait veniva contato una volta per
 * task, una per giornata e una per mese a seconda di chi leggeva il dato.
 *
 * Le due grandezze sono indipendenti:
 *
 *  RICAVO  = quanto si addebita al cliente
 *            - 0 se la giornata non è di campo o è da remoto (Desk = 'Si')
 *            - 0 se Spese_Comprese = 'Si', perché è già dentro il valore giornata
 *            - la diaria Valore_Spese_std, INTERA per ogni giornata di campo
 *              (anche per le mezze giornate: la trasferta c'è comunque)
 *            - altrimenti le spese effettive lorde della giornata
 *
 *  COSTO   = quanto V&P ha sborsato, SEMPRE le spese lorde, in ogni regime.
 *            Non è ridotto da Spese_Fatturate_VP: quella quota è pagata con la
 *            carta di credito V&P, quindi è un esborso aziendale a tutti gli
 *            effetti — serve solo a non riconoscerla al consulente.
 *
 * Da non confondere con FACT_GIORNATE.Costo_Spese calcolato in GiornateAPI, che
 * vale "spese lorde - Spese_Fatturate_VP": quello è il rimborso dovuto al
 * collaboratore, non il costo di commessa.
 */

class CalcoloSpese {

    /**
     * Espressione SQL che somma le spese lorde di una giornata.
     * I campi sono testuali su alcune installazioni, da qui il REPLACE.
     *
     * @param string $alias prefisso della tabella FACT_GIORNATE nella query
     */
    public static function sqlSpeseLorde($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "(COALESCE(CAST(REPLACE({$p}Spese_Viaggi, ',', '.') AS DECIMAL(10,2)), 0) +
                 COALESCE(CAST(REPLACE({$p}Vitto_alloggio, ',', '.') AS DECIMAL(10,2)), 0) +
                 COALESCE(CAST(REPLACE({$p}Altri_costi, ',', '.') AS DECIMAL(10,2)), 0))";
    }

    /**
     * Condizione SQL che isola le giornate su cui la diaria è addebitabile:
     * di campo e non da remoto.
     */
    public static function sqlGiornateAddebitabili($alias = '') {
        $p = $alias === '' ? '' : $alias . '.';
        return "({$p}Tipo = 'Campo' AND COALESCE({$p}Desk, 'No') <> 'Si')";
    }

    /**
     * La diaria concordata sul task, 0 se il task non ne ha una.
     */
    public static function diaria($taskData) {
        if (self::speseComprese($taskData)) {
            return 0.0;
        }
        return floatval($taskData['Valore_Spese_std'] ?? 0);
    }

    public static function speseComprese($taskData) {
        return isset($taskData['Spese_Comprese']) && $taskData['Spese_Comprese'] === 'Si';
    }

    /**
     * Ricavo spese di una singola giornata.
     *
     * @param array $taskData  ANA_TASK: Spese_Comprese, Valore_Spese_std
     * @param array $giornata  FACT_GIORNATE: Tipo, Desk e i campi di spesa
     */
    public static function ricavoGiornata($taskData, $giornata) {
        if (!self::giornataAddebitabile($giornata)) {
            return 0.0;
        }
        if (self::speseComprese($taskData)) {
            return 0.0;
        }
        $diaria = self::diaria($taskData);
        if ($diaria > 0) {
            return $diaria;
        }
        return self::costoGiornata($giornata);
    }

    /**
     * Ricavo spese aggregato su più giornate.
     *
     * @param int   $numGiornateAddebitabili conteggio di righe giornata, non somma dei gg
     * @param float $speseLordeTotali        usato solo nel regime a consuntivo
     */
    public static function ricavoAggregato($taskData, $numGiornateAddebitabili, $speseLordeTotali) {
        if (self::speseComprese($taskData)) {
            return 0.0;
        }
        $diaria = self::diaria($taskData);
        if ($diaria > 0) {
            return $diaria * intval($numGiornateAddebitabili);
        }
        return floatval($speseLordeTotali);
    }

    /**
     * Costo spese di una giornata: l'esborso lordo, sempre.
     */
    public static function costoGiornata($giornata) {
        return floatval($giornata['Spese_Viaggi'] ?? 0)
             + floatval($giornata['Vitto_alloggio'] ?? 0)
             + floatval($giornata['Altri_costi'] ?? 0);
    }

    /**
     * La diaria si addebita solo sulle giornate di campo svolte in trasferta.
     */
    public static function giornataAddebitabile($giornata) {
        $tipo = $giornata['Tipo'] ?? '';
        $desk = $giornata['Desk'] ?? 'No';
        return $tipo === 'Campo' && $desk !== 'Si';
    }
}
