-- Ambiente locale: rimette le correzioni fatte a mano su task e giornate per
-- allineare le spese di quattro commesse Lactalis ai documenti veri.
--
-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi
-- script. Come gli altri, gira sul database indicato da MARIADB_DATABASE:
-- nessun USE, cosi' resta valido se si cambia DB_NAME.
--
-- Va dopo 04-spese-viaggi-vitto, che crea la colonna Viaggio e i quattro campi
-- di regime: qui si scrivono solo le righe che si scostano da quei default.
--
-- =====================================================================
-- Perche' questo script esiste
-- =====================================================================
--
-- Il 15-17/08/2026 le spese di quattro commesse sono state riviste a mano
-- dall'interfaccia, confrontandole con offerte, ordini e fatture. Il lavoro e'
-- descritto in docs/260815_MODIFICHE_IN_LOCAL_ALLINEAMENTO SPESE.md, ma non
-- stava in nessuna migration: un reset lo perdeva, e andava rifatto a mano
-- leggendo quel documento. E' successo il 17/08/2026.
--
-- Le righe che divergono da dump + migration sono in tutto venti: un task e
-- diciannove giornate. Tutto il resto del database e' gia' riproducibile.
--
-- Le giornate si agganciano per ID_GIORNATA, che e' la chiave primaria e
-- arriva dal dump: non cambia fra un reset e l'altro.
--
-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore.
-- =====================================================================


-- ---------------------------------------------------------------------
-- COM0013  LACTALIS STAB CORTEOLONA SVILUPPO 2025   ricavo spese 1.210,00
-- ---------------------------------------------------------------------
--
-- Shop Floor Coaching era l'unico task della commessa senza diaria, quindi
-- addebitava le spese reali (200 euro a viaggio) mentre Aula CT e Prima Linea
-- applicavano 55. Allineato agli altri.

UPDATE ANA_TASK
   SET Valore_Spese_std_Viaggi       = 55.00,
       Spese_Comprese_Viaggi         = 'No',
       Spese_Comprese_Vitto_Alloggio = 'Si'
 WHERE ID_TASK = 'TAS00041';

-- Troni sulla Prima Linea: nei due giorni in cui e' andato con Vaglio il
-- viaggio non si addebita due volte.
UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20251030084320131',   -- 24/10/2025  Troni      TAS00042
    'GIO20251112190749770'    -- 12/11/2025  Troni      TAS00042
);

-- Silvestri su SFC: ogni riga qui e' il giorno SUCCESSIVO a una giornata con
-- albergo imputato, quindi la trasferta e' una sola per la coppia di giorni.
-- (26/11 -> 61,50 · 01/12 -> 84,00 · 15/01 -> 91,00 · 03/02 -> 90,00)
UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20251201213007759',   -- 27/11/2025  Silvestri  TAS00041
    'GIO20251201213713195',   -- 02/12/2025  Silvestri  TAS00041
    'GIO20260115221835465',   -- 16/01/2026  Silvestri  TAS00041
    'GIO20260205195222550'    -- 04/02/2026  Silvestri  TAS00041
);


-- ---------------------------------------------------------------------
-- COM2025013  LACTALIS STAB CASALE CREMASCO         ricavo spese 1.470,00
-- ---------------------------------------------------------------------
--
-- Nessun cambio sui task: solo il flag Viaggio.

-- Troni nei giorni in cui era con Vaglio.
UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20260116090442778',   -- 09/01/2026  Troni      TAS00056
    'GIO20260116090518888',   -- 20/01/2026  Troni      TAS00056
    'GIO20260116090530775',   -- 21/01/2026  Troni      TAS00056
    'GIO20260204085844178'    -- 04/02/2026  Troni      TAS00056
);

-- Giornate consecutive: la regola vale per chiunque, non per il solo Troni.
-- Il 21 gennaio - l'esempio citato nel documento - cade in entrambe le regole,
-- ed e' l'unico giorno in cui il viaggio si toglie anche a Vaglio.
UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20260109174707430',   -- 21/01/2026  Vaglio     TAS00056
    'GIO20260321094951886',   -- 18/03/2026  Troni      TAS00073
    'GIO20260321095236174',   -- 27/03/2026  Troni      TAS00085
    'GIO20260515113802952'    -- 22/05/2026  Troni      TAS00085
);


-- ---------------------------------------------------------------------
-- COM2025018  LACTALIS STAB CORTEOLONA SVILUPPO 2026 ricavo spese 1.155,00
-- ---------------------------------------------------------------------
--
-- Unica coppia di giornate consecutive di Silvestri nella commessa:
-- l'11/03 con albergo da 165,00, il 12/03 senza viaggio.
UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20260313092537372'    -- 12/03/2026  Silvestri  TAS00083
);


-- ---------------------------------------------------------------------
-- COM2025026  LACTALIS PORCARI                        ricavo spese 370,00
-- ---------------------------------------------------------------------
--
-- L'offerta firmata del 23/05/2026 scompone i 7.190,00 dell'ordine
-- 4512236024 in 6.200 di attivita' (4 gg x 1.550) + 620 di coordinamento
-- (10%) + 1 x 370 euro/VIAGGIO a/r Milano-Porcari. Il 370 e' quindi una
-- tariffa a trasferta, non un forfait censito male: la diaria viaggi si
-- applica una volta per giornata con Viaggio = 'Si', cioe' una volta per
-- trasferta. L'offerta ne prevedeva una sola, e una sola ne resta - quella
-- di Vaglio del 18/06.
--
-- Le due giornate di Vaglio erano Desk = 'Si' nel dump: il desk va tolto
-- (era in loco) e il viaggio non si addebita.
UPDATE FACT_GIORNATE SET Desk = 'No', Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20260613124130488',   -- 14/05/2026  Vaglio     TAS00104
    'GIO20260613125203534'    -- 19/06/2026  Vaglio     TAS00104
);

UPDATE FACT_GIORNATE SET Viaggio = 'No' WHERE ID_GIORNATA IN (
    'GIO20260629183921941',   -- 18/06/2026  Silvestri  TAS00104
    'GIO20260629183944832'    -- 19/06/2026  Silvestri  TAS00104
);


-- =====================================================================
-- Controlli. Il ricavo spese deve valere 1.210,00 su COM0013, 1.470,00 su
-- COM2025013, 1.155,00 su COM2025018 e 370,00 su COM2025026, e le giornate
-- con Viaggio = 'No' devono essere 19 in tutto.
-- =====================================================================

-- SELECT COUNT(*) AS senza_viaggio FROM FACT_GIORNATE WHERE Viaggio = 'No';
--
-- SELECT t.ID_COMMESSA,
--        ROUND(SUM(CASE WHEN g.Tipo='Campo' AND COALESCE(g.Desk,'No')<>'Si'
--                        AND COALESCE(g.Viaggio,'Si')='Si'
--             THEN CASE WHEN t.Spese_Comprese_Viaggi='Si' THEN 0
--                       WHEN COALESCE(t.Valore_Spese_std_Viaggi,0)>0
--                            THEN t.Valore_Spese_std_Viaggi
--                       ELSE COALESCE(g.Spese_Viaggi,0) END
--             ELSE 0 END)
--            + SUM(CASE WHEN g.Tipo='Campo' AND COALESCE(g.Desk,'No')<>'Si'
--             THEN CASE WHEN t.Spese_Comprese_Vitto_Alloggio='Si' THEN 0
--                       WHEN COALESCE(t.Valore_Spese_std_Vitto_Alloggio,0)>0
--                            THEN t.Valore_Spese_std_Vitto_Alloggio
--                       ELSE COALESCE(g.Vitto_alloggio,0)+COALESCE(g.Altri_costi,0) END
--             ELSE 0 END), 2) AS ricavo_spese
--   FROM ANA_TASK t JOIN FACT_GIORNATE g ON g.ID_TASK = t.ID_TASK
--  WHERE t.ID_COMMESSA IN ('COM0013','COM2025013','COM2025018','COM2025026')
--  GROUP BY t.ID_COMMESSA;
