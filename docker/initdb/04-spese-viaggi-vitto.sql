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
