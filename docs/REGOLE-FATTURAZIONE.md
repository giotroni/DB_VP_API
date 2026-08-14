# Le fatture nel gestionale — regole

*13/08/2026*

Le regole con cui il gestionale registra fatture e note di accredito. Nasce dalla
prima analisi del modello fatturazioni, che ha trovato i numeri a schermo gonfiati
del 34% per il modo in cui erano memorizzate le note di accredito.

I conteggi vengono dal dump di produzione `260804`, 88 documenti dal 23/12/2024 al
30/06/2026.

---

## 1. I due tipi di documento

`FACT_FATTURE` contiene entrambi, distinti dal campo `TIPO`:

| `TIPO` | Cos'è | Quanti |
|---|---|---|
| `Fattura` | il documento che genera un credito verso il cliente | 81 |
| `Nota_Accredito` | lo storno, totale o parziale, di una fattura già emessa | 7 |

---

## 2. Le regole della nota di accredito

### ✅ Gli importi sono **negativi**

`Fatturato_gg`, `Fatturato_Spese`, `Fatturato_TOT` e `Valore_Pagato` di una nota di
accredito si memorizzano con il segno meno. La conseguenza è la ragione della
scelta:

```
fatturato netto = SUM(Fatturato_TOT)
```

Nessuna schermata deve più correggere il segno per conto proprio — ed era proprio
questo il difetto: il segno stava in una `CASE WHEN` nel backend e in nessun punto
del frontend, che sommava e basta.

Sul documento cartaceo gli importi sono positivi ed è così che vengono digitati:
la conversione la fa `FattureAPI::preprocessData()`, in un punto solo. Chi inserisce
non deve ricordarsi nulla, e il form mostra subito il valore col segno che verrà
salvato.

**Su una fattura gli importi restano positivi**, e un importo negativo viene
respinto: per stornare si emette una nota di accredito, non una fattura al contrario.

### ✅ Non ha **scadenza di incasso**

`Tempi_Pagamento` e `Scadenza_Pagamento` sono `NULL` su ogni nota di accredito, e
il salvataggio li azzera anche se il form li mandasse compilati. Una nota di
accredito non si incassa: si compensa con la fattura che storna.

Ne discende lo stato: una nota di accredito ha `stato_pagamento = 'nota_accredito'`
e **non entra mai nell'aging** — non può essere "scaduta" né "in scadenza". A
schermo compare come *Storno*.

`Data_Pagamento` e `Valore_Pagato` restano compilabili, per registrare la
compensazione quando avviene; il valore, come tutti gli altri, è negativo.

### ✅ Punta alla **fattura che storna**

`ID_FATTURA_STORNATA` collega la nota alla fattura che annulla. È l'unica cosa
memorizzata del rapporto: tutto il resto si ricalcola.

Il collegamento sta **sulla nota**, non sulla fattura, perché una fattura può
essere stornata da più note — storni parziali in momenti diversi — mentre una
nota storna sempre un documento solo.

```
stornato = -SUM(Fatturato_TOT delle note collegate)
residuo  = Fatturato_TOT - stornato - Valore_Pagato
```

Da qui discende lo stato della **fattura**, e viene prima di ogni altro:

| Condizione | `stato_pagamento` | A schermo |
|---|---|---|
| le note collegate coprono l'intero importo | `stornata` | *Annullata* |
| ne coprono una parte | `stornata_parzialmente` | *Stornata in parte* |

Una fattura in questi due stati **non entra nell'aging**: non è un credito, non
può essere scaduta. Resta però visibile in elenco, marcata: farla sparire
lascerebbe un buco inspiegabile nella numerazione.

Lo stato non è una colonna. Una colonna scritta a mano sarebbe una seconda
verità da tenere allineata, ed è lo stesso motivo per cui il segno sta in
`preprocessData()` e non nelle schermate.

**Non si chiude una fattura stornata mettendole una `Data_Pagamento`.** È la
scorciatoia che viene in mente per toglierla dallo scaduto, e farebbe comparire
125.240,00 € come denaro entrato.

I controlli sul collegamento: solo una nota di accredito può stornare, e solo
una fattura dello stesso cliente, emessa prima della nota; la somma degli storni
non può superare l'imponibile. Una fattura con note collegate non è eliminabile,
perché la chiave esterna le scollegherebbe in silenzio.

### Cosa resta valido su entrambi i tipi

- `Fatturato_gg + Fatturato_Spese = Fatturato_TOT`, con qualunque segno;
- `|Valore_Pagato| ≤ |Fatturato_TOT|`;
- il numero `NR` e la data restano obbligatori.

---

## 3. Perché: cosa non tornava

Sei delle sette note di accredito — tutte quelle emesse dall'applicazione, aprile
2026 — erano salvate con **importo positivo**. La settima (`FATT000026`, maggio
2025, importata dal vecchio archivio) era negativa. Due convenzioni opposte nella
stessa colonna.

La causa stava nella validazione: `Fatturato_TOT` aveva `'min' => 0`, quindi da
interfaccia una nota negativa non era salvabile. La prassi si era adattata al
vincolo.

Le due conseguenze, sui numeri veri:

| | Prima | Dopo |
|---|---|---|
| "Fatturato Totale" in Management | 986.992,00 € | **736.513,50 €** |
| Fatture scadute | 41 | **35** |

I 250.478,50 € di differenza sono le note contate come ricavo invece che come
storno: 135.071,75 € di note, che sbagliavano di segno e quindi pesavano il doppio,
più la settima già negativa che il backend rovesciava una seconda volta.

Le sei note di aprile avevano anche una scadenza a 60 giorni ed erano quindi
conteggiate nello scaduto, accanto alle fatture che stornavano.

**I crediti aperti non cambiano: restano 453.475,00 €.** Le note continuano a
compensare — escono dall'*elenco* dello scaduto, non dal *conto*. È voluto: le
sei note di aprile stornano fatture a loro volta ancora aperte, e toglierle dal
totale gonfierebbe l'esposizione.

> I numeri di questo paragrafo e del § 4 fotografano l'archivio **al 13/08/2026**, prima
> dell'allineamento ai documenti cartacei: servono a spiegare cosa non tornava, non a dire
> quanto vale oggi. I valori correnti stanno nel § 5. In particolare i 453.475,00 € di
> crediti erano gonfiati da 26 incassi mai registrati e dalle sei fatture annullate: il
> credito vero è **74.082,50 €**.

---

## 4. Com'è stato implementato

| Punto | Cosa fa |
|---|---|
| [FattureAPI::preprocessData()](../API/FattureAPI.php) | applica il segno e azzera `Tempi_Pagamento` / `Scadenza_Pagamento`. È l'unico punto che scrive la regola |
| `FattureAPI::normalizzaImporto()` | la conversione di segno, condivisa fra validazione e salvataggio |
| `FattureAPI::resolveTipo()` | il `TIPO` di un update parziale viene letto dal record salvato. Prima veniva forzato a `Fattura`: un `PUT` senza il campo trasformava una nota in fattura |
| `FattureAPI::validateBusinessRules()` | il vincolo di segno dipende dal tipo; confronti su `Fatturato_TOT` e `Valore_Pagato` in valore assoluto |
| `FattureAPI::getStatoPagamento()` | nuovo stato `nota_accredito`, fuori dall'aging; poi `stornata` e `stornata_parzialmente`, che vengono prima di ogni altro |
| `FattureAPI::aggiungiDatiStorno()` | calcola `stornato`, `residuo` e i numeri delle note collegate a ogni lettura. Niente di questo è salvato |
| `FattureAPI::validateStorno()` | stesso cliente, fattura emessa prima, capienza residua |
| `FattureAPI::buildWhereClause()` | i filtri `pagata` / `non_pagata` / `scaduta` / `in_scadenza` escludono le note e le fatture stornate; nuovi filtri `nota_accredito` e `stornata` |
| `FattureAPI::getRiepilogoFatturato()` | il netto torna a essere `SUM(Fatturato_TOT)` |
| [fatture-section.js](../assets/js/modules/sections/fatture-section.js) | il form converte il segno e blocca termini e scadenza quando il tipo è nota di accredito; badge *Storno*, *Annullata* e *Stornata in parte*; il campo "Fattura stornata" compare solo sulle note e propone le sole fatture stornabili; la card "Fatturato Netto" ora somma valori già firmati e il conteggio fatture esclude gli storni |
| [fix_note_accredito.sql](../DB/migrations/fix_note_accredito.sql) | allinea i dati storici. Solo dati, idempotente, con runner PHP a fianco |
| [05-note-accredito.sql](../docker/initdb/05-note-accredito.sql) | la stessa migration applicata da sola a ogni reset dell'ambiente locale |

Tre correzioni minori nate guardando le schermate vere:

- **card statistiche** ([management.css](../assets/css/management.css)): `186.384,00 €` veniva
  tagliato a metà. `Intl.NumberFormat` separa il simbolo con uno spazio unificatore, che non è
  un punto di a capo valido, e il testo dipinto con `background-clip: text` non riceve colore
  fuori dal proprio box. Ora il numero si adatta alla card;
- **badge *Storno***: `.status-badge` non definisce un colore di testo, quindi con `bg-dark`
  restava nero su nero. Aggiunto `text-light`;
- **export CSV**: il numero fattura viene scritto come `="09/26"`, altrimenti Excel lo
  interpreta come data e lo mostra come *set-26*.

### Verifica

Fatta il 13/08/2026 in due passaggi.

**Sui metodi di `FattureAPI`**, con un banco di prova a 19 casi (segno, idempotenza, update
parziale senza `TIPO`, validazione per tipo, stato): tutti passati.

**Sul database vero**, ambiente locale allineato al dump `260813`:

- stato di partenza identico alla stima fatta sul dump — 6 note su 7 positive, tutte con
  scadenza, somma 986.992,00 €, 41 fatture scadute;
- dopo la migration: **736.513,50 €** di netto, **35** scadute, 0 note da correggere,
  crediti aperti invariati a 453.475,00 €;
- netto per anno **13.705,00** / **340.088,25** / **382.720,25**, e LACTALIS Corteolona
  2026 a **84.304,00 €** contro i 186.384,00 di prima;
- migration rieseguita: 0 note da correggere, quindi idempotente;
- **scrittura provata via API**: una nota inserita con importi positivi e termini a 60
  giorni è stata salvata `-1000,00 / -200,00 / -1200,00` con scadenza nulla e stato
  `nota_accredito`; una fattura con importi negativi è stata respinta. Record di prova
  eliminato.

### Da fare prima del rilascio

1. Eseguire le migration in produzione da phpMyAdmin, **in quest'ordine**, con un
   backup della tabella prima di cominciare:
   `fix_note_accredito.sql` → `allinea_fatture_pdf.sql` → `allinea_incassi.sql` →
   `add_storno_note_accredito.sql`.
   L'ordine conta: le due centrali cercano le righe per numero e la prima è quella
   che sistema le numerazioni.
   **Vanno eseguite insieme al deploy del codice**: il frontend nuovo somma valori
   firmati, e su dati non migrati sottrarrebbe le note invece di stornarle.
2. In locale non serve fare nulla: gli script da `05` a `08` in `docker/initdb` le
   applicano a ogni reset del volume.

---

---

## 5. L'allineamento ai documenti cartacei

*14/08/2026.* Riletti uno per uno gli 89 PDF in `docs/Fatture/2024`, `/2025` e
`/2026`, il registro incassi in `docs/Fatture/*.xlsx` e i documenti d'ordine in
`docs/Ordini`. I prospetti ricavati stanno in
`docs/Fatture/prospetto-fatture-<anno>.csv`.

L'impianto reggeva: importi, date e tipo coincidevano su quasi tutte le righe.
Quello che non tornava, e le tre migration che lo sistemano:

| Migration | Cosa fa |
|---|---|
| [allinea_fatture_pdf.sql](../DB/migrations/allinea_fatture_pdf.sql) | numerazioni (`1/26` → `01/26`, la 2026 numerata `15/25` → `15/26`), il doppione `FAT26005` della 03/26 che gonfiava il 2025 di 27.924,75, due importi (04/24 a 3.987,50 e la nota 14/26 a −27.924,75), le fatture 39/26 e 40/26 mai inserite, e 59 riferimenti d'ordine presi dai PDF |
| [allinea_incassi.sql](../DB/migrations/allinea_incassi.sql) | i 26 incassi che il registro Excel segnava e l'archivio no, più tre date divergenti |
| [add_storno_note_accredito.sql](../DB/migrations/add_storno_note_accredito.sql) | la colonna `ID_FATTURA_STORNATA` e i sette collegamenti storici |

Netto per anno dopo l'allineamento: **13.705,50** / **312.163,50** /
**401.687,50**. I crediti aperti veri sono **74.082,50**: le sei fatture 2026
annullate dalle note di aprile valgono 125.240,00 e non sono un credito.

Ognuna delle tre ha un runner PHP a fianco e una copia in `docker/initdb`, così
`reset-db.ps1` ricostruisce l'ambiente locale già allineato. Verificate con un
reset completo del volume: dal dump grezzo si riottengono gli stessi numeri.

### Cosa dicono gli ordini

I documenti d'ordine indicano a chi va intestata la fattura, e sono espliciti:
`4511977261`, `4512149513`, `4512149672`, `4512155215`, `4512210990` e
`4512210994` chiedono **Egidio Galbani Srl**; `4511977300`, `4512037132`,
`4512064618`, `4512092514`, `4512149558`, `4512210984` e `4512236024` chiedono
**Gruppo Lactalis Italia Srl**. I PDF delle fatture rispettano la divisione senza
eccezioni, e si spiega così il ciclo di storni di aprile: le fatture di gennaio
erano andate a Gruppo Lactalis mentre gli ordini chiedevano Galbani.

Su 29 ordini citati in fattura, 21 hanno il documento in archivio e per 16 il
fatturato coincide al centesimo con l'ordinato.

---

## 6. Quello che resta aperto

1. **Il cliente delle undici fatture 2026 intestate a Galbani** (15, 17, 19, 21,
   23, 25, 26, 27, 33, 34, 36) è registrato come `LACTALIS` o
   `LACTALIS STAB CORTEOLONA`, mentre l'anagrafica `LACTALIS GALBANI` esiste ed è
   inutilizzata nel 2026. Gli ordini dicono che l'intestatario è Galbani.
2. **La data della 37/26**: il PDF dice 30/05/2026 e l'archivio 30/06/2026, ma lo
   stesso PDF porta il numero sbagliato (`02/2026`), quindi va prima chiarito
   quale documento sia quello buono.
3. **37 delle 40 fatture 2026 non hanno `ID_COMMESSA`** (nel 2025 ne mancava una su 44), quindi il fatturato per
   commessa — e con esso il margine — è quasi vuoto sul lato ricavi.
   `CommesseAPI::getStatistiche()` inoltre filtra `TIPO = 'Fattura'` e ignora le
   note.
4. **Il controllo di unicità del numero usa `YEAR(Data)`**, ma la numerazione
   reale sta nel suffisso di `NR`: è così che è passato il doppione `03/26`
   datato 31/12/2025. Il dato è stato corretto, il controllo no.
5. **Due schemi di ID** (`FATT######` importati, `FAT{yy}###` generati) e l'ID che
   usa l'anno corrente invece dell'anno della fattura.
6. **`FACT_FATTURE_COLLABORATORI` non esiste in produzione**: il ciclo passivo ha
   API e interfaccia, entrambe disattivate.
7. **41/26 e 42/26** sono già nel registro Excel, datate 31/08/2026, ma non
   ancora emesse: niente PDF e niente riga in archivio.
