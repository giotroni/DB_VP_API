<?php
/**
 * Rigenera docker/initdb/09-attribuzioni-fatture-commesse.sql dallo stato
 * attuale del database locale.
 *
 * Lo script 09 e' una fotografia: contiene le righe che si scostano da quello
 * che producono dump + migration, cioe' il lavoro fatto a mano dall'interfaccia
 * per collegare le fatture alle commesse e per rimettere a posto gli
 * intestatari. Ogni attribuzione nuova invecchia la fotografia, e un reset la
 * perderebbe in silenzio - che e' esattamente il problema che lo script 09
 * esiste per risolvere. E' successo il 17/08/2026 con otto righe.
 *
 * Rispetto alla prima versione, scritta a mano, copre quattro divergenze e non
 * una sola: le tre nuove erano scoperte del tutto.
 *
 *   FACT_FATTURE.ID_COMMESSA            il collegamento alla commessa
 *   FACT_FATTURE.ID_CLIENTE             l'intestatario corretto a mano
 *   ANA_COMMESSE.ID_CLIENTE             la commessa spostata sul soggetto giusto
 *   ANA_COMMESSE.Data_Apertura_Commessa
 *   ANA_COMMESSE.Commessa                il nome corretto o precisato a mano
 *   ANA_COMMESSE.Stato_Commessa
 *
 * Utilizzo:
 *   docker compose exec -T web php /var/www/html/docker/genera-09-attribuzioni.php
 *
 * Richiede il database di confronto prod_260815, il dump di produzione caricato
 * a parte: e' il termine di paragone che dice quali righe sono state toccate.
 *
 * Il confronto e' una LEFT JOIN e non una INNER, per una ragione trovata sul
 * campo il 19/08/2026: le fatture 39/26 e 40/26 non esistono nel dump - le crea
 * la migration 06 - e con la INNER sparivano dal diff, cosi' le loro
 * attribuzioni non finivano nella fotografia e il reset le perdeva. Una riga
 * assente dal riferimento e' divergente per definizione, se in locale ha un
 * valore.
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

// Le fatture si agganciano per NR e non per ID_FATTURA: le numerazioni sono
// sistemate da 05-note-accredito e 06-allinea-fatture-pdf, e nel dump la 01/26
// e' ancora scritta "1/26". Per questo lo script va per ultimo.
$fatture = $db->query("
    SELECT l.NR, l.ID_COMMESSA, l.ID_CLIENTE, c.Commessa, cl.Cliente,
           (p.ID_FATTURA IS NULL OR NOT (l.ID_COMMESSA <=> p.ID_COMMESSA))
               AND l.ID_COMMESSA IS NOT NULL AS commessa_cambiata,
           p.ID_FATTURA IS NOT NULL AND NOT (l.ID_CLIENTE <=> p.ID_CLIENTE) AS cliente_cambiato
      FROM FACT_FATTURE l
      LEFT JOIN {$rif}.FACT_FATTURE p ON p.ID_FATTURA = l.ID_FATTURA
      LEFT JOIN ANA_COMMESSE c   ON c.ID_COMMESSA = l.ID_COMMESSA
      LEFT JOIN ANA_CLIENTI cl   ON cl.ID_CLIENTE = l.ID_CLIENTE
     WHERE (p.ID_FATTURA IS NULL AND l.ID_COMMESSA IS NOT NULL)
        OR NOT (l.ID_COMMESSA <=> p.ID_COMMESSA) OR NOT (l.ID_CLIENTE <=> p.ID_CLIENTE)
     ORDER BY l.ID_COMMESSA, l.Data, l.NR")->fetchAll(PDO::FETCH_ASSOC);

$commesse = $db->query("
    SELECT l.ID_COMMESSA, l.Commessa, l.ID_CLIENTE, l.Data_Apertura_Commessa,
           l.Stato_Commessa, cl.Cliente,
           NOT (l.ID_CLIENTE <=> p.ID_CLIENTE) AS cliente_cambiato,
           NOT (l.Data_Apertura_Commessa <=> p.Data_Apertura_Commessa) AS data_cambiata,
           NOT (l.Commessa <=> p.Commessa) AS nome_cambiato,
           NOT (l.Stato_Commessa <=> p.Stato_Commessa) AS stato_cambiato,
           p.Data_Apertura_Commessa AS data_dump,
           p.Commessa AS nome_dump,
           p.Stato_Commessa AS stato_dump
      FROM ANA_COMMESSE l
      JOIN {$rif}.ANA_COMMESSE p ON p.ID_COMMESSA = l.ID_COMMESSA
      LEFT JOIN ANA_CLIENTI cl   ON cl.ID_CLIENTE = l.ID_CLIENTE
     WHERE NOT (l.ID_CLIENTE <=> p.ID_CLIENTE)
        OR NOT (l.Data_Apertura_Commessa <=> p.Data_Apertura_Commessa)
        OR NOT (l.Commessa <=> p.Commessa)
        OR NOT (l.Stato_Commessa <=> p.Stato_Commessa)
     ORDER BY l.ID_COMMESSA")->fetchAll(PDO::FETCH_ASSOC);

$out = [];
$out[] = "-- Ambiente locale: rimette il lavoro fatto a mano su fatture e commesse.";
$out[] = "--";
$out[] = "-- GENERATO da docker/genera-09-attribuzioni.php: non modificare a mano,";
$out[] = "-- rigeneralo. Ogni attribuzione nuova fatta dall'interfaccia invecchia questa";
$out[] = "-- fotografia, e un reset la perderebbe in silenzio.";
$out[] = "--";
$out[] = "-- Serve perche' reset-db.ps1 ricrea il volume da zero e riesegue solo questi";
$out[] = "-- script, e nessuna migration valorizza ID_COMMESSA. E' successo il 17/08/2026:";
$out[] = "-- i conteggi delle tabelle tornavano tutti giusti e il reset sembrava riuscito,";
$out[] = "-- ma il fatturato per commessa era tornato indietro di otto righe senza che";
$out[] = "-- nulla lo segnalasse.";
$out[] = "--";
$out[] = "-- Nessun USE: gira sul database indicato da MARIADB_DATABASE. Va per ultimo";
$out[] = "-- fra 05 e 08, perche' aggancia le fatture per NR e le numerazioni sono";
$out[] = "-- sistemate da 05-note-accredito e 06-allinea-fatture-pdf.";
$out[] = "--";
$out[] = "-- Sicuro da rieseguire: gli UPDATE scrivono lo stesso valore, e";
$out[] = "-- Data_Modifica = Data_Modifica impedisce che il timestamp si sposti.";
$out[] = "";

// ---- fatture: ID_COMMESSA, raggruppate per commessa ----
$perCommessa = [];
foreach ($fatture as $f) {
    if (!$f['commessa_cambiata']) continue;
    $perCommessa[$f['ID_COMMESSA'] ?? ''][] = $f;
}
$nCommessa = array_sum(array_map('count', $perCommessa));
if ($perCommessa) {
    $out[] = "-- =====================================================================";
    $out[] = "-- Fatture -> commesse ({$nCommessa} righe)";
    $out[] = "-- =====================================================================";
    foreach ($perCommessa as $idCommessa => $righe) {
        $nomi = array_map(function ($f) { return "'" . $f['NR'] . "'"; }, $righe);
        $etichetta = $idCommessa === '' ? 'nessuna commessa' : ($righe[0]['Commessa'] ?? $idCommessa);
        $valore = $idCommessa === '' ? 'NULL' : "'" . $idCommessa . "'";
        $out[] = "";
        $out[] = "-- " . $idCommessa . "  " . $etichetta;
        $out[] = "UPDATE FACT_FATTURE SET ID_COMMESSA = {$valore}, Data_Modifica = Data_Modifica";
        $out[] = " WHERE NR IN (" . implode(',', $nomi) . ");";
    }
}

// ---- fatture: ID_CLIENTE ----
$perCliente = [];
foreach ($fatture as $f) {
    if (!$f['cliente_cambiato']) continue;
    $perCliente[$f['ID_CLIENTE']][] = $f;
}
$nCliente = array_sum(array_map('count', $perCliente));
if ($perCliente) {
    $out[] = "";
    $out[] = "-- =====================================================================";
    $out[] = "-- Intestatari corretti a mano ({$nCliente} fatture)";
    $out[] = "--";
    $out[] = "-- Non e' un errore che fattura e commessa stiano su clienti diversi: lo";
    $out[] = "-- decide l'ordine. Le fatture emesse al cliente sbagliato e poi stornate";
    $out[] = "-- restano com'erano, perche' il cliente sbagliato e' il motivo per cui";
    $out[] = "-- esiste la nota di accredito che le annulla.";
    $out[] = "-- =====================================================================";
    foreach ($perCliente as $idCliente => $righe) {
        $nomi = array_map(function ($f) { return "'" . $f['NR'] . "'"; }, $righe);
        $out[] = "";
        $out[] = "-- " . $idCliente . "  " . ($righe[0]['Cliente'] ?? '');
        $out[] = "UPDATE FACT_FATTURE SET ID_CLIENTE = '{$idCliente}', Data_Modifica = Data_Modifica";
        $out[] = " WHERE NR IN (" . implode(',', $nomi) . ");";
    }
}

// ---- commesse ----
if ($commesse) {
    $out[] = "";
    $out[] = "-- =====================================================================";
    $out[] = "-- Commesse: intestatario, nome, stato e data di apertura (" . count($commesse) . " righe)";
    $out[] = "-- =====================================================================";
    foreach ($commesse as $c) {
        $set = [];
        $nota = [];
        if ($c['cliente_cambiato']) {
            $set[] = "ID_CLIENTE = '" . $c['ID_CLIENTE'] . "'";
            $nota[] = $c['Cliente'];
        }
        if ($c['data_cambiata']) {
            $set[] = "Data_Apertura_Commessa = '" . $c['Data_Apertura_Commessa'] . "'";
            $nota[] = "apertura era " . ($c['data_dump'] ?? 'NULL');
        }
        if ($c['nome_cambiato']) {
            $set[] = "Commessa = " . $db->quote($c['Commessa']);
            $nota[] = "si chiamava " . ($c['nome_dump'] ?? 'NULL');
        }
        if ($c['stato_cambiato']) {
            $set[] = "Stato_Commessa = '" . $c['Stato_Commessa'] . "'";
            $nota[] = "era " . ($c['stato_dump'] ?? 'NULL');
        }
        $out[] = "";
        $out[] = "-- " . $c['Commessa'] . ($nota ? "  (" . implode(' - ', $nota) . ")" : '');
        $out[] = "UPDATE ANA_COMMESSE SET " . implode(', ', $set) . ", Data_Modifica = Data_Modifica";
        $out[] = " WHERE ID_COMMESSA = '" . $c['ID_COMMESSA'] . "';";
    }
}

$nAttribuite = $db->query("SELECT COUNT(*) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL")->fetchColumn();
$totale      = $db->query("SELECT SUM(Fatturato_TOT) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL")->fetchColumn();

$out[] = "";
$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- Controlli dopo un reset: devono tornare questi numeri.";
$out[] = "-- --------------------------------------------------------------------";
$out[] = "-- SELECT COUNT(*) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL;      -- {$nAttribuite}";
$out[] = "-- SELECT SUM(Fatturato_TOT) FROM FACT_FATTURE WHERE ID_COMMESSA IS NOT NULL;  -- {$totale}";
$out[] = "";

$dest = __DIR__ . '/initdb/09-attribuzioni-fatture-commesse.sql';
file_put_contents($dest, implode("\n", $out));
echo "scritto $dest\n";
echo "  fatture con commessa cambiata:  {$nCommessa}\n";
echo "  fatture con cliente cambiato:   {$nCliente}\n";
echo "  commesse cambiate:              " . count($commesse) . "\n";
