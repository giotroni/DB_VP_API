-- Migration: il regime di spesa diventa esplicito, e nasce il forfait a corpo
--
-- ANA_TASK + Regime_Spese_Viaggi, Valore_Spese_Viaggi,
--            Regime_Spese_Vitto_Alloggio, Valore_Spese_Vitto_Alloggio
--
-- Fino a oggi il regime era dedotto: "diaria a zero significa costi reali".
-- Quell'implicito ha reso indistinguibile per settimane un forfait una tantum da
-- una tariffa a trasferta, quindi ora e' dichiarato in colonna.
--
-- Il quarto valore, 'Corpo', copre le spese pattuite a corpo: l'ordine Lavazza
-- 1020201558 ha una riga "SPESE DI VITTO E ALLOGGIO 1 UR x 1.000,00" che il
-- modello per giornata non sapeva rappresentare.
--
-- La conversione NON cambia un centesimo su nessun task: 'Corpo' non si deduce
-- dai dati e va dichiarato a mano, caso per caso.
--
-- Vedi docs/SCHEMA-SPESE-A-CORPO.md e docs/REGOLE-SPESE.md.
--
-- Eseguire UNA SOLA VOLTA su ogni database. Sicuro da rieseguire: la DDL usa
-- IF NOT EXISTS e gli UPDATE riscrivono lo stesso valore.

-- =====================================================================
-- 1. Le colonne
-- =====================================================================

ALTER TABLE ANA_TASK
    ADD COLUMN IF NOT EXISTS Regime_Spese_Viaggi
        ENUM('Compreso','Diaria','Corpo','Reali') NOT NULL DEFAULT 'Reali'
        AFTER Valore_Spese_std_Vitto_Alloggio,
    ADD COLUMN IF NOT EXISTS Valore_Spese_Viaggi DECIMAL(10,2) DEFAULT NULL
        AFTER Regime_Spese_Viaggi,
    ADD COLUMN IF NOT EXISTS Regime_Spese_Vitto_Alloggio
        ENUM('Compreso','Diaria','Corpo','Reali') NOT NULL DEFAULT 'Reali'
        AFTER Valore_Spese_Viaggi,
    ADD COLUMN IF NOT EXISTS Valore_Spese_Vitto_Alloggio DECIMAL(10,2) DEFAULT NULL
        AFTER Regime_Spese_Vitto_Alloggio;

-- =====================================================================
-- 2. La conversione dai campi impliciti
--
-- L'importo resta NULL quando il regime non ne prevede uno: cosi' non
-- sopravvive un numero orfano pronto a riemergere se il regime cambiasse.
-- =====================================================================

UPDATE ANA_TASK SET
  Regime_Spese_Viaggi = CASE
      WHEN Spese_Comprese_Viaggi = 'Si'                     THEN 'Compreso'
      WHEN COALESCE(Valore_Spese_std_Viaggi, 0) > 0         THEN 'Diaria'
      ELSE 'Reali' END,
  Valore_Spese_Viaggi = CASE
      WHEN Spese_Comprese_Viaggi <> 'Si'
       AND COALESCE(Valore_Spese_std_Viaggi, 0) > 0         THEN Valore_Spese_std_Viaggi
      ELSE NULL END,
  Regime_Spese_Vitto_Alloggio = CASE
      WHEN Spese_Comprese_Vitto_Alloggio = 'Si'             THEN 'Compreso'
      WHEN COALESCE(Valore_Spese_std_Vitto_Alloggio, 0) > 0 THEN 'Diaria'
      ELSE 'Reali' END,
  Valore_Spese_Vitto_Alloggio = CASE
      WHEN Spese_Comprese_Vitto_Alloggio <> 'Si'
       AND COALESCE(Valore_Spese_std_Vitto_Alloggio, 0) > 0 THEN Valore_Spese_std_Vitto_Alloggio
      ELSE NULL END,
  -- Riassegnare Data_Modifica a se stessa impedisce a ON UPDATE di scattare.
  -- Senza questo la migration marca tutti i task come modificati adesso, e il
  -- registro attivita' di Statistiche - che si ricostruisce da Data_Modifica -
  -- mostra 118 modifiche fantasma.
  Data_Modifica = Data_Modifica;

-- =====================================================================
-- 3. I casi a corpo, dichiarati uno per uno
--
-- LAVAZZA SETTIMO: l'ordine 1020201558 quota 7 giornate a 1.650 piu' una riga
-- separata "SPESE DI VITTO E ALLOGGIO 1 UR x 1.000,00", e la fattura 13/25
-- ricalca la stessa struttura. Senza questa riga la commessa risulta con
-- 11.550,00 di maturato contro 12.550,00 fatturati.
-- =====================================================================

UPDATE ANA_TASK
   SET Regime_Spese_Vitto_Alloggio = 'Corpo',
       Valore_Spese_Vitto_Alloggio = 1000.00,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00022';

-- =====================================================================
-- Controlli. I conteggi per regime devono risultare:
--
--   VIAGGI            Compreso 38 · Diaria 46 · Corpo 0 · Reali 34
--   VITTO/ALLOGGIO    Compreso 84 · Diaria  0 · Corpo 1 · Reali 33
--
-- Sono una fotografia al 17/08/2026: cambiano appena si modifica il regime di
-- un task dall'interfaccia. Se non tornano, confrontare prima con i conteggi
-- sui campi vecchi, poi sospettare della conversione.
--
-- e nessun importo orfano su un regime che non lo prevede.
-- =====================================================================

-- SELECT Regime_Spese_Viaggi AS regime, COUNT(*) AS task
--   FROM ANA_TASK GROUP BY 1 ORDER BY 1;
-- SELECT Regime_Spese_Vitto_Alloggio AS regime, COUNT(*) AS task
--   FROM ANA_TASK GROUP BY 1 ORDER BY 1;
--
-- SELECT COUNT(*) AS importi_orfani FROM ANA_TASK
--  WHERE (Regime_Spese_Viaggi IN ('Compreso','Reali') AND Valore_Spese_Viaggi IS NOT NULL)
--     OR (Regime_Spese_Vitto_Alloggio IN ('Compreso','Reali') AND Valore_Spese_Vitto_Alloggio IS NOT NULL);
--
-- SELECT COUNT(*) AS importi_mancanti FROM ANA_TASK
--  WHERE (Regime_Spese_Viaggi IN ('Diaria','Corpo') AND COALESCE(Valore_Spese_Viaggi,0) <= 0)
--     OR (Regime_Spese_Vitto_Alloggio IN ('Diaria','Corpo') AND COALESCE(Valore_Spese_Vitto_Alloggio,0) <= 0);
