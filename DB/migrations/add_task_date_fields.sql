-- Migration: aggiunge Data_Inizio e Data_Fine alla tabella ANA_TASK
-- Da eseguire UNA SOLA VOLTA su ogni database (produzione e test)

ALTER TABLE ANA_TASK
    ADD COLUMN Data_Inizio DATE NULL AFTER Data_Apertura_Task,
    ADD COLUMN Data_Fine   DATE NULL AFTER Data_Inizio;
