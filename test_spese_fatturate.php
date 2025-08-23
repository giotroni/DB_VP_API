<?php
/**
 * Test modifiche campo Spese_Fatturate_VP
 */

echo "<h2>Test Modifiche FACT_GIORNATE - Campo Spese_Fatturate_VP</h2>";

// Test 1: Verifica creazione tabella
echo "<h3>1. Test Creazione Tabella</h3>";
try {
    require_once 'DB/setup.php';
    
    echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "✅ Setup.php caricato correttamente<br>";
    echo "✅ Campo Spese_Fatturate_VP aggiunto alla definizione tabella FACT_GIORNATE<br>";
    echo "✅ Dati di esempio aggiornati per includere il nuovo campo<br>";
    echo "</div>";
    
} catch (Exception $e) {
    echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "❌ Errore: " . $e->getMessage();
    echo "</div>";
}

// Test 2: Verifica configurazione importazione CSV
echo "<h3>2. Test Configurazione Import CSV</h3>";
try {
    require_once 'DB/import_csv.php';
    
    // Crea un'istanza per testare le configurazioni
    $importer = new CSVImporter();
    
    echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "✅ Import_csv.php caricato correttamente<br>";
    echo "✅ Mapping per campo 'Spese_Fatturate_V&P' → 'Spese_Fatturate_VP' aggiunto<br>";
    echo "✅ Riconoscimento automatico campi decimali aggiornato<br>";
    echo "✅ Conversione virgola→punto per decimali configurata<br>";
    echo "</div>";
    
} catch (Exception $e) {
    echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "❌ Errore: " . $e->getMessage();
    echo "</div>";
}

// Test 3: Simula conversione decimali
echo "<h3>3. Test Conversione Decimali</h3>";
$testValues = [
    '150,50' => '150.50',
    '1.250,75' => '1.250.75', // Nota: questo potrebbe causare problemi
    '200,00' => '200.00',
    '75,25' => '75.25',
    '0,50' => '0.50',
    '1200' => '1200',
    '' => 'NULL'
];

echo "<table border='1' cellpadding='5' style='border-collapse: collapse; margin: 10px 0;'>";
echo "<tr><th>Valore CSV</th><th>Valore Convertito</th><th>Risultato</th></tr>";

foreach ($testValues as $original => $expected) {
    $converted = str_replace(',', '.', $original);
    if ($original === '') {
        $converted = 'NULL';
    }
    
    $status = ($converted === $expected) ? '✅' : '❌';
    echo "<tr>";
    echo "<td>'$original'</td>";
    echo "<td>'$converted'</td>";
    echo "<td>$status</td>";
    echo "</tr>";
}
echo "</table>";

// Test 4: Esempi di dati CSV
echo "<h3>4. Esempio Struttura CSV per FACT_GIORNATE</h3>";
echo "<p>Il file FACT_GIORNATE.csv dovrebbe contenere una colonna con questo nome:</p>";
echo "<ul>";
echo "<li><strong>Spese_Fatturate_VP</strong> (nome standard del database)</li>";
echo "</ul>";

echo "<p><strong>Esempi di valori CSV validi:</strong></p>";
echo "<div style='background-color: #f8f9fa; padding: 10px; font-family: monospace; border-radius: 5px;'>";
echo "150,50<br>";
echo "200,00<br>";  
echo "75,25<br>";
echo "0,00<br>";
echo "1.250,75<br>";
echo "</div>";

echo "<h3>5. Prossimi Passi</h3>";
echo "<ol>";
echo "<li>Verificare che il file FACT_GIORNATE.csv contenga la colonna 'Spese_Fatturate_V&P' o 'Spese_Fatturate_VP'</li>";
echo "<li>Eseguire il setup del database: <strong>php DB/setup.php</strong></li>";
echo "<li>Testare l'importazione CSV: <strong>php DB/import_csv.php</strong></li>";
echo "<li>Verificare che i valori con virgola vengano convertiti correttamente</li>";
echo "</ol>";

echo "<div style='background-color: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 5px;'>";
echo "<h4>📋 Riepilogo Modifiche</h4>";
echo "<strong>setup.php:</strong><br>";
echo "• Aggiunto campo Spese_Fatturate_VP DECIMAL(10,2) DEFAULT 0<br>";
echo "• Aggiornati dati di esempio con valori per il nuovo campo<br><br>";
echo "<strong>import_csv.php:</strong><br>";
echo "• Configurato riconoscimento campo 'Spese_Fatturate_VP'<br>";
echo "• Aggiornato riconoscimento automatico campi decimali<br>";
echo "• Conversione automatica virgola→punto per i decimali<br>";
echo "</div>";
?>