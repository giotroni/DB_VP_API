-- Verifica del rilascio. Da eseguire DOPO 01-catena.sql, sullo stesso database.
--
-- Non modifica nulla: sono solo interrogazioni. Ogni risultato va confrontato
-- con la colonna "atteso" di DB/rilascio/README.md. Se un numero non torna,
-- fermarsi: e' piu' facile capirlo adesso che fra sei mesi.

-- =====================================================================
-- 1. Le righe, tabella per tabella.
-- =====================================================================

SELECT 'ANA_CLIENTI'               AS tabella, COUNT(*) AS righe FROM ANA_CLIENTI
UNION ALL SELECT 'ANA_COLLABORATORI',          COUNT(*) FROM ANA_COLLABORATORI
UNION ALL SELECT 'ANA_COMMESSE',               COUNT(*) FROM ANA_COMMESSE
UNION ALL SELECT 'ANA_COMMESSE_VISIBILITA',    COUNT(*) FROM ANA_COMMESSE_VISIBILITA
UNION ALL SELECT 'ANA_TARIFFE_COLLABORATORI',  COUNT(*) FROM ANA_TARIFFE_COLLABORATORI
UNION ALL SELECT 'ANA_TASK',                   COUNT(*) FROM ANA_TASK
UNION ALL SELECT 'FACT_FATTURE',               COUNT(*) FROM FACT_FATTURE
UNION ALL SELECT 'FACT_FATTURE_COLLABORATORI', COUNT(*) FROM FACT_FATTURE_COLLABORATORI
UNION ALL SELECT 'FACT_GIORNATE',              COUNT(*) FROM FACT_GIORNATE
UNION ALL SELECT 'GIORNATE_IMMAGINI',          COUNT(*) FROM GIORNATE_IMMAGINI
UNION ALL SELECT 'ANA_DOCUMENTI_COMMERCIALI',  COUNT(*) FROM ANA_DOCUMENTI_COMMERCIALI;

-- =====================================================================
-- 2. Il fatturato per anno, al netto degli storni.
--
--    E' il numero che cambia a schermo, ed e' quello che l'amministrazione
--    confronta con i propri prospetti. Le note di accredito sono negative,
--    quindi la somma le sottrae da sola.
-- =====================================================================

SELECT YEAR(Data)          AS anno,
       COUNT(*)            AS documenti,
       SUM(TIPO = 'Fattura')        AS fatture,
       SUM(TIPO = 'Nota_Accredito') AS note_accredito,
       FORMAT(SUM(Fatturato_TOT), 2, 'de_DE') AS fatturato_netto
  FROM FACT_FATTURE
 GROUP BY anno WITH ROLLUP;

-- =====================================================================
-- 3. Le attribuzioni fattura -> commessa.
--
--    Devono essere tutte: una fattura senza commessa e' fatturato che non
--    compare su nessun progetto.
-- =====================================================================

SELECT COUNT(*)                                 AS fatture_totali,
       SUM(ID_COMMESSA IS NOT NULL)             AS con_commessa,
       SUM(ID_COMMESSA IS NULL)                 AS senza_commessa,
       FORMAT(SUM(CASE WHEN ID_COMMESSA IS NOT NULL THEN Fatturato_TOT END), 2, 'de_DE') AS attribuito_netto
  FROM FACT_FATTURE;

-- =====================================================================
-- 4. Gli storni.
--
--    Ogni nota di accredito deve puntare alla fattura che storna: senza il
--    collegamento le sei fatture 2026 annullate restano nello scaduto.
-- =====================================================================

SELECT COUNT(*)                                 AS note_accredito,
       SUM(ID_FATTURA_STORNATA IS NOT NULL)     AS collegate,
       SUM(ID_FATTURA_STORNATA IS NULL)         AS scoperte
  FROM FACT_FATTURE WHERE TIPO = 'Nota_Accredito';

-- =====================================================================
-- 5. Gli incassi.
-- =====================================================================

SELECT SUM(Data_Pagamento IS NOT NULL)          AS documenti_incassati,
       FORMAT(SUM(Valore_Pagato), 2, 'de_DE')   AS incassato
  FROM FACT_FATTURE;

-- =====================================================================
-- 6. I regimi di spesa sui task.
-- =====================================================================

SELECT Regime_Spese_Viaggi          AS regime_viaggi,
       COUNT(*)                     AS task
  FROM ANA_TASK GROUP BY regime_viaggi ORDER BY regime_viaggi;

SELECT Regime_Spese_Vitto_Alloggio  AS regime_vitto_alloggio,
       COUNT(*)                     AS task
  FROM ANA_TASK GROUP BY regime_vitto_alloggio ORDER BY regime_vitto_alloggio;

-- =====================================================================
-- 7. La struttura: le colonne nuove ci sono tutte?
--
--    Devono uscire 14 righe. Una che manca significa che una ALTER non e'
--    passata, e il codice nuovo si aspetta di trovarla.
-- =====================================================================

SELECT TABLE_NAME AS tabella, COLUMN_NAME AS colonna
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND (   (TABLE_NAME = 'FACT_FATTURE'  AND COLUMN_NAME IN ('ID_FATTURA_STORNATA','ID_DOCUMENTO','Natura'))
        OR (TABLE_NAME = 'ANA_COMMESSE'  AND COLUMN_NAME IN ('Importo_Previsto'))
        OR (TABLE_NAME = 'ANA_CLIENTI'   AND COLUMN_NAME IN ('Codice_Fiscale'))
        OR (TABLE_NAME = 'FACT_GIORNATE' AND COLUMN_NAME IN ('Viaggio'))
        OR (TABLE_NAME = 'ANA_TASK'      AND COLUMN_NAME IN (
              'Spese_Comprese_Viaggi','Spese_Comprese_Vitto_Alloggio',
              'Valore_Spese_std_Viaggi','Valore_Spese_std_Vitto_Alloggio',
              'Regime_Spese_Viaggi','Valore_Spese_Viaggi',
              'Regime_Spese_Vitto_Alloggio','Valore_Spese_Vitto_Alloggio')))
 ORDER BY tabella, colonna;

-- =====================================================================
-- 8. I due campi documento devono essere spariti da ANA_COMMESSE.
--    Deve uscire una riga sola, con eliminati = 'si'.
-- =====================================================================

SELECT IF(COUNT(*) = 0, 'si', CONCAT('NO, ne restano ', COUNT(*))) AS eliminati
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ANA_COMMESSE'
   AND COLUMN_NAME IN ('Documento_Offerta', 'Documento_Ordine');

-- =====================================================================
-- 9. Nessun utente di prova.
--    L'ambiente locale ha un utente testadmin con password nota. Non deve
--    essere finito qui: deve uscire zero.
-- =====================================================================

SELECT COUNT(*) AS utenti_di_prova
  FROM ANA_COLLABORATORI
 WHERE ID_COLLABORATORE = 'TEST001' OR Email LIKE '%@local.test';
