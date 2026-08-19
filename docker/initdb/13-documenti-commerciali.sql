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
