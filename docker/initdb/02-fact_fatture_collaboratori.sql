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
