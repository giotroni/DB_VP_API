<?php
/**
 * Test del routing per debug URL parsing
 */

echo "=== ROUTING TEST ===\n\n";

echo "SERVER INFO:\n";
echo "REQUEST_URI: " . ($_SERVER['REQUEST_URI'] ?? 'non disponibile') . "\n";
echo "SCRIPT_NAME: " . ($_SERVER['SCRIPT_NAME'] ?? 'non disponibile') . "\n";
echo "PATH_INFO: " . ($_SERVER['PATH_INFO'] ?? 'non disponibile') . "\n";
echo "QUERY_STRING: " . ($_SERVER['QUERY_STRING'] ?? 'non disponibile') . "\n";

$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

echo "\nPATH PARSING:\n";
echo "Original path: $path\n";

// Test del nuovo pattern di parsing
$parsed_path = preg_replace('#^.*/API/?#', '', $path);
echo "Parsed path: $parsed_path\n";

$path_parts = explode('/', trim($parsed_path, '/'));
$resource = $path_parts[0] ?? '';
$id = $path_parts[1] ?? null;

echo "Resource: '$resource'\n";
echo "ID: " . ($id ?? 'null') . "\n";

echo "\nTEST CASES:\n";
$test_cases = [
    '/gestione_VP/API/status',
    '/gestione_VP/API/clienti',
    '/gestione_VP/API/clienti/123',
    '/API/status',
    '/status'
];

foreach ($test_cases as $test_uri) {
    $test_path = parse_url($test_uri, PHP_URL_PATH);
    $test_parsed = preg_replace('#^.*/API/?#', '', $test_path);
    $test_parts = explode('/', trim($test_parsed, '/'));
    $test_resource = $test_parts[0] ?? '';
    
    echo "URI: $test_uri -> Resource: '$test_resource'\n";
}

// Output JSON per test automatici
header('Content-Type: application/json');
echo "\n" . json_encode([
    'success' => true,
    'server_info' => [
        'request_uri' => $_SERVER['REQUEST_URI'] ?? null,
        'script_name' => $_SERVER['SCRIPT_NAME'] ?? null,
        'path_info' => $_SERVER['PATH_INFO'] ?? null
    ],
    'parsing' => [
        'original_path' => $path,
        'parsed_path' => $parsed_path,
        'resource' => $resource,
        'id' => $id
    ]
], JSON_PRETTY_PRINT);
?>