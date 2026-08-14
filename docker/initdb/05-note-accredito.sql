-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/fix_note_accredito.sql, che porta le note di accredito alla
-- regola di docs/REGOLE-FATTURAZIONE.md: importi negativi e nessuna scadenza.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script: senza, il locale ripartirebbe con le note di accredito positive e
-- con la scadenza, e il fatturato a schermo tornerebbe gonfiato.
-- Va tenuto allineato alla migration finche' il dump di produzione non la
-- contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

UPDATE FACT_FATTURE SET
    Fatturato_gg    = -ABS(Fatturato_gg),
    Fatturato_Spese = -ABS(Fatturato_Spese),
    Fatturato_TOT   = -ABS(Fatturato_TOT),
    Valore_Pagato   = -ABS(Valore_Pagato)
WHERE TIPO = 'Nota_Accredito';

UPDATE FACT_FATTURE SET
    Tempi_Pagamento    = NULL,
    Scadenza_Pagamento = NULL
WHERE TIPO = 'Nota_Accredito';
