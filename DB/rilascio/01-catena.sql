-- =====================================================================
--  RILASCIO GESTIONALE V&P  ·  catena completa
--  Generato il 19/08/2026 dagli script di docker/initdb
-- =====================================================================
--
--  Da eseguire su un database che contiene GIA' il dump di produzione
--  260815_vaglioty_DB_VP.sql e nient'altro. Vedi DB/rilascio/README.md.
--
--  ATTENZIONE: questo file NON contiene il dump. Prima si importa il dump,
--  poi si esegue questo.
--
--  Contiene, nell'ordine, undici script gia' verificati in locale:
--
--    02  crea FACT_FATTURE_COLLABORATORI, che nel dump non c'e'
--    04  separa le spese in viaggi e vitto/alloggio          [migration]
--    05  note di accredito negative e senza scadenza         [migration]
--    06  allinea l'archivio alle fatture cartacee            [migration]
--    07  i 26 incassi presi dal registro                     [migration]
--    08  collega ogni nota alla fattura che storna           [migration]
--    09  le attribuzioni fattura -> commessa                 [lavoro a mano]
--    10  le correzioni su regimi e flag Viaggio              [lavoro a mano]
--    11  il regime di spesa esplicito e il forfait a corpo   [migration]
--    12  i task creati a mano e le giornate spostate         [lavoro a mano]
--    13  offerte e ordini: ANA_DOCUMENTI_COMMERCIALI         [migration]
--
--  NON contiene lo script 03, che crea l'utente di prova testadmin con
--  password nota: quello resta nell'ambiente locale e non deve arrivare
--  su un server.
--
--  L'ordine conta. Il 12 deve stare dopo l'11 perche' il suo INSERT elenca
--  anche le colonne di regime, che le aggiunge l'11.
--
--  Verificato il 19/08/2026: eseguita sul dump 260815 grezzo, questa catena
--  riproduce il database locale al centesimo — 673 righe su 11 tabelle,
--  zero divergenze, unica eccezione voluta l'utente di prova.
--
--  Sicura da rieseguire: ogni script e' idempotente.
-- =====================================================================



-- #####################################################################
-- ##  02-fact_fatture_collaboratori.sql
-- #####################################################################

-- FACT_FATTURE_COLLABORATORI: manca nel dump di produzione del 20260730 pur essendo
-- definita in DB/critical/setup.php e usata da API/FattureCollaboratoriAPI.php.
-- Definizione copiata alla lettera da DB/critical/setup.php (tabella 8).
-- Va eseguita DOPO il dump perche' ha una FK verso ANA_COLLABORATORI.

CREATE TABLE IF NOT EXISTS FACT_FATTURE_COLLABORATORI (
    ID_FATTURA VARCHAR(50) PRIMARY KEY,
    Data DATE,
    ID_COLLABORATORE VARCHAR(50),
    Descrizione TEXT,
    Importo_netto DECIMAL(12,2) DEFAULT 0,
    Importo_IVA DECIMAL(12,2) DEFAULT 0,
    Importo_Totale DECIMAL(12,2) DEFAULT 0,
    Ritenuta_Acconto DECIMAL(12,2) DEFAULT 0,
    Netto_pagare DECIMAL(12,2) DEFAULT 0,
    Stato ENUM('Ricevuta','Pagata','Annullata') DEFAULT 'Ricevuta',
    Data_Pagamento DATE DEFAULT NULL,
    Data_Creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ID_UTENTE_CREAZIONE VARCHAR(50),
    Data_Modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ID_UTENTE_MODIFICA VARCHAR(50),
    FOREIGN KEY (ID_COLLABORATORE) REFERENCES ANA_COLLABORATORI(ID_COLLABORATORE) ON DELETE SET NULL,
    INDEX idx_collaboratore (ID_COLLABORATORE),
    INDEX idx_stato (Stato),
    INDEX idx_data_pagamento (Data_Pagamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- #####################################################################
-- ##  04-spese-viaggi-vitto.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/add_spese_viaggi_vitto.sql, che separa le spese in Viaggi e
-- Vitto/Alloggio e aggiunge il flag Viaggio sulla giornata.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script: senza, il locale ripartirebbe con lo schema vecchio del dump.
-- Va tenuto allineato alla migration finche' il dump di produzione non le
-- contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

ALTER TABLE ANA_TASK
    ADD COLUMN Spese_Comprese_Viaggi          ENUM('Si','No')  DEFAULT 'No' AFTER Spese_Comprese,
    ADD COLUMN Spese_Comprese_Vitto_Alloggio  ENUM('Si','No')  DEFAULT 'No' AFTER Spese_Comprese_Viaggi,
    ADD COLUMN Valore_Spese_std_Viaggi        DECIMAL(10,2)    DEFAULT NULL AFTER Valore_Spese_std,
    ADD COLUMN Valore_Spese_std_Vitto_Alloggio DECIMAL(10,2)   DEFAULT NULL AFTER Valore_Spese_std_Viaggi;

UPDATE ANA_TASK SET
    Spese_Comprese_Viaggi         = COALESCE(Spese_Comprese, 'No'),
    Spese_Comprese_Vitto_Alloggio = COALESCE(Spese_Comprese, 'No'),
    Valore_Spese_std_Viaggi       = Valore_Spese_std;

UPDATE ANA_TASK SET Spese_Comprese_Vitto_Alloggio = 'Si'
WHERE COALESCE(Spese_Comprese, 'No') = 'No'
  AND COALESCE(Valore_Spese_std, 0) > 0;

ALTER TABLE FACT_GIORNATE
    ADD COLUMN Viaggio ENUM('Si','No') DEFAULT 'Si' AFTER Desk;

UPDATE FACT_GIORNATE SET Viaggio = 'Si' WHERE Viaggio IS NULL;


-- #####################################################################
-- ##  05-note-accredito.sql
-- #####################################################################

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


-- #####################################################################
-- ##  06-allinea-fatture-pdf.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/allinea_fatture_pdf.sql, che allinea l'archivio alle fatture cartacee in docs/Fatture:
-- numerazioni, doppioni, importi, i due documenti mancanti e i riferimenti
-- d'ordine.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Va tenuto allineato alla migration finche' il dump di produzione non
-- la contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

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


-- #####################################################################
-- ##  07-allinea-incassi.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/allinea_incassi.sql, che registra i 26 incassi presenti nel
-- registro Excel e mai riportati in archivio, piu' tre date divergenti.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Va tenuto allineato alla migration finche' il dump di produzione non
-- la contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

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


-- #####################################################################
-- ##  08-storno-note-accredito.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/add_storno_note_accredito.sql, che aggiunge ID_FATTURA_STORNATA e
-- collega ogni nota di accredito alla fattura che storna.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Va tenuto allineato alla migration finche' il dump di produzione non
-- la contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

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


-- #####################################################################
-- ##  09-attribuzioni-fatture-commesse.sql
-- #####################################################################

-- Ambiente locale: rimette il lavoro fatto a mano su fatture e commesse.
--
-- GENERATO da docker/genera-09-attribuzioni.php: non modificare a mano,
-- rigeneralo. Ogni attribuzione nuova fatta dall'interfaccia invecchia questa
-- fotografia, e un reset la perderebbe in silenzio.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script, e nessuna migration valorizza ID_COMMESSA. E' successo il 17/08/2026:
-- i conteggi delle tabelle tornavano tutti giusti e il reset sembrava riuscito,
-- ma il fatturato per commessa era tornato indietro di otto righe senza che
-- nulla lo segnalasse.
--
-- Nessun USE: gira sul database indicato da MARIADB_DATABASE. Va per ultimo
-- fra 05 e 08, perche' aggancia le fatture per NR e le numerazioni sono
-- sistemate da 05-note-accredito e 06-allinea-fatture-pdf.
--
-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore, e
-- Data_Modifica = Data_Modifica impedisce che il timestamp si sposti.

-- =====================================================================
-- Fatture -> commesse (43 righe)
-- =====================================================================

-- COM0012  LACTALIS STAB AUDIT CORTE - CASTELLI
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0012', Data_Modifica = Data_Modifica
 WHERE NR IN ('36/25');

-- COM0013  LACTALIS STAB CORTEOLONA SVILUPPO 2025
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0013', Data_Modifica = Data_Modifica
 WHERE NR IN ('04/26','09/26','16/26','17/26','22/26','23/26');

-- COM2025004  IWT Coaching
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025004', Data_Modifica = Data_Modifica
 WHERE NR IN ('05/26');

-- COM2025006  PERFETTI FORMAZIONE CAPITURNO 2025
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025006', Data_Modifica = Data_Modifica
 WHERE NR IN ('01/26');

-- COM2025008  LINDT WORKSHOP RUOLO CR
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025008', Data_Modifica = Data_Modifica
 WHERE NR IN ('28/25');

-- COM2025009  LINDT SVILUPPO CR 2025
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025009', Data_Modifica = Data_Modifica
 WHERE NR IN ('34/25');

-- COM2025010  LINDT SVILUPPO CAPITURNO 2025
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025010', Data_Modifica = Data_Modifica
 WHERE NR IN ('41/25');

-- COM2025011  LACTALIS STAB CERTOSA
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025011', Data_Modifica = Data_Modifica
 WHERE NR IN ('06/26','10/26','18/26','19/26','24/26','25/26','27/26');

-- COM2025012  LAVAZZA DIREZIONE OPERATIONS
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025012', Data_Modifica = Data_Modifica
 WHERE NR IN ('43/25');

-- COM2025013  LACTALIS STAB CASALE CREMASCO
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025013', Data_Modifica = Data_Modifica
 WHERE NR IN ('03/26','12/26','14/26','15/26','20/26','21/26','26/26');

-- COM2025014  LACTALIS LTF 2026
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025014', Data_Modifica = Data_Modifica
 WHERE NR IN ('07/26','31/26');

-- COM2025015  LINDT SVILUPPO CapiTurno 2026
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025015', Data_Modifica = Data_Modifica
 WHERE NR IN ('02/26','13/26','37/26');

-- COM2025016  PERFETTI FORMAZIONE CAPITURNO 2026
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025016', Data_Modifica = Data_Modifica
 WHERE NR IN ('08/26','11/26','29/26');

-- COM2025017  LUCCHINI COACHING
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025017', Data_Modifica = Data_Modifica
 WHERE NR IN ('28/26');

-- COM2025018  LACTALIS STAB CORTEOLONA SVILUPPO 2026
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025018', Data_Modifica = Data_Modifica
 WHERE NR IN ('34/26');

-- COM2025019  LINDT COACHING MIDDLE MANAGEMENT 2026
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025019', Data_Modifica = Data_Modifica
 WHERE NR IN ('30/26');

-- COM2025020  LACTALIS STAB AMBROSI PRIMA FASE
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025020', Data_Modifica = Data_Modifica
 WHERE NR IN ('32/26');

-- COM2025021  LACTALIS STAB MELZO
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025021', Data_Modifica = Data_Modifica
 WHERE NR IN ('33/26');

-- COM2025022  LAVAZZA R&D AUDIT
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025022', Data_Modifica = Data_Modifica
 WHERE NR IN ('35/26');

-- COM2025025  LUCCHINI FORMAZIONE
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025025', Data_Modifica = Data_Modifica
 WHERE NR IN ('40/26');

-- COM2025026  LACTALIS PORCARI
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025026', Data_Modifica = Data_Modifica
 WHERE NR IN ('39/26');

-- =====================================================================
-- Intestatari corretti a mano (15 fatture)
--
-- Non e' un errore che fattura e commessa stiano su clienti diversi: lo
-- decide l'ordine. Le fatture emesse al cliente sbagliato e poi stornate
-- restano com'erano, perche' il cliente sbagliato e' il motivo per cui
-- esiste la nota di accredito che le annulla.
-- =====================================================================

-- CLI0009  LACTALIS
UPDATE FACT_FATTURE SET ID_CLIENTE = 'CLI0009', Data_Modifica = Data_Modifica
 WHERE NR IN ('04/26','09/26','16/26','22/26');

-- CLI0011  LACTALIS GALBANI
UPDATE FACT_FATTURE SET ID_CLIENTE = 'CLI0011', Data_Modifica = Data_Modifica
 WHERE NR IN ('17/26','23/26','19/26','25/26','27/26','15/26','21/26','26/26','36/26','34/26','33/26');

-- =====================================================================
-- Commesse: intestatario, nome, stato e data di apertura (8 righe)
-- =====================================================================

-- LACTALIS STAB AUDIT CORTE - CASTELLI  (LACTALIS)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0009', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM0012';

-- LACTALIS STAB CORTEOLONA SVILUPPO 2025  (LACTALIS GALBANI)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0011', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM0013';

-- LACTALIS STAB CERTOSA  (LACTALIS GALBANI)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0011', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025011';

-- LACTALIS STAB CASALE CREMASCO  (LACTALIS GALBANI)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0011', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025013';

-- LACTALIS STAB CORTEOLONA SVILUPPO 2026  (LACTALIS GALBANI - apertura era 2026-11-01)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0011', Data_Apertura_Commessa = '2026-04-01', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025018';

-- LACTALIS STAB AMBROSI PRIMA FASE  (LACTALIS - si chiamava LACTALIS STAB AMBROSI)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0009', Commessa = 'LACTALIS STAB AMBROSI PRIMA FASE', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025020';

-- LACTALIS CERTOSA SECONDA FASE  (LACTALIS GALBANI)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0011', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025028';

-- LACTALIS AMBROSI CI Castendendolo e Collecchio  (LACTALIS - si chiamava LACTALIS CI Castendendolo e Collecchio)
UPDATE ANA_COMMESSE SET ID_CLIENTE = 'CLI0009', Commessa = 'LACTALIS AMBROSI CI Castendendolo e Collecchio', Data_Modifica = Data_Modifica
 WHERE ID_COMMESSA = 'COM2025030';

-- --------------------------------------------------------------------
-- Controlli dopo un reset: devono tornare questi numeri.
-- --------------------------------------------------------------------
-- SELECT COUNT(*) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL;      -- 89
-- SELECT SUM(Fatturato_TOT) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL;  -- 727556.50


-- #####################################################################
-- ##  10-spese-quattro-commesse.sql
-- #####################################################################

-- Ambiente locale: rimette le correzioni fatte a mano su task e giornate.
--
-- GENERATO da docker/genera-10-spese.php: non modificare a mano, rigeneralo.
-- Ogni correzione nuova fatta dall'interfaccia invecchia questa fotografia, e
-- un reset la perderebbe in silenzio.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Nessun USE: gira sul database indicato da MARIADB_DATABASE.
-- Va dopo 04-spese-viaggi-vitto, che crea la colonna Viaggio e i campi di regime.
--
-- Le regole che hanno guidato queste correzioni stanno in
-- docs/260815_MODIFICHE_IN_LOCAL_ALLINEAMENTO SPESE.md: il viaggio non si
-- addebita due volte quando due consulenti vanno insieme, ne' il giorno dopo
-- una giornata con albergo.
--
-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore. Data_Modifica
-- viene riassegnata a se stessa per impedire a ON UPDATE di scattare, altrimenti
-- il registro attivita' di Statistiche si riempie di modifiche fantasma.

-- --------------------------------------------------------------------
-- Task: 6 con un regime di spesa diverso dal default
-- --------------------------------------------------------------------

-- TAS00012  CASTELLI 1. AUDIT
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 170.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00012';

-- TAS00013  CASTELLI 2. PRIMA LINEA
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 170.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00013';

-- TAS00014  CASTELLI Aula CT
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 170.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00014';

-- TAS00034  CASTELLI SFC CT
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 170.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00034';

-- TAS00041  Corteolona Shop Floor Coaching
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 55.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00041';

-- TAS00043  Castelli Consulenza Organizzativa
UPDATE ANA_TASK
   SET Spese_Comprese_Viaggi         = 'No',
       Valore_Spese_std_Viaggi       = 170.00,
       Spese_Comprese_Vitto_Alloggio = 'Si',
       Valore_Spese_std_Vitto_Alloggio = NULL,
       Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00043';

-- --------------------------------------------------------------------
-- Giornate: 23 con viaggio tolto o desk corretto
-- Agganciate per ID_GIORNATA, che e' la chiave primaria e arriva dal dump.
-- --------------------------------------------------------------------

-- COM0012
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'DAY000000119',   -- 18/06/2025  Giorgio Troni      TAS00012
    'DAY000000151'    -- 05/08/2025  Giorgio Troni      TAS00013
);

-- COM0013
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20251030084320131',   -- 24/10/2025  Giorgio Troni      TAS00042
    'GIO20251112190749770',   -- 12/11/2025  Giorgio Troni      TAS00042
    'GIO20251201213007759',   -- 27/11/2025  Francesco Silvestri TAS00041
    'GIO20251201213713195',   -- 02/12/2025  Francesco Silvestri TAS00041
    'GIO20260115221835465',   -- 16/01/2026  Francesco Silvestri TAS00041
    'GIO20260205195222550'    -- 04/02/2026  Francesco Silvestri TAS00041
);

-- COM2025013
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260116090442778',   -- 09/01/2026  Giorgio Troni      TAS00056
    'GIO20260116090518888',   -- 20/01/2026  Giorgio Troni      TAS00056
    'GIO20260109174707430',   -- 21/01/2026  Alessandro Vaglio  TAS00056
    'GIO20260116090530775',   -- 21/01/2026  Giorgio Troni      TAS00056
    'GIO20260204085844178',   -- 04/02/2026  Giorgio Troni      TAS00056
    'GIO20260321094951886',   -- 18/03/2026  Giorgio Troni      TAS00073
    'GIO20260321095236174',   -- 27/03/2026  Giorgio Troni      TAS00085
    'GIO20260515113802952'    -- 22/05/2026  Giorgio Troni      TAS00085
);

-- COM2025018
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260313092537372'    -- 12/03/2026  Francesco Silvestri TAS00083
);

-- COM2025020
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260427111025123'    -- 05/05/2026  Giorgio Troni      TAS00130
);
UPDATE FACT_GIORNATE SET Desk = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260502114524329'    -- 05/05/2026  Alessandro Vaglio  TAS00130
);

-- COM2025026
UPDATE FACT_GIORNATE SET Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260629183921941',   -- 18/06/2026  Francesco Silvestri TAS00104
    'GIO20260629183944832'    -- 19/06/2026  Francesco Silvestri TAS00104
);
UPDATE FACT_GIORNATE SET Desk = 'No', Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
    'GIO20260613124130488',   -- 14/05/2026  Alessandro Vaglio  TAS00104
    'GIO20260613125203534'    -- 19/06/2026  Alessandro Vaglio  TAS00104
);

-- --------------------------------------------------------------------
-- Controlli: 23 giornate senza viaggio, 6 task con regime proprio.
-- --------------------------------------------------------------------
-- SELECT COUNT(*) FROM FACT_GIORNATE WHERE Viaggio = 'No';


-- #####################################################################
-- ##  11-regime-spese.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/add_regime_spese.sql, che rende esplicito il regime di spesa e
-- introduce il forfait a corpo.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Va tenuto allineato alla migration finche' il dump di produzione non
-- la contiene gia'. Come gli altri, nessun USE: gira sul database indicato da
-- MARIADB_DATABASE.
--
-- Va dopo 04-spese-viaggi-vitto, che crea le colonne da cui converte, e dopo 10,
-- che imposta i regimi a mano sulle quattro commesse: qui si legge il risultato.
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


-- #####################################################################
-- ##  12-task-creati-in-locale.sql
-- #####################################################################

-- Ambiente locale: i task creati dall'interfaccia e le giornate spostate.
--
-- GENERATO da docker/genera-10-spese.php: non modificare a mano, rigeneralo.
--
-- Gli altri script correggono righe che il dump gia' contiene. Queste no:
-- sono righe nate in locale. Trovate il 19/08/2026 alla prima prova di reset
-- vera, quando TAS00130 'AUDIT Collecchio' e' sparito e le sue due giornate
-- sono tornate sul task del dump, senza che nulla lo segnalasse.
--
-- Va per ultimo, dopo 11-regime-spese: l'INSERT elenca anche le colonne
-- di regime che quello script aggiunge.
--
-- Sicuro da rieseguire: INSERT IGNORE non duplica, gli UPDATE riscrivono lo
-- stesso valore. Data_Modifica e' riassegnata a se stessa per non far
-- scattare ON UPDATE.

-- =====================================================================
-- Task creati in locale (1)
-- =====================================================================

-- AUDIT Collecchio  (COM2025020)
INSERT IGNORE INTO ANA_TASK (ID_TASK, Task, Desc_Task, ID_COMMESSA, ID_COLLABORATORE, Tipo, Data_Apertura_Task, Data_Inizio, Data_Fine, Stato_Task, gg_previste, Spese_Comprese, Spese_Comprese_Viaggi, Spese_Comprese_Vitto_Alloggio, Valore_Spese_std, Valore_Spese_std_Viaggi, Valore_Spese_std_Vitto_Alloggio, Regime_Spese_Viaggi, Valore_Spese_Viaggi, Regime_Spese_Vitto_Alloggio, Valore_Spese_Vitto_Alloggio, Valore_gg, Data_Creazione, ID_UTENTE_CREAZIONE, Data_Modifica, ID_UTENTE_MODIFICA)
VALUES ('TAS00130', 'AUDIT Collecchio', NULL, 'COM2025020', NULL, 'Campo', '2026-03-15', NULL, '2026-08-19', 'Chiuso', NULL, 'No', 'No', 'Si', NULL, '145.00', NULL, 'Diaria', '145.00', 'Compreso', NULL, '1550.00', '2026-08-19 08:36:40', 'CONS003', '2026-08-19 08:41:24', 'CONS003');

-- =====================================================================
-- Task modificati dall'interfaccia (5)
-- Stato, giornate previste, prezzo e regime di spesa: colonne che gli
-- altri script non rimettono, o che 11-regime-spese riporterebbe al
-- valore derivato dalle colonne vecchie.
-- =====================================================================

-- TAS00018  CASTELLI Affiancamento VP
UPDATE ANA_TASK
   SET Task = 'CASTELLI Affiancamento VP',
       ID_COMMESSA = 'COM0012',
       Tipo = 'Formazione',
       Stato_Task = 'Chiuso',
       gg_previste = '0.00',
       Valore_gg = NULL,
       Data_Apertura_Task = '2025-06-01',
       Data_Fine = '2026-03-28',
       ID_COLLABORATORE = NULL,
       Regime_Spese_Viaggi = 'Compreso',
       Valore_Spese_Viaggi = NULL,
       Regime_Spese_Vitto_Alloggio = 'Compreso',
       Valore_Spese_Vitto_Alloggio = NULL
     , Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00018';

-- TAS00022  LAVAZZA SETTIMO FORMAZIONE
UPDATE ANA_TASK
   SET Task = 'LAVAZZA SETTIMO FORMAZIONE',
       ID_COMMESSA = 'COM0007',
       Tipo = 'Campo',
       Stato_Task = 'In corso',
       gg_previste = '7.00',
       Valore_gg = '1650.00',
       Data_Apertura_Task = '2025-03-01',
       Data_Fine = '2026-03-28',
       ID_COLLABORATORE = NULL,
       Regime_Spese_Viaggi = 'Compreso',
       Valore_Spese_Viaggi = NULL,
       Regime_Spese_Vitto_Alloggio = 'Corpo',
       Valore_Spese_Vitto_Alloggio = '1000.00'
     , Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00022';

-- TAS00043  Castelli Consulenza Organizzativa
UPDATE ANA_TASK
   SET Task = 'Castelli Consulenza Organizzativa',
       ID_COMMESSA = 'COM2025007',
       Tipo = 'Campo',
       Stato_Task = 'In corso',
       gg_previste = '1.00',
       Valore_gg = '1550.00',
       Data_Apertura_Task = '2025-11-01',
       Data_Fine = NULL,
       ID_COLLABORATORE = NULL,
       Regime_Spese_Viaggi = 'Diaria',
       Valore_Spese_Viaggi = '170.00',
       Regime_Spese_Vitto_Alloggio = 'Compreso',
       Valore_Spese_Vitto_Alloggio = NULL
     , Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00043';

-- TAS00090  AUDIT
UPDATE ANA_TASK
   SET Task = 'AUDIT',
       ID_COMMESSA = 'COM2025020',
       Tipo = 'Campo',
       Stato_Task = 'Chiuso',
       gg_previste = '4.00',
       Valore_gg = '1550.00',
       Data_Apertura_Task = '2026-03-15',
       Data_Fine = '2026-08-19',
       ID_COLLABORATORE = NULL,
       Regime_Spese_Viaggi = 'Diaria',
       Valore_Spese_Viaggi = '125.00',
       Regime_Spese_Vitto_Alloggio = 'Compreso',
       Valore_Spese_Vitto_Alloggio = NULL
     , Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00090';

-- TAS00103  COORDINAMENTO TRONI
UPDATE ANA_TASK
   SET Task = 'COORDINAMENTO TRONI',
       ID_COMMESSA = 'COM2025020',
       Tipo = 'Monitoraggio',
       Stato_Task = 'Chiuso',
       gg_previste = NULL,
       Valore_gg = '0.10',
       Data_Apertura_Task = '2026-06-01',
       Data_Fine = '2026-08-19',
       ID_COLLABORATORE = 'CONS003',
       Regime_Spese_Viaggi = 'Compreso',
       Valore_Spese_Viaggi = NULL,
       Regime_Spese_Vitto_Alloggio = 'Compreso',
       Valore_Spese_Vitto_Alloggio = NULL
     , Data_Modifica = Data_Modifica
 WHERE ID_TASK = 'TAS00103';

-- =====================================================================
-- Giornate spostate su un altro task (2)
-- Dopo gli INSERT qui sopra: il task di destinazione deve esistere.
-- =====================================================================

-- verso TAS00130 (erano su TAS00090)
UPDATE FACT_GIORNATE SET ID_TASK = 'TAS00130', Data_Modifica = Data_Modifica
 WHERE ID_GIORNATA IN ('GIO20260427111025123','GIO20260502114524329');


-- #####################################################################
-- ##  13-documenti-commerciali.sql
-- #####################################################################

-- Ambiente locale: applica al dump appena importato la migration
-- DB/migrations/add_documenti_commerciali.sql, che crea ANA_DOCUMENTI_COMMERCIALI,
-- aggiunge ID_DOCUMENTO e Natura sulla fattura, Importo_Previsto sulla commessa e
-- Codice_Fiscale sul cliente, ed elimina i due campi documento da ANA_COMMESSE.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Va tenuto allineato alla migration finche' il dump di produzione non
-- la contiene gia'.
-- Come gli altri script di questa cartella, gira sul database indicato da
-- MARIADB_DATABASE: nessun USE, cosi' resta valido se si cambia DB_NAME.

-- Migration: i documenti commerciali (offerte e ordini) come entita' propria
--
-- Fase 1 del progetto commesse-ordini. Vedi docs/PROGETTO-COMMESSE-ORDINI.md, § 4.
--
-- SOLO STRUTTURA: nessun dato viene scritto, nessuna schermata cambia. La
-- migration e' rilasciabile da sola, prima che esista l'interfaccia che
-- compilera' la tabella.
--
-- Perche' una tabella e non due campi su ANA_COMMESSE:
--
--   - una commessa ha N ordini. Certosa ne ha due (fase 1 e fase 2), Perfetti
--     due sullo stesso progetto, Corteolona due. I due campi Documento_Offerta
--     e Documento_Ordine erano sottodimensionati per il problema reale, ed e'
--     probabilmente il motivo per cui non sono mai stati compilati: zero
--     commesse su 45.
--
-- Perche' UNA tabella per offerte e ordini e non due:
--
--   - la fattura deve poter puntare all'una o all'altro con un campo solo.
--     L'attivita' parte alla conferma dell'offerta e l'ordine, se arriva,
--     arriva dopo, spesso a fatture gia' emesse: senza ordine e' l'offerta a
--     fare fede per la fatturazione.
--   - le due entita' condividono importo, intestatario, documento e stato.
--     Le distingue Tipo, le lega ID_PADRE.
--
-- Perche' ID_PADRE e non una riga sola che cambia tipo quando l'ordine arriva:
--
--   - un'offerta puo' generare piu' ordini. L'offerta "250923 Reggio Corte
--     Audit" copre 4512064618 (14.416,50) e 4512092514 (11.486,00), che fanno
--     25.902,50 al centesimo.
--
-- ATTENZIONE, l'unico passaggio distruttivo: il punto 3 elimina
-- Documento_Offerta e Documento_Ordine da ANA_COMMESSE. In locale, al
-- 19/08/2026, sono NULL su tutte e 45 le commesse, quindi non si perde nulla,
-- ma la verifica va rifatta in produzione prima di eseguire:
--
--   SELECT COUNT(*) FROM ANA_COMMESSE
--    WHERE Documento_Offerta IS NOT NULL OR Documento_Ordine IS NOT NULL;
--
-- Deve dare 0. Il runner PHP lo controlla da solo e si ferma; eseguendo il
-- .sql a mano da phpMyAdmin il controllo va fatto prima.
--
-- Sicura da rieseguire: IF NOT EXISTS / IF EXISTS ovunque.

-- =====================================================================
-- 1. La tabella dei documenti commerciali.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ANA_DOCUMENTI_COMMERCIALI (
    ID_DOCUMENTO varchar(50) NOT NULL
        COMMENT 'DOC{yy}###, sullo schema gia'' usato per le fatture',
    Tipo enum('Offerta','Ordine') NOT NULL DEFAULT 'Ordine',

    -- Sull'ordine, l'offerta da cui nasce. Nullable perche' non tutti gli
    -- ordini hanno un'offerta a monte e nessuna offerta ha un padre.
    ID_PADRE varchar(50) DEFAULT NULL
        COMMENT 'Solo sugli ordini: l''offerta da cui l''ordine discende',

    -- Obbligatorio anche sulle offerte: si registrano solo quelle confermate,
    -- quindi non esiste un documento senza il lavoro che autorizza. La
    -- commessa e' quella che contiene quel lavoro, non quella dell'anno.
    ID_COMMESSA varchar(50) NOT NULL,

    Numero varchar(100) DEFAULT NULL
        COMMENT 'Il riferimento del cliente per l''ordine, il nostro protocollo per l''offerta',
    Data date DEFAULT NULL,

    -- Esplicito e non dedotto da Importo vuoto: su un ordine chiuso l'importo
    -- mancante e' un dato da recuperare, su uno a giornate e' la normalita'.
    -- Confonderli significa non sapere mai quali ordini vanno completati.
    Tipo_Importo enum('Chiuso','A_giornate') NOT NULL DEFAULT 'Chiuso',

    -- Il dato che oggi non esiste da nessuna parte, ed e' il motivo per cui
    -- non si puo' parlare di avanzamento. Nullable: sugli ordini a giornate
    -- non esiste proprio.
    Importo decimal(12,2) DEFAULT NULL,
    Giornate_Previste decimal(10,2) DEFAULT NULL
        COMMENT 'Solo sugli ordini a giornate che dichiarano un tetto in giornate',

    -- Lo decide l'ordine, non la commessa: 4512149513 chiede fattura a Egidio
    -- Galbani e 4512149558 a Gruppo Lactalis, e sono due stabilimenti dello
    -- stesso gruppo.
    ID_CLIENTE_INTESTATARIO varchar(50) DEFAULT NULL,

    Documento varchar(500) DEFAULT NULL
        COMMENT 'Il PDF caricato, sul modello delle foto delle consuntivazioni',
    Stato enum('Atteso','Ricevuto','Chiuso') NOT NULL DEFAULT 'Ricevuto',

    -- Solo sulle offerte. "In attesa d'ordine, da sollecitare" e "ordine che
    -- non arrivera' mai" (Emu, Sammontana, EOC) sono due cose diverse, e la
    -- differenza non e' deducibile dall'assenza di un figlio.
    Ordine_Atteso enum('Si','No') NOT NULL DEFAULT 'No',

    -- Quanto e' rimasto non fatturato alla chiusura, e perche'. Ricalcolarlo a
    -- posteriori da' lo stesso numero senza dire il motivo: lavoro non venduto
    -- o perimetro ridotto in corsa sono informazioni commerciali diverse.
    Residuo_Alla_Chiusura decimal(12,2) DEFAULT NULL,
    Note_Chiusura text DEFAULT NULL,

    Note text DEFAULT NULL,
    Data_Creazione timestamp NULL DEFAULT current_timestamp(),
    ID_UTENTE_CREAZIONE varchar(50) DEFAULT NULL,
    Data_Modifica timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    ID_UTENTE_MODIFICA varchar(50) DEFAULT NULL,

    PRIMARY KEY (ID_DOCUMENTO),
    KEY idx_commessa (ID_COMMESSA),
    KEY idx_padre (ID_PADRE),
    KEY idx_intestatario (ID_CLIENTE_INTESTATARIO),
    KEY idx_tipo (Tipo),
    KEY idx_numero (Numero),
    KEY idx_stato (Stato),

    -- CASCADE come su ANA_TASK: un documento senza la sua commessa non ha
    -- significato. SET NULL non sarebbe nemmeno possibile, la colonna e' NOT NULL.
    CONSTRAINT ANA_DOCUMENTI_COMMERCIALI_ibfk_1
        FOREIGN KEY (ID_COMMESSA) REFERENCES ANA_COMMESSE (ID_COMMESSA) ON DELETE CASCADE,
    -- RESTRICT e non SET NULL, per due motivi che coincidono.
    --
    -- Il primo e' di modello: cancellare un'offerta che ha generato ordini non
    -- deve portarsi via gli ordini, ma nemmeno slegarli in silenzio. Il legame
    -- offerta-ordine e' l'unico posto in cui e' scritto che quei 25.902,50 di
    -- Reggio Corte sono una fornitura sola: perso quello, non si ricostruisce.
    -- Chi vuole davvero cancellare l'offerta stacca prima gli ordini a mano.
    --
    -- Il secondo e' tecnico: MariaDB rifiuta (errore 1901) un CHECK che
    -- riferisce una colonna soggetta a ON DELETE SET NULL. Con SET NULL il
    -- vincolo qui sotto non sarebbe creabile.
    CONSTRAINT ANA_DOCUMENTI_COMMERCIALI_ibfk_2
        FOREIGN KEY (ID_PADRE) REFERENCES ANA_DOCUMENTI_COMMERCIALI (ID_DOCUMENTO) ON DELETE RESTRICT,
    CONSTRAINT ANA_DOCUMENTI_COMMERCIALI_ibfk_3
        FOREIGN KEY (ID_CLIENTE_INTESTATARIO) REFERENCES ANA_CLIENTI (ID_CLIENTE) ON DELETE SET NULL,

    -- Solo un ordine puo' avere un padre. Un'offerta figlia di un'offerta non
    -- e' un caso del modello, e' un errore di inserimento.
    CONSTRAINT chk_padre_solo_su_ordine CHECK (Tipo = 'Ordine' OR ID_PADRE IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. La fattura punta al suo documento, e dichiara che tipo di fattura e'.
--
--    ID_DOCUMENTO resta NULLABLE in questa fase: diventa obbligatorio solo
--    quando il backfill sara' completo, e oggi due fatture non hanno ancora
--    un documento di riferimento individuato (40/26 Lucchini, 32/25
--    Sammontana). Renderlo NOT NULL adesso bloccherebbe l'inserimento di
--    qualunque fattura nuova, che e' esattamente il tipo di rilascio che
--    questa fase vuole evitare.
--
--    ID_COMMESSA sulla fattura NON si tocca e NON si elimina: diventera' un
--    dato derivato dal documento, ma resta una colonna vera. Toglierla
--    vorrebbe dire riscrivere ogni query che oggi la usa.
--
--    Restano per ora anche Riferimento_Ordine e Data_Ordine, che sono il
--    numero d'ordine scritto a mano: si eliminano quando ID_DOCUMENTO e'
--    compilato ovunque, non prima, perche' oggi sono l'unica traccia che
--    collega 61 fatture al loro ordine.
-- =====================================================================

ALTER TABLE FACT_FATTURE
    ADD COLUMN IF NOT EXISTS ID_DOCUMENTO varchar(50) DEFAULT NULL
        COMMENT 'Il documento commerciale che autorizza la fattura: ordine, o offerta se l''ordine non c''e'''
        AFTER ID_COMMESSA;

ALTER TABLE FACT_FATTURE
    ADD COLUMN IF NOT EXISTS Natura enum('Acconto','Avanzamento','Saldo') DEFAULT NULL
        COMMENT 'A che punto della fornitura sta la fattura'
        AFTER ID_DOCUMENTO;

ALTER TABLE FACT_FATTURE
    ADD INDEX IF NOT EXISTS idx_documento (ID_DOCUMENTO);

-- SET NULL come sulle altre tre chiavi esterne della tabella: cancellare un
-- documento non deve far sparire le fatture emesse su di esso.
-- In MariaDB IF NOT EXISTS va dopo FOREIGN KEY, non dopo CONSTRAINT.
ALTER TABLE FACT_FATTURE
    ADD CONSTRAINT FACT_FATTURE_ibfk_4
        FOREIGN KEY IF NOT EXISTS (ID_DOCUMENTO) REFERENCES ANA_DOCUMENTI_COMMERCIALI (ID_DOCUMENTO)
        ON DELETE SET NULL;

-- =====================================================================
-- 3. Su ANA_COMMESSE: entra l'importo previsto, escono i due campi documento.
--
--    Importo_Previsto entra subito anche se non verra' usato finche' non c'e'
--    l'avanzamento: e' la prima delle decisioni prese il 15/08/2026. Per le
--    commesse a giornate resta vuoto.
--
--    I due campi documento si eliminano ENTRAMBI, non si riusano: la tabella
--    del punto 1 li rende ridondanti, e tenerli sarebbe una seconda verita'
--    da allineare. Vedi l'avvertenza in testa al file.
-- =====================================================================

ALTER TABLE ANA_COMMESSE
    ADD COLUMN IF NOT EXISTS Importo_Previsto decimal(12,2) DEFAULT NULL
        COMMENT 'Vuoto sulle commesse a giornate'
        AFTER Stato_Commessa;

ALTER TABLE ANA_COMMESSE DROP COLUMN IF EXISTS Documento_Offerta;
ALTER TABLE ANA_COMMESSE DROP COLUMN IF EXISTS Documento_Ordine;

-- =====================================================================
-- 4. Su ANA_CLIENTI: il codice fiscale.
--
--    Serve alla fase 3, quando il cliente torna a essere il soggetto giuridico
--    e i quattro pseudo-clienti Lactalis si ricompongono. La colonna entra qui
--    perche' e' struttura, e la struttura sta tutta in questa migration; la
--    compilazione e' un'altra cosa.
-- =====================================================================

ALTER TABLE ANA_CLIENTI
    ADD COLUMN IF NOT EXISTS Codice_Fiscale varchar(20) DEFAULT NULL
        AFTER P_IVA;

-- =====================================================================
-- Controlli.
-- =====================================================================

-- SHOW CREATE TABLE ANA_DOCUMENTI_COMMERCIALI;
-- SELECT COUNT(*) FROM ANA_DOCUMENTI_COMMERCIALI;             -- 0: la fase 4 la compila
-- SHOW COLUMNS FROM FACT_FATTURE LIKE 'ID\_DOCUMENTO';
-- SHOW COLUMNS FROM ANA_COMMESSE LIKE 'Documento\_%';         -- vuoto
-- SELECT COUNT(*) FROM FACT_FATTURE;                          -- 89, invariato
