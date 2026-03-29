<?php
$dir = __DIR__;

// Check ANA_TASK
echo "=== ANA_TASK.csv ===\n";
$f = fopen($dir.'/ANA_TASK.csv', 'r');
$h = fgetcsv($f, 0, ';');
echo count($h).' cols: '.implode(' | ', $h)."\n";
$tipoIdx = array_search('Tipo', $h);
$types = [];
$nr = 0;
while (($r = fgetcsv($f, 0, ';')) !== false) {
    $nr++;
    if (isset($r[$tipoIdx])) $types[$r[$tipoIdx]] = true;
}
fclose($f);
echo "Tipo values: ".implode(', ', array_keys($types))."\n";
echo "Rows: $nr\n\n";

// Check ANA_COMMESSE
echo "=== ANA_COMMESSE.csv ===\n";
$f = fopen($dir.'/ANA_COMMESSE.csv', 'r');
$h = fgetcsv($f, 0, ';');
echo count($h).' cols: '.implode(' | ', $h)."\n";
$stIdx = array_search('Stato_Commessa', $h);
$tipoIdx2 = array_search('Tipo_Commessa', $h);
$states = []; $types2 = [];
$nr = 0;
while (($r = fgetcsv($f, 0, ';')) !== false) {
    $nr++;
    if (isset($r[$stIdx])) $states[$r[$stIdx]] = true;
    if (isset($r[$tipoIdx2])) $types2[$r[$tipoIdx2]] = true;
}
fclose($f);
echo "Stato_Commessa values: ".implode(', ', array_keys($states))."\n";
echo "Tipo_Commessa values: ".implode(', ', array_keys($types2))."\n";
echo "Rows: $nr\n\n";

// Check FACT_GIORNATE
echo "=== FACT_GIORNATE.csv ===\n";
$f = fopen($dir.'/FACT_GIORNATE.csv', 'r');
$h = fgetcsv($f, 0, ';');
echo count($h).' cols: '.implode(' | ', $h)."\n";
$tipoIdx3 = array_search('Tipo', $h);
$deskIdx = array_search('Desk', $h);
$confIdx = array_search('Confermata', $h);
$tipos3 = []; $desks = []; $confs = [];
$nr = 0;
while (($r = fgetcsv($f, 0, ';')) !== false) {
    $nr++;
    if (isset($r[$tipoIdx3])) $tipos3[$r[$tipoIdx3]] = true;
    if (isset($r[$deskIdx])) $desks[$r[$deskIdx]] = true;
    if (isset($r[$confIdx])) $confs[$r[$confIdx]] = true;
}
fclose($f);
echo "Tipo values: ".implode(', ', array_keys($tipos3))."\n";
echo "Desk values: ".implode(', ', array_keys($desks))."\n";
echo "Confermata values: ".implode(', ', array_keys($confs))."\n";
echo "Rows: $nr\n";
