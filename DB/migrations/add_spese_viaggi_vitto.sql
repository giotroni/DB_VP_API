-- Migration: separa le spese in Viaggi e Vitto/Alloggio, aggiunge il flag Viaggio
-- Da eseguire UNA SOLA VOLTA su ogni database (produzione e test)
-- Vedi docs/REGOLE-SPESE.md per le regole che ne derivano.

-- 1. ANA_TASK: i due regimi di spesa diventano quattro campi, due per categoria.
ALTER TABLE ANA_TASK
    ADD COLUMN Spese_Comprese_Viaggi          ENUM('Si','No')  DEFAULT 'No' AFTER Spese_Comprese,
    ADD COLUMN Spese_Comprese_Vitto_Alloggio  ENUM('Si','No')  DEFAULT 'No' AFTER Spese_Comprese_Viaggi,
    ADD COLUMN Valore_Spese_std_Viaggi        DECIMAL(10,2)    DEFAULT NULL AFTER Valore_Spese_std,
    ADD COLUMN Valore_Spese_std_Vitto_Alloggio DECIMAL(10,2)   DEFAULT NULL AFTER Valore_Spese_std_Viaggi;

-- 2. Popolamento conservativo: il maturato non deve cambiare.
--    Il regime unico si replica su entrambe le categorie e la diaria diventa diaria viaggi.
UPDATE ANA_TASK SET
    Spese_Comprese_Viaggi         = COALESCE(Spese_Comprese, 'No'),
    Spese_Comprese_Vitto_Alloggio = COALESCE(Spese_Comprese, 'No'),
    Valore_Spese_std_Viaggi       = Valore_Spese_std;

-- 3. I task a diaria: il forfait di 50-90 EUR copriva viaggio e pasto insieme,
--    quindi il vitto/alloggio risulta compreso e non si riaddebita a parte.
--    Da rivedere task per task in Management dopo il rilascio.
UPDATE ANA_TASK SET Spese_Comprese_Vitto_Alloggio = 'Si'
WHERE COALESCE(Spese_Comprese, 'No') = 'No'
  AND COALESCE(Valore_Spese_std, 0) > 0;

-- 4. FACT_GIORNATE: il flag che dice se il viaggio e' stato effettuato.
--    Default 'Si': le giornate gia' in archivio mantengono il valore attuale.
ALTER TABLE FACT_GIORNATE
    ADD COLUMN Viaggio ENUM('Si','No') DEFAULT 'Si' AFTER Desk;

UPDATE FACT_GIORNATE SET Viaggio = 'Si' WHERE Viaggio IS NULL;

-- Le colonne Spese_Comprese e Valore_Spese_std restano in tabella come rete di
-- sicurezza: dopo il rilascio nessun codice le legge piu'. Si rimuovono con una
-- migration separata, a verifica avvenuta in produzione.
