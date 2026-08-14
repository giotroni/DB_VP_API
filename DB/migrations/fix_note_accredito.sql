-- Migration: allinea le note di accredito alla regola (segno negativo, nessuna scadenza)
-- Vedi docs/REGOLE-FATTURAZIONE.md.
--
-- Nessuna modifica di struttura: solo dati. E' idempotente (-ABS e SET NULL
-- danno lo stesso risultato a ogni esecuzione), quindi rieseguirla non fa danni.

-- 1. Segno. Sul documento cartaceo gli importi sono positivi ed e' cosi' che
--    sono stati digitati: in archivio devono essere negativi, perche' una nota
--    di accredito storna. Una sola nota storica (FATT000026) era gia' corretta.
UPDATE FACT_FATTURE SET
    Fatturato_gg    = -ABS(Fatturato_gg),
    Fatturato_Spese = -ABS(Fatturato_Spese),
    Fatturato_TOT   = -ABS(Fatturato_TOT),
    Valore_Pagato   = -ABS(Valore_Pagato)
WHERE TIPO = 'Nota_Accredito';

-- 2. Scadenza. Una nota di accredito non si incassa, si compensa: senza questa
--    riga le sei note di aprile 2026 restano contate nello scaduto.
UPDATE FACT_FATTURE SET
    Tempi_Pagamento    = NULL,
    Scadenza_Pagamento = NULL
WHERE TIPO = 'Nota_Accredito';

-- Controllo: la prima riga deve dare 0 note con importo positivo o con scadenza,
-- la seconda il fatturato netto come somma semplice.
-- SELECT COUNT(*) AS da_correggere FROM FACT_FATTURE
--  WHERE TIPO = 'Nota_Accredito'
--    AND (Fatturato_TOT > 0 OR Scadenza_Pagamento IS NOT NULL OR Tempi_Pagamento IS NOT NULL);
-- SELECT SUM(Fatturato_TOT) AS fatturato_netto FROM FACT_FATTURE;
