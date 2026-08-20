-- Timbra come SYSTEM le righe che ha modificato la catena di rilascio.
--
-- IL PROBLEMA CHE RISOLVE
--
-- Il registro attivita' di Statistiche non legge una tabella di audit - non
-- esiste - ma ricostruisce gli eventi da Data_Creazione e Data_Modifica,
-- mettendoci accanto ID_UTENTE_CREAZIONE e ID_UTENTE_MODIFICA.
--
-- Le due colonne non si comportano allo stesso modo:
--
--   Data_Modifica       si aggiorna DA SOLA, e' ON UPDATE current_timestamp()
--   ID_UTENTE_MODIFICA  lo scrive SOLO il codice PHP, dall'interfaccia
--
-- Quindi ogni UPDATE fatto in SQL - cioe' tutta questa catena - sposta la data
-- e lascia l'utente com'era. Il giorno del rilascio il registro mostrerebbe
-- centinaia di "Modificato" tutti allo stesso minuto e senza nome, per una
-- settimana intera (la finestra predefinita e' 7 giorni). Non e' un danno ai
-- dati, ma copre l'attivita' vera proprio nei giorni in cui la si vuole
-- guardare.
--
-- Timbrando SYSTEM l'evento resta - i dati sono cambiati davvero, nasconderlo
-- sarebbe peggio - ma dice chi e' stato. SYSTEM non e' un collaboratore,
-- quindi il registro lo mostra cosi' com'e'; nell'archivio compare gia' su due
-- fatture, non e' una convenzione nuova.
--
-- PERCHE' TIMBRA SOLO LE RIGHE SENZA NOME
--
-- La prima versione timbrava tutto quello che la catena aveva toccato, con
-- l'argomento che ID_UTENTE_MODIFICA vuol dire "chi ha modificato per ultimo"
-- e dopo la catena l'ultimo e' la migrazione. Provata sul dump 260815,
-- cancellava 15 attribuzioni vere: CONS008 passava da 10 fatture a 3, CONS006
-- da 8 a 1, CONS001 spariva.
--
-- Non vale lo scambio. Un nome sovrascritto non si recupera; una riga in cui
-- il registro attribuisce il rilascio a chi l'aveva salvata mesi prima e' un
-- fastidio che dura sette giorni, quanto la finestra del registro. Fra un
-- danno che resta e uno che passa si sceglie quello che passa.
--
-- Restano quindi 15 righe circa in cui il nome mostrato non e' di chi ha fatto
-- il rilascio. Sono poche e riconoscibili: hanno la stessa ora di tutte le
-- altre.
--
-- COME RICONOSCE LE RIGHE
--
-- Da Data_Modifica: la catena l'ha appena spostata, mentre tutto il resto
-- porta ancora la data che aveva nel dump.
--
--   dentro 01-catena.sql   @rilascio e' NOW() preso in cima al file, prima che
--                          qualunque script tocchi qualcosa: preciso al secondo
--   da solo, in initdb     @rilascio non esiste e si ripiega su CURDATE()
--
-- Il ripiego e' sicuro nell'ambiente locale, dove la catena gira su un dump
-- appena importato e nessun altro sta scrivendo. In produzione conta il caso
-- preciso, ed e' per questo che @rilascio va preso in cima alla catena.
--
-- Data_Modifica NON si sposta: assegnandola a se stessa nella SET, MariaDB non
-- applica l'ON UPDATE. Verificato.
--
-- Sicura da rieseguire: la seconda volta non trova piu' nulla da timbrare.

SET @dal := IFNULL(@rilascio, CURDATE());

-- Le sette tabelle che il registro attivita' legge, vedi API/AttivitaAPI.php.

UPDATE FACT_GIORNATE
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE FACT_FATTURE
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE ANA_COMMESSE
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE ANA_TASK
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE ANA_CLIENTI
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE ANA_COLLABORATORI
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

UPDATE ANA_TARIFFE_COLLABORATORI
   SET ID_UTENTE_MODIFICA = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;

-- Anche le CREAZIONI della catena: le due fatture che il dump non aveva e il
-- task nato in locale entrano nel registro come "Creato", e senza questo
-- comparirebbero senza nome allo stesso modo.

UPDATE FACT_FATTURE
   SET ID_UTENTE_CREAZIONE = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Creazione >= @dal AND ID_UTENTE_CREAZIONE IS NULL;

UPDATE ANA_TASK
   SET ID_UTENTE_CREAZIONE = 'SYSTEM', Data_Modifica = Data_Modifica
 WHERE Data_Creazione >= @dal AND ID_UTENTE_CREAZIONE IS NULL;

-- =====================================================================
-- Controllo. Dopo la catena non deve restare nessuna riga modificata di
-- recente senza un nome accanto.
-- =====================================================================

-- SELECT 'FACT_FATTURE' AS tabella, COUNT(*) AS senza_nome FROM FACT_FATTURE
--  WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL
-- UNION ALL SELECT 'ANA_TASK', COUNT(*) FROM ANA_TASK
--  WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL
-- UNION ALL SELECT 'FACT_GIORNATE', COUNT(*) FROM FACT_GIORNATE
--  WHERE Data_Modifica >= @dal AND ID_UTENTE_MODIFICA IS NULL;
