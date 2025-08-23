<?php
/**
 * Test specifico per il calcolo del "Costo gg" di Stefano Colombo - Marzo 2025
 */

// Cambia la directory di lavoro per evitare problemi con i percorsi relativi negli include
chdir(__DIR__);
require_once 'DB/config.php';

/**
 * Formatta un numero in formato italiano (virgola per decimali, punto per migliaia)
 */
function formatItalianNumber($value) {
    return number_format($value, 2, ',', '.');
}

try {
    $db = getDatabase();
    
    echo "<h1>Test Calcolo Costo gg - Stefano Colombo - Marzo 2025</h1>";
    echo "<div style='background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px;'>";
    echo "<strong>🔍 IMPORTANTE:</strong> Il calcolo del 'Costo gg' viene effettuato <strong>SOLO</strong> per giornate di tipo 'Campo'. ";
    echo "Le giornate di altri tipi (es. Ufficio, Trasferta, ecc.) hanno costo zero.";
    echo "</div>";
    echo "<hr>";
    
    // Cerca Stefano Colombo nel database
    $sql_stefano = "SELECT ID_COLLABORATORE, Collaboratore, Email FROM ANA_COLLABORATORI 
                    WHERE Collaboratore LIKE '%Stefano%' AND Collaboratore LIKE '%Colombo%'";
    $stmt_stefano = $db->prepare($sql_stefano);
    $stmt_stefano->execute();
    $stefano = $stmt_stefano->fetch();
    
    if (!$stefano) {
        echo "<div style='color: red; padding: 20px; border: 2px solid red; margin: 20px 0;'>";
        echo "<h3>❌ COLLABORATORE NON TROVATO</h3>";
        echo "<p>Stefano Colombo non è stato trovato nel database.</p>";
        echo "<p>Collaboratori disponibili nel database:</p>";
        
        $sql_all = "SELECT ID_COLLABORATORE, Collaboratore, Email FROM ANA_COLLABORATORI ORDER BY Collaboratore";
        $stmt_all = $db->prepare($sql_all);
        $stmt_all->execute();
        $all_collaboratori = $stmt_all->fetchAll(PDO::FETCH_ASSOC);
        
        echo "<ul>";
        foreach ($all_collaboratori as $collab) {
            echo "<li><strong>" . $collab['ID_COLLABORATORE'] . "</strong> - " . $collab['Collaboratore'] . " (" . $collab['Email'] . ")</li>";
        }
        echo "</ul>";
        echo "</div>";
        exit;
    }
    
    echo "<div style='background: #e8f5e8; padding: 15px; border: 2px solid #4CAF50; margin: 10px 0;'>";
    echo "<h2>✅ Collaboratore Trovato</h2>";
    echo "<p><strong>ID:</strong> " . $stefano['ID_COLLABORATORE'] . "</p>";
    echo "<p><strong>Nome:</strong> " . $stefano['Collaboratore'] . "</p>";
    echo "<p><strong>Email:</strong> " . $stefano['Email'] . "</p>";
    echo "</div>";
    
    // Verifica le tariffe disponibili per Stefano
    echo "<h3>📊 Tariffe Disponibili per Stefano Colombo</h3>";
    $sql_tariffe = "SELECT 
                       t.ID_TARIFFA,
                       t.ID_COMMESSA,
                       t.Tariffa_gg,
                       t.Dal,
                       t.Spese_comprese,
                       c.Commessa,
                       CASE 
                           WHEN t.ID_COMMESSA IS NULL THEN 'Tariffa Standard'
                           ELSE CONCAT('Tariffa Specifica: ', c.Commessa)
                       END as Tipo_Tariffa
                    FROM ANA_TARIFFE_COLLABORATORI t
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    WHERE t.ID_COLLABORATORE = ?
                    ORDER BY t.Dal DESC, t.ID_COMMESSA";
    
    $stmt_tariffe = $db->prepare($sql_tariffe);
    $stmt_tariffe->execute([$stefano['ID_COLLABORATORE']]);
    $tariffe = $stmt_tariffe->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($tariffe)) {
        echo "<div style='color: orange; padding: 15px; border: 2px solid orange; margin: 10px 0;'>";
        echo "<h4>⚠️ NESSUNA TARIFFA CONFIGURATA</h4>";
        echo "<p>Non sono state trovate tariffe per Stefano Colombo. Il calcolo del Costo gg sarà 0.</p>";
        echo "</div>";
    } else {
        echo "<table border='1' style='border-collapse: collapse; width: 100%; margin: 10px 0;'>";
        echo "<thead style='background-color: #f0f0f0;'>";
        echo "<tr><th>ID Tariffa</th><th>Tipo</th><th>Commessa</th><th>Tariffa/gg</th><th>Spese Incluse</th><th>Valida Dal</th></tr>";
        echo "</thead><tbody>";
        
        foreach ($tariffe as $tariffa) {
            $is_standard = is_null($tariffa['ID_COMMESSA']);
            $row_color = $is_standard ? 'background-color: #fff3cd;' : 'background-color: #d1ecf1;';
            
            echo "<tr style='$row_color'>";
            echo "<td>" . $tariffa['ID_TARIFFA'] . "</td>";
            echo "<td>" . $tariffa['Tipo_Tariffa'] . "</td>";
            echo "<td>" . ($tariffa['Commessa'] ?? 'N/A') . "</td>";
            echo "<td style='text-align: right;'><strong>€ " . formatItalianNumber($tariffa['Tariffa_gg']) . "</strong></td>";
            echo "<td>" . $tariffa['Spese_comprese'] . "</td>";
            echo "<td>" . $tariffa['Dal'] . "</td>";
            echo "</tr>";
        }
        echo "</tbody></table>";
        
        echo "<div style='font-size: 0.9em; color: #666; margin: 10px 0;'>";
        echo "<p><span style='background-color: #fff3cd; padding: 2px 5px;'>■</span> Tariffa Standard (usata quando non c'è tariffa specifica per la commessa)</p>";
        echo "<p><span style='background-color: #d1ecf1; padding: 2px 5px;'>■</span> Tariffa Specifica per Commessa (ha priorità se la commessa corrisponde)</p>";
        echo "</div>";
    }
    
    // Verifica le consuntivazioni di marzo 2025
    echo "<h3>📅 Consuntivazioni di Stefano Colombo - Marzo 2025</h3>";
    $sql_consuntivazioni = "SELECT 
                              g.ID_GIORNATA,
                              g.Data,
                              g.gg,
                              g.Tipo,
                              g.Desk,
                              t.Task,
                              c.Commessa,
                              c.ID_COMMESSA,
                              g.Note
                           FROM FACT_GIORNATE g
                           LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                           LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                           WHERE g.ID_COLLABORATORE = ?
                           AND g.Tipo = 'Campo'
                           AND YEAR(g.Data) = 2025
                           AND MONTH(g.Data) = 3
                           ORDER BY g.Data ASC";
    
    $stmt_consuntivazioni = $db->prepare($sql_consuntivazioni);
    $stmt_consuntivazioni->execute([$stefano['ID_COLLABORATORE']]);
    $consuntivazioni = $stmt_consuntivazioni->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($consuntivazioni)) {
        echo "<div style='color: orange; padding: 15px; border: 2px solid orange; margin: 10px 0;'>";
        echo "<h4>📝 NESSUNA CONSUNTIVAZIONE TROVATA</h4>";
        echo "<p>Non sono state trovate consuntivazioni per Stefano Colombo nel mese di marzo 2025.</p>";
        echo "</div>";
        
        // Mostra le consuntivazioni disponibili
        $sql_altre = "SELECT DISTINCT YEAR(Data) as anno, MONTH(Data) as mese, MONTHNAME(Data) as nome_mese
                      FROM FACT_GIORNATE 
                      WHERE ID_COLLABORATORE = ?
                      ORDER BY anno DESC, mese DESC";
        $stmt_altre = $db->prepare($sql_altre);
        $stmt_altre->execute([$stefano['ID_COLLABORATORE']]);
        $altri_mesi = $stmt_altre->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($altri_mesi)) {
            echo "<p><strong>Mesi con consuntivazioni disponibili:</strong></p>";
            echo "<ul>";
            foreach ($altri_mesi as $mese) {
                echo "<li>" . $mese['nome_mese'] . " " . $mese['anno'] . "</li>";
            }
            echo "</ul>";
        }
    } else {
        echo "<p><strong>Trovate " . count($consuntivazioni) . " consuntivazioni per marzo 2025</strong></p>";
        
        // Calcolo dettagliato del Costo gg
        echo "<h3>💰 Calcolo Dettagliato Costo gg - Marzo 2025</h3>";
        
        echo "<table border='1' style='border-collapse: collapse; width: 100%; margin: 10px 0;'>";
        echo "<thead style='background-color: #f0f0f0;'>";
        echo "<tr>";
        echo "<th>Data</th>";
        echo "<th>Giornate</th>";
        echo "<th>Commessa/Cliente</th>";
        echo "<th>Task</th>";
        echo "<th>Tipo</th>";
        echo "<th>Tariffa Specifica</th>";
        echo "<th>Tariffa Standard</th>";
        echo "<th>Tariffa Usata</th>";
        echo "<th>Costo Calcolato</th>";
        echo "<th>Note</th>";
        echo "</tr>";
        echo "</thead><tbody>";
        
        $totale_giornate = 0;
        $totale_costo = 0;
        
        foreach ($consuntivazioni as $cons) {
            // Trova la tariffa specifica per questa commessa (se esiste)
            $tariffa_specifica = null;
            $tariffa_standard = null;
            
            foreach ($tariffe as $tariffa) {
                // Verifica che la tariffa sia valida alla data della consuntivazione
                if ($tariffa['Dal'] <= $cons['Data']) {
                    if ($tariffa['ID_COMMESSA'] == $cons['ID_COMMESSA'] && !is_null($cons['ID_COMMESSA'])) {
                        $tariffa_specifica = $tariffa['Tariffa_gg'];
                        break; // Priorità alla tariffa specifica
                    } elseif (is_null($tariffa['ID_COMMESSA'])) {
                        $tariffa_standard = $tariffa['Tariffa_gg'];
                    }
                }
            }
            
            // Determina quale tariffa usare
            $tariffa_usata = $tariffa_specifica ?? $tariffa_standard ?? 0;
            
            // Calcola il costo per questa giornata
            $costo_giornata = $cons['gg'] * $tariffa_usata;
            
            $totale_giornate += $cons['gg'];
            $totale_costo += $costo_giornata;
            
            // Formatta la riga
            $tipo_badge_color = [
                'Campo' => 'background-color: #007bff; color: white;',
                'Promo' => 'background-color: #17a2b8; color: white;',
                'Sviluppo' => 'background-color: #ffc107; color: black;',
                'Formazione' => 'background-color: #28a745; color: white;'
            ];
            $badge_style = $tipo_badge_color[$cons['Tipo']] ?? 'background-color: #6c757d; color: white;';
            
            echo "<tr>";
            echo "<td>" . date('d/m/Y', strtotime($cons['Data'])) . "</td>";
            echo "<td style='text-align: center;'><strong>" . $cons['gg'] . "</strong></td>";
            echo "<td>" . ($cons['Commessa'] ? $cons['Commessa'] . '<br><small>' . ($cons['Cliente'] ?? '') . '</small>' : 'N/A') . "</td>";
            echo "<td>" . ($cons['Task'] ?? 'N/A') . "</td>";
            echo "<td><span style='padding: 2px 6px; border-radius: 3px; font-size: 0.8em; $badge_style'>" . $cons['Tipo'] . "</span></td>";
            echo "<td style='text-align: right;'>" . ($tariffa_specifica ? "€ " . formatItalianNumber($tariffa_specifica) : '-') . "</td>";
            echo "<td style='text-align: right;'>" . ($tariffa_standard ? "€ " . formatItalianNumber($tariffa_standard) : '-') . "</td>";
            echo "<td style='text-align: right; background-color: #e8f5e8;'><strong>€ " . formatItalianNumber($tariffa_usata) . "</strong></td>";
            echo "<td style='text-align: right; background-color: #fff3cd;'><strong>€ " . formatItalianNumber($costo_giornata) . "</strong></td>";
            echo "<td style='font-size: 0.8em;'>" . ($cons['Note'] ? substr($cons['Note'], 0, 50) . (strlen($cons['Note']) > 50 ? '...' : '') : '-') . "</td>";
            echo "</tr>";
        }
        
        echo "<tr style='font-weight: bold; background-color: #f8f9fa; border-top: 3px solid #dee2e6;'>";
        echo "<td>TOTALE</td>";
        echo "<td style='text-align: center;'>" . number_format($totale_giornate, 1) . "</td>";
        echo "<td colspan='6'></td>";
        echo "<td style='text-align: right; background-color: #fff3cd; font-size: 1.2em;'>€ " . formatItalianNumber($totale_costo) . "</td>";
        echo "<td></td>";
        echo "</tr>";
        echo "</tbody></table>";
        
        // Riepilogo finale
        echo "<div style='background: #d4edda; padding: 20px; border: 2px solid #28a745; margin: 20px 0; border-radius: 5px;'>";
        echo "<h3 style='margin-top: 0;'>📊 Riepilogo Calcolo Costo gg</h3>";
        echo "<div style='display: grid; grid-template-columns: 1fr 1fr; gap: 20px;'>";
        echo "<div>";
        echo "<h4>Dati Marzo 2025:</h4>";
        echo "<ul>";
        echo "<li><strong>Collaboratore:</strong> " . $stefano['Collaboratore'] . "</li>";
        echo "<li><strong>Periodo:</strong> Marzo 2025</li>";
        echo "<li><strong>Totale Giornate:</strong> " . number_format($totale_giornate, 1) . "</li>";
        echo "<li><strong>Numero Consuntivazioni:</strong> " . count($consuntivazioni) . "</li>";
        echo "</ul>";
        echo "</div>";
        echo "<div>";
        echo "<h4>Risultato Calcolo:</h4>";
        echo "<ul>";
        echo "<li style='font-size: 1.3em;'><strong>Costo gg Totale: € " . formatItalianNumber($totale_costo) . "</strong></li>";
        echo "<li><strong>Costo Medio per Giornata:</strong> € " . formatItalianNumber($totale_costo / max($totale_giornate, 1)) . "</li>";
        echo "</ul>";
        echo "</div>";
        echo "</div>";
        echo "</div>";
        
        // Verifica con la query dell'API
        echo "<h3>🔍 Verifica con Query API</h3>";
        $sql_api_verifica = "SELECT 
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
                               ) as costo_gg_api
                            FROM FACT_GIORNATE g
                            LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                            LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                            WHERE g.ID_COLLABORATORE = ?
                            AND g.Tipo = 'Campo'
                            AND YEAR(g.Data) = 2025
                            AND MONTH(g.Data) = 3";
        
        $stmt_api_verifica = $db->prepare($sql_api_verifica);
        $stmt_api_verifica->execute([$stefano['ID_COLLABORATORE']]);
        $costo_api = $stmt_api_verifica->fetch()['costo_gg_api'] ?? 0;
        
        echo "<p><strong>Risultato Query API:</strong> € " . formatItalianNumber($costo_api) . "</p>";
        echo "<p><strong>Risultato Calcolo Manuale:</strong> € " . formatItalianNumber($totale_costo) . "</p>";
        
        if (abs($costo_api - $totale_costo) < 0.01) {
            echo "<div style='color: green; font-weight: bold;'>✅ VERIFICA POSITIVA: I calcoli corrispondono!</div>";
        } else {
            echo "<div style='color: red; font-weight: bold;'>❌ ATTENZIONE: Discrepanza nei calcoli!</div>";
            echo "<p>Differenza: € " . formatItalianNumber(abs($costo_api - $totale_costo)) . "</p>";
        }
    }
    
} catch (Exception $e) {
    echo "<div style='color: red; padding: 20px; border: 2px solid red; margin: 20px 0;'>";
    echo "<h3>❌ ERRORE</h3>";
    echo "<p><strong>Messaggio:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Linea:</strong> " . $e->getLine() . "</p>";
    echo "<details>";
    echo "<summary>Stack Trace</summary>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</details>";
    echo "</div>";
}
?>

<style>
body {
    font-family: Arial, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f8f9fa;
}
h1, h2, h3 {
    color: #2c3e50;
}
table {
    font-size: 0.9em;
}
table th {
    padding: 8px;
    text-align: center;
    font-weight: bold;
}
table td {
    padding: 6px 8px;
    vertical-align: top;
}
table tr:nth-child(even) {
    background-color: #f9f9f9;
}
table tr:hover {
    background-color: #e8f4f8;
}
.highlight {
    background-color: #fff3cd !important;
}
code {
    background-color: #f8f9fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
}
</style>
