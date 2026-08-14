<?php
/**
 * Migration: registra gli incassi mancanti su FACT_FATTURE
 *
 * Esegue allinea_incassi.sql, che sta nella stessa cartella e contiene il
 * dettaglio di ogni riga. In sintesi:
 *
 *   - 26 incassi presenti nel registro Excel e mai riportati in archivio
 *     (4 code del 2025 saldate a inizio 2026, 22 del 2026)
 *   - 3 date di incasso che divergevano: 05/24, 01/25 e la nota di credito 21/25
 *
 * Fonte: docs/Fatture/0 V&P Fatture emesse pagate etc 2025.xlsx e ...2026.xlsx,
 * foglio "Emesse", colonne A e B.
 *
 * Solo dati, nessuna modifica di struttura. Tutto in una transazione. Sicura
 * da rieseguire.
 *
 * PREREQUISITO: allinea_fatture_pdf.sql deve essere gia' stato eseguito, perche'
 * questa migration cerca le righe per numero. Il controllo e' automatico qui
 * sotto: se non e' stata eseguita, il programma si ferma senza toccare nulla.
 *
 * Utilizzo:
 *   php allinea_incassi.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/allinea_incassi.php  (da browser, solo localhost)
 *
 * In produzione l'esecuzione da browser e' bloccata: eseguire
 * allinea_incassi.sql da phpMyAdmin.
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

function fotografia($db) {
    return $db->query("
        SELECT
            (SELECT COUNT(*) FROM FACT_FATTURE WHERE Data_Pagamento IS NOT NULL)      AS incassati,
            (SELECT COUNT(*) FROM FACT_FATTURE
              WHERE Data_Pagamento IS NULL AND TIPO = 'Fattura')                      AS senza_incasso,
            (SELECT COUNT(*) FROM FACT_FATTURE
              WHERE Data_Pagamento IS NOT NULL AND Valore_Pagato <> Fatturato_TOT)    AS incoerenti
    ")->fetch(PDO::FETCH_ASSOC);
}

function stampa($titolo, $f) {
    echo "$titolo\n";
    echo "  documenti con data di incasso ....... {$f['incassati']}\n";
    echo "  fatture ancora senza incasso ........ {$f['senza_incasso']}\n";
    echo "  incassi diversi dall'imponibile ..... {$f['incoerenti']}\n\n";
}

echo "=== Migration: allinea_incassi ===\n";
echo "Database: " . DB_NAME . "\n\n";

// --- Prerequisito ---
$problemi = [];
if ($db->query("SELECT COUNT(*) FROM FACT_FATTURE WHERE NR = '1/26'")->fetchColumn() > 0) {
    $problemi[] = "esiste ancora una fattura numerata '1/26'";
}
$doppi = $db->query("
    SELECT COUNT(*) FROM (SELECT NR FROM FACT_FATTURE GROUP BY NR HAVING COUNT(*) > 1) d
")->fetchColumn();
if ($doppi > 0) {
    $problemi[] = "ci sono $doppi numeri di documento duplicati";
}
if ($problemi) {
    echo "Non posso procedere: " . implode('; ', $problemi) . ".\n";
    echo "Eseguire prima allinea_fatture_pdf.sql.\n";
    exit(1);
}

$prima = fotografia($db);
stampa("Prima:", $prima);

$file = __DIR__ . '/allinea_incassi.sql';
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
    $db->beginTransaction();

    $toccate = 0;
    foreach ($statements as $sql) {
        $n = $db->exec($sql);
        $toccate += $n;
        if ($n === 0 && preg_match("/WHERE NR = '([^']+)'/", $sql, $m)) {
            // Riga gia' allineata oppure documento assente: distinguiamo,
            // perche' il secondo caso e' un problema da guardare.
            $esiste = $db->prepare("SELECT COUNT(*) FROM FACT_FATTURE WHERE NR = ?");
            $esiste->execute([$m[1]]);
            if ($esiste->fetchColumn() == 0) {
                echo "  ATTENZIONE: nessuna fattura {$m[1]} in archivio\n";
            }
        }
    }

    $db->commit();
    echo "\nRighe modificate: $toccate\n\n";

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

echo "Fatture ancora da incassare:\n";
$aperte = $db->query("
    SELECT NR, Data, Fatturato_TOT FROM FACT_FATTURE
     WHERE Data_Pagamento IS NULL AND TIPO = 'Fattura' AND YEAR(Data) >= 2024
     ORDER BY Data
")->fetchAll(PDO::FETCH_ASSOC);
$totale = 0;
foreach ($aperte as $r) {
    printf("  %-8s %s %14s\n", $r['NR'], $r['Data'],
        number_format((float)$r['Fatturato_TOT'], 2, ',', '.'));
    $totale += (float)$r['Fatturato_TOT'];
}
printf("  %-8s %s %14s\n", '', '           ', number_format($totale, 2, ',', '.'));

echo "\nNota: le sei fatture stornate da nota di credito (03, 04, 06, 09, 10 e\n";
echo "12 del 2026) compaiono qui sopra ed e' corretto: non sono state incassate,\n";
echo "sono state annullate. A saldo pesano zero, perche' le note di credito le\n";
echo "compensano.\n";

if (php_sapi_name() !== 'cli') {
    echo "</pre>";
}
