<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once 'config.php';

try {
    $pdo = getDatabase();

    // The SQL query to fetch FACT_GIORNATE with the calculated Costo_gg
    $sql = "
    SELECT
        fg.*,
        COALESCE(
            tc_specific.Tariffa_gg,
            tc_default.Tariffa_gg
        ) AS Costo_gg
    FROM
        FACT_GIORNATE fg
    LEFT JOIN
        ANA_TASK at ON fg.ID_TASK = at.ID_TASK
    LEFT JOIN
        ANA_TARIFFE_COLLABORATORI tc_specific ON fg.ID_COLLABORATORE = tc_specific.ID_COLLABORATORE
        AND at.ID_COMMESSA = tc_specific.ID_COMMESSA
    LEFT JOIN
        ANA_TARIFFE_COLLABORATORI tc_default ON fg.ID_COLLABORATORE = tc_default.ID_COLLABORATORE
        AND tc_default.ID_COMMESSA IS NULL
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Apply the calculation: gg * Costo_gg
    foreach ($data as &$row) {
        $row['Costo_gg_Totale'] = $row['gg'] * $row['Costo_gg'];
    }

    echo json_encode($data, JSON_PRETTY_PRINT);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database query failed: " . $e->getMessage()]);
}
?>