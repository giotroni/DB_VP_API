# Le spese nel gestionale — regole implementate e decisioni da prendere

*Documento di lavoro — 31/07/2026*

Serve a rispondere a una domanda sola: **cosa fa oggi il software con le spese, e
è quello che vogliamo?** Prima la fotografia di com'è implementato adesso, poi le
incoerenze che ne derivano con i numeri veri, infine le decisioni da prendere.

I conteggi vengono dal **database vero** (95 task), interrogato tramite l'ambiente di test
locale descritto in [AMBIENTE-LOCALE.md](AMBIENTE-LOCALE.md). Una prima versione di questo
documento usava lo snapshot CSV in [DB/Dati/](../DB/Dati/), che è più vecchio e contiene
meno giornate: le cifre qui sotto sostituiscono quelle.

> **Verifica del 16/08/2026 contro la produzione**, rifatta caricando il backup `260815` in
> un database separato accanto a quello locale: i numeri qui sotto sono misurati sui due
> database, non stimati. Metodo e dettaglio in
> [CONFRONTO-PRODUZIONE-LOCALE.md](CONFRONTO-PRODUZIONE-LOCALE.md).
>
> La colonna produzione riproduce l'**export CSV** del gestionale, al centesimo e su tutte e
> 44 le commesse (`docs/prod_export_commesse.csv`, 17/08/2026).
>
> | | Produzione | Locale | Δ |
> |---|---:|---:|---:|
> | Valore totale | 655.253,29 | 653.000,79 | −2.252,50 |
> | Costo totale attività | 431.325,79 | 429.243,39 | −2.082,40 |
> | Margine | 60.705,07 | 60.534,96 | **−170,10** |
>
> Il maturato giornate non cambia: giornate di campo e costo accounting coincidono al
> centesimo nei due ambienti. Sul totale il margine si muove di appena 170 €: quello che
> cambia davvero è la **distribuzione** fra commesse (19 su 44) e il fatto che ricavo e costo
> delle spese smettono di essere lo stesso numero.
>
> Due versioni precedenti di questo blocco davano +6.557,40 e poi +4.304,90. Non erano
> sbagliati i dati ma la baseline: prendevano come "produzione" la formula di `TaskAPI`
> (diaria una volta per task), che alimenta la testata solo quando nessun anno è spuntato nel
> filtro, e non l'export né le schede. Vedi l'anomalia ① qui sotto e
> [CONFRONTO-PRODUZIONE-LOCALE.md](CONFRONTO-PRODUZIONE-LOCALE.md): in produzione le formule
> sono tre e quale si vede dipende dalla schermata **e dal filtro**.
>
> Resta valido il caso limite: COM2025031 *LACTALIS PORCARI Seconda Fase*, senza nemmeno una
> giornata, vale già 2.960 € di ricavo spese, perché `TaskAPI::calcolaValoreSpese` restituisce
> la diaria appena è valorizzata sul task senza guardare le giornate — al contrario della
> funzione gemella `calcolaValoreGg`, che con zero giornate ritorna 0. Stesso difetto su
> COM2025028 (150 €) e COM2025029 (210 €): 3.320 € di ricavo esposto su commesse mai partite.

---

## 1. I dati che inseriamo

### Sul task (`ANA_TASK`) — il **prezzo di vendita** delle spese

Dal 07/08/2026 il regime è per **categoria**, non più unico: viaggi e vitto/alloggio
si vendono in modo indipendente perché i contratti li trattano in modo indipendente.

| Campo | Valori | Significato |
|---|---|---|
| `Spese_Comprese_Viaggi` | `Si` / `No` | `Si` = i viaggi sono già dentro il valore giornata. `No` = si addebitano a parte. |
| `Valore_Spese_std_Viaggi` | numero o vuoto | La **diaria viaggi**: quanto si addebita per ogni giornata di campo in cui il viaggio c'è stato. Vuoto = a consuntivo. |
| `Spese_Comprese_Vitto_Alloggio` | `Si` / `No` | Stesso significato per vitto, alloggio e altri costi. |
| `Valore_Spese_std_Vitto_Alloggio` | numero o vuoto | La **diaria vitto/alloggio**, per ogni giornata di campo. Vuoto = a consuntivo. |

Ciascuna diaria è compilabile **solo** se la categoria non è compresa: il form la
nasconde e `TaskAPI` la azzera a `null` in salvataggio, così non resta un valore
orfano pronto a riemergere se il regime tornasse a `No`.

I campi storici `Spese_Comprese` e `Valore_Spese_std` restano in tabella come rete
di sicurezza, ma nessun codice li legge più. Si rimuovono con una migration
separata a verifica avvenuta in produzione.

### Sulla giornata (`FACT_GIORNATE`) — il **costo reale**

| Campo | Significato |
|---|---|
| `Spese_Viaggi` | esborso viaggi A/R |
| `Vitto_alloggio` | esborso vitto e alloggio |
| `Altri_costi` | altri esborsi — seguono il regime del vitto/alloggio |
| `Spese_Fatturate_VP` | quota già fatturata direttamente a V&P dal fornitore — **non** va rimborsata al collaboratore |
| `Viaggio` | `Si` (default) / `No`. Dice se la trasferta c'è stata: chi si ferma in loco fra due giornate consecutive non fa il viaggio del secondo giorno, e al cliente non va addebitato. |

### La ripartizione del parco task (dump `260804`, 96 task)

| Regime | Viaggi | Vitto/Alloggio |
|---|---|---|
| Compreso nel valore giornata | **34** | **60** |
| A diaria | **26** | **0** |
| A consuntivo | **36** | **36** |

Il vitto/alloggio risulta compreso su 60 task perché la migration ha applicato il
default conservativo: i 26 task a diaria avevano un forfait unico di 50–90 € che
copriva viaggio e pasto insieme. Vanno rivisti uno a uno.

---

## 2. I valori che il software calcola

Da questi campi il codice deriva quattro grandezze. **Tre delle quattro si chiamano
"spese" e significano cose diverse** — è qui che nasce quasi tutta la confusione.

| Grandezza | Dove nasce | Formula | Cos'è concettualmente |
|---|---|---|---|
| `giornata.spese_totali` | [GiornateAPI.php:471](../API/GiornateAPI.php#L471) | viaggi + vitto + altri | **esborso lordo** della giornata |
| `giornata.Costo_Spese` | [GiornateAPI.php:512-515](../API/GiornateAPI.php#L512-L515) | `spese_totali − Spese_Fatturate_VP` | **quanto V&P sborsa davvero** (rimborso al collaboratore) |
| `giornata.Valore_spese` | [GiornateAPI.php:478-491](../API/GiornateAPI.php#L478-L491) | vedi sotto | **prezzo addebitato al cliente**, imputato alla giornata |
| `task.valore_spese_maturato` | [TaskAPI.php:881-911](../API/TaskAPI.php#L881-L911) | vedi sotto | **prezzo addebitato al cliente**, imputato al task |

### `giornata.Valore_spese` — la regola per giornata

```
se la giornata non è di tipo 'Campo'  →  0
se Desk = 'Si'                        →  0        (giornata da remoto: nessuna trasferta)
se Spese_Comprese = 'Si'              →  0
se Valore_Spese_std > 0               →  il forfait INTERO, su ogni giornata
altrimenti                            →  spese_totali della giornata
```

### `task.valore_spese_maturato` — la regola per task

```
se Spese_Comprese = 'Si'   →  0
se Valore_Spese_std > 0    →  il forfait UNA SOLA VOLTA per tutto il task
altrimenti                 →  Σ delle spese effettive di tutte le giornate del task
```

Esiste una variante filtrata per periodo ([TaskAPI.php:667-712](../API/TaskAPI.php#L667-L712))
che applica il forfait **una volta se nel periodo c'è almeno una giornata**, zero altrimenti.

> **Le due regole divergono solo nel caso forfait.** Nel regime a consuntivo la somma
> per giornata e la somma per task coincidono, e in `Spese_Comprese = Si` fanno entrambe
> zero. Tutto il problema si concentra sui 20 task a forfait.

---

## 3. Dove finiscono, schermata per schermata

| Schermata / export | Ricavo spese | Costo spese |
|---|---|---|
| **Card commessa** ([commesse-task-section.js:153](../assets/js/modules/sections/commesse-task-section.js#L153), [:160-169](../assets/js/modules/sections/commesse-task-section.js#L160-L169)) | Σ `task.valore_spese_maturato` → forfait **1× per task** | Σ giornata `Costo_gg + Valore_spese` → forfait **1× per giornata** |
| **Export commesse CSV** ([:1333-1354](../assets/js/modules/sections/commesse-task-section.js#L1333-L1354)) | idem card | idem card |
| **Sezione Clienti** ([clienti-section.js:196-221](../assets/js/modules/sections/clienti-section.js#L196-L221)) | Σ `giornata.Valore_spese` → forfait **1× per giornata** | — (non calcola margine) |
| **Maturato mensile** ([CommesseAPI.php:802-827](../API/CommesseAPI.php#L802-L827), [:865](../API/CommesseAPI.php#L865), [:907](../API/CommesseAPI.php#L907)) | forfait **1× per mese** in cui il task ha giornate | lo **stesso identico numero** rientra come costo |
| **Scheda task** ([:281](../assets/js/modules/sections/commesse-task-section.js#L281), [:700](../assets/js/modules/sections/commesse-task-section.js#L700)) | `valore_spese_maturato` (1× per task) e, in una vista, Σ per giornata ([:664](../assets/js/modules/sections/commesse-task-section.js#L664)) | — |
| **Consuntivazione collaboratori** ([ConsuntivazioneAPI.php:95-109](../API/ConsuntivazioneAPI.php#L95-L109)) | — | `spese − Spese_Fatturate_VP` = rimborsabili |

**La consuntivazione collaboratori è l'unica parte coerente e non tocca nulla del resto:**
serve a sapere quanto rimborsare a chi ha viaggiato, usa i soli dati di fatto e non
guarda mai il forfait. Va bene così — non è oggetto di decisione.

---

## 4. Le quattro anomalie

### ① Il forfait ha tre interpretazioni simultanee

Per task, per giornata, per mese — a seconda di chi legge il dato. Su TAS00083
("4. SFC CT - Seconda Fase", commessa COM2025018 LACTALIS CORTEOLONA), diaria 55 € e
17 giornate di campo consuntivate:

| Interpretazione | Ricavo spese | Dove si vede |
|---|---|---|
| per task | **55 €** | ricavo della card commessa |
| per giornata | **935 €** | costo della card commessa, sezione Clienti |
| per mese | **385 €** (7 mesi con giornate) | maturato mensile |

Nella stessa pagina Commesse e Task quale delle prime due si vede dipende anche dal **filtro
Anno**, perché con un periodo attivo il front-end ricalcola dalle giornate invece di usare il
valore del server. Fino al 17/08/2026 "tutti gli anni spuntati" e "nessuno spuntato" — che
sul menu si leggono entrambi "Tutti" — davano quindi due totali diversi, 4.475 € di scarto,
e un elenco con una commessa in meno. In locale è stato corretto (selezione totale = nessun
filtro); in produzione il doppio comportamento resta fino al rilascio.

Sui 26 task a diaria che hanno giornate consuntivate, lo scarto complessivo tra
lettura per-task e lettura per-giornata è di **7.460 €**.

### ② Nella card commessa la diaria entra come ricavo con una regola e come costo con l'altra

Non è solo un'incoerenza di rappresentazione: **genera margine negativo dal nulla**.
Su TAS00083, 55 € di ricavo contro 935 € di costo = **880 € di margine inventato**.
Sull'intero parco task il gonfiaggio è quello stesso di **7.460 €**.

### ③ Il "costo spese" usato nei margini non è un costo

La card commessa somma `Costo_gg + Valore_spese`, cioè costo giornata + **prezzo di
vendita** delle spese. Il campo `Costo_Spese` — l'unico che rappresenta l'esborso vero
di V&P — **non viene usato in nessun calcolo di margine**, né la quota `Spese_Fatturate_VP`.

La conseguenza si vede bene nei casi in cui forfait e realtà divergono parecchio:

| Task | Diaria × gg | Esborso reale | Scostamento |
|---|---|---|---|
| TAS00085 Shop Floor Coaching CapiTurno | 70 × 15 = 1.050 € | 2.437,30 € | −1.387 € non visti |
| TAS00083 4. SFC CT | 55 × 17 = 935 € | 2.069 € | −1.134 € non visti |
| TAS00073 Aula CapiTurno | 70 × 3 = 210 € | 540 € | −330 € non visti |
| TAS00040 Corteolona Aula CT | 55 × 4 = 220 € | 526 € | −306 € non visti |

Il margine di commessa oggi **non risente mai di quanto abbiamo speso davvero**. E il dato
non è marginale: sui task sopra la diaria copre meno della metà della trasferta.

### ④ Con `Spese_Comprese = Si` il costo sparisce del tutto

`Valore_spese` è 0 per definizione, e siccome il costo passa da lì, l'esborso reale non
compare da nessuna parte nel conto economico di commessa. Vale **238,80 €** su 3 task:
poco, ma è poco perché il regime è poco usato con spese vere, non perché il meccanismo
funzioni.

### Nota a margine

Nel maturato mensile il forfait entra come ricavo ([:865](../API/CommesseAPI.php#L865))
e **lo stesso numero** rientra come costo ([:907](../API/CommesseAPI.php#L907)): il margine
delle spese lì è sempre esattamente zero, e le spese reali del mese vengono lette dal DB
ma poi ignorate ([:813-814](../API/CommesseAPI.php#L813-L814)). Qualunque decisione si
prenda, questo punto va riscritto.

---

## 5. Le decisioni prese — 02/08/2026

### ✅ `Valore_Spese_std` è un **importo giornaliero**

È la diaria di trasferta concordata col cliente: si addebita **per ogni giornata di campo**.
Le letture "una volta per task" e "una volta al mese" sono errate e vanno eliminate.

Coerente con i dati: i forfait censiti valgono 50–90 €, importi da diaria (viaggio + pasto).
Su TAS00056 il forfait è 70 € contro 10 giornate — la lettura per-task avrebbe significato
trasferte vendute a 7 € l'una.

### ✅ Il margine è **totale**: ricavo complessivo meno costi, tutto compreso

Il margine di commessa deve essere il netto tra quanto si vende al cliente e quanto si
spende davvero, **spese incluse da entrambi i lati**. Non più il prezzo di vendita usato
come se fosse un costo.

### ✅ Con `Spese_Comprese = Si` l'esborso va **comunque a costo**

Il ricavo è già dentro il valore giornata, ma il costo esiste e va imputato. Oggi sparisce.

### ✅ Le spese si **riaddebitano per intero** al cliente

`Spese_Fatturate_VP` non riduce il ricavo: al cliente si addebita la spesa a prescindere
da chi l'ha materialmente pagata.

---

## 6. Le regole che ne derivano

### Ricavo spese — prezzo al cliente

Le due categorie si calcolano separatamente e si sommano.

**Viaggi**
```
giornata non 'Campo', oppure Desk = 'Si'   →  0
Viaggio = 'No'                             →  0   (nessuna trasferta quel giorno)
Spese_Comprese_Viaggi = 'Si'               →  0   (già dentro il valore giornata)
Valore_Spese_std_Viaggi > 0                →  la diaria viaggi, per ogni giornata di campo
altrimenti (consuntivo)                    →  Spese_Viaggi effettive della giornata
```

**Vitto/alloggio + altre**
```
giornata non 'Campo', oppure Desk = 'Si'   →  0
Spese_Comprese_Vitto_Alloggio = 'Si'       →  0
Valore_Spese_std_Vitto_Alloggio > 0        →  la diaria V/A, per ogni giornata di campo
altrimenti (consuntivo)                    →  Vitto_alloggio + Altri_costi della giornata
```

Il flag `Viaggio` **non** tocca il vitto/alloggio: chi si ferma mangia e dorme comunque.

### Costo spese — esborso di V&P

```
sempre, in ogni regime  →  Spese_Viaggi + Vitto_alloggio + Altri_costi
```

Nessuna eccezione: né una categoria compresa, né la presenza di una diaria, né
`Viaggio = 'No'` riducono il costo, perché il costo è quello che V&P ha sborsato e
non dipende da come lo si è venduto.

### Margine di commessa

```
(valore giornate + ricavo spese) − (costo giornate + costo spese) − costo accounting
```

### Due dettagli chiariti il 03/08/2026

1. **`Spese_Fatturate_VP` non riduce il costo.** È l'importo delle spese per cui esiste una
   fattura V&P pagata con la carta di credito aziendale: V&P la sostiene comunque, serve
   solo a non riconoscerla al consulente. Il costo di commessa è quindi la spesa **lorda**,
   e il campo resta confinato al calcolo del rimborso in consuntivazione.
   *(Attenzione al nome: `giornata.Costo_Spese` vale `spese − fatturate`, cioè è il rimborso
   dovuto al collaboratore, non il costo aziendale. Il nome inganna, il codice ora lo dice.)*
2. **Le mezze giornate pagano la diaria intera.** La trasferta c'è comunque, quindi la
   spesa si contabilizza per intero anche con `gg = 0,50`.

### Tre dettagli decisi il 07/08/2026

1. **`Altri_costi` segue il vitto/alloggio.** È la coppia già usata nelle etichette di
   Management ("Costo Vitto/Alloggio + Altre"), e nel database vale 80 € in tutto: non
   meritava una terza categoria. Si riaddebita quando quella categoria è a consuntivo.
2. **`Viaggio = 'No'` è un veto assoluto sul ricavo viaggi**, in ogni regime: azzera sia
   la diaria sia il riaddebito a consuntivo delle `Spese_Viaggi`. Se il viaggio non c'è
   stato non c'è nulla da vendere; se una spesa risulta comunque registrata, resta a costo.
3. **Il flag si compila a mano, non si deduce.** `Spese_Viaggi = 0` non significa
   "nessun viaggio": su TAS00064 (LINDT, 14 giornate a diaria 70 €) non c'è alcuna spesa
   viaggio registrata, perché con la diaria i consulenti spesso non registrano l'esborso.

### Nota sul fatturato

La regola parla di "valore complessivo fatturato". Il software oggi calcola il **maturato**
(quanto si è prodotto), non il fatturato: le fatture si inseriscono a mano e nessuna
schermata le riconcilia col maturato di commessa. Il margine che si va a correggere è
quindi un margine sul maturato. La riconciliazione col fatturato resta l'assenza funzionale
più grossa del gestionale, ed è un lavoro a sé.

---

## 7. Com'è stato implementato

Fatto il 03/08/2026, commit `74bc638`.

Le regole stanno ora in **un punto solo**, [API/CalcoloSpese.php](../API/CalcoloSpese.php),
usato da `TaskAPI`, `GiornateAPI` e `CommesseAPI`. Prima erano replicate in quattro punti
già divergenti fra loro: finché la logica resta duplicata, torna a divergere.

| Punto | Cosa è cambiato |
|---|---|
| `TaskAPI::calcolaValoreSpese()` | la diaria moltiplicata per le giornate di campo, non più contata una volta sola |
| `TaskAPI::calcolaValoreSpeseFilrato()` | idem, sulle giornate del periodo filtrato |
| `TaskAPI` | nuovo campo `costo_spese_maturato` esposto sul task |
| `GiornateAPI` | stessa regola di prima, ma delegata a `CalcoloSpese`; commento che chiarisce cosa sia davvero `Costo_Spese` |
| `CommesseAPI::getMaturatoMensile()` | diaria per giornata anziché una volta al mese; `Costo_TOT` usa l'esborso reale; nuovo campo `Costo_Spese` per mese |
| Card commessa ed export CSV | il costo somma `spese_totali` (esborso) invece di `Valore_spese` (prezzo) |
| Export CSV giornate (04/08/2026) | la colonna `Valore Spese` legge `Valore_spese` dall'API anziché ricalcolare l'esborso; nuova colonna `Costo Spese` con l'esborso lordo |

La **sezione Clienti non è stata toccata**: sommava già `Valore_spese` per giornata, che
con la regola nuova è la lettura corretta. Da fonte dell'incoerenza è diventata il
riferimento.

Nessuna migrazione dati: i campi sono gli stessi, cambia come vengono letti.

### Verifica

Fatta sull'ambiente locale contro il database vero, non su dati di prova:

- **le tre fonti ora concordano** — su TAS00052 la somma per giornata e il valore per task
  danno entrambi 250,00 €, ed era esattamente la divergenza che generava margini falsi;
- le giornate `Desk = Si` e quelle non di campo restano fuori dal ricavo, le mezze giornate
  pagano la diaria intera (verificato su TAS00083: 55 € anche sulle giornate da 0,50);
- i tre regimi si comportano come deciso — `Spese_Comprese = Si` dà ricavo 0 e costo 175 €
  su TAS00037 (prima era invisibile), il consuntivo dà ricavo = costo;
- i totali del maturato mensile combaciano con una query di controllo scritta a parte
  (COM2025011: 1.000 / 0 · COM0001: 0 / 175 · COM2025013: 2.030 / 3.367,30).

### Effetto sui margini

**16 commesse** cambiano valore, tutte di tipo Cliente:

| Commessa | Ricavo spese | Costo spese | Δ margine |
|---|---|---|---|
| LINDT SVILUPPO CapiTurno 2026 | 140 → 980 | 980 → 0 | **+1.820** |
| LACTALIS STAB CERTOSA | 250 → 1.000 | 1.000 → 0 | **+1.750** |
| LACTALIS PORCARI | 370 → 1.110 | 1.110 → 150 | **+1.700** |
| LINDT SVILUPPO CAPITURNO 2025 | 140 → 770 | 770 → 0 | **+1.400** |
| LINDT SVILUPPO CR 2025 | 140 → 700 | 700 → 420 | **+840** |
| … altre 8 commesse in positivo | | | da +40 a +490 |
| LACTALIS STAB CORTEOLONA 2026 | 165 → 1.155 | 1.155 → 2.320 | **−175** |
| CALVI SVIL MANAGERIALITÀ | 0 → 0 | 0 → 175 | **−175** |
| LACTALIS AUDIT CORTE - CASTELLI | 1.595 → 1.595 | 1.595 → 1.642 | **−47** |

I margini salgono dove la diaria era sottostimata dal conteggio per-task, scendono dove
per la prima volta compare un esborso reale che prima non veniva contato.

---

## 8. La separazione in due categorie — 07/08/2026

Fatto sopra all'implementazione del 03/08, che non era ancora arrivata in produzione:
in produzione le due modifiche arrivano insieme.

### Cosa cambia nel database

`ANA_TASK` guadagna quattro colonne (`Spese_Comprese_Viaggi`,
`Spese_Comprese_Vitto_Alloggio`, `Valore_Spese_std_Viaggi`,
`Valore_Spese_std_Vitto_Alloggio`) e `FACT_GIORNATE` una (`Viaggio`, default `Si`).
Migration: [DB/migrations/add_spese_viaggi_vitto.sql](../DB/migrations/add_spese_viaggi_vitto.sql)
con runner PHP a fianco; in produzione si esegue lo `.sql` da phpMyAdmin, perché il
runner blocca l'esecuzione da host remoto.

Il popolamento è **conservativo per costruzione**: il regime unico si replica su
entrambe le categorie, la vecchia diaria diventa diaria viaggi, e i 26 task che ne
avevano una passano a `Spese_Comprese_Vitto_Alloggio = 'Si'` — perché quel forfait
di 50–90 € copriva viaggio e pasto insieme. Tutte le giornate storiche partono con
`Viaggio = 'Si'`.

### Cosa cambia nel codice

| Punto | Cosa è cambiato |
|---|---|
| `CalcoloSpese` | `ricavoGiornata()` somma `ricavoViaggiGiornata()` e `ricavoVittoGiornata()`; nuovi `viaggioAddebitabile()`, `sqlViaggiAddebitabili()`, `sqlSpeseViaggi()`, `sqlSpeseVitto()` |
| `CalcoloSpese::ricavoAggregato()` | cambia firma: prende un array di aggregati, perché le due categorie hanno basi di conteggio diverse |
| `TaskAPI::aggregaSpeseTask()` | la query restituisce anche `n_con_viaggio`, `viaggi_sum`, `vitto_sum` |
| `GiornateAPI` | legge i quattro campi nuovi in join; espone `Valore_spese_viaggi` e `Valore_spese_vitto` accanto al totale |
| `CommesseAPI::getMaturatoMensile()` | stessi aggregati per task e mese |
| `ConsuntivazioneAPI` | accetta e persiste `viaggio` in inserimento, modifica e duplicazione |
| Form task in Management | due riquadri affiancati, uno per categoria, ciascuno con "Compresi" e "Diaria (€/gg)" e il proprio toggle indipendente |
| Form giornate e consuntivazione | switch "Viaggio effettuato", acceso di default, disabilitato su giornate Desk o non di campo |

### Verifica

Sul database vero, con la migration applicata: il **ricavo spese complessivo resta
17.685,52 €**, identico a prima della separazione — la migration è economicamente
neutra e ogni variazione arriverà solo dalla revisione manuale dei task. Il percorso
per giornata e quello aggregato concordano su tutti e 96 i task.

Campioni: TAS00083 → 935,00 € di ricavo e 2.069,00 € di costo; TAS00052 → 250,00 €;
TAS00037 (compreso) → 0 € di ricavo e 175,00 € di costo; TAS00007 (consuntivo, con
40 € di `Altri_costi`) → 1.904,50 €.

### Cosa resta da fare

1. Rivedere in Management i **26 task a diaria**, decidendo per ciascuno se il
   vitto/alloggio sia davvero compreso. I 9 dove la scelta cambia il maturato:
   TAS00085, TAS00083, TAS00090, TAS00073, TAS00040, TAS00056, TAS00072, TAS00049,
   TAS00082 — in totale +2.361 € se passassero tutti a consuntivo.
2. Correggere **TAS00104** (370 €, LACTALIS PORCARI) e **TAS00099** (500 €, EMU):
   sono forfait una tantum censiti come diarie giornaliere, quindi oggi si moltiplicano
   per il numero di giornate.
3. Compilare il flag `Viaggio` sulle giornate future. Le 12 giornate storiche
   consecutive su task a diaria (1.125 €) si correggono a mano solo se il cliente non
   è ancora stato fatturato.
4. A verifica avvenuta, `DROP COLUMN Spese_Comprese, Valore_Spese_std` su `ANA_TASK`.

---

## Stato

- **Decise il 02/08/2026:** diaria giornaliera; margine totale con esborso reale a costo;
  costo imputato anche in regime `Spese_Comprese = Si`; ricavo spese non ridotto da
  `Spese_Fatturate_VP`.
- **Chiariti il 03/08/2026:** `Spese_Fatturate_VP` non riduce il costo; le mezze giornate
  pagano la diaria intera.
- **Implementato il 03/08/2026** e verificato in locale sul database vero. Resta da
  guardare le schermate in Management prima di portare in produzione.
- **Corretto il 04/08/2026:** l'export CSV delle giornate era rimasto fuori
  dall'allineamento — scriveva l'esborso nella colonna `Valore Spese`, quindi su
  TAS00083 dava 2.069 € contro i 935 € della scheda task. Ora le due fonti concordano
  e il CSV espone entrambi i lati (`Costo Spese` = 2.069 €, `Valore Spese` = 935 €).
- **Deciso e implementato il 07/08/2026:** regime di spesa separato per viaggi e
  vitto/alloggio; flag `Viaggio` sulla giornata; `Altri_costi` agganciato al
  vitto/alloggio. Migration economicamente neutra, verificata in locale (§ 8).
  **Non ancora in produzione**, insieme all'implementazione del 03/08.
