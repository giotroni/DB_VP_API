-- Utente di comodo per l'ambiente di test LOCALE.
-- Le password reali nel dump sono hash bcrypt e non sono note, quindi senza
-- questo utente non si riuscirebbe a entrare nell'app in locale.
-- Nuova riga: nessun record reale viene modificato.
--
--   username: testadmin    password: test1234    ruolo: Admin
--
-- Questo file viene eseguito SOLO dai container di test: sul server di
-- produzione non esiste alcun utente testadmin.

INSERT INTO ANA_COLLABORATORI
    (ID_COLLABORATORE, Collaboratore, Email, User, PWD, Ruolo, ID_UTENTE_CREAZIONE)
VALUES
    ('TEST001', 'Test Admin', 'testadmin@local.test', 'testadmin',
     '$2y$12$kO8.qAeWOmjI2dCeYbhMzuKH.8qrKFkMoRorFOUV1M.b//HwoseDq', 'Admin', 'TEST001')
ON DUPLICATE KEY UPDATE User = VALUES(User);
