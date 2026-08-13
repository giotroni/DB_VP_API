<?php
/**
 * Migration: separa le spese in Viaggi e Vitto/Alloggio, aggiunge il flag Viaggio
 *
 * ANA_TASK     + Spese_Comprese_Viaggi, Spese_Comprese_Vitto_Alloggio,
 *                Valore_Spese_std_Viaggi, Valore_Spese_std_Vitto_Alloggio
 * FACT_GIORNATE + Viaggio
 *
 * Il popolamento e' conservativo: il maturato spese non cambia. Vedi
 * docs/REGOLE-SPESE.md per le regole di calcolo che ne derivano.
 *
 * Eseguire UNA SOLA VOLTA su ogni database (produzione e test).
 * Sicuro da rieseguire: verifica le colonne prima di toccarle.
 *
 * Utilizzo:
 *   php add_spese_viaggi_vitto.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/add_spese_viaggi_vitto.php  (da browser, solo localhost)
 *
 * In produzione l'esecuzione da browser e' bloccata: eseguire
 * add_spese_viaggi_vitto.sql da phpMyAdmin.
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

echo "=== Migration: add_spese_viaggi_vitto ===\n";
echo "Database: " . DB_NAME . "\n\n";

/**
 * Esiste la colonna? Legge l'elenco completo invece di usare SHOW COLUMNS ...
 * LIKE :col, che MariaDB non accetta come prepared statement.
 */
function hasColumn($db, $table, $column) {
    // Niente cache: dopo un ALTER la risposta cambia, e il costo è irrilevante.
    $stmt = $db->query("SHOW COLUMNS FROM `$table`");
    return in_array($column, array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field'), true);
}

$taskColumns = [
    'Spese_Comprese_Viaggi'           => "ENUM('Si','No') DEFAULT 'No' AFTER Spese_Comprese",
    'Spese_Comprese_Vitto_Alloggio'   => "ENUM('Si','No') DEFAULT 'No' AFTER Spese_Comprese_Viaggi",
    'Valore_Spese_std_Viaggi'         => "DECIMAL(10,2) DEFAULT NULL AFTER Valore_Spese_std",
    'Valore_Spese_std_Vitto_Alloggio' => "DECIMAL(10,2) DEFAULT NULL AFTER Valore_Spese_std_Viaggi",
];

try {
    // --- 1. ANA_TASK: le quattro colonne nuove ---
    $mancanti = [];
    foreach ($taskColumns as $nome => $definizione) {
        if (!hasColumn($db, 'ANA_TASK', $nome)) {
            $mancanti[] = "ADD COLUMN `$nome` $definizione";
        }
    }

    if (empty($mancanti)) {
        echo "→ ANA_TASK: le quattro colonne esistono già, nessuna modifica alla struttura.\n";
        $taskGiaMigrato = true;
    } else {
        $db->exec("ALTER TABLE ANA_TASK " . implode(', ', $mancanti));
        echo "✅ ANA_TASK: aggiunte " . count($mancanti) . " colonne.\n";
        $taskGiaMigrato = false;
    }

    // --- 2. Popolamento dai campi storici, solo alla prima esecuzione ---
    if (!$taskGiaMigrato && hasColumn($db, 'ANA_TASK', 'Spese_Comprese')) {
        $n = $db->exec("
            UPDATE ANA_TASK SET
                Spese_Comprese_Viaggi         = COALESCE(Spese_Comprese, 'No'),
                Spese_Comprese_Vitto_Alloggio = COALESCE(Spese_Comprese, 'No'),
                Valore_Spese_std_Viaggi       = Valore_Spese_std
        ");
        echo "✅ Popolate le nuove colonne su $n task dai campi storici.\n";

        // I task a diaria: il forfait copriva viaggio + pasto, quindi il
        // vitto/alloggio risulta compreso. Da rivedere task per task.
        $n = $db->exec("
            UPDATE ANA_TASK SET Spese_Comprese_Vitto_Alloggio = 'Si'
            WHERE COALESCE(Spese_Comprese, 'No') = 'No'
              AND COALESCE(Valore_Spese_std, 0) > 0
        ");
        echo "✅ $n task a diaria impostati con vitto/alloggio compreso (da rivedere a mano).\n";
    }

    // --- 3. FACT_GIORNATE: il flag Viaggio ---
    if (hasColumn($db, 'FACT_GIORNATE', 'Viaggio')) {
        echo "→ FACT_GIORNATE: la colonna Viaggio esiste già.\n";
    } else {
        $db->exec("ALTER TABLE FACT_GIORNATE
                   ADD COLUMN Viaggio ENUM('Si','No') DEFAULT 'Si' AFTER Desk");
        $n = $db->exec("UPDATE FACT_GIORNATE SET Viaggio = 'Si' WHERE Viaggio IS NULL");
        echo "✅ FACT_GIORNATE: colonna Viaggio aggiunta, $n giornate storiche impostate a 'Si'.\n";
    }

    // --- 4. Riepilogo di controllo ---
    echo "\nRipartizione dei task dopo la migration:\n";
    $stmt = $db->query("
        SELECT
            COUNT(*) AS totale,
            SUM(Spese_Comprese_Viaggi = 'Si')         AS viaggi_compresi,
            SUM(COALESCE(Valore_Spese_std_Viaggi, 0) > 0) AS viaggi_a_diaria,
            SUM(Spese_Comprese_Vitto_Alloggio = 'Si') AS vitto_compreso,
            SUM(COALESCE(Valore_Spese_std_Vitto_Alloggio, 0) > 0) AS vitto_a_diaria
        FROM ANA_TASK
    ");
    $r = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "  task totali .................. {$r['totale']}\n";
    echo "  viaggi compresi .............. {$r['viaggi_compresi']}\n";
    echo "  viaggi a diaria .............. {$r['viaggi_a_diaria']}\n";
    echo "  vitto/alloggio compreso ...... {$r['vitto_compreso']}\n";
    echo "  vitto/alloggio a diaria ...... {$r['vitto_a_diaria']}\n";

    $stmt = $db->query("SELECT COUNT(*) AS n, SUM(Viaggio = 'Si') AS con_viaggio FROM FACT_GIORNATE");
    $g = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "  giornate ..................... {$g['n']} (di cui con viaggio: {$g['con_viaggio']})\n";

    echo "\n✅ Migration completata.\n";
    echo "   Prossimo passo: rivedere in Management i task a diaria, decidendo\n";
    echo "   per ciascuno se il vitto/alloggio sia davvero compreso.\n";

} catch (PDOException $e) {
    echo "❌ Errore: " . $e->getMessage() . "\n";
    exit(1);
}

if (php_sapi_name() !== 'cli') echo "</pre>";
