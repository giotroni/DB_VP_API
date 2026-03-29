<?php
/**
 * Script diagnostico: verifica lo stato delle tabelle nel DB
 */
require_once __DIR__ . '/../config.php';

$db = getDatabase();
$isCLI = php_sapi_name() === 'cli';

if (!$isCLI) {
    echo "<pre style='font-family:monospace;background:#1e1e1e;color:#d4d4d4;padding:20px;'>";
}

$tables = [
    'ANA_CLIENTI', 'ANA_COLLABORATORI', 'ANA_COMMESSE', 'ANA_TASK',
    'ANA_TARIFFE_COLLABORATORI', 'ANA_COMMESSE_VISIBILITA',
    'FACT_GIORNATE', 'GIORNATE_IMMAGINI', 'FACT_FATTURE', 'FACT_FATTURE_COLLABORATORI'
];

echo "=== STATO DB: " . DB_NAME . " ===\n\n";

foreach ($tables as $table) {
    try {
        $stmt = $db->query("SELECT COUNT(*) as c FROM `$table`");
        $n = $stmt->fetch()['c'];
        echo sprintf("%-35s %5d record\n", $table, $n);
    } catch (PDOException $e) {
        echo sprintf("%-35s ERRORE: %s\n", $table, $e->getMessage());
    }
}

echo "\n=== CAMPIONE ANA_TASK (prime 5 righe) ===\n";
try {
    $stmt = $db->query("SELECT ID_TASK, Task, ID_COMMESSA, Tipo FROM ANA_TASK LIMIT 5");
    $rows = $stmt->fetchAll();
    if (empty($rows)) {
        echo "TABELLA VUOTA!\n";
    } else {
        foreach ($rows as $r) {
            echo "  {$r['ID_TASK']} | {$r['Task']} | {$r['ID_COMMESSA']} | {$r['Tipo']}\n";
        }
    }
} catch (PDOException $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
}

echo "\n=== CAMPIONE ANA_COMMESSE (prime 5 righe) ===\n";
try {
    $stmt = $db->query("SELECT ID_COMMESSA, Commessa, Stato_Commessa FROM ANA_COMMESSE LIMIT 5");
    $rows = $stmt->fetchAll();
    if (empty($rows)) {
        echo "TABELLA VUOTA!\n";
    } else {
        foreach ($rows as $r) {
            echo "  {$r['ID_COMMESSA']} | {$r['Commessa']} | {$r['Stato_Commessa']}\n";
        }
    }
} catch (PDOException $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
}

echo "\n=== CAMPIONE FACT_GIORNATE (prime 5 righe) ===\n";
try {
    $stmt = $db->query("SELECT ID_GIORNATA, Data, ID_COLLABORATORE, ID_TASK FROM FACT_GIORNATE ORDER BY Data DESC LIMIT 5");
    $rows = $stmt->fetchAll();
    if (empty($rows)) {
        echo "TABELLA VUOTA!\n";
    } else {
        foreach ($rows as $r) {
            echo "  {$r['ID_GIORNATA']} | {$r['Data']} | {$r['ID_COLLABORATORE']} | {$r['ID_TASK']}\n";
        }
    }
} catch (PDOException $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
}

echo "\n=== VERIFICA RIFERIMENTI INCROCIATI ===\n";
try {
    $stmt = $db->query("
        SELECT COUNT(*) as c FROM FACT_GIORNATE g
        LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
        WHERE t.ID_TASK IS NULL AND g.ID_TASK IS NOT NULL
    ");
    $n = $stmt->fetch()['c'];
    echo "Giornate con ID_TASK orfano (nessun match in ANA_TASK): $n\n";
} catch (PDOException $e) {
    echo "ERRORE join: " . $e->getMessage() . "\n";
}

try {
    $stmt = $db->query("
        SELECT COUNT(*) as c FROM ANA_TASK t
        LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
        WHERE c.ID_COMMESSA IS NULL AND t.ID_COMMESSA IS NOT NULL
    ");
    $n = $stmt->fetch()['c'];
    echo "Task con ID_COMMESSA orfano (nessun match in ANA_COMMESSE): $n\n";
} catch (PDOException $e) {
    echo "ERRORE join: " . $e->getMessage() . "\n";
}

if (!$isCLI) echo "</pre>";
