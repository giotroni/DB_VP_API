<?php
/**
 * Migration: collega ogni nota di accredito alla fattura che storna
 *
 * Esegue add_storno_note_accredito.sql, che sta nella stessa cartella:
 *
 *   - aggiunge la colonna ID_FATTURA_STORNATA con indice e chiave esterna
 *   - collega le sette note di accredito storiche alla loro fattura
 *
 * Vedi docs/REGOLE-FATTURAZIONE.md.
 *
 * Modifica di struttura, quindi la DDL non e' annullabile con un rollback:
 * fare un backup della tabella prima di eseguirla in produzione. Sicura da
 * rieseguire (IF NOT EXISTS e UPDATE a valore fisso).
 *
 * Utilizzo:
 *   php add_storno_note_accredito.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/add_storno_note_accredito.php  (da browser, solo localhost)
 *
 * In produzione l'esecuzione da browser e' bloccata: eseguire il .sql da
 * phpMyAdmin.
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

echo "=== Migration: add_storno_note_accredito ===\n";
echo "Database: " . DB_NAME . "\n\n";

$note = $db->query("SELECT COUNT(*) FROM FACT_FATTURE WHERE TIPO = 'Nota_Accredito'")->fetchColumn();
echo "Note di accredito in archivio ... $note\n\n";

$file = __DIR__ . '/add_storno_note_accredito.sql';
if (!is_readable($file)) {
    die("File non trovato: $file\n");
}

$statements = [];
foreach (explode(';', file_get_contents($file)) as $pezzo) {
    $righe = array_filter(explode("\n", $pezzo), function ($r) {
        return strpos(ltrim($r), '--') !== 0;
    });
    $sql = trim(implode("\n", $righe));
    if ($sql !== '') {
        $statements[] = $sql;
    }
}

echo "Istruzioni da eseguire: " . count($statements) . "\n\n";

try {
    foreach ($statements as $sql) {
        $prima_riga = strtok($sql, "\n");
        $n = $db->exec($sql);
        if (stripos($sql, 'ALTER TABLE') === 0) {
            echo "  " . substr(preg_replace('/\s+/', ' ', $sql), 0, 88) . "\n";
        } elseif ($n > 0) {
            preg_match("/nc\.NR = '([^']+)'/", $sql, $m);
            echo "  collegata la nota " . ($m[1] ?? '?') . "\n";
        }
    }
} catch (Exception $e) {
    echo "\nERRORE: " . $e->getMessage() . "\n";
    exit(1);
}

// --- Esito ---
$scoperte = $db->query("
    SELECT NR, Data, Fatturato_TOT FROM FACT_FATTURE
     WHERE TIPO = 'Nota_Accredito' AND ID_FATTURA_STORNATA IS NULL
     ORDER BY Data
")->fetchAll(PDO::FETCH_ASSOC);

$collegate = $note - count($scoperte);
echo "\nNote collegate a una fattura ... $collegate su $note\n";

if ($scoperte) {
    echo "\nNote senza fattura collegata:\n";
    foreach ($scoperte as $r) {
        printf("  %-8s %s %14s\n", $r['NR'], $r['Data'],
            number_format((float)$r['Fatturato_TOT'], 2, ',', '.'));
    }
    echo "Da collegare a mano dalla schermata fatture: il collegamento automatico\n";
    echo "richiede stesso cliente e importi che si annullano.\n";
}

echo "\nFatture stornate:\n";
$stornate = $db->query("
    SELECT f.NR, f.Data, f.Fatturato_TOT,
           -SUM(nc.Fatturato_TOT)                       AS stornato,
           f.Fatturato_TOT + SUM(nc.Fatturato_TOT)
             - IFNULL(f.Valore_Pagato, 0)               AS residuo,
           GROUP_CONCAT(nc.NR ORDER BY nc.NR SEPARATOR ', ') AS note_di_accredito
      FROM FACT_FATTURE f
      JOIN FACT_FATTURE nc ON nc.ID_FATTURA_STORNATA = f.ID_FATTURA
     GROUP BY f.ID_FATTURA, f.NR, f.Data, f.Fatturato_TOT, f.Valore_Pagato
     ORDER BY f.Data, f.NR
")->fetchAll(PDO::FETCH_ASSOC);

$totale = 0;
foreach ($stornate as $r) {
    printf("  %-8s %s  fatturato %13s  stornato %13s  residuo %11s  <- %s\n",
        $r['NR'], $r['Data'],
        number_format((float)$r['Fatturato_TOT'], 2, ',', '.'),
        number_format((float)$r['stornato'], 2, ',', '.'),
        number_format((float)$r['residuo'], 2, ',', '.'),
        $r['note_di_accredito']);
    $totale += (float)$r['stornato'];
}
echo "  totale stornato: " . number_format($totale, 2, ',', '.') . "\n";

echo "\nCrediti aperti al netto degli storni:\n";
$aperti = $db->query("
    SELECT SUM(f.Fatturato_TOT
               + IFNULL((SELECT SUM(nc.Fatturato_TOT) FROM FACT_FATTURE nc
                          WHERE nc.ID_FATTURA_STORNATA = f.ID_FATTURA), 0)
               - IFNULL(f.Valore_Pagato, 0)) AS residuo
      FROM FACT_FATTURE f
     WHERE f.TIPO = 'Fattura' AND f.Data_Pagamento IS NULL
")->fetchColumn();
echo "  " . number_format((float)$aperti, 2, ',', '.') . "\n";

if (php_sapi_name() !== 'cli') {
    echo "</pre>";
}
