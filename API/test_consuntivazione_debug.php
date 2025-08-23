<?php
// Test debug per ConsuntivazioneAPI
require_once '../DB/config.php';
require_once 'AuthAPI.php';

// Simula una sessione di login
session_start();
$_SESSION['user_id'] = 'CONS003';
$_SESSION['user_name'] = 'Giorgio Troni';
$_SESSION['user_email'] = 'gtroni@vaglioandpartners.com';
$_SESSION['user_role'] = 'Admin';
$_SESSION['session_token'] = 'test_token';
$_SESSION['login_time'] = time();

class ConsuntivazioneTest {
    private $db;
    private $authAPI;
    
    public function __construct() {
        $this->db = getDatabase();
        $this->authAPI = new AuthAPI();
    }
    
    public function testStatistiche() {
        echo "<h3>Test Statistiche</h3>";
        
        try {
            $user = $this->authAPI->getCurrentUser();
            echo "<p>User ID: " . $user['id'] . "</p>";
            
            // Test query ore mese
            echo "<h4>Test 1: Ore mese</h4>";
            $sql1 = "SELECT COALESCE(SUM(gg), 0) as ore_mese
                     FROM FACT_GIORNATE 
                     WHERE ID_COLLABORATORE = :user_id 
                     AND MONTH(Data) = MONTH(CURDATE()) 
                     AND YEAR(Data) = YEAR(CURDATE())";
            
            $stmt1 = $this->db->prepare($sql1);
            $stmt1->execute(['user_id' => $user['id']]);
            $oreMese = $stmt1->fetch()['ore_mese'];
            echo "<p style='color: green;'>✅ Ore mese: $oreMese</p>";
            
            // Test query progetti attivi
            echo "<h4>Test 2: Progetti attivi</h4>";
            $sql2 = "SELECT COUNT(DISTINCT t.ID_COMMESSA) as progetti_attivi
                     FROM ANA_TASK t
                     LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                     WHERE t.ID_COLLABORATORE = :user_id 
                     AND t.Stato_Task IN ('In corso', 'Sospeso')
                     AND c.Stato_Commessa IN ('In corso', 'Sospesa')";
            
            $stmt2 = $this->db->prepare($sql2);
            $stmt2->execute(['user_id' => $user['id']]);
            $progettiAttivi = $stmt2->fetch()['progetti_attivi'];
            echo "<p style='color: green;'>✅ Progetti attivi: $progettiAttivi</p>";
            
        } catch (Exception $e) {
            echo "<p style='color: red;'>❌ ERRORE: " . $e->getMessage() . "</p>";
            echo "<p>Traccia:</p><pre>" . $e->getTraceAsString() . "</pre>";
        }
    }
    
    public function testUltimeConsuntivazioni() {
        echo "<h3>Test Ultime Consuntivazioni</h3>";
        
        try {
            $user = $this->authAPI->getCurrentUser();
            
            $sql = "SELECT 
                        g.ID_GIORNATA,
                        g.Data,
                        g.gg,
                        t.Task,
                        c.Commessa
                    FROM FACT_GIORNATE g
                    LEFT JOIN ANA_TASK t ON g.ID_TASK = t.ID_TASK
                    LEFT JOIN ANA_COMMESSE c ON t.ID_COMMESSA = c.ID_COMMESSA
                    WHERE g.ID_COLLABORATORE = :user_id
                    ORDER BY g.Data DESC
                    LIMIT 5";
                    
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':user_id', $user['id'], PDO::PARAM_STR);
            $stmt->execute();
            
            $consuntivazioni = $stmt->fetchAll();
            echo "<p style='color: green;'>✅ Trovate " . count($consuntivazioni) . " consuntivazioni</p>";
            
            if (count($consuntivazioni) > 0) {
                echo "<pre>" . print_r($consuntivazioni[0], true) . "</pre>";
            }
            
        } catch (Exception $e) {
            echo "<p style='color: red;'>❌ ERRORE: " . $e->getMessage() . "</p>";
            echo "<p>Traccia:</p><pre>" . $e->getTraceAsString() . "</pre>";
        }
    }
}

?>
<!DOCTYPE html>
<html>
<head>
    <title>Test ConsuntivazioneAPI</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        h3 { color: #333; border-bottom: 2px solid #ddd; }
    </style>
</head>
<body>
    <h1>Test ConsuntivazioneAPI</h1>
    <?php 
    $test = new ConsuntivazioneTest();
    $test->testStatistiche();
    $test->testUltimeConsuntivazioni();
    ?>
</body>
</html>