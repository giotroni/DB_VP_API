<?php
echo "<h2>Test Email System</h2>";

// Verifica configurazione PHP mail
echo "<h3>Configurazione PHP Mail:</h3>";
echo "<ul>";
echo "<li>sendmail_path: " . ini_get('sendmail_path') . "</li>";
echo "<li>SMTP: " . ini_get('SMTP') . "</li>";
echo "<li>smtp_port: " . ini_get('smtp_port') . "</li>";
echo "<li>sendmail_from: " . ini_get('sendmail_from') . "</li>";
echo "</ul>";

// Test semplice invio email
$testEmail = "test@example.com";
$subject = "Test Email V&P";
$message = "Questo è un test del sistema email.";
$headers = "From: noreply@vepsystem.com\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

echo "<h3>Test Invio Email:</h3>";
echo "<p>Invio email a: $testEmail</p>";

$result = mail($testEmail, $subject, $message, $headers);

if ($result) {
    echo "<div style='color: green;'>✅ Email inviata con successo!</div>";
} else {
    echo "<div style='color: red;'>❌ Errore nell'invio email.</div>";
}

// Verifica se PHP è in modalità locale
echo "<h3>Informazioni Sistema:</h3>";
echo "<p>Server: " . $_SERVER['SERVER_NAME'] . "</p>";
echo "<p>Documento Root: " . $_SERVER['DOCUMENT_ROOT'] . "</p>";
echo "<p>PHP Version: " . phpversion() . "</p>";

// Log dell'operazione
error_log("Test email eseguito - Risultato: " . ($result ? 'SUCCESS' : 'FAILED'));
?>