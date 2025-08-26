<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once 'config.php';

try {
    $pdo = getDatabase();
    $stmt = $pdo->prepare("SELECT * FROM ANA_TASK");
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($data, JSON_PRETTY_PRINT);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database query failed: " . $e->getMessage()]);
}
?>