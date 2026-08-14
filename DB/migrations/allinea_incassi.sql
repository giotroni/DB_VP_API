-- Migration: registra gli incassi mancanti su FACT_FATTURE
--
-- Origine dei dati: il foglio "Emesse" dei due file in docs/Fatture
--   0 V&P Fatture emesse pagate etc 2025.xlsx   (contiene in coda anche il 2024)
--   0 V&P Fatture emesse pagate etc 2026.xlsx
-- colonna A = incassata, colonna B = data dell'incasso.
--
-- Il registro Excel segnava 71 documenti incassati, l'archivio ne aveva 45:
-- qui ci sono i 26 incassi che mancavano piu' tre date che divergevano.
--
-- Valore_Pagato viene messo pari a Fatturato_TOT perche' l'archivio registra
-- l'incasso al netto dell'IVA, come sulle 45 righe gia' presenti. L'Excel
-- riporta invece il totale con IVA: e' la stessa cosa vista da due lati.
--
-- ATTENZIONE: eseguire DOPO allinea_fatture_pdf.sql, che sistema le
-- numerazioni. Senza quella, la 01/26 e' ancora numerata '1/26' e la 15/26
-- e' ancora '15/26' non distinguibile dalla 15/25 di Italpizza.
--
-- Solo dati, nessuna modifica di struttura. Sicura da rieseguire: scrive
-- valori fissi.
--
-- NON tocca le note di credito e le sei fatture che stornano: nell'Excel sono
-- marcate NC, non incassate, ed e' giusto che restino senza data.

-- =====================================================================
-- 1. Incassi mai registrati: quattro code del 2025 saldate a inizio 2026...
-- =====================================================================

UPDATE FACT_FATTURE SET Data_Pagamento = '2026-01-12', Valore_Pagato = Fatturato_TOT WHERE NR = '41/25';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-01-09', Valore_Pagato = Fatturato_TOT WHERE NR = '42/25';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-02-02', Valore_Pagato = Fatturato_TOT WHERE NR = '43/25';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-01-30', Valore_Pagato = Fatturato_TOT WHERE NR = '44/25';

-- =====================================================================
-- ... e ventidue del 2026, quasi tutti gli incassi da marzo in poi.
-- =====================================================================

UPDATE FACT_FATTURE SET Data_Pagamento = '2026-03-13', Valore_Pagato = Fatturato_TOT WHERE NR = '01/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-08', Valore_Pagato = Fatturato_TOT WHERE NR = '02/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-03-11', Valore_Pagato = Fatturato_TOT WHERE NR = '05/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-02', Valore_Pagato = Fatturato_TOT WHERE NR = '07/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-10', Valore_Pagato = Fatturato_TOT WHERE NR = '08/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-05', Valore_Pagato = Fatturato_TOT WHERE NR = '11/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-08', Valore_Pagato = Fatturato_TOT WHERE NR = '13/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-20', Valore_Pagato = Fatturato_TOT WHERE NR = '15/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-20', Valore_Pagato = Fatturato_TOT WHERE NR = '17/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-04-20', Valore_Pagato = Fatturato_TOT WHERE NR = '19/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-05-05', Valore_Pagato = Fatturato_TOT WHERE NR = '21/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-05-05', Valore_Pagato = Fatturato_TOT WHERE NR = '23/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-05-05', Valore_Pagato = Fatturato_TOT WHERE NR = '25/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '26/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '27/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-30', Valore_Pagato = Fatturato_TOT WHERE NR = '28/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-07-03', Valore_Pagato = Fatturato_TOT WHERE NR = '29/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-07-07', Valore_Pagato = Fatturato_TOT WHERE NR = '30/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '31/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '32/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '33/26';
UPDATE FACT_FATTURE SET Data_Pagamento = '2026-06-16', Valore_Pagato = Fatturato_TOT WHERE NR = '34/26';

-- =====================================================================
-- 2. Tre date che divergevano. Il registro Excel e' la fonte: e' li' che
--    si segna l'incasso quando arriva.
-- =====================================================================

-- 05/24 Perfetti: archivio 31/01/2025, registro 07/02/2025.
UPDATE FACT_FATTURE SET Data_Pagamento = '2025-02-07' WHERE NR = '05/24';

-- 01/25 Mantua: archivio 12/03/2025, registro 24/03/2025.
UPDATE FACT_FATTURE SET Data_Pagamento = '2025-03-24' WHERE NR = '01/25';

-- 21/25 nota di credito Ambrosi: archivio 31/05/2025, cioe' la data della
-- nota stessa, registro 12/09/2025, cioe' quando e' stata compensata.
UPDATE FACT_FATTURE SET Data_Pagamento = '2025-09-12' WHERE NR = '21/25';

-- =====================================================================
-- Controllo. Dopo la migration devono risultare 71 documenti incassati:
-- gli 8 ancora aperti sono 35/26, 36/26, 37/26, 38/26, 39/26, 40/26 piu' le
-- due non ancora emesse (41/26 e 42/26, che in archivio non ci sono), e i 12
-- fra note di credito e fatture stornate restano senza data.
-- =====================================================================

-- SELECT COUNT(*) AS incassati FROM FACT_FATTURE WHERE Data_Pagamento IS NOT NULL;
-- SELECT NR, Data, Fatturato_TOT FROM FACT_FATTURE
--  WHERE Data_Pagamento IS NULL AND TIPO = 'Fattura' AND YEAR(Data) >= 2024
--  ORDER BY Data;
-- SELECT COUNT(*) AS incoerenti FROM FACT_FATTURE
--  WHERE Data_Pagamento IS NOT NULL AND Valore_Pagato <> Fatturato_TOT;
