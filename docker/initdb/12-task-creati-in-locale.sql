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