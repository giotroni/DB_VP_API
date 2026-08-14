<?php
/**
 * Migration: allinea FACT_FATTURE alle fatture cartacee 2024-2026
 *
 * Esegue allinea_fatture_pdf.sql, che sta nella stessa cartella e contiene
 * i commenti su ogni singola correzione. In sintesi:
 *
 *   - numerazioni sbagliate: 1/26 -> 01/26, 15/25 -> 15/26
 *   - doppione FAT26005 (fattura 03/26 inserita due volte, una con data 2025)
 *   - importi: 04/24 a 3.987,50 e nota di accredito 14/26 a -27.924,75
 *   - inserimento delle fatture 39/26 e 40/26, mai registrate
 *   - riferimenti d'ordine e date ordine presi dai PDF
 *   - nota descrittiva sulle note di accredito
 *
 * Solo dati, nessuna modifica di struttura. Tutto in una transazione: o passa
 * tutto o non cambia nulla. Sicura da rieseguire.
 *
 * Utilizzo:
 *   php allinea_fatture_pdf.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/allinea_fatture_pdf.php  (da browser, solo localhost)
 *
 * In produzione l'esecuzione da browser e' bloccata: eseguire
 * allinea_fatture_pdf.sql da phpMyAdmin.
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

/** Fotografia dell'archivio, per mostrare il prima e il dopo. */
function fotografia($db) {
    $sql = "SELECT YEAR(Data) AS anno, COUNT(*) AS documenti, SUM(Fatturato_TOT) AS netto
              FROM FACT_FATTURE WHERE YEAR(Data) BETWEEN 2024 AND 2026
             GROUP BY YEAR(Data) ORDER BY anno";
    $righe = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    $extra = $db->query("
        SELECT
            (SELECT COUNT(*) FROM FACT_FATTURE
              WHERE TIPO = 'Fattura'
                AND (Riferimento_Ordine IS NULL OR Riferimento_Ordine = '')) AS senza_ordine,
            (SELECT COUNT(*) FROM (
                SELECT NR FROM FACT_FATTURE GROUP BY NR HAVING COUNT(*) > 1
             ) d)                                                            AS numeri_doppi
    ")->fetch(PDO::FETCH_ASSOC);

    return ['anni' => $righe, 'extra' => $extra];
}

function stampa($titolo, $foto) {
    echo "$titolo\n";
    foreach ($foto['anni'] as $r) {
        printf("  %s ... %2d documenti, netto %14s\n",
            $r['anno'], $r['documenti'], number_format((float)$r['netto'], 2, ',', '.'));
    }
    echo "  fatture senza riferimento d'ordine ... {$foto['extra']['senza_ordine']}\n";
    echo "  numeri di documento duplicati ....... {$foto['extra']['numeri_doppi']}\n\n";
}

echo "=== Migration: allinea_fatture_pdf ===\n";
echo "Database: " . DB_NAME . "\n\n";

$prima = fotografia($db);
stampa("Prima:", $prima);

$file = __DIR__ . '/allinea_fatture_pdf.sql';
if (!is_readable($file)) {
    die("File non trovato: $file\n");
}

// Lo .sql non contiene punti e virgola dentro le stringhe, quindi si puo'
// spezzare sul separatore senza parser.
$statements = [];
foreach (explode(';', file_get_contents($file)) as $pezzo) {
    // Via i commenti riga per riga: restano solo le istruzioni.
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
    $db->beginTransaction();

    $toccate = 0;
    foreach ($statements as $i => $sql) {
        $n = $db->exec($sql);
        $toccate += $n;
        if ($n > 0) {
            $prima_riga = strtok($sql, "\n");
            printf("  [%2d] %-70s %d riga/e\n", $i + 1, substr($prima_riga, 0, 70), $n);
        }
    }

    $db->commit();
    echo "\nRighe modificate in totale: $toccate\n\n";

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo "\nERRORE: " . $e->getMessage() . "\n";
    echo "Nessuna modifica applicata (rollback).\n";
    exit(1);
}

$dopo = fotografia($db);
stampa("Dopo:", $dopo);

// I totali attesi dai PDF in docs/Fatture.
$attesi = ['2024' => 13705.50, '2025' => 312163.50, '2026' => 401687.50];
$conteggi = ['2024' => 5, '2025' => 44, '2026' => 40];
$ok = true;
echo "Controllo contro i PDF:\n";
foreach ($dopo['anni'] as $r) {
    $anno = (string)$r['anno'];
    if (!isset($attesi[$anno])) continue;
    $delta = round((float)$r['netto'] - $attesi[$anno], 2);
    $esito = ($delta == 0.0 && (int)$r['documenti'] === $conteggi[$anno]) ? 'OK' : 'DA VERIFICARE';
    if ($esito !== 'OK') $ok = false;
    printf("  %s ... %s (documenti %d/%d, scarto %s)\n",
        $anno, $esito, $r['documenti'], $conteggi[$anno],
        number_format($delta, 2, ',', '.'));
}

echo "\n" . ($ok
    ? "Archivio allineato ai PDF.\n"
    : "Restano differenze: vedi i commenti in allinea_fatture_pdf.sql (cliente Galbani, data della 37/26).\n");

if (php_sapi_name() !== 'cli') {
    echo "</pre>";
}
