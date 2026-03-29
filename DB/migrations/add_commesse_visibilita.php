<?php
/**
 * Migrazione: aggiunge tabella ANA_COMMESSE_VISIBILITA
 * Eseguire una sola volta su: vaglioty_DB_VP
 *
 * Da CLI:  php add_commesse_visibilita.php
 * Da web:  aprire nel browser (protetto dal controllo REMOTE_ADDR)
 */

// Protezione: eseguibile solo da localhost o da CLI
$isCLI = (php_sapi_name() === 'cli');
if (!$isCLI && !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
    http_response_code(403);
    exit('Accesso non consentito.');
}

// Carica la configurazione DB
$configPaths = [
    __DIR__ . '/../config.php',
    __DIR__ . '/../../DB/config.php',
];
$loaded = false;
foreach ($configPaths as $path) {
    if (file_exists($path)) {
        require_once $path;
        $loaded = true;
        break;
    }
}
if (!$loaded) {
    exit("ERRORE: config.php non trovato.\n");
}

// ── Esecuzione migrazione ────────────────────────────────────────────────────

$sql = "
CREATE TABLE IF NOT EXISTS ANA_COMMESSE_VISIBILITA (
    ID_COLLABORATORE VARCHAR(50) NOT NULL,
    ID_COMMESSA      VARCHAR(50) NOT NULL,
    Data_Creazione   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID_COLLABORATORE, ID_COMMESSA),
    FOREIGN KEY (ID_COLLABORATORE) REFERENCES ANA_COLLABORATORI(ID_COLLABORATORE) ON DELETE CASCADE,
    FOREIGN KEY (ID_COMMESSA)      REFERENCES ANA_COMMESSE(ID_COMMESSA) ON DELETE CASCADE,
    INDEX idx_collaboratore (ID_COLLABORATORE),
    INDEX idx_commessa (ID_COMMESSA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    $db = getDatabase();
    $db->exec($sql);

    // Verifica che la tabella esista davvero
    $check = $db->query("SHOW TABLES LIKE 'ANA_COMMESSE_VISIBILITA'")->fetch();
    if ($check) {
        echo "OK: tabella ANA_COMMESSE_VISIBILITA presente (creata o già esistente).\n";
    } else {
        echo "ATTENZIONE: tabella non trovata dopo la creazione.\n";
    }
} catch (PDOException $e) {
    exit("ERRORE database: " . $e->getMessage() . "\n");
}
