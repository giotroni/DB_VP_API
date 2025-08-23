<?php
/**
 * Test script per verificare il calcolo delle statistiche
 */

require_once 'DB/config.php';

try {
    $db = getDatabase();
    
    echo "<h2>Test Calcolo Statistiche</h2>";
    
    // Test query originale (problema)
    echo "<h3>Query originale (possibile problema):</h3>";
    $sql_old = "SELECT 
                    COALESCE(SUM(Spese_Viaggi + Vitto_alloggio + Altri_costi), 0) as spese_mese,
                    COALESCE(SUM(Spese_Fatturate_VP), 0) as spese_fatturate_vp
                 FROM FACT_GIORNATE 
                 WHERE MONTH(Data) = MONTH(CURDATE()) 
                 AND YEAR(Data) = YEAR(CURDATE())";
    
    $stmt_old = $db->prepare($sql_old);
    $stmt_old->execute();
    $result_old = $stmt_old->fetch();
    
    echo "Spese del mese (vecchia query): " . $result_old['spese_mese'] . "<br>";
    echo "Spese fatturate VP (vecchia query): " . $result_old['spese_fatturate_vp'] . "<br>";
    echo "Spese rimborsabili (vecchia query): " . ($result_old['spese_mese'] - $result_old['spese_fatturate_vp']) . "<br><br>";
    
    // Test query corretta
    echo "<h3>Query corretta (dovrebbe funzionare):</h3>";
    $sql_new = "SELECT 
                    COALESCE(SUM(COALESCE(Spese_Viaggi, 0) + COALESCE(Vitto_alloggio, 0) + COALESCE(Altri_costi, 0)), 0) as spese_mese,
                    COALESCE(SUM(COALESCE(Spese_Fatturate_VP, 0)), 0) as spese_fatturate_vp
                 FROM FACT_GIORNATE 
                 WHERE MONTH(Data) = MONTH(CURDATE()) 
                 AND YEAR(Data) = YEAR(CURDATE())";
    
    $stmt_new = $db->prepare($sql_new);
    $stmt_new->execute();
    $result_new = $stmt_new->fetch();
    
    echo "Spese del mese (nuova query): " . $result_new['spese_mese'] . "<br>";
    echo "Spese fatturate VP (nuova query): " . $result_new['spese_fatturate_vp'] . "<br>";
    echo "Spese rimborsabili (nuova query): " . ($result_new['spese_mese'] - $result_new['spese_fatturate_vp']) . "<br><br>";
    
    // Dettaglio delle singole consuntivazioni
    echo "<h3>Dettaglio consuntivazioni del mese corrente:</h3>";
    $sql_detail = "SELECT 
                      Data,
                      COALESCE(Spese_Viaggi, 0) as Spese_Viaggi,
                      COALESCE(Vitto_alloggio, 0) as Vitto_alloggio,
                      COALESCE(Altri_costi, 0) as Altri_costi,
                      COALESCE(Spese_Fatturate_VP, 0) as Spese_Fatturate_VP,
                      (COALESCE(Spese_Viaggi, 0) + COALESCE(Vitto_alloggio, 0) + COALESCE(Altri_costi, 0)) as Totale_Spese
                   FROM FACT_GIORNATE 
                   WHERE MONTH(Data) = MONTH(CURDATE()) 
                   AND YEAR(Data) = YEAR(CURDATE())
                   ORDER BY Data DESC";
    
    $stmt_detail = $db->prepare($sql_detail);
    $stmt_detail->execute();
    $details = $stmt_detail->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<table border='1' style='border-collapse: collapse;'>";
    echo "<tr><th>Data</th><th>Viaggi</th><th>Vitto</th><th>Altre</th><th>Fatturate VP</th><th>Totale</th><th>Rimborsabili</th></tr>";
    
    $totale_generale = 0;
    $totale_fatturate = 0;
    
    foreach ($details as $row) {
        $totale_riga = $row['Totale_Spese'];
        $fatturate_riga = $row['Spese_Fatturate_VP'];
        $rimborsabili_riga = $totale_riga - $fatturate_riga;
        
        $totale_generale += $totale_riga;
        $totale_fatturate += $fatturate_riga;
        
        echo "<tr>";
        echo "<td>" . $row['Data'] . "</td>";
        echo "<td>€ " . number_format($row['Spese_Viaggi'], 2) . "</td>";
        echo "<td>€ " . number_format($row['Vitto_alloggio'], 2) . "</td>";
        echo "<td>€ " . number_format($row['Altri_costi'], 2) . "</td>";
        echo "<td>€ " . number_format($row['Spese_Fatturate_VP'], 2) . "</td>";
        echo "<td>€ " . number_format($totale_riga, 2) . "</td>";
        echo "<td>€ " . number_format($rimborsabili_riga, 2) . "</td>";
        echo "</tr>";
    }
    
    echo "<tr style='font-weight: bold; background-color: #f0f0f0;'>";
    echo "<td>TOTALE</td>";
    echo "<td colspan='4'></td>";
    echo "<td>€ " . number_format($totale_generale, 2) . "</td>";
    echo "<td>€ " . number_format($totale_generale - $totale_fatturate, 2) . "</td>";
    echo "</tr>";
    echo "</table>";
    
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}
?>