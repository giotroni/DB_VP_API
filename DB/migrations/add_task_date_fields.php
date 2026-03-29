<?php
/**
 * Migration: aggiunge Data_Inizio e Data_Fine a ANA_TASK
 *
 * Eseguire UNA SOLA VOLTA su ogni database (produzione e test).
 * Sicuro da rieseguire: usa ADD COLUMN IF NOT EXISTS.
 *
 * Utilizzo:
 *   php add_task_date_fields.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/add_task_date_fields.php  (da browser, solo localhost)
 */

// Blocca esecuzione remota
if (php_sapi_name() !== 'cli') {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!in_array($host, ['localhost', '127.0.0.1', '::1'])) {
        http_response_code(403);
        die('Accesso consentito solo da localhost.');
    }
    echo "<pre style='font-family:monospace;'>";
}

require_once __DIR__ . '/../config.php';

$db = getDatabase();

echo "=== Migration: add_task_date_fields ===\n";
echo "Database: " . DB_NAME . "\n\n";

// Verifica stato attuale
$stmt = $db->query("SHOW COLUMNS FROM ANA_TASK LIKE 'Data_Inizio'");
$hasDataInizio = $stmt->rowCount() > 0;

$stmt = $db->query("SHOW COLUMNS FROM ANA_TASK LIKE 'Data_Fine'");
$hasDataFine = $stmt->rowCount() > 0;

if ($hasDataInizio && $hasDataFine) {
    echo "✅ Le colonne Data_Inizio e Data_Fine esistono già. Nessuna azione necessaria.\n";
    exit(0);
}

// Esegui l'ALTER TABLE
$sql = "ALTER TABLE ANA_TASK";
$parts = [];
if (!$hasDataInizio) {
    $parts[] = "ADD COLUMN Data_Inizio DATE NULL AFTER Data_Apertura_Task";
}
if (!$hasDataFine) {
    $after = $hasDataInizio ? 'Data_Inizio' : 'Data_Apertura_Task';
    $parts[] = "ADD COLUMN Data_Fine DATE NULL AFTER $after";
}
$sql .= " " . implode(", ", $parts);

try {
    $db->exec($sql);

    if (!$hasDataInizio) echo "✅ Colonna Data_Inizio aggiunta con successo.\n";
    if (!$hasDataFine)   echo "✅ Colonna Data_Fine aggiunta con successo.\n";

    // Verifica finale
    $stmt = $db->query("SHOW COLUMNS FROM ANA_TASK");
    $cols = array_column($stmt->fetchAll(), 'Field');
    echo "\nColonne ANA_TASK dopo la migration:\n";
    echo "  " . implode(", ", $cols) . "\n";

    echo "\n✅ Migration completata. Puoi ora rieseguire l'import CSV.\n";

} catch (PDOException $e) {
    echo "❌ Errore: " . $e->getMessage() . "\n";
    exit(1);
}

if (php_sapi_name() !== 'cli') echo "</pre>";
