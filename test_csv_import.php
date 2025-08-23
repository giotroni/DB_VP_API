<?php
/**
 * Test importazione file FACT_GIORNATE_TEST.csv
 */

require_once 'DB/config.php';

echo "<h2>Test Importazione FACT_GIORNATE_TEST.csv</h2>";

try {
    $db = getDatabase();
    
    // Leggi il file CSV di test
    $csvFile = 'DB/Dati/FACT_GIORNATE_TEST.csv';
    
    if (!file_exists($csvFile)) {
        throw new Exception("File CSV non trovato: $csvFile");
    }
    
    echo "<h3>1. Analisi File CSV</h3>";
    $handle = fopen($csvFile, 'r');
    $headers = fgetcsv($handle, 0, ';');
    
    echo "<p><strong>Headers trovati:</strong></p>";
    echo "<ul>";
    foreach ($headers as $i => $header) {
        echo "<li>[$i] $header</li>";
    }
    echo "</ul>";
    
    // Trova la colonna Spese_Fatturate_VP
    $speseFattIndex = array_search('Spese_Fatturate_VP', $headers);
    if ($speseFattIndex !== false) {
        echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "✅ Colonna 'Spese_Fatturate_VP' trovata all'indice $speseFattIndex";
        echo "</div>";
    } else {
        echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "❌ Colonna 'Spese_Fatturate_VP' non trovata";
        echo "</div>";
    }
    
    echo "<h3>2. Analisi Dati</h3>";
    echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
    echo "<tr>";
    foreach ($headers as $header) {
        echo "<th>$header</th>";
    }
    echo "</tr>";
    
    $rowCount = 0;
    while (($row = fgetcsv($handle, 0, ';')) !== FALSE && $rowCount < 5) {
        echo "<tr>";
        foreach ($row as $i => $value) {
            // Evidenzia il campo Spese_Fatturate_V&P
            if ($i === $speseFattIndex) {
                echo "<td style='background-color: #fff3cd;'><strong>$value</strong></td>";
            } else {
                echo "<td>$value</td>";
            }
        }
        echo "</tr>";
        $rowCount++;
    }
    echo "</table>";
    
    fclose($handle);
    
    echo "<h3>3. Test Conversione Decimali</h3>";
    echo "<p>Simulazione conversione valori dal CSV:</p>";
    
    $handle = fopen($csvFile, 'r');
    fgetcsv($handle, 0, ';'); // Skip headers
    
    echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
    echo "<tr><th>ID_GIORNATA</th><th>Spese_Fatturate_VP (originale)</th><th>Convertito</th></tr>";
    
    while (($row = fgetcsv($handle, 0, ';')) !== FALSE) {
        $id = $row[0];
        $speseFatt = $row[$speseFattIndex];
        $converted = str_replace(',', '.', $speseFatt);
        
        echo "<tr>";
        echo "<td>$id</td>";
        echo "<td>$speseFatt</td>";
        echo "<td style='background-color: #d4edda;'>$converted</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    fclose($handle);
    
    echo "<h3>4. Verifica Struttura Database</h3>";
    
    // Verifica se la colonna esiste nella tabella
    $stmt = $db->query("DESCRIBE FACT_GIORNATE");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $speseFattExists = false;
    echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
    echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Default</th></tr>";
    
    foreach ($columns as $column) {
        $highlight = '';
        if ($column['Field'] === 'Spese_Fatturate_VP') {
            $speseFattExists = true;
            $highlight = "style='background-color: #d4edda;'";
        }
        
        echo "<tr $highlight>";
        echo "<td>{$column['Field']}</td>";
        echo "<td>{$column['Type']}</td>";
        echo "<td>{$column['Null']}</td>";
        echo "<td>{$column['Default']}</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    if ($speseFattExists) {
        echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "✅ Campo 'Spese_Fatturate_VP' presente nella tabella FACT_GIORNATE";
        echo "</div>";
    } else {
        echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "❌ Campo 'Spese_Fatturate_VP' NON presente nella tabella FACT_GIORNATE<br>";
        echo "Eseguire prima: <strong>php DB/setup.php</strong>";
        echo "</div>";
    }
    
} catch (Exception $e) {
    echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "❌ Errore: " . $e->getMessage();
    echo "</div>";
}
?>