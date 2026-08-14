-- Migration: collega ogni nota di accredito alla fattura che storna
--
-- Prima di questa colonna il legame stava solo nel testo delle Note, quindi
-- una fattura annullata era indistinguibile da una insoluta: le sei stornate
-- del 2026 restavano nell'elenco dello scaduto per 125.240,00 euro che nessuno
-- avrebbe mai incassato.
--
-- Il collegamento sta sulla NOTA e non sulla fattura perche' una fattura puo'
-- essere stornata da piu' note (storni parziali in momenti diversi), mentre una
-- nota storna sempre un documento solo.
--
-- Da qui si ricava tutto senza memorizzare altro:
--   stornato = -SUM(Fatturato_TOT delle note collegate)
--   residuo  = Fatturato_TOT - stornato - Valore_Pagato
-- Lo stato resta calcolato, non salvato: una colonna scritta a mano sarebbe una
-- seconda verita' da tenere allineata.
--
-- Vedi docs/REGOLE-FATTURAZIONE.md.
--
-- Sicura da rieseguire: la DDL usa IF NOT EXISTS e gli UPDATE scrivono lo
-- stesso valore.

-- =====================================================================
-- 1. La colonna, con lo stesso tipo della chiave a cui punta.
-- =====================================================================

ALTER TABLE FACT_FATTURE
    ADD COLUMN IF NOT EXISTS ID_FATTURA_STORNATA varchar(50) DEFAULT NULL
        COMMENT 'Solo sulle note di accredito: la fattura che questa nota storna'
        AFTER NR;

ALTER TABLE FACT_FATTURE
    ADD INDEX IF NOT EXISTS idx_fattura_stornata (ID_FATTURA_STORNATA);

-- ON DELETE SET NULL come sulle altre due chiavi esterne della tabella:
-- cancellare una fattura non deve far sparire la nota che la stornava.
-- In MariaDB IF NOT EXISTS va dopo FOREIGN KEY, non dopo CONSTRAINT.
ALTER TABLE FACT_FATTURE
    ADD CONSTRAINT FACT_FATTURE_ibfk_3
        FOREIGN KEY IF NOT EXISTS (ID_FATTURA_STORNATA) REFERENCES FACT_FATTURE (ID_FATTURA)
        ON DELETE SET NULL;

-- =====================================================================
-- 2. I sette collegamenti storici, ricavati dal testo delle note.
--
--    Ogni UPDATE si verifica da solo: collega solo se il documento stornato
--    e' una fattura dello stesso cliente e se i due importi si annullano a
--    vicenda. Se una delle due condizioni non regge, la riga resta a NULL e
--    il runner lo segnala invece di scrivere un legame sbagliato.
-- =====================================================================

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '20/25' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '21/25' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '03/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '14/26' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '04/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '16/26' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '06/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '18/26' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '12/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '20/26' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '09/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '22/26' AND nc.TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE nc
  JOIN FACT_FATTURE f
    ON f.NR = '10/26' AND f.TIPO = 'Fattura'
   AND f.ID_CLIENTE = nc.ID_CLIENTE
   AND ABS(f.Fatturato_TOT + nc.Fatturato_TOT) < 0.01
   SET nc.ID_FATTURA_STORNATA = f.ID_FATTURA
 WHERE nc.NR = '24/26' AND nc.TIPO = 'Nota_Accredito';

-- =====================================================================
-- Controlli. Devono risultare 7 note collegate e nessuna scoperta.
-- =====================================================================

-- SELECT COUNT(*) AS collegate FROM FACT_FATTURE
--  WHERE TIPO = 'Nota_Accredito' AND ID_FATTURA_STORNATA IS NOT NULL;
-- SELECT NR, Data, Fatturato_TOT FROM FACT_FATTURE
--  WHERE TIPO = 'Nota_Accredito' AND ID_FATTURA_STORNATA IS NULL;
-- SELECT f.NR, f.Fatturato_TOT, -SUM(nc.Fatturato_TOT) AS stornato
--   FROM FACT_FATTURE f JOIN FACT_FATTURE nc ON nc.ID_FATTURA_STORNATA = f.ID_FATTURA
--  GROUP BY f.ID_FATTURA, f.NR, f.Fatturato_TOT;
