<?php
/**
 * Migration: i documenti commerciali (offerte e ordini) come entita' propria
 *
 * Esegue add_documenti_commerciali.sql, che sta nella stessa cartella:
 *
 *   - crea ANA_DOCUMENTI_COMMERCIALI, una tabella sola per offerte e ordini
 *   - aggiunge FACT_FATTURE.ID_DOCUMENTO (nullable in questa fase) e Natura
 *   - aggiunge ANA_COMMESSE.Importo_Previsto ed elimina i due campi documento
 *   - aggiunge ANA_CLIENTI.Codice_Fiscale
 *
 * Fase 1 del progetto commesse-ordini. Vedi docs/PROGETTO-COMMESSE-ORDINI.md.
 *
 * SOLO STRUTTURA: nessun dato viene scritto e nessuna schermata cambia, quindi
 * si puo' rilasciare da sola.
 *
 * Un passaggio e' distruttivo: ANA_COMMESSE perde Documento_Offerta e
 * Documento_Ordine. Questo runner si ferma prima di toccarli se risultano
 * compilati su almeno una commessa, e stampa quali. Eseguendo il .sql a mano
 * da phpMyAdmin il controllo non c'e': va fatto prima.
 *
 * La DDL non e' annullabile con un rollback: backup delle tabelle prima di
 * eseguirla in produzione. Sicura da rieseguire (IF NOT EXISTS / IF EXISTS).
 *
 * Utilizzo:
 *   php add_documenti_commerciali.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/add_documenti_commerciali.php  (da browser, solo localhost)
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

echo "=== Migration: add_documenti_commerciali ===\n";
echo "Database: " . DB_NAME . "\n\n";

// --- Il controllo che protegge il passaggio distruttivo ---
//
// I due campi vanno eliminati, ma solo perche' non li ha mai usati nessuno.
// Se in produzione qualcuno li avesse compilati nel frattempo, l'eliminazione
// butterebbe via un dato senza dirlo.

$colonne = $db->query("
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ANA_COMMESSE'
       AND COLUMN_NAME IN ('Documento_Offerta', 'Documento_Ordine')
")->fetchAll(PDO::FETCH_COLUMN);

if ($colonne) {
    $compilate = $db->query("
        SELECT ID_COMMESSA, Commessa, Documento_Offerta, Documento_Ordine
          FROM ANA_COMMESSE
         WHERE Documento_Offerta IS NOT NULL AND Documento_Offerta <> ''
            OR Documento_Ordine  IS NOT NULL AND Documento_Ordine  <> ''
         ORDER BY ID_COMMESSA
    ")->fetchAll(PDO::FETCH_ASSOC);

    if ($compilate) {
        echo "FERMO: i due campi documento di ANA_COMMESSE sono compilati su "
             . count($compilate) . " commesse.\n\n";
        foreach ($compilate as $r) {
            printf("  %-12s %-40s %s | %s\n", $r['ID_COMMESSA'],
                substr((string)$r['Commessa'], 0, 40),
                $r['Documento_Offerta'] ?: '-', $r['Documento_Ordine'] ?: '-');
        }
        echo "\nLa migration li eliminerebbe. Vanno prima riportati sulla tabella\n";
        echo "dei documenti, oppure annotati altrove se non servono piu'.\n";
        exit(1);
    }
    echo "Campi documento su ANA_COMMESSE ... vuoti su tutte le commesse, si possono eliminare\n";
} else {
    echo "Campi documento su ANA_COMMESSE ... gia' eliminati\n";
}

$commesse = $db->query("SELECT COUNT(*) FROM ANA_COMMESSE")->fetchColumn();
$fatture  = $db->query("SELECT COUNT(*) FROM FACT_FATTURE")->fetchColumn();
echo "Commesse in archivio ........... $commesse\n";
echo "Fatture in archivio ............ $fatture\n\n";

// --- Esecuzione ---

$file = __DIR__ . '/add_documenti_commerciali.sql';
if (!is_readable($file)) {
    die("File non trovato: $file\n");
}

// I commenti si tolgono PRIMA di spezzare sui punto e virgola, non dopo: le
// note in testa al file contengono query di esempio, e un ';' dentro un
// commento spezzerebbe l'istruzione lasciando fuori mezza frase di prosa.
$righe = array_filter(explode("\n", file_get_contents($file)), function ($r) {
    return strpos(ltrim($r), '--') !== 0;
});

$statements = [];
foreach (explode(';', implode("\n", $righe)) as $pezzo) {
    $sql = trim($pezzo);
    if ($sql !== '') {
        $statements[] = $sql;
    }
}

echo "Istruzioni da eseguire: " . count($statements) . "\n\n";

try {
    foreach ($statements as $sql) {
        $db->exec($sql);
        echo "  " . substr(preg_replace('/\s+/', ' ', $sql), 0, 88) . "\n";
    }
} catch (Exception $e) {
    echo "\nERRORE: " . $e->getMessage() . "\n";
    exit(1);
}

// --- Esito ---

echo "\n--- Struttura risultante ---\n";

$attese = [
    'ANA_DOCUMENTI_COMMERCIALI' => ['ID_DOCUMENTO', 'Tipo', 'ID_PADRE', 'ID_COMMESSA',
        'Tipo_Importo', 'Importo', 'ID_CLIENTE_INTESTATARIO', 'Stato', 'Ordine_Atteso'],
    'FACT_FATTURE'  => ['ID_DOCUMENTO', 'Natura'],
    'ANA_COMMESSE'  => ['Importo_Previsto'],
    'ANA_CLIENTI'   => ['Codice_Fiscale'],
];

$mancanti = 0;
foreach ($attese as $tabella => $campi) {
    $presenti = $db->query("
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = " . $db->quote($tabella)
    )->fetchAll(PDO::FETCH_COLUMN);

    foreach ($campi as $campo) {
        $ok = in_array($campo, $presenti);
        printf("  %-28s %-26s %s\n", $tabella, $campo, $ok ? 'ok' : 'MANCANTE');
        if (!$ok) { $mancanti++; }
    }
}

$rimaste = $db->query("
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ANA_COMMESSE'
       AND COLUMN_NAME IN ('Documento_Offerta', 'Documento_Ordine')
")->fetchColumn();
printf("  %-28s %-26s %s\n", 'ANA_COMMESSE', 'Documento_Offerta/Ordine',
    $rimaste == 0 ? 'eliminati' : "ANCORA PRESENTI ($rimaste)");
if ($rimaste != 0) { $mancanti++; }

// --- Nulla deve essere cambiato nei dati ---

$commesse_dopo = $db->query("SELECT COUNT(*) FROM ANA_COMMESSE")->fetchColumn();
$fatture_dopo  = $db->query("SELECT COUNT(*) FROM FACT_FATTURE")->fetchColumn();
$documenti     = $db->query("SELECT COUNT(*) FROM ANA_DOCUMENTI_COMMERCIALI")->fetchColumn();

echo "\n--- Dati ---\n";
printf("  commesse ..... %d %s\n", $commesse_dopo, $commesse_dopo == $commesse ? '(invariate)' : '*** CAMBIATE ***');
printf("  fatture ...... %d %s\n", $fatture_dopo,  $fatture_dopo  == $fatture  ? '(invariate)' : '*** CAMBIATE ***');
printf("  documenti .... %d (li compila la fase 4)\n", $documenti);

if ($mancanti > 0 || $commesse_dopo != $commesse || $fatture_dopo != $fatture) {
    echo "\nMigration NON completata correttamente.\n";
    exit(1);
}

echo "\nMigration completata. Nessuna schermata cambia: la tabella e' vuota e\n";
echo "ID_DOCUMENTO sulla fattura e' ancora nullable. Diventa obbligatorio a\n";
echo "backfill completo, non prima.\n";

if (php_sapi_name() !== 'cli') {
    echo "</pre>";
}
