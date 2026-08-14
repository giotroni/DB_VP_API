<?php
/**
 * Migration: allinea le note di accredito alla regola
 *
 *   - importi negativi (il fatturato netto torna a essere SUM(Fatturato_TOT))
 *   - nessuna scadenza: Tempi_Pagamento e Scadenza_Pagamento a NULL
 *
 * Vedi docs/REGOLE-FATTURAZIONE.md.
 *
 * Solo dati, nessuna modifica di struttura. Sicura da rieseguire: -ABS e SET NULL
 * sono idempotenti.
 *
 * Utilizzo:
 *   php fix_note_accredito.php          (da terminale nella cartella migrations/)
 *   http://.../DB/migrations/fix_note_accredito.php  (da browser, solo localhost)
 *
 * In produzione l'esecuzione da browser e' bloccata: eseguire
 * fix_note_accredito.sql da phpMyAdmin.
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

echo "=== Migration: fix_note_accredito ===\n";
echo "Database: " . DB_NAME . "\n\n";

try {
    // --- Fotografia prima ---
    $stmt = $db->query("
        SELECT
            COUNT(*)                                          AS note,
            SUM(Fatturato_TOT > 0)                            AS con_importo_positivo,
            SUM(Scadenza_Pagamento IS NOT NULL
                OR Tempi_Pagamento IS NOT NULL)               AS con_scadenza
        FROM FACT_FATTURE WHERE TIPO = 'Nota_Accredito'
    ");
    $prima = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "Note di accredito in archivio ... {$prima['note']}\n";
    echo "  con importo positivo .......... {$prima['con_importo_positivo']}\n";
    echo "  con scadenza di incasso ....... {$prima['con_scadenza']}\n\n";

    if ($prima['note'] == 0) {
        echo "→ Nessuna nota di accredito: niente da fare.\n";
    } else {
        // --- 1. Segno ---
        $n = $db->exec("
            UPDATE FACT_FATTURE SET
                Fatturato_gg    = -ABS(Fatturato_gg),
                Fatturato_Spese = -ABS(Fatturato_Spese),
                Fatturato_TOT   = -ABS(Fatturato_TOT),
                Valore_Pagato   = -ABS(Valore_Pagato)
            WHERE TIPO = 'Nota_Accredito'
        ");
        echo "✅ Segno normalizzato ({$prima['con_importo_positivo']} note portate a negativo).\n";

        // --- 2. Scadenza ---
        $db->exec("
            UPDATE FACT_FATTURE SET
                Tempi_Pagamento    = NULL,
                Scadenza_Pagamento = NULL
            WHERE TIPO = 'Nota_Accredito'
        ");
        echo "✅ Scadenza rimossa ({$prima['con_scadenza']} note tolte dall'aging).\n";
    }

    // --- 3. Verifica ---
    $stmt = $db->query("
        SELECT COUNT(*) FROM FACT_FATTURE
        WHERE TIPO = 'Nota_Accredito'
          AND (Fatturato_TOT > 0 OR Scadenza_Pagamento IS NOT NULL OR Tempi_Pagamento IS NOT NULL)
    ");
    $residui = (int) $stmt->fetchColumn();

    $stmt = $db->query("
        SELECT
            SUM(Fatturato_TOT)                                                  AS netto,
            SUM(CASE WHEN TIPO = 'Fattura' THEN Fatturato_TOT ELSE 0 END)       AS fatture,
            SUM(CASE WHEN TIPO = 'Nota_Accredito' THEN Fatturato_TOT ELSE 0 END) AS note
        FROM FACT_FATTURE
    ");
    $tot = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "\nDopo la migration:\n";
    echo "  note ancora da correggere ..... $residui\n";
    echo "  fatturato lordo ............... " . number_format((float) $tot['fatture'], 2, ',', '.') . " €\n";
    echo "  note di accredito ............. " . number_format((float) $tot['note'], 2, ',', '.') . " €\n";
    echo "  fatturato netto ............... " . number_format((float) $tot['netto'], 2, ',', '.') . " €\n";

    if ($residui > 0) {
        echo "\n❌ Restano $residui note non allineate: controllare a mano.\n";
        exit(1);
    }

    echo "\n✅ Migration completata.\n";
    echo "   Il fatturato netto è ora SUM(Fatturato_TOT): nessuna schermata deve\n";
    echo "   più correggere il segno per conto proprio.\n";

} catch (PDOException $e) {
    echo "❌ Errore: " . $e->getMessage() . "\n";
    exit(1);
}

if (php_sapi_name() !== 'cli') echo "</pre>";
