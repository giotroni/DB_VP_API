<?php
/**
 * Test rapido per verificare le API modificate
 */

// Abilita visualizzazione errori
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== TEST API MODIFICATE ===\n\n";

// Test 1: API Task
echo "1. Test API Task:\n";
$taskResponse = file_get_contents('https://vaglioandpartners.com/../API/task?limit=5');
if ($taskResponse) {
    echo "Risposta Task API (primi 500 caratteri):\n";
    echo substr($taskResponse, 0, 500) . "\n\n";
    
    $taskData = json_decode($taskResponse, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo "✅ JSON Task valido\n";
        if (isset($taskData['data']['data'][0])) {
            $firstTask = $taskData['data']['data'][0];
            echo "Primo task ID: " . ($firstTask['ID_TASK'] ?? 'N/A') . "\n";
            echo "Giorni effettuati: " . ($firstTask['gg_effettuate'] ?? 'N/A') . "\n";
            echo "Nome commessa: " . ($firstTask['commessa_nome'] ?? 'N/A') . "\n";
        }
    } else {
        echo "❌ Errore JSON Task: " . json_last_error_msg() . "\n";
    }
} else {
    echo "❌ Errore chiamata API Task\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Test 2: API Commesse  
echo "2. Test API Commesse:\n";
$commesseResponse = file_get_contents('https://vaglioandpartners.com/../API/commesse?limit=5');
if ($commesseResponse) {
    echo "Risposta Commesse API (primi 500 caratteri):\n";
    echo substr($commesseResponse, 0, 500) . "\n\n";
    
    $commesseData = json_decode($commesseResponse, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo "✅ JSON Commesse valido\n";
        if (isset($commesseData['data']['data'][0])) {
            $firstCommessa = $commesseData['data']['data'][0];
            echo "Prima commessa ID: " . ($firstCommessa['ID_COMMESSA'] ?? 'N/A') . "\n";
            echo "Nome commessa: " . ($firstCommessa['Commessa'] ?? 'N/A') . "\n";
            echo "Nome cliente: " . ($firstCommessa['Cliente'] ?? 'N/A') . "\n";
        }
    } else {
        echo "❌ Errore JSON Commesse: " . json_last_error_msg() . "\n";
    }
} else {
    echo "❌ Errore chiamata API Commesse\n";
}

echo "\n" . str_repeat("-", 50) . "\n\n";

// Test 3: API Collaboratori
echo "3. Test API Collaboratori:\n";
$collabResponse = file_get_contents('https://vaglioandpartners.com/../API/collaboratori?limit=5');
if ($collabResponse) {
    echo "Risposta Collaboratori API (primi 300 caratteri):\n";
    echo substr($collabResponse, 0, 300) . "\n\n";
    
    $collabData = json_decode($collabResponse, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo "✅ JSON Collaboratori valido\n";
    } else {
        echo "❌ Errore JSON Collaboratori: " . json_last_error_msg() . "\n";
    }
} else {
    echo "❌ Errore chiamata API Collaboratori\n";
}

echo "\n=== FINE TEST ===\n";
?>