-- Ambiente locale: rimette i collegamenti fattura -> commessa (ID_COMMESSA).
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Come gli altri, gira sul database indicato da MARIADB_DATABASE:
-- nessun USE, cosi' resta valido se si cambia DB_NAME.
--
-- Va per ultimo, dopo 05-08: aggancia le righe per NR, e le numerazioni sono
-- sistemate da 05-note-accredito e 06-allinea-fatture-pdf (nel dump la 01/26 e'
-- scritta "1/26").
--
-- =====================================================================
-- Perche' questo script esiste
-- =====================================================================
--
-- Nessuna delle migration valorizza ID_COMMESSA: 06-allinea-fatture-pdf lo
-- nomina solo in un commento. Le attribuzioni che divergono dal dump di
-- produzione erano quindi lavoro fatto a mano dall'interfaccia, e un reset le
-- perdeva **in silenzio**: i conteggi delle tabelle tornavano tutti giusti e il
-- reset sembrava riuscito, ma il fatturato per commessa tornava indietro di otto
-- righe senza che nulla lo segnalasse. E' successo il 17/08/2026, ed e' stato
-- recuperato solo perche' esisteva una fotografia presa poco prima per un altro
-- motivo.
--
-- Le otto righe che il dump NON ha sono tutte disambiguazioni Lindt piu' IWT,
-- cioe' il lavoro di separare le quattro commesse Lindt che nel dump di
-- produzione sono appiattite su COM0014:
--
--     28/25  COM0014      -> COM2025008   LINDT WORKSHOP RUOLO CR
--     34/25  COM0014      -> COM2025009   LINDT SVILUPPO CR 2025
--     41/25  COM0014      -> COM2025010   LINDT SVILUPPO CAPITURNO 2025
--     37/26  COM2025009   -> COM2025015   LINDT SVILUPPO CapiTurno 2026
--     02/26  (nessuna)    -> COM2025015
--     13/26  (nessuna)    -> COM2025015
--     05/26  (nessuna)    -> COM2025004   IWT Coaching
--     30/26  (nessuna)    -> COM2025019   LINDT COACHING MIDDLE MANAGEMENT 2026
--
-- Le altre 47 coincidono gia' col dump e sono ripetute qui apposta: cosi' lo
-- script descrive lo stato completo e non dipende da cosa contiene il dump del
-- giorno. Le 34 fatture senza commessa restano senza: sono il lavoro della
-- fase 2 di docs/PROGETTO-COMMESSE-ORDINI.md, che rendera' ID_COMMESSA
-- obbligatorio e mandera' in pensione questo file.
--
-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore.
-- NR e' univoco su FACT_FATTURE, quindi ogni riga colpisce una fattura sola.
-- =====================================================================

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0001'
 WHERE NR IN ('04/24','03/25','07/25','10/25','14/25','18/25','26/25','29/25','39/25');

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0002' WHERE NR IN ('02/24','04/25');

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0003'
 WHERE NR IN ('01/24','01/25','06/25','12/25','16/25','24/25','33/25');

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0004'
 WHERE NR IN ('03/24','02/25','05/25','11/25','15/25','23/25','27/25');

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0005' WHERE NR IN ('05/24','35/25');
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0006' WHERE NR = '17/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0007' WHERE NR = '13/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0008' WHERE NR = '31/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0009' WHERE NR IN ('09/25','19/25','40/25');
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0010' WHERE NR = '08/25';

-- La terna Ambrosi: fattura, nota che la storna, riemissione.
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0011' WHERE NR IN ('20/25','21/25','22/25');

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0012' WHERE NR = '30/25';

-- 36/25 e' attribuita qui nel dump, ma il PDF dice "Audit Culturale Reggio
-- Emilia e Corteolona", cioe' COM0012. E' l'unica fattura, con la 05/24,
-- datata prima della prima giornata della sua commessa. Lasciata com'e' per
-- non cambiare i numeri di nascosto: la correzione e' una decisione, ed e'
-- registrata nell'appendice A di docs/PROGETTO-COMMESSE-ORDINI.md.
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0013' WHERE NR = '36/25';

UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0014' WHERE NR = '25/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM0015' WHERE NR = '32/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025004' WHERE NR IN ('37/25','05/26');
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025006' WHERE NR IN ('38/25','42/25','44/25');
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025008' WHERE NR = '28/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025009' WHERE NR = '34/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025010' WHERE NR = '41/25';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025013' WHERE NR = '36/26';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025015' WHERE NR IN ('02/26','13/26','37/26');
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025019' WHERE NR = '30/26';
UPDATE FACT_FATTURE SET ID_COMMESSA = 'COM2025023' WHERE NR = '38/26';

-- =====================================================================
-- Controlli. Devono risultare 55 fatture con commessa su 89, e nessun
-- ID_COMMESSA che punta a una commessa inesistente.
-- =====================================================================

-- SELECT COUNT(*) AS con_commessa FROM FACT_FATTURE
--  WHERE ID_COMMESSA IS NOT NULL AND ID_COMMESSA <> '';
-- SELECT f.NR, f.ID_COMMESSA FROM FACT_FATTURE f
--   LEFT JOIN ANA_COMMESSE c ON c.ID_COMMESSA = f.ID_COMMESSA
--  WHERE f.ID_COMMESSA IS NOT NULL AND f.ID_COMMESSA <> '' AND c.ID_COMMESSA IS NULL;
