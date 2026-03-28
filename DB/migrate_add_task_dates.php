<?php
/**
 * Migrazione: aggiunge Data_Inizio e Data_Fine alla tabella ANA_TASK
 * 
 * Eseguire una volta sola per aggiornare il database esistente.
 */
header("Content-Type: text/plain; charset=utf-8");
require_once 'config.php';

try {
    $pdo = getDatabase();

    // Aggiunge Data_Inizio dopo Data_Apertura_Task
    $stmt = $pdo->query("SHOW COLUMNS FROM ANA_TASK LIKE 'Data_Inizio'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE ANA_TASK ADD COLUMN Data_Inizio DATE NULL AFTER Data_Apertura_Task");
        echo "✓ Colonna Data_Inizio aggiunta.\n";
    } else {
        echo "- Colonna Data_Inizio già presente, saltata.\n";
    }

    // Aggiunge Data_Fine dopo Data_Inizio
    $stmt = $pdo->query("SHOW COLUMNS FROM ANA_TASK LIKE 'Data_Fine'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE ANA_TASK ADD COLUMN Data_Fine DATE NULL AFTER Data_Inizio");
        echo "✓ Colonna Data_Fine aggiunta.\n";
    } else {
        echo "- Colonna Data_Fine già presente, saltata.\n";
    }

    // Allinea i task già chiusi/archiviati che non hanno Data_Fine: imposta oggi come default
    $updated = $pdo->exec(
        "UPDATE ANA_TASK SET Data_Fine = CURDATE() 
         WHERE Stato_Task IN ('Chiuso', 'Archiviato') AND Data_Fine IS NULL"
    );
    echo "✓ Task già chiusi/archiviati aggiornati con Data_Fine = OGGI: {$updated} record.\n";

    echo "\nMigrazione completata con successo.\n";

} catch (PDOException $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
}
?>
