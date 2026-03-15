<?php
require_once 'DB/config.php';

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8', DB_USER, DB_PASS);
    
    echo "=== STRUTTURA FACT_GIORNATE ===\n";
    $stmt = $pdo->query('DESCRIBE FACT_GIORNATE');
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $row['Field'] . ' | ' . $row['Type'] . "\n";
    }
    
    echo "\n=== SAMPLE DATA FACT_GIORNATE ===\n";
    $stmt = $pdo->query('SELECT * FROM FACT_GIORNATE LIMIT 3');
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
        echo "---\n";
    }
    
    echo "\n=== TEST QUERY CALCOLO VALORE ===\n";
    $stmt = $pdo->query("SELECT g.*, 
                                COALESCE(t.Tariffa_gg, 0) as tariffa_specifica,
                                COALESCE(tg.Tariffa_gg, 0) as tariffa_generale
                         FROM FACT_GIORNATE g
                         LEFT JOIN ANA_TARIFFE_COLLABORATORI t ON g.ID_COLLABORATORE = t.ID_COLLABORATORE 
                         LEFT JOIN ANA_TARIFFE_COLLABORATORI tg ON g.ID_COLLABORATORE = tg.ID_COLLABORATORE
                         WHERE g.Tipo = 'Campo'
                         LIMIT 3");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
        echo "---\n";
    }
    
} catch (Exception $e) {
    echo 'Errore: ' . $e->getMessage();
}
?>