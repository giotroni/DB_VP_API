<?php
/**
 * Test specifico per il file FACT_GIORNATE.csv reale
 */

require_once 'DB/config.php';

echo "<h2>Test File FACT_GIORNATE.csv Reale</h2>";

try {
    $csvFile = 'DB/Dati/FACT_GIORNATE.csv';
    
    if (!file_exists($csvFile)) {
        throw new Exception("File CSV non trovato: $csvFile");
    }
    
    echo "<h3>1. Analisi Struttura File</h3>";
    $handle = fopen($csvFile, 'r');
    $headers = fgetcsv($handle, 0, ';');
    
    echo "<p><strong>Headers del file CSV:</strong></p>";
    echo "<div style='font-family: monospace; background-color: #f8f9fa; padding: 10px; border-radius: 5px;'>";
    foreach ($headers as $i => $header) {
        $highlight = ($header === 'Spese_Fatturate_VP') ? 'background-color: #fff3cd; font-weight: bold;' : '';
        echo "<span style='$highlight'>[$i] $header</span><br>";
    }
    echo "</div>";
    
    // Trova la colonna Spese_Fatturate_VP
    $speseFattIndex = array_search('Spese_Fatturate_VP', $headers);
    
    if ($speseFattIndex !== false) {
        echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "✅ Campo 'Spese_Fatturate_VP' trovato alla posizione $speseFattIndex";
        echo "</div>";
        
        echo "<h3>2. Analisi Valori del Campo</h3>";
        
        // Analizza i primi 20 record
        $valoriAnalizzati = [];
        $recordCount = 0;
        $valoriVuoti = 0;
        $valoriConVirgola = 0;
        $valoriNumerici = 0;
        
        while (($row = fgetcsv($handle, 0, ';')) !== FALSE && $recordCount < 50) {
            $valore = $row[$speseFattIndex];
            
            if (empty($valore)) {
                $valoriVuoti++;
            } elseif (strpos($valore, ',') !== false) {
                $valoriConVirgola++;
                $valoriAnalizzati[] = $valore . ' → ' . str_replace(',', '.', $valore);
            } elseif (is_numeric($valore)) {
                $valoriNumerici++;
                $valoriAnalizzati[] = $valore . ' (già numerico)';
            } else {
                $valoriAnalizzati[] = $valore . ' (non numerico)';
            }
            
            $recordCount++;
        }
        
        echo "<p><strong>Statistiche sui primi $recordCount record:</strong></p>";
        echo "<ul>";
        echo "<li>Valori vuoti: $valoriVuoti</li>";
        echo "<li>Valori con virgola: $valoriConVirgola</li>";
        echo "<li>Valori numerici: $valoriNumerici</li>";
        echo "</ul>";
        
        if (!empty($valoriAnalizzati)) {
            echo "<p><strong>Esempi di conversioni:</strong></p>";
            echo "<div style='font-family: monospace; background-color: #f8f9fa; padding: 10px; border-radius: 5px; max-height: 200px; overflow-y: auto;'>";
            foreach (array_slice($valoriAnalizzati, 0, 10) as $esempio) {
                echo "$esempio<br>";
            }
            if (count($valoriAnalizzati) > 10) {
                echo "... e altri " . (count($valoriAnalizzati) - 10) . " valori<br>";
            }
            echo "</div>";
        }
        
    } else {
        echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "❌ Campo 'Spese_Fatturate_VP' NON trovato nel file CSV!<br>";
        echo "Campi disponibili: " . implode(', ', $headers);
        echo "</div>";
    }
    
    fclose($handle);
    
    echo "<h3>3. Verifica Compatibilità Database</h3>";
    
    $db = getDatabase();
    $stmt = $db->query("SHOW COLUMNS FROM FACT_GIORNATE LIKE 'Spese_Fatturate_VP'");
    $column = $stmt->fetch();
    
    if ($column) {
        echo "<div style='background-color: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "✅ Campo 'Spese_Fatturate_VP' presente nel database<br>";
        echo "<strong>Tipo:</strong> {$column['Type']}<br>";
        echo "<strong>Null:</strong> {$column['Null']}<br>";
        echo "<strong>Default:</strong> {$column['Default']}";
        echo "</div>";
    } else {
        echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "❌ Campo 'Spese_Fatturate_VP' NON presente nel database<br>";
        echo "Eseguire: <code>php DB/setup.php</code>";
        echo "</div>";
    }
    
    echo "<h3>4. Test Importazione</h3>";
    if ($speseFattIndex !== false && $column) {
        echo "<div style='background-color: #d1ecf1; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "🔄 <strong>Pronto per l'importazione!</strong><br>";
        echo "Eseguire: <code>php DB/import_csv.php</code><br>";
        echo "Il sistema convertirà automaticamente i valori con virgola in valori decimali validi.";
        echo "</div>";
    } else {
        echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
        echo "❌ Importazione non possibile. Verificare i problemi sopra riportati.";
        echo "</div>";
    }
    
} catch (Exception $e) {
    echo "<div style='background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px;'>";
    echo "❌ Errore: " . $e->getMessage();
    echo "</div>";
}
?>