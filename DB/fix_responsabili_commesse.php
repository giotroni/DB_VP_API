<?php
/**
 * Script per aggiornare le commesse senza responsabile
 * Assegna un responsabile di default alle commesse che non ne hanno uno
 */

require_once 'config.php';

try {
    $db = getDatabase();
    
    // Prima vediamo quali commesse non hanno responsabile
    echo "=== COMMESSE SENZA RESPONSABILE ===\n";
    $sql = "SELECT ID_COMMESSA, Commessa, Tipo_Commessa FROM ANA_COMMESSE WHERE ID_COLLABORATORE IS NULL OR ID_COLLABORATORE = ''";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $commesseSenzaResp = $stmt->fetchAll();
    
    if (empty($commesseSenzaResp)) {
        echo "Tutte le commesse hanno già un responsabile assegnato.\n";
        exit(0);
    }
    
    echo "Trovate " . count($commesseSenzaResp) . " commesse senza responsabile:\n";
    foreach ($commesseSenzaResp as $commessa) {
        echo "- {$commessa['ID_COMMESSA']}: {$commessa['Commessa']} ({$commessa['Tipo_Commessa']})\n";
    }
    
    // Troviamo il primo collaboratore disponibile (di solito CONS001 - Alessandro Vaglio)
    echo "\n=== COLLABORATORI DISPONIBILI ===\n";
    $sql = "SELECT ID_COLLABORATORE, Collaboratore FROM ANA_COLLABORATORI ORDER BY ID_COLLABORATORE LIMIT 5";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $collaboratori = $stmt->fetchAll();
    
    if (empty($collaboratori)) {
        echo "ERRORE: Nessun collaboratore trovato nel database!\n";
        exit(1);
    }
    
    echo "Collaboratori disponibili:\n";
    foreach ($collaboratori as $index => $collab) {
        echo ($index + 1) . ". {$collab['ID_COLLABORATORE']}: {$collab['Collaboratore']}\n";
    }
    
    // Usa il primo collaboratore come default (di solito Alessandro Vaglio)
    $responsabileDefault = $collaboratori[0];
    echo "\nResponsabile di default selezionato: {$responsabileDefault['Collaboratore']} ({$responsabileDefault['ID_COLLABORATORE']})\n";
    
    // Chiedi conferma se in modalità interattiva
    if (php_sapi_name() === 'cli') {
        echo "\nVuoi assegnare questo responsabile a tutte le commesse senza responsabile? (s/n): ";
        $handle = fopen("php://stdin", "r");
        $confirmation = trim(fgets($handle));
        fclose($handle);
        
        if (strtolower($confirmation) !== 's') {
            echo "Operazione annullata.\n";
            exit(0);
        }
    }
    
    // Aggiorna le commesse
    echo "\n=== AGGIORNAMENTO COMMESSE ===\n";
    $sql = "UPDATE ANA_COMMESSE SET ID_COLLABORATORE = ? WHERE ID_COLLABORATORE IS NULL OR ID_COLLABORATORE = ''";
    $stmt = $db->prepare($sql);
    $stmt->execute([$responsabileDefault['ID_COLLABORATORE']]);
    
    $aggiornate = $stmt->rowCount();
    echo "Aggiornate $aggiornate commesse con responsabile: {$responsabileDefault['Collaboratore']}\n";
    
    // Verifica il risultato
    echo "\n=== VERIFICA RISULTATO ===\n";
    $sql = "SELECT c.ID_COMMESSA, c.Commessa, col.Collaboratore as Responsabile 
            FROM ANA_COMMESSE c 
            LEFT JOIN ANA_COLLABORATORI col ON c.ID_COLLABORATORE = col.ID_COLLABORATORE 
            WHERE c.ID_COMMESSA IN ('" . implode("','", array_column($commesseSenzaResp, 'ID_COMMESSA')) . "')";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $risultato = $stmt->fetchAll();
    
    foreach ($risultato as $riga) {
        echo "✅ {$riga['ID_COMMESSA']}: {$riga['Commessa']} → Responsabile: {$riga['Responsabile']}\n";
    }
    
    echo "\n🎉 Aggiornamento completato con successo!\n";
    
} catch (Exception $e) {
    echo "❌ ERRORE: " . $e->getMessage() . "\n";
    exit(1);
}
?>