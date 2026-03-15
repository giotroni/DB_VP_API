<?php
/**
 * Test script per verificare il calcolo del "Costo gg"
 */

// Cambia la directory di lavoro per evitare problemi con i percorsi relativi negli include
chdir(__DIR__);
require_once 'DB/config.php';

try {
    $db = getDatabase();
    
    echo "<h2>Test Calcolo Costo Giornaliero (Costo gg)</h2>";
    
    // Simuliamo un utente autenticato (usa l'ID del primo collaboratore per il test)
    $sql_user = "SELECT ID_COLLABORATORE, Collaboratore FROM ANA_COLLABORATORI LIMIT 1";
    $stmt_user = $db->prepare($sql_user);
    $stmt_user->execute();
    $user = $stmt_user->fetch();
    
    if (!$user) {
        echo "Nessun collaboratore trovato nel database.";
        exit;
    }
    
    echo "<h3>Test per collaboratore: " . $user['Collaboratore'] . " (ID: " . $user['ID_COLLABORATORE'] . ")</h3>";
    
    // Verifica le tariffe disponibili per questo collaboratore
    echo "<h4>Tariffe disponibili per il collaboratore:</h4>";
    $sql_tariffe = "SELECT 
                       t.ID_TARIFFA,
                       t.ID_COMMESSA,
                       t.Tariffa_gg,
                       t.Dal,
                       c.Commessa,
                       CASE 
                           WHEN t.ID_COMMESSA IS NULL THEN 'Tariffa Standard'
                           ELSE CONCAT('Tariffa Specifica: ', c.Commessa)
                       END as Tipo_Tariffa
                    FROM ANA_TARIFFE_COLLABORATORI t
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    WHERE t.ID_COLLABORATORE = ?
                    ORDER BY t.Dal DESC";
    
    $stmt_tariffe = $db->prepare($sql_tariffe);
    $stmt_tariffe->execute([$user['ID_COLLABORATORE']]);
    $tariffe = $stmt_tariffe->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<table border='1' style='border-collapse: collapse;'>";
    echo "<tr><th>ID Tariffa</th><th>Tipo</th><th>Commessa</th><th>Tariffa/gg</th><th>Dal</th></tr>";
    
    foreach ($tariffe as $tariffa) {
        echo "<tr>";
        echo "<td>" . $tariffa['ID_TARIFFA'] . "</td>";
        echo "<td>" . $tariffa['Tipo_Tariffa'] . "</td>";
        echo "<td>" . ($tariffa['Commessa'] ?? 'N/A') . "</td>";
        echo "<td>€ " . number_format($tariffa['Tariffa_gg'], 2) . "</td>";
        echo "<td>" . $tariffa['Dal'] . "</td>";
        echo "</tr>";
    }
    echo "</table><br>";
    
    // Test del calcolo del Costo gg per il mese corrente
    echo "<h4>Calcolo Costo gg per il mese corrente:</h4>";
    
    $sql_costo = "SELECT 
                    SUM(
                        g.gg * COALESCE(
                            -- Tariffa specifica per commessa se esiste
                            (SELECT tc.Tariffa_gg 
                             FROM ANA_TARIFFE_COLLABORATORI tc
                             WHERE tc.ID_COLLABORATORE = g.ID_COLLABORATORE
                             AND tc.ID_COMMESSA = c.ID_COMMESSA
                             AND tc.Dal <= g.Data
                             ORDER BY tc.Dal DESC
                             LIMIT 1),
                            -- Altrimenti tariffa standard (ID_COMMESSA è NULL)
                            (SELECT ts.Tariffa_gg
                             FROM ANA_TARIFFE_COLLABORATORI ts
                             WHERE ts.ID_COLLABORATORE = g.ID_COLLABORATORE
                             AND ts.ID_COMMESSA IS NULL
                             AND ts.Dal <= g.Data
                             ORDER BY ts.Dal DESC
                             LIMIT 1),
                            0
                        )
                    ) as costo_gg
                 FROM FACT_GIORNATE g
                 LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                 LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                 WHERE g.ID_COLLABORATORE = ? 
                 AND MONTH(g.Data) = MONTH(CURDATE()) 
                 AND YEAR(g.Data) = YEAR(CURDATE())";
    
    $stmt_costo = $db->prepare($sql_costo);
    $stmt_costo->execute([$user['ID_COLLABORATORE']]);
    $risultato_costo = $stmt_costo->fetch();
    
    $costo_gg = $risultato_costo['costo_gg'] ?? 0;
    echo "<p><strong>Costo gg totale per il mese corrente: € " . number_format($costo_gg, 2) . "</strong></p>";
    
    // Dettaglio del calcolo per ogni giornata
    echo "<h4>Dettaglio calcolo per ogni giornata del mese corrente:</h4>";
    
    $sql_dettaglio = "SELECT 
                        g.Data,
                        g.gg,
                        c.Commessa,
                        c.ID_COMMESSA,
                        -- Tariffa specifica per commessa se esiste
                        (SELECT tc.Tariffa_gg 
                         FROM ANA_TARIFFE_COLLABORATORI tc
                         WHERE tc.ID_COLLABORATORE = g.ID_COLLABORATORE
                         AND tc.ID_COMMESSA = c.ID_COMMESSA
                         AND tc.Dal <= g.Data
                         ORDER BY tc.Dal DESC
                         LIMIT 1) as Tariffa_Specifica,
                        -- Tariffa standard (ID_COMMESSA è NULL)
                        (SELECT ts.Tariffa_gg
                         FROM ANA_TARIFFE_COLLABORATORI ts
                         WHERE ts.ID_COLLABORATORE = g.ID_COLLABORATORE
                         AND ts.ID_COMMESSA IS NULL
                         AND ts.Dal <= g.Data
                         ORDER BY ts.Dal DESC
                         LIMIT 1) as Tariffa_Standard,
                        -- Tariffa utilizzata
                        COALESCE(
                            (SELECT tc.Tariffa_gg 
                             FROM ANA_TARIFFE_COLLABORATORI tc
                             WHERE tc.ID_COLLABORATORE = g.ID_COLLABORATORE
                             AND tc.ID_COMMESSA = c.ID_COMMESSA
                             AND tc.Dal <= g.Data
                             ORDER BY tc.Dal DESC
                             LIMIT 1),
                            (SELECT ts.Tariffa_gg
                             FROM ANA_TARIFFE_COLLABORATORI ts
                             WHERE ts.ID_COLLABORATORE = g.ID_COLLABORATORE
                             AND ts.ID_COMMESSA IS NULL
                             AND ts.Dal <= g.Data
                             ORDER BY ts.Dal DESC
                             LIMIT 1),
                            0
                        ) as Tariffa_Utilizzata
                     FROM FACT_GIORNATE g
                     LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                     LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                     WHERE g.ID_COLLABORATORE = ? 
                     AND MONTH(g.Data) = MONTH(CURDATE()) 
                     AND YEAR(g.Data) = YEAR(CURDATE())
                     ORDER BY g.Data DESC";
    
    $stmt_dettaglio = $db->prepare($sql_dettaglio);
    $stmt_dettaglio->execute([$user['ID_COLLABORATORE']]);
    $dettagli = $stmt_dettaglio->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($dettagli)) {
        echo "<p>Nessuna consuntivazione trovata per il mese corrente.</p>";
    } else {
        echo "<table border='1' style='border-collapse: collapse;'>";
        echo "<tr><th>Data</th><th>Giornate</th><th>Commessa</th><th>Tariffa Specifica</th><th>Tariffa Standard</th><th>Tariffa Utilizzata</th><th>Costo Calcolato</th></tr>";
        
        $totale_costo = 0;
        
        foreach ($dettagli as $dettaglio) {
            $costo_giornata = $dettaglio['gg'] * $dettaglio['Tariffa_Utilizzata'];
            $totale_costo += $costo_giornata;
            
            echo "<tr>";
            echo "<td>" . $dettaglio['Data'] . "</td>";
            echo "<td>" . $dettaglio['gg'] . "</td>";
            echo "<td>" . ($dettaglio['Commessa'] ?? 'N/A') . "</td>";
            echo "<td>€ " . ($dettaglio['Tariffa_Specifica'] ? number_format($dettaglio['Tariffa_Specifica'], 2) : 'N/A') . "</td>";
            echo "<td>€ " . ($dettaglio['Tariffa_Standard'] ? number_format($dettaglio['Tariffa_Standard'], 2) : 'N/A') . "</td>";
            echo "<td>€ " . number_format($dettaglio['Tariffa_Utilizzata'], 2) . "</td>";
            echo "<td>€ " . number_format($costo_giornata, 2) . "</td>";
            echo "</tr>";
        }
        
        echo "<tr style='font-weight: bold; background-color: #f0f0f0;'>";
        echo "<td colspan='6'>TOTALE</td>";
        echo "<td>€ " . number_format($totale_costo, 2) . "</td>";
        echo "</tr>";
        echo "</table>";
        
        echo "<p><strong>Verifica: Il totale calcolato manualmente (€ " . number_format($totale_costo, 2) . ") corrisponde al risultato della query (€ " . number_format($costo_gg, 2) . ")? " . ($totale_costo == $costo_gg ? "✅ SÌ" : "❌ NO") . "</strong></p>";
    }
    
    // Test dell'API
    echo "<h4>Test dell'API getStatistiche (manuale):</h4>";
    
    // Invece di usare le classi API che hanno problemi di include, testiamo la logica direttamente
    echo "<p>Simulazione dell'autenticazione riuscita per il collaboratore: " . $user['Collaboratore'] . "</p>";
    
    // Esegui la stessa query che userebbe l'API
    $sql_api = "SELECT 
                    COALESCE(SUM(gg), 0) as ore_mese
                 FROM FACT_GIORNATE 
                 WHERE ID_COLLABORATORE = ?
                 AND MONTH(Data) = MONTH(CURDATE()) 
                 AND YEAR(Data) = YEAR(CURDATE())";
    
    $stmt_api1 = $db->prepare($sql_api);
    $stmt_api1->execute([$user['ID_COLLABORATORE']]);
    $ore_mese = $stmt_api1->fetch()['ore_mese'];
    
    // Spese del mese
    $sql_api2 = "SELECT 
                    COALESCE(SUM(COALESCE(Spese_Viaggi, 0) + COALESCE(Vitto_alloggio, 0) + COALESCE(Altri_costi, 0)), 0) as spese_mese,
                    COALESCE(SUM(COALESCE(Spese_Fatturate_VP, 0)), 0) as spese_fatturate_vp
                 FROM FACT_GIORNATE 
                 WHERE ID_COLLABORATORE = ?
                 AND MONTH(Data) = MONTH(CURDATE()) 
                 AND YEAR(Data) = YEAR(CURDATE())";
    
    $stmt_api2 = $db->prepare($sql_api2);
    $stmt_api2->execute([$user['ID_COLLABORATORE']]);
    $spese_result = $stmt_api2->fetch();
    
    // Giorni lavorati
    $sql_api3 = "SELECT COUNT(DISTINCT Data) as giorni_lavorati
                 FROM FACT_GIORNATE 
                 WHERE ID_COLLABORATORE = ?
                 AND MONTH(Data) = MONTH(CURDATE()) 
                 AND YEAR(Data) = YEAR(CURDATE())";
    
    $stmt_api3 = $db->prepare($sql_api3);
    $stmt_api3->execute([$user['ID_COLLABORATORE']]);
    $giorni_lavorati = $stmt_api3->fetch()['giorni_lavorati'];
    
    // Risultati simulati API
    $api_result = [
        'ore_mese' => number_format($ore_mese, 1),
        'spese_mese' => number_format($spese_result['spese_mese'], 2),
        'spese_rimborsabili' => number_format(max(0, $spese_result['spese_mese'] - $spese_result['spese_fatturate_vp']), 2),
        'giorni_lavorati' => $giorni_lavorati,
        'costo_gg' => number_format($costo_gg, 2)
    ];
    
    echo "<p><strong>Risultato simulato dell'API getStatistiche:</strong></p>";
    echo "<pre>";
    print_r($api_result);
    echo "</pre>";
    
    echo "<p><strong>Interpretazione dei risultati:</strong></p>";
    echo "<ul>";
    echo "<li>Giornate nel mese: " . $api_result['ore_mese'] . "</li>";
    echo "<li>Spese del mese: € " . $api_result['spese_mese'] . "</li>";
    echo "<li>Spese rimborsabili: € " . $api_result['spese_rimborsabili'] . "</li>";
    echo "<li><strong>Costo gg (NUOVO): € " . $api_result['costo_gg'] . "</strong></li>";
    echo "<li>Date nel mese: " . $api_result['giorni_lavorati'] . "</li>";
    echo "</ul>";
    
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage() . "<br>";
    echo "Stack trace: <pre>" . $e->getTraceAsString() . "</pre>";
}
?>