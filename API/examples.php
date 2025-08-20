<?php
/**
 * Esempi di utilizzo delle API Vaglio & Partners
 * Collezione di script di esempio per le operazioni più comuni
 */

require_once '../DB/config.php';

/**
 * Helper per fare richieste API
 */
function callAPI($endpoint, $method = 'GET', $data = null) {
    $url = 'http://localhost/API' . $endpoint; // Modifica con il tuo URL
    
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $data ? json_encode($data) : null
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

echo "=== ESEMPI API VAGLIO & PARTNERS ===\n\n";

// Esempio 1: Workflow completo cliente-commessa-fattura
echo "1. WORKFLOW COMPLETO: Cliente → Commessa → Task → Giornata → Fattura\n";
echo "================================================================\n\n";

// Crea cliente
echo "Step 1: Creazione cliente\n";
$clienteData = [
    'Cliente' => 'ESEMPIO SRL',
    'Denominazione_Sociale' => 'Esempio Solutions SRL',
    'Indirizzo' => 'Via Esempio 123',
    'Citta' => 'Milano',
    'CAP' => '20100',
    'Provincia' => 'MI',
    'P_IVA' => '01234567890'
];

$cliente = callAPI('/clienti', 'POST', $clienteData);
if ($cliente['code'] === 200) {
    $clienteId = $cliente['data']['data']['ID_CLIENTE'];
    echo "✅ Cliente creato: $clienteId\n";
} else {
    echo "❌ Errore creazione cliente\n";
    exit;
}

// Crea collaboratore (se necessario)
echo "\nStep 2: Verifica/Creazione collaboratore\n";
$collaboratori = callAPI('/collaboratori?collaboratore=Alessandro');
if ($collaboratori['data']['data']['pagination']['total'] > 0) {
    $collaboratoreId = $collaboratori['data']['data']['data'][0]['ID_COLLABORATORE'];
    echo "✅ Collaboratore esistente: $collaboratoreId\n";
} else {
    $collaboratoreData = [
        'Collaboratore' => 'Alessandro Vaglio',
        'Email' => 'avaglio@example.com',
        'Ruolo' => 'Manager'
    ];
    $collaboratore = callAPI('/collaboratori', 'POST', $collaboratoreData);
    $collaboratoreId = $collaboratore['data']['data']['ID_COLLABORATORE'];
    echo "✅ Collaboratore creato: $collaboratoreId\n";
}

// Crea commessa
echo "\nStep 3: Creazione commessa\n";
$commessaData = [
    'Commessa' => 'IMPLEMENTAZIONE ISO 9001',
    'Desc_Commessa' => 'Implementazione sistema qualità ISO 9001',
    'Tipo_Commessa' => 'Cliente',
    'ID_CLIENTE' => $clienteId,
    'ID_COLLABORATORE' => $collaboratoreId,
    'Commissione' => 0.20,
    'Data_Apertura_Commessa' => date('Y-m-d')
];

$commessa = callAPI('/commesse', 'POST', $commessaData);
if ($commessa['code'] === 200) {
    $commessaId = $commessa['data']['data']['ID_COMMESSA'];
    echo "✅ Commessa creata: $commessaId\n";
} else {
    echo "❌ Errore creazione commessa\n";
    print_r($commessa);
    exit;
}

// Crea task
echo "\nStep 4: Creazione task\n";
$taskData = [
    'Task' => 'ANALISI GAP ISO 9001',
    'Desc_Task' => 'Analisi dello stato attuale vs requisiti ISO 9001',
    'ID_COMMESSA' => $commessaId,
    'ID_COLLABORATORE' => $collaboratoreId,
    'Tipo' => 'Campo',
    'Data_Apertura_Task' => date('Y-m-d'),
    'gg_previste' => 5.0,
    'Spese_Comprese' => 'No',
    'Valore_Spese_std' => 300.00,
    'Valore_gg' => 1200.00
];

$task = callAPI('/task', 'POST', $taskData);
if ($task['code'] === 200) {
    $taskId = $task['data']['data']['ID_TASK'];
    echo "✅ Task creato: $taskId\n";
} else {
    echo "❌ Errore creazione task\n";
    exit;
}

// Crea tariffa per il collaboratore
echo "\nStep 5: Creazione tariffa collaboratore\n";
$tariffaData = [
    'ID_COLLABORATORE' => $collaboratoreId,
    'ID_COMMESSA' => $commessaId,
    'Tariffa_gg' => 1200.00,
    'Spese_comprese' => 'No',
    'Dal' => date('Y-m-d')
];

$tariffa = callAPI('/tariffe', 'POST', $tariffaData);
if ($tariffa['code'] === 200) {
    $tariffaId = $tariffa['data']['data']['ID_TARIFFA'];
    echo "✅ Tariffa creata: $tariffaId\n";
}

// Registra alcune giornate
echo "\nStep 6: Registrazione giornate lavorative\n";
$giornate = [];
for ($i = 0; $i < 3; $i++) {
    $data = date('Y-m-d', strtotime("-$i days"));
    $giornataData = [
        'Data' => $data,
        'ID_COLLABORATORE' => $collaboratoreId,
        'ID_TASK' => $taskId,
        'Tipo' => 'Campo',
        'Desk' => 'No',
        'gg' => 1.0,
        'Spese_Viaggi' => 120.00,
        'Vitto_alloggio' => 80.00,
        'Altri_costi' => 25.00,
        'Note' => "Giornata $i - Analisi gap ISO"
    ];
    
    $giornata = callAPI('/giornate', 'POST', $giornataData);
    if ($giornata['code'] === 200) {
        $giornate[] = $giornata['data']['data']['ID_GIORNATA'];
        echo "✅ Giornata registrata: $data\n";
    }
}

// Crea fattura
echo "\nStep 7: Emissione fattura\n";
$fatturaData = [
    'Data' => date('Y-m-d'),
    'ID_CLIENTE' => $clienteId,
    'TIPO' => 'Fattura',
    'NR' => date('y') . '_ESEMPIO_' . date('md'),
    'ID_COMMESSA' => $commessaId,
    'Fatturato_gg' => 3600.00, // 3 giorni * 1200
    'Fatturato_Spese' => 675.00, // 3 giorni * 225 di spese
    'Fatturato_TOT' => 4275.00,
    'Note' => 'Fattura per analisi gap ISO 9001 - prime 3 giornate',
    'Tempi_Pagamento' => 30
];

$fattura = callAPI('/fatture', 'POST', $fatturaData);
if ($fattura['code'] === 200) {
    $fatturaId = $fattura['data']['data']['ID_FATTURA'];
    echo "✅ Fattura emessa: $fatturaId\n";
}

echo "\n" . str_repeat("=", 50) . "\n\n";

// Esempio 2: Query e reportistica
echo "2. ESEMPI DI QUERY E REPORTISTICA\n";
echo "==================================\n\n";

// Statistiche cliente
echo "Statistiche del cliente creato:\n";
$clienteDettaglio = callAPI("/clienti/$clienteId");
if (isset($clienteDettaglio['data']['data']['statistics'])) {
    $stats = $clienteDettaglio['data']['data']['statistics'];
    echo "- Commesse totali: {$stats['commesse_totali']}\n";
    echo "- Commesse attive: {$stats['commesse_attive']}\n";
    echo "- Fatturato totale: €{$stats['fatturato_totale']}\n";
}

// Giornate del mese corrente per collaboratore
echo "\nGiornate del mese corrente per $collaboratoreId:\n";
$meseCorrente = date('n');
$annoCorrente = date('Y');
$giornateDelMese = callAPI("/giornate?collaboratore=$collaboratoreId&mese=$meseCorrente&anno=$annoCorrente");
if (isset($giornateDelMese['data']['data']['data'])) {
    echo "- Giornate registrate: " . count($giornateDelMese['data']['data']['data']) . "\n";
    $totaleGg = 0;
    $totaleSpese = 0;
    foreach ($giornateDelMese['data']['data']['data'] as $g) {
        $totaleGg += $g['gg'];
        $totaleSpese += $g['spese_totali'];
    }
    echo "- Totale giorni: $totaleGg\n";
    echo "- Totale spese: €$totaleSpese\n";
}

// Fatture in scadenza
echo "\nFatture in scadenza:\n";
$fattureInScadenza = callAPI("/fatture?stato_pagamento=in_scadenza");
if (isset($fattureInScadenza['data']['data']['data'])) {
    echo "- Numero fatture: " . count($fattureInScadenza['data']['data']['data']) . "\n";
}

echo "\n" . str_repeat("=", 50) . "\n\n";

// Esempio 3: Aggiornamenti e gestione stati
echo "3. ESEMPI DI AGGIORNAMENTI\n";
echo "==========================\n\n";

// Aggiorna stato commessa
echo "Aggiornamento stato commessa:\n";
$updateCommessa = callAPI("/commesse/$commessaId", 'PUT', [
    'Stato_Commessa' => 'In corso',
    'Note' => 'Commessa in fase di esecuzione'
]);
if ($updateCommessa['code'] === 200) {
    echo "✅ Stato commessa aggiornato\n";
}

// Registra pagamento fattura
if (isset($fatturaId)) {
    echo "\nRegistrazione pagamento fattura:\n";
    $updateFattura = callAPI("/fatture/$fatturaId", 'PUT', [
        'Data_Pagamento' => date('Y-m-d'),
        'Valore_Pagato' => 4275.00
    ]);
    if ($updateFattura['code'] === 200) {
        echo "✅ Pagamento registrato\n";
    }
}

echo "\n" . str_repeat("=", 50) . "\n\n";

// Esempio 4: Filtri avanzati
echo "4. ESEMPI FILTRI AVANZATI\n";
echo "=========================\n\n";

// Clienti per provincia
echo "Clienti in Lombardia:\n";
$clientiLombardia = callAPI("/clienti?provincia=MI");
echo "- Trovati: " . $clientiLombardia['data']['data']['pagination']['total'] . " clienti\n";

// Task attivi per tipo
echo "\nTask di tipo 'Campo' attivi:\n";
$taskCampo = callAPI("/task?tipo=Campo&stato=In%20corso");
echo "- Trovati: " . $taskCampo['data']['data']['pagination']['total'] . " task\n";

// Fatture dell'anno corrente
echo "\nFatture anno " . date('Y') . ":\n";
$fattureAnno = callAPI("/fatture?anno=" . date('Y'));
if (isset($fattureAnno['data']['data']['data'])) {
    $totaleAnno = 0;
    foreach ($fattureAnno['data']['data']['data'] as $f) {
        if ($f['TIPO'] === 'Fattura') {
            $totaleAnno += $f['Fatturato_TOT'];
        }
    }
    echo "- Numero fatture: " . count($fattureAnno['data']['data']['data']) . "\n";
    echo "- Fatturato totale: €$totaleAnno\n";
}

echo "\n" . str_repeat("=", 50) . "\n\n";

echo "=== FINE ESEMPI ===\n";
echo "Gli esempi sono stati eseguiti con successo.\n";
echo "Puoi trovare i dati creati nel database per ulteriori test.\n\n";

echo "DATI CREATI:\n";
echo "- Cliente ID: $clienteId\n";
echo "- Collaboratore ID: $collaboratoreId\n";
echo "- Commessa ID: $commessaId\n";
echo "- Task ID: $taskId\n";
if (isset($fatturaId)) echo "- Fattura ID: $fatturaId\n";
echo "\nPuoi utilizzare questi ID per testare ulteriori operazioni.\n";
?>