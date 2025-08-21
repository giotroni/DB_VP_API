<?php
/**
 * Test Suite per le API Vaglio & Partners
 * Script per testare tutte le funzionalità CRUD delle API
 */

// Configurazione test
$baseUrl = 'https://vaglioandpartners.com/gestione_VP/API/index.php'; // URL base con index.php
$testData = [];

echo "=== TEST API VAGLIO & PARTNERS ===\n";
echo "Base URL: $baseUrl\n\n";

// Prima di tutto testiamo il file semplice
echo "0. TEST PRELIMINARE\n";
testOperation("Simple Test", str_replace('/index.php', '/simple_test.php', $baseUrl));
testOperation("Routing Test", str_replace('/index.php', '/routing_test.php', $baseUrl));
echo "\n";

/**
 * Funzione helper per fare richieste HTTP
 */
function makeRequest($url, $method = 'GET', $data = null) {
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
    $error = curl_error($curl);
    
    curl_close($curl);
    
    if ($error) {
        throw new Exception("CURL Error: $error");
    }
    
    return [
        'code' => $httpCode,
        'body' => json_decode($response, true),
        'raw' => $response
    ];
}

/**
 * Testa una singola operazione API
 */
function testOperation($name, $url, $method = 'GET', $data = null, $expectedCode = 200) {
    echo "Testing: $name... ";
    
    try {
        $response = makeRequest($url, $method, $data);
        
        if ($response['code'] === $expectedCode) {
            echo "✅ PASS (HTTP {$response['code']})\n";
            return $response['body'];
        } else {
            echo "❌ FAIL (Expected {$expectedCode}, got {$response['code']})\n";
            if (isset($response['body']['error'])) {
                echo "   Error: {$response['body']['error']}\n";
            }
            return null;
        }
    } catch (Exception $e) {
        echo "❌ ERROR: {$e->getMessage()}\n";
        return null;
    }
}

// Test dello stato API
echo "1. TEST STATO API\n";
testOperation("API Status", "$baseUrl?resource=status&debug=1");
testOperation("API Documentation", "$baseUrl?debug=1");
echo "\n";

// Test Clienti
echo "2. TEST CLIENTI\n";
$clienteData = [
    'Cliente' => 'TEST CLIENT SRL',
    'Denominazione_Sociale' => 'Test Client Solutions SRL',
    'Indirizzo' => 'Via Test 123',
    'Citta' => 'Milano',
    'CAP' => '20100',
    'Provincia' => 'MI',
    'P_IVA' => '99999999999'
];

$clienteCreato = testOperation("Crea Cliente", "$baseUrl?resource=clienti", 'POST', $clienteData, 200);
if ($clienteCreato && isset($clienteCreato['data']['ID_CLIENTE'])) {
    $testData['cliente_id'] = $clienteCreato['data']['ID_CLIENTE'];
    echo "   Created Cliente ID: {$testData['cliente_id']}\n";
    
    testOperation("Lista Clienti", "$baseUrl?resource=clienti");
    testOperation("Dettaglio Cliente", "$baseUrl?resource=clienti&id={$testData['cliente_id']}");
    testOperation("Aggiorna Cliente", "$baseUrl?resource=clienti&id={$testData['cliente_id']}", 'PUT', ['Citta' => 'Roma']);
}
echo "\n";

// Test Collaboratori
echo "3. TEST COLLABORATORI\n";
$collaboratoreData = [
    'Collaboratore' => 'Test User',
    'Email' => 'test.user@test.com',
    'PWD' => 'password123',
    'Ruolo' => 'User'
];

$collaboratoreCreato = testOperation("Crea Collaboratore", "$baseUrl?resource=collaboratori", 'POST', $collaboratoreData, 200);
if ($collaboratoreCreato && isset($collaboratoreCreato['data']['ID_COLLABORATORE'])) {
    $testData['collaboratore_id'] = $collaboratoreCreato['data']['ID_COLLABORATORE'];
    echo "   Created Collaboratore ID: {$testData['collaboratore_id']}\n";
    
    testOperation("Lista Collaboratori", "$baseUrl?resource=collaboratori");
    testOperation("Dettaglio Collaboratore", "$baseUrl?resource=collaboratori&id={$testData['collaboratore_id']}");
}
echo "\n";

// Test Commesse
if (isset($testData['cliente_id'], $testData['collaboratore_id'])) {
    echo "4. TEST COMMESSE\n";
    $commessaData = [
        'Commessa' => 'Test Project',
        'Tipo_Commessa' => 'Cliente',
        'ID_CLIENTE' => $testData['cliente_id'],
        'ID_COLLABORATORE' => $testData['collaboratore_id'],
        'Data_Apertura_Commessa' => date('Y-m-d'),
        'Stato_Commessa' => 'In corso'
    ];
    
    $commessaCreata = testOperation("Crea Commessa", "$baseUrl?resource=commesse", 'POST', $commessaData, 200);
    if ($commessaCreata && isset($commessaCreata['data']['ID_COMMESSA'])) {
        $testData['commessa_id'] = $commessaCreata['data']['ID_COMMESSA'];
        echo "   Created Commessa ID: {$testData['commessa_id']}\n";
        
        testOperation("Lista Commesse", "$baseUrl?resource=commesse");
        testOperation("Dettaglio Commessa", "$baseUrl?resource=commesse&id={$testData['commessa_id']}");
    }
    echo "\n";
}

// Test Task
if (isset($testData['commessa_id'], $testData['collaboratore_id'])) {
    echo "5. TEST TASK\n";
    $taskData = [
        'Task' => 'Test Task',
        'Desc_Task' => 'Task di test per API',
        'ID_COMMESSA' => $testData['commessa_id'],
        'ID_COLLABORATORE' => $testData['collaboratore_id'],
        'Tipo' => 'Campo',
        'Data_Apertura_Task' => date('Y-m-d'),
        'gg_previste' => 3.0,
        'Stato_Task' => 'In corso'
    ];
    
    $taskCreato = testOperation("Crea Task", "$baseUrl?resource=task", 'POST', $taskData, 200);
    if ($taskCreato && isset($taskCreato['data']['ID_TASK'])) {
        $testData['task_id'] = $taskCreato['data']['ID_TASK'];
        echo "   Created Task ID: {$testData['task_id']}\n";
        
        testOperation("Lista Task", "$baseUrl?resource=task");
        testOperation("Dettaglio Task", "$baseUrl?resource=task&id={$testData['task_id']}");
    }
    echo "\n";
}

// Test Tariffe
if (isset($testData['collaboratore_id'])) {
    echo "6. TEST TARIFFE\n";
    $tariffaData = [
        'ID_COLLABORATORE' => $testData['collaboratore_id'],
        'Tariffa_gg' => 900.00,
        'Dal' => date('Y-m-d')
    ];
    
    $tariffaCreata = testOperation("Crea Tariffa", "$baseUrl?resource=tariffe", 'POST', $tariffaData, 200);
    if ($tariffaCreata && isset($tariffaCreata['data']['ID_TARIFFA'])) {
        $testData['tariffa_id'] = $tariffaCreata['data']['ID_TARIFFA'];
        echo "   Created Tariffa ID: {$testData['tariffa_id']}\n";
        
        testOperation("Lista Tariffe", "$baseUrl?resource=tariffe");
        testOperation("Dettaglio Tariffa", "$baseUrl?resource=tariffe&id={$testData['tariffa_id']}");
    }
    echo "\n";
}

// Test Giornate
if (isset($testData['collaboratore_id'], $testData['task_id'])) {
    echo "7. TEST GIORNATE\n";
    $giornataData = [
        'Data' => date('Y-m-d'),
        'ID_COLLABORATORE' => $testData['collaboratore_id'],
        'ID_TASK' => $testData['task_id'],
        'Tipo' => 'Campo',
        'Desk' => 'No',
        'gg' => 1.0,
        'Note' => 'Giornata di test'
    ];
    
    $giornataCreata = testOperation("Crea Giornata", "$baseUrl?resource=giornate", 'POST', $giornataData, 200);
    if ($giornataCreata && isset($giornataCreata['data']['ID_GIORNATA'])) {
        $testData['giornata_id'] = $giornataCreata['data']['ID_GIORNATA'];
        echo "   Created Giornata ID: {$testData['giornata_id']}\n";
        
        testOperation("Lista Giornate", "$baseUrl?resource=giornate");
        testOperation("Dettaglio Giornata", "$baseUrl?resource=giornate&id={$testData['giornata_id']}");
    }
    echo "\n";
}

// Test Fatture
if (isset($testData['cliente_id'])) {
    echo "8. TEST FATTURE\n";
    $fatturaData = [
        'Data' => date('Y-m-d'),
        'ID_CLIENTE' => $testData['cliente_id'],
        'TIPO' => 'Fattura',
        'NR' => 'TEST_' . date('YmdHis'),
        'ID_COMMESSA' => $testData['commessa_id'],
        'Fatturato_gg' => 1000.00,
        'Fatturato_Spese' => 250.00,
        'Fatturato_TOT' => 1250.00,
        'Note' => 'Fattura di test'
    ];
    
    $fatturaCreata = testOperation("Crea Fattura", "$baseUrl?resource=fatture", 'POST', $fatturaData, 200);
    if ($fatturaCreata && isset($fatturaCreata['data']['ID_FATTURA'])) {
        $testData['fattura_id'] = $fatturaCreata['data']['ID_FATTURA'];
        echo "   Created Fattura ID: {$testData['fattura_id']}\n";
        
        testOperation("Lista Fatture", "$baseUrl?resource=fatture");
        testOperation("Dettaglio Fattura", "$baseUrl?resource=fatture&id={$testData['fattura_id']}");
    }
    echo "\n";
}

// Test Filtri Avanzati
echo "9. TEST FILTRI AVANZATI\n";
testOperation("Clienti con filtro città", "$baseUrl?resource=clienti&citta=Milano");
testOperation("Commesse attive", "$baseUrl?resource=commesse&stato=Attiva");
testOperation("Giornate con spese", "$baseUrl?resource=giornate&data_da=" . date('Y-m-01'));
testOperation("Fatture per cliente", "$baseUrl?resource=fatture&cliente={$testData['cliente_id']}");
echo "\n";

// Test Validazioni (dovrebbero fallire)
echo "10. TEST VALIDAZIONI (devono fallire)\n";
testOperation("Cliente senza nome", "$baseUrl?resource=clienti", 'POST', ['P_IVA' => '12345678901'], 400);
testOperation("Email duplicata", "$baseUrl?resource=collaboratori", 'POST', $collaboratoreData, 400);
testOperation("Commessa con cliente inesistente", "$baseUrl?resource=commesse", 'POST', [
    'Commessa' => 'Test',
    'Tipo_Commessa' => 'Cliente',
    'ID_CLIENTE' => 'INESISTENTE'
], 400);
echo "\n";

// Cleanup - Elimina i dati di test (in ordine inverso per rispettare i vincoli)
echo "11. CLEANUP DATI DI TEST\n";
if (isset($testData['fattura_id'])) {
    testOperation("Elimina Fattura", "$baseUrl?resource=fatture&id={$testData['fattura_id']}", 'DELETE');
}
if (isset($testData['giornata_id'])) {
    testOperation("Elimina Giornata", "$baseUrl?resource=giornate&id={$testData['giornata_id']}", 'DELETE');
}
if (isset($testData['tariffa_id'])) {
    testOperation("Elimina Tariffa", "$baseUrl?resource=tariffe&id={$testData['tariffa_id']}", 'DELETE');
}
if (isset($testData['task_id'])) {
    testOperation("Elimina Task", "$baseUrl?resource=task&id={$testData['task_id']}", 'DELETE');
}
if (isset($testData['commessa_id'])) {
    testOperation("Elimina Commessa", "$baseUrl?resource=commesse&id={$testData['commessa_id']}", 'DELETE');
}
if (isset($testData['collaboratore_id'])) {
    testOperation("Elimina Collaboratore", "$baseUrl?resource=collaboratori&id={$testData['collaboratore_id']}", 'DELETE');
}
if (isset($testData['cliente_id'])) {
    testOperation("Elimina Cliente", "$baseUrl?resource=clienti&id={$testData['cliente_id']}", 'DELETE');
}

echo "\n=== FINE TEST ===\n";
echo "Tutti i test completati. Verifica i risultati sopra.\n";
echo "Gli elementi con ✅ sono passati, quelli con ❌ sono falliti.\n";
?>