<?php
/**
 * Debug rapido per controllare task e commesse
 */

require_once 'DB/config.php';

header('Content-Type: application/json');

try {
    $db = getDatabase();
    
    echo "🔍 DEBUG DATABASE\n\n";
    
    // 1. Controllo commesse in corso
    echo "📋 COMMESSE IN CORSO:\n";
    $sqlCommesse = "SELECT ID_COMMESSA, Commessa, Stato_Commessa FROM ANA_COMMESSE WHERE Stato_Commessa = 'In corso' ORDER BY ID_COMMESSA LIMIT 5";
    $stmtCommesse = $db->query($sqlCommesse);
    $commesse = $stmtCommesse->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($commesse as $commessa) {
        echo "- {$commessa['ID_COMMESSA']}: {$commessa['Commessa']} ({$commessa['Stato_Commessa']})\n";
    }
    
    // 2. Controllo task per la prima commessa
    if (!empty($commesse)) {
        $primaCommessa = $commesse[0]['ID_COMMESSA'];
        echo "\n📝 TASK PER COMMESSA {$primaCommessa}:\n";
        
        $sqlTasks = "SELECT ID_TASK, Task, Desc_Task, Tipo, Stato_Task FROM ANA_TASK WHERE ID_COMMESSA = ? ORDER BY ID_TASK";
        $stmtTasks = $db->prepare($sqlTasks);
        $stmtTasks->execute([$primaCommessa]);
        $tasks = $stmtTasks->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($tasks)) {
            echo "❌ NESSUN TASK TROVATO!\n";
        } else {
            foreach ($tasks as $task) {
                echo "- {$task['ID_TASK']}: {$task['Task']} (Tipo: {$task['Tipo']}, Stato: {$task['Stato_Task']})\n";
            }
        }
        
        // 3. Controllo task filtrati (come nell'API)
        echo "\n🔍 TASK FILTRATI (Stato='In corso', Tipo!='Monitoraggio'):\n";
        $sqlTasksFiltrati = "SELECT ID_TASK, Task, Desc_Task, Tipo, Stato_Task 
                            FROM ANA_TASK 
                            WHERE ID_COMMESSA = ? 
                            AND Stato_Task = 'In corso' 
                            AND Tipo != 'Monitoraggio' 
                            ORDER BY Task";
        $stmtTasksFiltrati = $db->prepare($sqlTasksFiltrati);
        $stmtTasksFiltrati->execute([$primaCommessa]);
        $tasksFiltrati = $stmtTasksFiltrati->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($tasksFiltrati)) {
            echo "❌ NESSUN TASK FILTRATO TROVATO!\n";
            echo "   Possibili cause:\n";
            echo "   - Tutti i task hanno Stato_Task != 'In corso'\n";
            echo "   - Tutti i task hanno Tipo = 'Monitoraggio'\n";
        } else {
            foreach ($tasksFiltrati as $task) {
                echo "✅ {$task['ID_TASK']}: {$task['Task']} (Tipo: {$task['Tipo']})\n";
            }
        }
    }
    
    // 4. Controllo stati task esistenti
    echo "\n📊 STATI TASK ESISTENTI:\n";
    $sqlStati = "SELECT DISTINCT Stato_Task, COUNT(*) as count FROM ANA_TASK GROUP BY Stato_Task";
    $stmtStati = $db->query($sqlStati);
    $stati = $stmtStati->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($stati as $stato) {
        echo "- {$stato['Stato_Task']}: {$stato['count']} task\n";
    }
    
    // 5. Controllo tipi task esistenti
    echo "\n📊 TIPI TASK ESISTENTI:\n";
    $sqlTipi = "SELECT DISTINCT Tipo, COUNT(*) as count FROM ANA_TASK GROUP BY Tipo";
    $stmtTipi = $db->query($sqlTipi);
    $tipi = $stmtTipi->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($tipi as $tipo) {
        echo "- {$tipo['Tipo']}: {$tipo['count']} task\n";
    }
    
} catch (Exception $e) {
    echo "💥 ERRORE: " . $e->getMessage() . "\n";
}
?>