<?php
/**
 * Prove su CalcoloSpese: i quattro regimi, e l'invariante che conta.
 *
 * L'invariante e' che la somma giornata per giornata e il calcolo aggregato per
 * task diano lo stesso numero. E' quello che il lavoro di agosto ha stabilito
 * unificando tre formule divergenti, ed e' quello che il regime 'Corpo' rischia
 * di rompere, perche' un importo per-task non e' divisibile per giornata.
 *
 * Utilizzo:
 *   docker compose exec -T web php /var/www/html/API/tests/test_calcolo_spese.php
 */

require_once __DIR__ . '/../CalcoloSpese.php';

$ok = 0; $ko = 0;

function verifica($nome, $atteso, $ottenuto) {
    global $ok, $ko;
    $uguale = abs(floatval($atteso) - floatval($ottenuto)) < 0.005;
    if ($uguale) { $ok++; printf("  ok    %s\n", $nome); }
    else { $ko++; printf("  FALLITO %s: atteso %.2f, ottenuto %.2f\n", $nome, $atteso, $ottenuto); }
}

/** Giornate di prova: tre di campo in trasferta, una da remoto, una non di campo. */
function giornate() {
    return [
        ['Tipo'=>'Campo','Desk'=>'No','Viaggio'=>'Si','Spese_Viaggi'=>200,'Vitto_alloggio'=>90,'Altri_costi'=>0],
        ['Tipo'=>'Campo','Desk'=>'No','Viaggio'=>'No','Spese_Viaggi'=>0,  'Vitto_alloggio'=>80,'Altri_costi'=>0],
        ['Tipo'=>'Campo','Desk'=>'No','Viaggio'=>'Si','Spese_Viaggi'=>150,'Vitto_alloggio'=>0, 'Altri_costi'=>10],
        ['Tipo'=>'Campo','Desk'=>'Si','Viaggio'=>'Si','Spese_Viaggi'=>999,'Vitto_alloggio'=>999,'Altri_costi'=>0],
        ['Tipo'=>'Promo','Desk'=>'No','Viaggio'=>'Si','Spese_Viaggi'=>999,'Vitto_alloggio'=>999,'Altri_costi'=>0],
    ];
}

/** Marca la prima addebitabile e la prima con viaggio, come fara' GiornateAPI. */
function marca($gg) {
    $vistaAdd = false; $vistaVia = false;
    foreach ($gg as $i => $g) {
        $add = CalcoloSpese::giornataAddebitabile($g);
        $via = CalcoloSpese::viaggioAddebitabile($g);
        $gg[$i]['prima_addebitabile'] = ($add && !$vistaAdd);
        $gg[$i]['prima_con_viaggio']  = ($via && !$vistaVia);
        if ($add) $vistaAdd = true;
        if ($via) $vistaVia = true;
    }
    return $gg;
}

/** Gli aggregati che TaskAPI ricava in SQL. */
function aggrega($gg) {
    $a = ['n_addebitabili'=>0,'n_con_viaggio'=>0,'viaggi_sum'=>0,'vitto_sum'=>0];
    foreach ($gg as $g) {
        if (CalcoloSpese::giornataAddebitabile($g)) {
            $a['n_addebitabili']++;
            $a['vitto_sum'] += $g['Vitto_alloggio'] + $g['Altri_costi'];
        }
        if (CalcoloSpese::viaggioAddebitabile($g)) {
            $a['n_con_viaggio']++;
            $a['viaggi_sum'] += $g['Spese_Viaggi'];
        }
    }
    return $a;
}

function sommaPerGiornata($task, $gg) {
    $t = 0.0;
    foreach ($gg as $g) { $t += CalcoloSpese::ricavoGiornata($task, $g); }
    return $t;
}

// ---------------------------------------------------------------- i regimi
$gg = marca(giornate());
$agg = aggrega($gg);

echo "Giornate di prova: 3 addebitabili, di cui 2 con viaggio\n";
verifica('addebitabili', 3, $agg['n_addebitabili']);
verifica('con viaggio',  2, $agg['n_con_viaggio']);

$casi = [
    ['Compreso su entrambe', ['Regime_Spese_Viaggi'=>'Compreso','Regime_Spese_Vitto_Alloggio'=>'Compreso'], 0],
    // diaria viaggi 55 x 2 con viaggio = 110; vitto compreso = 0
    ['Diaria viaggi', ['Regime_Spese_Viaggi'=>'Diaria','Valore_Spese_Viaggi'=>55,
                       'Regime_Spese_Vitto_Alloggio'=>'Compreso'], 110],
    // diaria vitto 70 x 3 addebitabili = 210
    ['Diaria vitto', ['Regime_Spese_Viaggi'=>'Compreso',
                      'Regime_Spese_Vitto_Alloggio'=>'Diaria','Valore_Spese_Vitto_Alloggio'=>70], 210],
    // reali: viaggi 200+150 = 350 (solo con viaggio); vitto 90+80+10 = 180
    ['Costi reali su entrambe', ['Regime_Spese_Viaggi'=>'Reali','Regime_Spese_Vitto_Alloggio'=>'Reali'], 530],
    // CORPO: 1000 una volta sola, non per giornata
    ['Corpo vitto 1000', ['Regime_Spese_Viaggi'=>'Compreso',
                          'Regime_Spese_Vitto_Alloggio'=>'Corpo','Valore_Spese_Vitto_Alloggio'=>1000], 1000],
    ['Corpo viaggi 370', ['Regime_Spese_Viaggi'=>'Corpo','Valore_Spese_Viaggi'=>370,
                          'Regime_Spese_Vitto_Alloggio'=>'Compreso'], 370],
    ['Corpo su entrambe', ['Regime_Spese_Viaggi'=>'Corpo','Valore_Spese_Viaggi'=>370,
                           'Regime_Spese_Vitto_Alloggio'=>'Corpo','Valore_Spese_Vitto_Alloggio'=>1000], 1370],
];

echo "\nRicavo per regime — aggregato per task\n";
foreach ($casi as [$nome, $task, $atteso]) {
    verifica($nome, $atteso, CalcoloSpese::ricavoAggregato($task, $agg));
}

echo "\nL'invariante: somma per giornata = aggregato per task\n";
foreach ($casi as [$nome, $task, $atteso]) {
    verifica($nome, CalcoloSpese::ricavoAggregato($task, $agg), sommaPerGiornata($task, $gg));
}

// -------------------------------------------------- task senza giornate
echo "\nUn task a corpo senza giornate non deve esporre ricavo\n";
$vuoto = ['n_addebitabili'=>0,'n_con_viaggio'=>0,'viaggi_sum'=>0,'vitto_sum'=>0];
verifica('corpo vitto, zero giornate',
    0, CalcoloSpese::ricavoAggregato(['Regime_Spese_Viaggi'=>'Compreso',
        'Regime_Spese_Vitto_Alloggio'=>'Corpo','Valore_Spese_Vitto_Alloggio'=>1000], $vuoto));
verifica('corpo viaggi, zero giornate',
    0, CalcoloSpese::ricavoAggregato(['Regime_Spese_Viaggi'=>'Corpo','Valore_Spese_Viaggi'=>370,
        'Regime_Spese_Vitto_Alloggio'=>'Compreso'], $vuoto));

// -------------------------------------------- senza il flag, niente forfait
echo "\nSenza il flag della prima giornata il forfait non si somma piu' volte\n";
$senzaFlag = giornate();
verifica('nessun flag: zero per giornata', 0,
    sommaPerGiornata(['Regime_Spese_Viaggi'=>'Compreso',
        'Regime_Spese_Vitto_Alloggio'=>'Corpo','Valore_Spese_Vitto_Alloggio'=>1000], $senzaFlag));

// --------------------------------------- compatibilita' con lo schema vecchio
echo "\nRecord letti da uno schema senza le colonne nuove\n";
verifica('vecchio: compreso', 0,
    CalcoloSpese::ricavoAggregato(['Spese_Comprese_Viaggi'=>'Si','Spese_Comprese_Vitto_Alloggio'=>'Si'], $agg));
verifica('vecchio: diaria viaggi 55', 110,
    CalcoloSpese::ricavoAggregato(['Spese_Comprese_Viaggi'=>'No','Valore_Spese_std_Viaggi'=>55,
                                   'Spese_Comprese_Vitto_Alloggio'=>'Si'], $agg));
verifica('vecchio: costi reali', 530,
    CalcoloSpese::ricavoAggregato(['Spese_Comprese_Viaggi'=>'No','Spese_Comprese_Vitto_Alloggio'=>'No'], $agg));

// ------------------------------------------- diaria a zero contro costi reali
// Prima che il regime fosse dichiarato erano la stessa cosa: "diaria vuota"
// significava a consuntivo. Ora sono due dichiarazioni diverse, e la differenza
// va tenuta viva da un test invece che da un ricordo. TaskAPI impedisce di
// salvare il primo stato, ma il calcolo deve rispondere in modo prevedibile
// anche sui task che ci fossero finiti prima del controllo.
echo "\nDiaria a zero e costi reali non sono la stessa cosa\n";
$soloViaggi = ['Regime_Spese_Vitto_Alloggio' => 'Compreso'];
verifica('diaria con importo 0: non addebita nulla', 0,
    CalcoloSpese::ricavoAggregato($soloViaggi + ['Regime_Spese_Viaggi'=>'Diaria','Valore_Spese_Viaggi'=>0], $agg));
verifica('diaria con importo assente: non addebita nulla', 0,
    CalcoloSpese::ricavoAggregato($soloViaggi + ['Regime_Spese_Viaggi'=>'Diaria'], $agg));
verifica('costi reali: addebita la spesa effettiva', 350,
    CalcoloSpese::ricavoAggregato($soloViaggi + ['Regime_Spese_Viaggi'=>'Reali'], $agg));
verifica('corpo con importo 0: non addebita nulla', 0,
    CalcoloSpese::ricavoAggregato($soloViaggi + ['Regime_Spese_Viaggi'=>'Corpo','Valore_Spese_Viaggi'=>0], $agg));

printf("\n%d passati, %d falliti\n", $ok, $ko);
exit($ko > 0 ? 1 : 0);
