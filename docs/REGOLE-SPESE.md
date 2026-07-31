# Le spese nel gestionale — regole implementate e decisioni da prendere

*Documento di lavoro — 31/07/2026*

Serve a rispondere a una domanda sola: **cosa fa oggi il software con le spese, e
è quello che vogliamo?** Prima la fotografia di com'è implementato adesso, poi le
incoerenze che ne derivano con i numeri veri, infine le decisioni da prendere.

I conteggi vengono dallo snapshot in [DB/Dati/](../DB/Dati/) (78 task, ultimo export
disponibile), non dal database di produzione: gli ordini di grandezza sono quelli, le
cifre esatte vanno riverificate sul DB live prima di qualunque comunicazione al cliente.

---

## 1. I dati che inseriamo

### Sul task (`ANA_TASK`) — il **prezzo di vendita** delle spese

| Campo | Valori | Significato inteso |
|---|---|---|
| `Spese_Comprese` | `Si` / `No` | `Si` = le spese sono già dentro il valore giornata, non si addebitano a parte. `No` = si addebitano. |
| `Valore_Spese_std` | numero o vuoto | Il forfait spese concordato col cliente. Compilabile **solo** se `Spese_Comprese = No`: il form lo nasconde e `TaskAPI` lo azzera a `null` in salvataggio ([TaskAPI.php:1214-1215](../API/TaskAPI.php#L1214-L1215)). |

Se `Spese_Comprese = No` e `Valore_Spese_std` è vuoto, il regime è **a consuntivo**:
si addebita al cliente quello che si è effettivamente speso.

### Sulla giornata (`FACT_GIORNATE`) — il **costo reale**

| Campo | Significato |
|---|---|
| `Spese_Viaggi` | esborso viaggi A/R |
| `Vitto_alloggio` | esborso vitto e alloggio |
| `Altri_costi` | altri esborsi |
| `Spese_Fatturate_VP` | quota già fatturata direttamente a V&P dal fornitore — **non** va rimborsata al collaboratore |

### La ripartizione attuale del parco task

| Regime | Task |
|---|---|
| `Spese_Comprese = Si` (spese nel prezzo giornata) | **29** |
| Forfait `Valore_Spese_std > 0` | **20** |
| A consuntivo (`No`, senza forfait) | **29** |

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
("4. SFC CT - Seconda Fase", commessa COM2025018 LACTALIS CORTEOLONA), forfait 55 € e
6 giornate consuntivate:

| Interpretazione | Ricavo spese | Dove si vede |
|---|---|---|
| per task | **55 €** | ricavo della card commessa |
| per giornata | **330 €** | costo della card commessa, sezione Clienti |
| per mese | **110 €** (2 mesi con giornate) | maturato mensile |

Sui 19 task a forfait che hanno giornate consuntivate, lo scarto complessivo tra
lettura per-task e lettura per-giornata è di **4.180 €**.

### ② Nella card commessa il forfait entra come ricavo con una regola e come costo con l'altra

Non è solo un'incoerenza di rappresentazione: **genera margine negativo dal nulla**.
Su TAS00083, 55 € di ricavo contro 330 € di costo = **275 € di margine inventato**.
Sull'intero parco task il gonfiaggio è quello stesso di **4.180 €**.

### ③ Il "costo spese" usato nei margini non è un costo

La card commessa somma `Costo_gg + Valore_spese`, cioè costo giornata + **prezzo di
vendita** delle spese. Il campo `Costo_Spese` — l'unico che rappresenta l'esborso vero
di V&P — **non viene usato in nessun calcolo di margine**, né la quota `Spese_Fatturate_VP`.

La conseguenza si vede bene nei casi in cui forfait e realtà divergono parecchio:

| Task | Forfait × gg | Esborso reale | Scostamento |
|---|---|---|---|
| TAS00040 Corteolona Aula CT | 55 × 3 = 165 € | 526 € | −361 € non visti |
| TAS00073 Aula CapiTurno | 70 × 3 = 210 € | 540 € | −330 € non visti |
| TAS00083 4. SFC CT | 55 × 6 = 330 € | 565 € | −235 € non visti |
| TAS00048 Shop Floor Coaching CT | 70 × 7 = 490 € | 0 € | +490 € di costo inesistente |

Il margine di commessa oggi **non risente mai di quanto abbiamo speso davvero**.

### ④ Con `Spese_Comprese = Si` il costo sparisce del tutto

`Valore_spese` è 0 per definizione, e siccome il costo passa da lì, l'esborso reale non
compare da nessuna parte nel conto economico di commessa. Oggi vale **191,80 €**
(TAS00037 EVOLUTION GAME 175 €, TAS00009 GALBANI COACHING 16,80 €): poco, ma è poco
perché il regime è poco usato con spese vere, non perché il meccanismo funzioni.

### Nota a margine

Nel maturato mensile il forfait entra come ricavo ([:865](../API/CommesseAPI.php#L865))
e **lo stesso numero** rientra come costo ([:907](../API/CommesseAPI.php#L907)): il margine
delle spese lì è sempre esattamente zero, e le spese reali del mese vengono lette dal DB
ma poi ignorate ([:813-814](../API/CommesseAPI.php#L813-L814)). Qualunque decisione si
prenda, questo punto va riscritto.

---

## 5. Le decisioni da prendere

### Decisione 1 — Cosa significa `Valore_Spese_std`?

È la decisione che sblocca tutto il resto. Tre letture possibili:

| Opzione | Significato commerciale | Conseguenza sui dati esistenti |
|---|---|---|
| **A. Forfait giornaliero** (diaria) | "ti addebito X € di trasferta per ogni giornata di campo" | il ricavo spese dei 19 task sale di 4.180 € rispetto alla lettura per-task |
| **B. Forfait a task** | "le trasferte di tutto questo intervento costano X €" | il ricavo resta quello di oggi lato card, ma va corretto ovunque si legga per giornata |
| **C. Forfait mensile** | "X € al mese finché l'intervento è aperto" | lettura intermedia; oggi esiste solo nel maturato mensile |

**Elemento a favore di A.** I forfait censiti valgono 50–90 €: sono importi da diaria
giornaliera (viaggio + pasto), non da trasferta di un intervento intero. Su TAS00056 il
forfait è 70 € contro 10 giornate consuntivate — leggerlo come "70 € per tutto il task"
significherebbe aver venduto 10 trasferte a 7 € l'una. La lettura per giornata è l'unica
che regge il confronto con gli esborsi reali della tabella al punto ③.

Va comunque confermata da te: è una questione di cosa c'è scritto nelle offerte, non di
cosa è coerente nel codice.

### Decisione 2 — Il costo di commessa deve riflettere l'esborso vero?

Oggi non lo riflette: usa il prezzo di vendita al posto del costo. Le opzioni:

- **Sì (raccomandato):** il costo spese diventa `Costo_Spese` = esborso − quota già
  fatturata a V&P. Il margine spese diventa una grandezza reale — positivo quando il
  forfait copre la trasferta, negativo quando no. Risolve ②, ③ e ④ in un colpo solo.
- **No:** si tiene la convenzione attuale, ma allora il margine spese è zero per
  costruzione e tanto vale escludere le spese dal calcolo del margine invece di
  farle comparire da entrambi i lati con numeri diversi.

### Decisione 3 — In regime `Spese_Comprese = Si`, l'esborso va a costo?

Concettualmente sì: il ricavo è già dentro il valore giornata, ma il costo resta ed è
reale. Dipende però da come è costruito il prezzo giornata in offerta — se lo hai già
maggiorato per coprire le trasferte, imputare anche il costo è corretto e mostra il
margine vero; se il valore giornata è quello "secco", il conto va rivisto a monte.

### Decisione 4 — Il regime a consuntivo va bene così?

Qui il software è già coerente (ricavo = esborso, per giornata e per task coincidono) e
non richiede decisioni, salvo un punto: **anche a consuntivo il ricavo ignora
`Spese_Fatturate_VP`**. Se una spesa è arrivata direttamente in fattura a V&P, la
riaddebitiamo comunque al cliente? Probabilmente sì, ma va confermato.

---

## 6. Cosa comporta implementare

A decisioni prese, l'intervento è circoscritto e va fatto in un colpo solo:

1. **Una sola funzione** che, dato il task e la giornata, restituisce ricavo spese e costo
   spese secondo la regola decisa. Oggi la logica è replicata in quattro punti che sono
   già divergenti — finché resta duplicata, tornerà a divergere.
2. **Quattro consumatori da riallineare** su quella funzione: card commessa, export CSV
   commesse, sezione Clienti, maturato mensile.
3. **Nessuna migrazione dati.** I campi restano quelli, cambia solo come vengono letti —
   ma i margini storici di tutte le commesse con task a forfait cambiano valore. Vale la
   pena stampare un prima/dopo per commessa prima di mettere in produzione.

Ordine di grandezza dello spostamento sui dati attuali: **~4.200 € di margine** che oggi
è negativo per errore, più il ricavo spese che si muove a seconda della Decisione 1.

---

## Riepilogo delle domande

1. `Valore_Spese_std` è un forfait **per giornata**, **per task** o **per mese**?
2. Il costo di commessa deve usare l'**esborso reale** invece del prezzo di vendita?
3. Con `Spese_Comprese = Si`, l'esborso reale va **comunque a costo** di commessa?
4. Le spese già fatturate direttamente a V&P si **riaddebitano** comunque al cliente?

Rispondi a queste quattro e la parte tecnica è meccanica.
