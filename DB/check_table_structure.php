<?php
require_once 'config.php';

try {
    $db = getDatabase();
    $stmt = $db->query('DESCRIBE ANA_COLLABORATORI');
    
    echo "Struttura tabella ANA_COLLABORATORI:\n";
    echo "=====================================\n";
    
    while ($row = $stmt->fetch()) {
        echo $row['Field'] . " - " . $row['Type'] . "\n";
    }
    
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}
?>