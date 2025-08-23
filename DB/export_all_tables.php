<?php
/**
 * Script per l'esportazione di tutte le tabelle del database in file CSV
 * Formato italiano: punto e virgola come separatore, virgola per decimali
 */

require_once 'config.php';

try {
    $db = getDatabase();
    
    // Crea la cartella Export se non esiste
    $exportDir = __DIR__ . '/Export';
    if (!is_dir($exportDir)) {
        mkdir($exportDir, 0755, true);
        echo "Cartella Export creata.<br>";
    }
    
    // Ottieni lista di tutte le tabelle
    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    
    echo "<h2>Esportazione Tabelle Database</h2>";
    echo "Data esportazione: " . date('Y-m-d H:i:s') . "<br><br>";
    
    $totalRecords = 0;
    $exportedTables = 0;
    
    foreach ($tables as $table) {
        echo "<h3>Esportazione tabella: {$table}</h3>";
        
        // Ottieni i dati della tabella
        $stmt = $db->query("SELECT * FROM `{$table}`");
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($data)) {
            echo "Tabella vuota - saltata<br><br>";
            continue;
        }
        
        // Nome file CSV
        $filename = $exportDir . '/' . $table . '.csv';
        
        // Apri file per scrittura
        $file = fopen($filename, 'w');
        
        if (!$file) {
            echo "Errore: impossibile creare il file {$filename}<br><br>";
            continue;
        }
        
        // Funzione per formattare i numeri in formato italiano
        $formatNumber = function($value) {
            if (is_numeric($value) && strpos($value, '.') !== false) {
                return str_replace('.', ',', $value);
            }
            return $value;
        };
        
        // Scrivi intestazioni (nomi colonne)
        $headers = array_keys($data[0]);
        fputcsv($file, $headers, ';');
        
        // Scrivi i dati
        $recordCount = 0;
        foreach ($data as $row) {
            // Converti numeri decimali in formato italiano
            $formattedRow = array_map($formatNumber, $row);
            fputcsv($file, $formattedRow, ';');
            $recordCount++;
        }
        
        fclose($file);
        
        echo "✓ Esportati {$recordCount} record in: " . basename($filename) . "<br>";
        echo "Dimensione file: " . formatBytes(filesize($filename)) . "<br><br>";
        
        $totalRecords += $recordCount;
        $exportedTables++;
    }
    
    echo "<hr>";
    echo "<h3>Riepilogo Esportazione</h3>";
    echo "Tabelle esportate: {$exportedTables}<br>";
    echo "Record totali esportati: {$totalRecords}<br>";
    echo "Cartella destinazione: " . realpath($exportDir) . "<br>";
    
    // Lista dei file creati
    echo "<br><h4>File creati:</h4>";
    echo "<ul>";
    $files = glob($exportDir . '/*.csv');
    foreach ($files as $file) {
        $size = formatBytes(filesize($file));
        $modified = date('Y-m-d H:i:s', filemtime($file));
        echo "<li><strong>" . basename($file) . "</strong> - {$size} - {$modified}</li>";
    }
    echo "</ul>";
    
    // Crea anche un file di log
    $logFile = $exportDir . '/export_log_' . date('Y-m-d_H-i-s') . '.txt';
    $logContent = "Esportazione Database - " . date('Y-m-d H:i:s') . "\n";
    $logContent .= "========================================\n";
    $logContent .= "Tabelle esportate: {$exportedTables}\n";
    $logContent .= "Record totali: {$totalRecords}\n\n";
    
    foreach ($tables as $table) {
        $count = $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
        $logContent .= "{$table}: {$count} record\n";
    }
    
    file_put_contents($logFile, $logContent);
    echo "<br>Log salvato in: " . basename($logFile);
    
} catch (Exception $e) {
    echo "<div style='color: red;'>";
    echo "<h3>Errore durante l'esportazione:</h3>";
    echo $e->getMessage();
    echo "</div>";
}

/**
 * Formatta la dimensione del file in formato leggibile
 */
function formatBytes($size, $precision = 2) {
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
        $size /= 1024;
    }
    
    return round($size, $precision) . ' ' . $units[$i];
}
?>

<style>
body {
    font-family: Arial, sans-serif;
    max-width: 1200px;
    margin: 20px auto;
    padding: 20px;
    background-color: #f5f5f5;
}

h2, h3, h4 {
    color: #333;
}

h3 {
    border-bottom: 2px solid #007bff;
    padding-bottom: 5px;
}

ul {
    background-color: white;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

li {
    margin: 5px 0;
    padding: 5px;
    border-bottom: 1px solid #eee;
}

hr {
    margin: 30px 0;
    border: none;
    border-top: 3px solid #007bff;
}
</style>