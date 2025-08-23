<?php
// Test sintassi semplice
echo "Test PHP funziona";

// Test connessione database
require_once '../DB/config.php';
try {
    $db = getDatabase();
    echo " - Database OK";
} catch (Exception $e) {
    echo " - Database ERROR: " . $e->getMessage();
}

// Test session
session_start();
echo " - Session OK";

// Test AuthAPI
try {
    require_once 'AuthAPI.php';
    $auth = new AuthAPI();
    echo " - AuthAPI OK";
} catch (Exception $e) {
    echo " - AuthAPI ERROR: " . $e->getMessage();
}
?>