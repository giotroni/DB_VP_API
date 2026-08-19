-- Verifica del rilascio, parte 2: la STRUTTURA.
-- Da eseguire DOPO 01-catena.sql, dalla scheda SQL.
--
-- Non modifica nulla: sono solo interrogazioni.
--
-- =====================================================================
--  PRIMA DI ESEGUIRE: scrivi qui sotto il nome del database.
-- =====================================================================
--
--   'vaglioty_DB_VP_TEST'  per il collaudo
--   'vaglioty_DB_VP'       per la produzione

SET @schema := 'vaglioty_DB_VP_TEST';

-- Perche' una variabile invece di DATABASE(), che sarebbe piu' comodo:
-- phpMyAdmin, quando incontra una query su INFORMATION_SCHEMA, sposta il
-- database corrente a 'information_schema' per le istruzioni successive.
-- DATABASE() risponderebbe 'information_schema', e i controlli direbbero che
-- va tutto bene senza aver guardato nulla.
--
-- E' anche il motivo per cui questi controlli stanno in un file separato dai
-- controlli sui dati: mescolarli fa fallire tutto quello che viene dopo la
-- prima query su INFORMATION_SCHEMA.

-- =====================================================================
-- 1. Il database e' quello giusto? Le tabelle devono essere 11.
--
--    Questa query va guardata per prima e vale come controllo del nome: se
--    esce 0, @schema e' scritto male e tutto il resto del file risponde sul
--    vuoto, cioe' risponde bene per il motivo sbagliato.
--
--    Nel dump ne arrivano 9. Le aggiunte sono FACT_FATTURE_COLLABORATORI
--    (script 02) e ANA_DOCUMENTI_COMMERCIALI (script 13).
-- =====================================================================

SELECT @schema  AS database_controllato,
       COUNT(*) AS tabelle,
       GROUP_CONCAT(TABLE_NAME ORDER BY TABLE_NAME SEPARATOR ', ') AS elenco
  FROM INFORMATION_SCHEMA.TABLES
 WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE';

-- =====================================================================
-- 2. Le colonne nuove ci sono tutte?
--
--    Devono uscire 14 righe. Una che manca significa che una ALTER non e'
--    passata, e il codice nuovo si aspetta di trovarla.
-- =====================================================================

SELECT TABLE_NAME AS tabella, COLUMN_NAME AS colonna
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = @schema
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
-- 3. I due campi documento devono essere spariti da ANA_COMMESSE.
--
--    Deve uscire 0. E' un controllo di ASSENZA, quindi vale solo se la
--    query 1 ha confermato che il database e' quello giusto: su un nome
--    sbagliato risponderebbe 0 avendo guardato il nulla.
-- =====================================================================

SELECT COUNT(*) AS campi_documento_rimasti
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ANA_COMMESSE'
   AND COLUMN_NAME IN ('Documento_Offerta', 'Documento_Ordine');

-- =====================================================================
-- 4. I vincoli sui documenti commerciali.
--
--    Devono uscire 4 righe: le tre chiavi esterne piu' il controllo che
--    impedisce a un'offerta di avere un padre.
-- =====================================================================

SELECT CONSTRAINT_NAME AS vincolo, CONSTRAINT_TYPE AS tipo
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
 WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ANA_DOCUMENTI_COMMERCIALI'
   AND CONSTRAINT_TYPE <> 'PRIMARY KEY'
 ORDER BY vincolo;
