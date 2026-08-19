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

// I task creati dall'interfaccia non stanno nel dump, quindi nessuno script li
// ricreerebbe: vanno inseriti, non aggiornati. Trovato il 19/08/2026, quando un
// reset ha fatto sparire TAS00130 "AUDIT Collecchio" e la giornata collegata e'
// rimasta appesa al task del dump.
$nuovi = $db->query("
    SELECT l.*
      FROM ANA_TASK l
      LEFT JOIN {$rif}.ANA_TASK p ON p.ID_TASK = l.ID_TASK
     WHERE p.ID_TASK IS NULL
     ORDER BY l.ID_TASK")->fetchAll(PDO::FETCH_ASSOC);

// I task modificati dall'interfaccia su colonne che nessuno script rimette:
// stato, giornate previste, prezzo, e il regime di spesa quando e' stato
// cambiato a mano. Il regime si confronta con quello che 11-regime-spese
// deriverebbe dalle colonne vecchie: se l'utente lo cambia dall'interfaccia,
// la derivazione lo riporterebbe indietro.
$modificati = $db->query("
    SELECT l.ID_TASK, l.Task, l.ID_COMMESSA, l.Tipo, l.Stato_Task, l.gg_previste,
           l.Valore_gg, l.Data_Apertura_Task, l.Data_Fine, l.ID_COLLABORATORE,
           l.Regime_Spese_Viaggi, l.Valore_Spese_Viaggi,
           l.Regime_Spese_Vitto_Alloggio, l.Valore_Spese_Vitto_Alloggio
      FROM ANA_TASK l
      JOIN {$rif}.ANA_TASK p ON p.ID_TASK = l.ID_TASK
     WHERE NOT (l.Task <=> p.Task)
        OR NOT (l.ID_COMMESSA <=> p.ID_COMMESSA)
        OR NOT (l.Tipo <=> p.Tipo)
        OR NOT (l.Stato_Task <=> p.Stato_Task)
        OR NOT (l.gg_previste <=> p.gg_previste)
        OR NOT (l.Valore_gg <=> p.Valore_gg)
        OR NOT (l.Data_Apertura_Task <=> p.Data_Apertura_Task)
        OR NOT (l.Data_Fine <=> p.Data_Fine)
        OR NOT (l.ID_COLLABORATORE <=> p.ID_COLLABORATORE)
        OR NOT (l.Regime_Spese_Viaggi <=> CASE
                    WHEN l.Spese_Comprese_Viaggi = 'Si' THEN 'Compreso'
                    WHEN COALESCE(l.Valore_Spese_std_Viaggi, 0) > 0 THEN 'Diaria'
                    ELSE 'Reali' END)
        OR NOT (l.Regime_Spese_Vitto_Alloggio <=> CASE
                    WHEN l.ID_TASK = 'TAS00022' THEN 'Corpo'
                    WHEN l.Spese_Comprese_Vitto_Alloggio = 'Si' THEN 'Compreso'
                    WHEN COALESCE(l.Valore_Spese_std_Vitto_Alloggio, 0) > 0 THEN 'Diaria'
                    ELSE 'Reali' END)
     ORDER BY l.ID_TASK")->fetchAll(PDO::FETCH_ASSOC);

// Le giornate spostate su un task diverso da quello del dump.
$spostate = $db->query("
    SELECT l.ID_GIORNATA, l.ID_TASK, p.ID_TASK AS task_dump, l.Data
      FROM FACT_GIORNATE l
      JOIN {$rif}.FACT_GIORNATE p ON p.ID_GIORNATA = l.ID_GIORNATA
     WHERE NOT (l.ID_TASK <=> p.ID_TASK)
     ORDER BY l.ID_TASK, l.Data")->fetchAll(PDO::FETCH_ASSOC);

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
    // Le tre combinazioni vanno tenute separate. Fino al 19/08/2026 le righe
    // scelte per il solo cambio di Desk si prendevano anche Viaggio = 'No', e
    // un reset toglieva il viaggio a una giornata che l'aveva. Il difetto e'
    // emerso alla prima prova di reset vera.
    $soloViaggio = array_filter($righe, fn($g) => $g['desk'] === $g['desk_dump'] && $g['viaggio'] === 'No');
    $soloDesk    = array_filter($righe, fn($g) => $g['desk'] !== $g['desk_dump'] && $g['viaggio'] !== 'No');
    $ancheDesk   = array_filter($righe, fn($g) => $g['desk'] !== $g['desk_dump'] && $g['viaggio'] === 'No');
    foreach ([['Viaggio = \'No\'', $soloViaggio],
              ['Desk = \'No\'', $soloDesk],
              ['Desk = \'No\', Viaggio = \'No\'', $ancheDesk]] as [$set, $gruppo]) {
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
file_put_contents($dest, implode(PHP_EOL, $out));
echo "scritto $dest" . PHP_EOL;
echo "  task con regime proprio: " . count($task) . PHP_EOL;
echo "  giornate corrette:       " . count($gio) . PHP_EOL;

// =====================================================================
// Script 12: le righe nate in locale, che nessun altro script ricrea.
//
// Sta in un file separato ed e' eseguito DOPO 11-regime-spese, perche'
// l'INSERT elenca tutte le colonne di ANA_TASK e alcune le aggiunge proprio
// lo script 11: dentro il 10 fallirebbe con "unknown column".
// =====================================================================
$out = [];
$out[] = "-- Ambiente locale: i task creati dall'interfaccia e le giornate spostate.";
$out[] = "--";
$out[] = "-- GENERATO da docker/genera-10-spese.php: non modificare a mano, rigeneralo.";
$out[] = "--";
$out[] = "-- Gli altri script correggono righe che il dump gia' contiene. Queste no:";
$out[] = "-- sono righe nate in locale. Trovate il 19/08/2026 alla prima prova di reset";
$out[] = "-- vera, quando TAS00130 'AUDIT Collecchio' e' sparito e le sue due giornate";
$out[] = "-- sono tornate sul task del dump, senza che nulla lo segnalasse.";
$out[] = "--";
$out[] = "-- Va per ultimo, dopo 11-regime-spese: l'INSERT elenca anche le colonne";
$out[] = "-- di regime che quello script aggiunge.";
$out[] = "--";
$out[] = "-- Sicuro da rieseguire: INSERT IGNORE non duplica, gli UPDATE riscrivono lo";
$out[] = "-- stesso valore. Data_Modifica e' riassegnata a se stessa per non far";
$out[] = "-- scattare ON UPDATE.";
$out[] = "";

if ($nuovi) {
    $out[] = "-- =====================================================================";
    $out[] = "-- Task creati in locale (" . count($nuovi) . ")";
    $out[] = "-- =====================================================================";
    foreach ($nuovi as $t) {
        $col = array_keys($t);
        $val = array_map(fn($c) => $t[$c] === null ? 'NULL' : $db->quote($t[$c]), $col);
        $out[] = "";
        $out[] = "-- " . $t['Task'] . "  (" . $t['ID_COMMESSA'] . ")";
        $out[] = "INSERT IGNORE INTO ANA_TASK (" . implode(', ', $col) . ")";
        $out[] = "VALUES (" . implode(', ', $val) . ");";
    }
}

if ($modificati) {
    $out[] = "";
    $out[] = "-- =====================================================================";
    $out[] = "-- Task modificati dall'interfaccia (" . count($modificati) . ")";
    $out[] = "-- Stato, giornate previste, prezzo e regime di spesa: colonne che gli";
    $out[] = "-- altri script non rimettono, o che 11-regime-spese riporterebbe al";
    $out[] = "-- valore derivato dalle colonne vecchie.";
    $out[] = "-- =====================================================================";
    foreach ($modificati as $t) {
        $set = [];
        foreach (['Task','ID_COMMESSA','Tipo','Stato_Task','gg_previste','Valore_gg',
                  'Data_Apertura_Task','Data_Fine','ID_COLLABORATORE',
                  'Regime_Spese_Viaggi','Valore_Spese_Viaggi',
                  'Regime_Spese_Vitto_Alloggio','Valore_Spese_Vitto_Alloggio'] as $c) {
            $set[] = "       {$c} = " . ($t[$c] === null ? 'NULL' : $db->quote($t[$c]));
        }
        $out[] = "";
        $out[] = "-- " . $t['ID_TASK'] . "  " . $t['Task'];
        $out[] = "UPDATE ANA_TASK";
        $out[] = "   SET " . ltrim(implode("," . PHP_EOL, $set));
        $out[] = "     , Data_Modifica = Data_Modifica";
        $out[] = " WHERE ID_TASK = '" . $t['ID_TASK'] . "';";
    }
}

if ($spostate) {
    $out[] = "";
    $out[] = "-- =====================================================================";
    $out[] = "-- Giornate spostate su un altro task (" . count($spostate) . ")";
    $out[] = "-- Dopo gli INSERT qui sopra: il task di destinazione deve esistere.";
    $out[] = "-- =====================================================================";
    $perTaskSpostate = [];
    foreach ($spostate as $g) { $perTaskSpostate[$g['ID_TASK']][] = $g; }
    foreach ($perTaskSpostate as $idTask => $righe) {
        $ids = array_map(fn($g) => "'" . $g['ID_GIORNATA'] . "'", $righe);
        $out[] = "";
        $out[] = "-- verso " . $idTask . " (erano su " . ($righe[0]['task_dump'] ?? 'NULL') . ")";
        $out[] = "UPDATE FACT_GIORNATE SET ID_TASK = '{$idTask}', Data_Modifica = Data_Modifica";
        $out[] = " WHERE ID_GIORNATA IN (" . implode(',', $ids) . ");";
    }
}

$dest = __DIR__ . '/initdb/12-task-creati-in-locale.sql';
file_put_contents($dest, implode(PHP_EOL, $out));
echo "scritto $dest" . PHP_EOL;
echo "  task creati in locale:   " . count($nuovi) . PHP_EOL;
echo "  task modificati:         " . count($modificati) . PHP_EOL;
echo "  giornate spostate:       " . count($spostate) . PHP_EOL;
