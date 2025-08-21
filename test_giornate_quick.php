<?php
// Test rapido per verificare l'endpoint giornate
require_once 'API/index.php';

// Simula una richiesta GET
$_GET['resource'] = 'giornate';
$_GET['task'] = 'TAS00006'; // Task di esempio

// Cattura l'output
ob_start();
$api = new APIRouter();
$api->handleRequest();
$output = ob_get_clean();

echo "=== TEST GIORNATE API ===\n";
echo "URL: ?resource=giornate&task=TAS00006\n";
echo "Output:\n";
echo $output;
?>