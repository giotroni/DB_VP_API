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
UPDATE FACT_GIORNATE SET Desk = 'No', Viaggio = 'No', Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (
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
