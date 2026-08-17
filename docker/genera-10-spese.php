<?php
/**
 * Rigenera docker/initdb/10-spese-quattro-commesse.sql dallo stato attuale del
 * database locale.
 *
 * Lo script 10 e' una fotografia: contiene le righe di task e giornate che si
 * scostano da quello che producono dump + migration, cioe' le correzioni fatte
 * a mano dall'interfaccia. Ogni volta che se ne fa una nuova la fotografia
 * invecchia, e un reset la perderebbe in silenzio - che e' esattamente il
 * problema che lo script 10 esiste per risolvere.
 *
 * Rigenerarlo invece di aggiornarlo a mano toglie di mezzo la dimenticanza.
 *
 * Utilizzo:
 *   docker compose exec -T web php /var/www/html/docker/genera-10-spese.php
 *   php docker/genera-10-spese.php            (con DB_HOST/DB_NAME/... nell'ambiente)
 *
 * Richiede che il database di confronto prod_260815 (il dump di produzione
 * caricato a parte) sia presente: e' il termine di paragone che dice quali
 * righe sono state toccate a mano.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Solo da riga di comando.\n");
}

$host = getenv('DB_HOST') ?: 'db';
$name = getenv('DB_NAME') ?: 'vaglioty_DB_VP';
$user = getenv('DB_USER') ?: 'vaglioty_DB_VP';
$pass = getenv('DB_PASS') ?: getenv('DB_PASSWORD');
$rif  = getenv('DB_RIFERIMENTO') ?: 'prod_260815';

$db = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass,
              [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// I task che si scostano da cio' che produce la migration 04 sul dump.
$task = $db->query("
    SELECT l.ID_TASK, l.Task, l.Spese_Comprese_Viaggi, l.Valore_Spese_std_Viaggi,
           l.Spese_Comprese_Vitto_Alloggio, l.Valore_Spese_std_Vitto_Alloggio
      FROM ANA_TASK l JOIN {$rif}.ANA_TASK p ON p.ID_TASK = l.ID_TASK
     WHERE COALESCE(l.Spese_Comprese_Viaggi,'') <> COALESCE(p.Spese_Comprese,'No')
        OR COALESCE(l.Spese_Comprese_Vitto_Alloggio,'') <>
           (CASE WHEN COALESCE(p.Valore_Spese_std,0) > 0 THEN 'Si'
                 ELSE COALESCE(p.Spese_Comprese,'No') END)
        OR COALESCE(l.Valore_Spese_std_Viaggi,0)         <> COALESCE(p.Valore_Spese_std,0)
        OR COALESCE(l.Valore_Spese_std_Vitto_Alloggio,0) <> 0
     ORDER BY l.ID_TASK")->fetchAll(PDO::FETCH_ASSOC);

// Le giornate con il viaggio tolto o il desk cambiato rispetto al dump.
$gio = $db->query("
    SELECT l.ID_GIORNATA, l.Data, c.Collaboratore, l.ID_TASK, t.ID_COMMESSA,
           COALESCE(l.Viaggio,'Si') AS viaggio,
           COALESCE(l.Desk,'No')    AS desk,
           COALESCE(p.Desk,'No')    AS desk_dump
      FROM FACT_GIORNATE l
      JOIN {$rif}.FACT_GIORNATE p ON p.ID_GIORNATA = l.ID_GIORNATA
      JOIN ANA_TASK t              ON t.ID_TASK = l.ID_TASK
      JOIN ANA_COLLABORATORI c     ON c.ID_COLLABORATORE = l.ID_COLLABORATORE
     WHERE COALESCE(l.Viaggio,'Si') = 'No'
        OR COALESCE(l.Desk,'No') <> COALESCE(p.Desk,'No')
     ORDER BY t.ID_COMMESSA, l.Data, c.Collaboratore")->fetchAll(PDO::FETCH_ASSOC);

$out = [];
$out[] = "-- Ambiente locale: rimette le correzioni fatte a mano su task e giornate.";
$out[] = "--";
$out[] = "-- GENERATO da docker/genera-10-spese.php: non modificare a mano, rigeneralo.";
$out[] = "-- Ogni correzione nuova fatta dall'interfaccia invecchia questa fotografia, e";
$out[] = "-- un reset la perderebbe in silenzio.";
$out[] = "--";
$out[] = "-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi";
$out[] = "-- script. Nessun USE: gira sul database indicato da MARIADB_DATABASE.";
$out[] = "-- Va dopo 04-spese-viaggi-vitto, che crea la colonna Viaggio e i campi di regime.";
$out[] = "--";
$out[] = "-- Le regole che hanno guidato queste correzioni stanno in";
$out[] = "-- docs/260815_MODIFICHE_IN_LOCAL_ALLINEAMENTO SPESE.md: il viaggio non si";
$out[] = "-- addebita due volte quando due consulenti vanno insieme, ne' il giorno dopo";
$out[] = "-- una giornata con albergo.";
$out[] = "--";
$out[] = "-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore. Data_Modifica";
$out[] = "-- viene riassegnata a se stessa per impedire a ON UPDATE di scattare, altrimenti";
$out[] = "-- il registro attivita' di Statistiche si riempie di modifiche fantasma.";
$out[] = "";

$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- Task: " . count($task) . " con un regime di spesa diverso dal default";
$out[] = "-- --------------------------------------------------------------------";
$out[] = "";
foreach ($task as $t) {
    $dv  = $t['Valore_Spese_std_Viaggi'] === null ? 'NULL' : number_format((float)$t['Valore_Spese_std_Viaggi'], 2, '.', '');
    $dva = $t['Valore_Spese_std_Vitto_Alloggio'] === null ? 'NULL' : number_format((float)$t['Valore_Spese_std_Vitto_Alloggio'], 2, '.', '');
    $out[] = "-- " . $t['ID_TASK'] . "  " . $t['Task'];
    $out[] = "UPDATE ANA_TASK";
    $out[] = "   SET Spese_Comprese_Viaggi         = '" . $t['Spese_Comprese_Viaggi'] . "',";
    $out[] = "       Valore_Spese_std_Viaggi       = " . $dv . ",";
    $out[] = "       Spese_Comprese_Vitto_Alloggio = '" . $t['Spese_Comprese_Vitto_Alloggio'] . "',";
    $out[] = "       Valore_Spese_std_Vitto_Alloggio = " . $dva . ",";
    $out[] = "       Data_Modifica = Data_Modifica";
    $out[] = " WHERE ID_TASK = '" . $t['ID_TASK'] . "';";
    $out[] = "";
}

// Le giornate si raggruppano per commessa, e dentro per tipo di correzione.
$perCommessa = [];
foreach ($gio as $g) { $perCommessa[$g['ID_COMMESSA']][] = $g; }

$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- Giornate: " . count($gio) . " con viaggio tolto o desk corretto";
$out[] = "-- Agganciate per ID_GIORNATA, che e' la chiave primaria e arriva dal dump.";
$out[] = "-- --------------------------------------------------------------------";
foreach ($perCommessa as $commessa => $righe) {
    $out[] = "";
    $out[] = "-- " . $commessa;
    $soloViaggio = array_filter($righe, fn($g) => $g['desk'] === $g['desk_dump']);
    $ancheDesk   = array_filter($righe, fn($g) => $g['desk'] !== $g['desk_dump']);
    foreach ([['Viaggio = \'No\'', $soloViaggio], ['Desk = \'No\', Viaggio = \'No\'', $ancheDesk]] as [$set, $gruppo]) {
        if (!$gruppo) continue;
        $out[] = "UPDATE FACT_GIORNATE SET {$set}, Data_Modifica = Data_Modifica WHERE ID_GIORNATA IN (";
        $n = count($gruppo); $i = 0;
        foreach ($gruppo as $g) {
            $i++;
            $out[] = sprintf("    '%s'%s   -- %s  %-18s %s",
                $g['ID_GIORNATA'], $i < $n ? ',' : ' ',
                date('d/m/Y', strtotime($g['Data'])), $g['Collaboratore'], $g['ID_TASK']);
        }
        $out[] = ");";
    }
}

$out[] = "";
$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- Controlli: " . count($gio) . " giornate senza viaggio, " . count($task) . " task con regime proprio.";
$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- SELECT COUNT(*) FROM FACT_GIORNATE WHERE Viaggio = 'No';";
$out[] = "";

$dest = __DIR__ . '/initdb/10-spese-quattro-commesse.sql';
file_put_contents($dest, implode("\n", $out));
echo "scritto $dest\n";
echo "  task:    " . count($task) . "\n";
echo "  giornate: " . count($gio) . "\n";
