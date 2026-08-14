-- Migration: allinea FACT_FATTURE alle fatture cartacee 2024-2026
--
-- Origine dei dati: i PDF in docs/Fatture/2024, /2025 e /2026, riletti uno per
-- uno. Il confronto e i prospetti stanno in
--   docs/Fatture/prospetto-fatture-<anno>.csv
--
-- Solo dati, nessuna modifica di struttura. Sicura da rieseguire: ogni UPDATE
-- scrive un valore fisso, quindi la seconda esecuzione non cambia nulla. Le
-- due INSERT sono protette da NOT EXISTS e la DELETE dall'ID della riga.
--
-- NON tocca:
--   - il cliente delle fatture riemesse a Egidio Galbani (15, 17, 19, 21, 23,
--     25, 26, 27, 33, 34, 36 del 2026, registrate sotto LACTALIS): serve una
--     decisione, non una correzione meccanica
--   - la data della 37/26, che sul PDF e' 30/05/26 e in archivio 30/06/26: il
--     PDF riporta anche il numero sbagliato (02/2026), quindi va chiarito prima
--     quale dei due documenti e' quello buono
--   - ID_COMMESSA, che sul 2026 e' valorizzato solo su 3 righe su 38
--
-- Eseguire dentro una transazione (vedi allinea_fatture_pdf.php, che lo fa).

-- =====================================================================
-- 1. Numerazioni sbagliate. Vanno per prime: le sezioni dopo cercano
--    le righe per NR.
-- =====================================================================

-- 1a. La fattura 01/2026 e' l'unica scritta senza zero iniziale.
UPDATE FACT_FATTURE SET NR = '01/26'
 WHERE NR = '1/26' AND YEAR(Data) = 2026;

-- 1b. La fattura del 15/04/2026 a 27.924,75 e' del 2026, non del 2025: cosi'
--     com'e' collide con la 15/25 di Italpizza del 30/04/2025.
UPDATE FACT_FATTURE SET NR = '15/26'
 WHERE ID_FATTURA = 'FAT26028' AND NR = '15/25';

-- =====================================================================
-- 2. Doppione. FAT26005 e FAT26006 sono la stessa fattura 03/2026 inserita
--    due volte a un minuto di distanza. La prima ha la data sbagliata
--    (31/12/2025) e gonfia il fatturato 2025 di 27.924,75.
-- =====================================================================

DELETE FROM FACT_FATTURE
 WHERE ID_FATTURA = 'FAT26005'
   AND NR = '03/26' AND Data = '2025-12-31'
   AND EXISTS (SELECT 1 FROM (SELECT * FROM FACT_FATTURE) x
                WHERE x.ID_FATTURA = 'FAT26006' AND x.NR = '03/26' AND x.Data = '2026-01-31');

-- =====================================================================
-- 3. Importi. Due arrotondamenti persi in digitazione.
-- =====================================================================

-- 3a. 04/2024 Calvi: sul documento 3.987,50 (2.900 + 725 + 362,50 di coordinamento).
UPDATE FACT_FATTURE SET Fatturato_gg = 3987.50, Fatturato_TOT = 3987.50
 WHERE NR = '04/24' AND Fatturato_TOT = 3987.00;

-- 3b. 14/2026 nota di accredito: storna per intero la 03/2026, che e'
--     registrata a 27.924,75. Senza i 75 centesimi lo storno non chiude.
UPDATE FACT_FATTURE SET Fatturato_gg = -27924.75, Fatturato_TOT = -27924.75
 WHERE NR = '14/26' AND TIPO = 'Nota_Accredito' AND Fatturato_TOT = -27924.00;

-- =====================================================================
-- 4. Documenti mancanti: le ultime due fatture del 2026 non sono mai state
--    inserite. Scadenza calcolata come data + giorni, come sulle righe
--    vicine.
-- =====================================================================

INSERT INTO FACT_FATTURE
    (ID_FATTURA, Data, ID_CLIENTE, TIPO, NR, Fatturato_gg, Fatturato_Spese,
     Fatturato_TOT, Riferimento_Ordine, Data_Ordine, Tempi_Pagamento,
     Scadenza_Pagamento, Note)
SELECT 'FAT26042', '2026-07-15', 'CLI0009', 'Fattura', '39/26', 7190.00, 0.00,
       7190.00, '4512236024', '2026-07-15', 60, '2026-09-13',
       'Attivita formativa Fase 1 capiturno Porcari'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM (SELECT * FROM FACT_FATTURE) x WHERE x.NR = '39/26');

INSERT INTO FACT_FATTURE
    (ID_FATTURA, Data, ID_CLIENTE, TIPO, NR, Fatturato_gg, Fatturato_Spese,
     Fatturato_TOT, Riferimento_Ordine, Data_Ordine, Tempi_Pagamento,
     Scadenza_Pagamento, Note)
SELECT 'FAT26043', '2026-07-31', 'CLI0021', 'Fattura', '40/26', 11400.00, 378.00,
       11778.00, NULL, NULL, 30, '2026-08-30',
       'Formazione Comunicazione Leadership - 2 edizioni aula e follow up on line. Emessa da Alepat Sas'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM (SELECT * FROM FACT_FATTURE) x WHERE x.NR = '40/26');

-- =====================================================================
-- 5. Riferimenti d'ordine. Presi dal testo dei PDF: prima di questa
--    migration erano compilati su 24 righe su 88, e in due casi contenevano
--    l'intera descrizione della fattura invece del numero d'ordine.
--    Le fatture senza ordine del cliente (lavori su nostra offerta) restano
--    a NULL: 01/24, 02/24, 03/24, 01/25, 02/25, 04/25, 05/25, 06/25, 11/25,
--    12/25, 15/25, 16/25, 20/25, 23/25, 24/25, 25/25, 27/25, 28/25, 32/25,
--    33/25, 38/26, 40/26.
-- =====================================================================

UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '04/24';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000113088', Data_Ordine = '2024-12-30'
 WHERE NR = '05/24';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '03/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '07/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4511977261', Data_Ordine = '2025-02-04'
 WHERE NR = '08/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4511977300', Data_Ordine = '2025-02-04'
 WHERE NR = '09/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '10/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '1020201558', Data_Ordine = '2025-03-13'
 WHERE NR = '13/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '14/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '1020203362', Data_Ordine = Data_Ordine
 WHERE NR = '17/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '18/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4511977300', Data_Ordine = '2025-02-04'
 WHERE NR = '19/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512037132', Data_Ordine = Data_Ordine
 WHERE NR = '22/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '26/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '29/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512064618', Data_Ordine = Data_Ordine
 WHERE NR = '30/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '1020205239', Data_Ordine = Data_Ordine
 WHERE NR = '31/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500238831', Data_Ordine = Data_Ordine
 WHERE NR = '34/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000124038', Data_Ordine = '2025-09-22'
 WHERE NR = '35/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512092514', Data_Ordine = '2025-09-30'
 WHERE NR = '36/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = 'WR2500969', Data_Ordine = Data_Ordine
 WHERE NR = '37/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000124043', Data_Ordine = '2025-09-22'
 WHERE NR = '38/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '7130017952', Data_Ordine = '2024-09-27'
 WHERE NR = '39/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4511977300', Data_Ordine = '2025-02-04'
 WHERE NR = '40/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500241173', Data_Ordine = Data_Ordine
 WHERE NR = '41/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000124043', Data_Ordine = '2025-09-22'
 WHERE NR = '42/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '1020209062', Data_Ordine = '2025-12-17'
 WHERE NR = '43/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000124043', Data_Ordine = '2025-09-22'
 WHERE NR = '44/25';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000124043', Data_Ordine = '2025-09-22'
 WHERE NR = '01/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500247167', Data_Ordine = Data_Ordine
 WHERE NR = '02/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '03/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149672', Data_Ordine = '2026-01-28'
 WHERE NR = '04/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = 'WR2500969', Data_Ordine = Data_Ordine
 WHERE NR = '05/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512155215', Data_Ordine = Data_Ordine
 WHERE NR = '06/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149558', Data_Ordine = '2026-01-28'
 WHERE NR = '07/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000129980', Data_Ordine = '2026-02-06'
 WHERE NR = '08/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149672', Data_Ordine = '2026-01-28'
 WHERE NR = '09/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512155215', Data_Ordine = '2026-02-06'
 WHERE NR = '10/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000129980', Data_Ordine = '2026-02-06'
 WHERE NR = '11/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '12/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500247167', Data_Ordine = Data_Ordine
 WHERE NR = '13/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '15/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149672', Data_Ordine = '2026-01-28'
 WHERE NR = '17/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512155215', Data_Ordine = Data_Ordine
 WHERE NR = '19/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '21/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149672', Data_Ordine = '2026-01-28'
 WHERE NR = '23/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512155215', Data_Ordine = '2026-02-06'
 WHERE NR = '25/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '26/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512155215', Data_Ordine = '2026-02-06'
 WHERE NR = '27/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '8500032997', Data_Ordine = '2026-04-10'
 WHERE NR = '28/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '9000129980', Data_Ordine = '2026-02-06'
 WHERE NR = '29/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500251625', Data_Ordine = '2026-04-17'
 WHERE NR = '30/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149558', Data_Ordine = '2026-01-28'
 WHERE NR = '31/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512210984', Data_Ordine = '2026-05-27'
 WHERE NR = '32/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512210990', Data_Ordine = '2026-05-27'
 WHERE NR = '33/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512210994', Data_Ordine = '2026-05-27'
 WHERE NR = '34/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '1020213371', Data_Ordine = '2026-05-21'
 WHERE NR = '35/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4512149513', Data_Ordine = Data_Ordine
 WHERE NR = '36/26';
UPDATE FACT_FATTURE SET Riferimento_Ordine = '4500247167', Data_Ordine = Data_Ordine
 WHERE NR = '37/26';

-- =====================================================================
-- 6. Note delle note di accredito: senza il riferimento al documento
--    stornato non si capisce piu' che cosa annullano.
-- =====================================================================

UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 20 del 31/05/25 per errata fatturazione'
 WHERE NR = '21/25' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 03 del 31/01/26 per errata fatturazione'
 WHERE NR = '14/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 04 del 31/01/26 per errata fatturazione'
 WHERE NR = '16/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 06 del 31/01/26 per errata fatturazione'
 WHERE NR = '18/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 12 del 31/03/26 per errata fatturazione'
 WHERE NR = '20/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 09 del 28/02/26 per errata fatturazione'
 WHERE NR = '22/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');
UPDATE FACT_FATTURE SET Note = 'Storno totale nostra fattura 10 del 28/02/26 per errata fatturazione'
 WHERE NR = '24/26' AND TIPO = 'Nota_Accredito' AND (Note IS NULL OR Note = '');

-- =====================================================================
-- Controlli. Dopo la migration i tre totali devono essere:
--   2024   13.705,50 su  5 documenti
--   2025  312.163,50 su 44 documenti
--   2026  401.687,50 su 40 documenti
-- =====================================================================

-- SELECT YEAR(Data) AS anno, COUNT(*) AS documenti, SUM(Fatturato_TOT) AS netto
--   FROM FACT_FATTURE GROUP BY YEAR(Data) ORDER BY anno;
-- SELECT NR, COUNT(*) FROM FACT_FATTURE GROUP BY NR HAVING COUNT(*) > 1;
-- SELECT COUNT(*) AS senza_ordine FROM FACT_FATTURE
--  WHERE TIPO = 'Fattura' AND (Riferimento_Ordine IS NULL OR Riferimento_Ordine = '');
