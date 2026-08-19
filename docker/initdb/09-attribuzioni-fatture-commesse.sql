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
