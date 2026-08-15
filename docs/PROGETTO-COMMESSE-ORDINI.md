# Progetto: le fatture sulla commessa, e la commessa sull'ordine

*15/08/2026 — documento di progetto, in attesa di approvazione*

Oggi le fatture vivono attaccate al cliente. L'obiettivo è collegarle alla **commessa**,
collegare la commessa agli **ordini** che la autorizzano, e da lì leggere l'avanzamento:
quanto è stato ordinato, quanto maturato, quanto fatturato, quanto incassato.

I numeri di questo documento sono stati letti sul database allineato al dump `260813`, dopo
le migration di allineamento del 14/08/2026 (vedi [REGOLE-FATTURAZIONE.md](REGOLE-FATTURAZIONE.md)).

---

## 1. Cosa c'è già

Metà dell'impianto esiste ed è spento.

| | Stato verificato |
|---|---|
| `FACT_FATTURE.ID_COMMESSA` | **esiste**, nullable. Compilato su 43 righe su 44 nel 2025, su **3 su 40** nel 2026 |
| `ANA_COMMESSE.Documento_Offerta` e `.Documento_Ordine` | **esistono** in schema e nelle regole di validazione di [CommesseAPI.php](../API/CommesseAPI.php). Compilati su **0 commesse su 41**, mai nominati dal frontend |
| Importo della commessa | **non esiste**: nessun campo valore, budget o ordinato |
| `ANA_CLIENTI.P_IVA` | esiste, **vuota su tutti e 22 i clienti**. `Ragione_Sociale` è la copia del nome breve |
| Riferimento d'ordine sulla fattura | compilato su **83 fatture su 89**, dal 14/08/2026 |

Le fatture non sono legate al cliente per come è fatta la tabella: lo sono per come è stata
usata. Nel 2025 la prassi c'era, nel 2026 si è persa.

## 2. Il problema che il cambiamento risolve davvero

L'anagrafica clienti contiene `LACTALIS`, `LACTALIS AMBROSI`, `LACTALIS GALBANI` e
`LACTALIS STAB CORTEOLONA NUOVA CASTELLI`. Non sono quattro clienti: sono **due soggetti
giuridici e quattro stabilimenti**.

L'anagrafica è stata frammentata per compensare l'assenza del collegamento alla commessa.
Serviva distinguere Corteolona da Certosa nei totali, e l'unica dimensione disponibile era
il cliente. Il risultato è che oggi il cliente non è né il soggetto che riceve la fattura né
il progetto, ma un ibrido — ed è la ragione per cui la questione Galbani è rimasta
irrisolvibile: correggere l'intestatario avrebbe cancellato l'informazione sullo stabilimento.

Spostare le fatture sulla commessa **libera il cliente**, che può tornare a essere il
soggetto giuridico. È il beneficio maggiore, e non era l'obiettivo di partenza.

## 3. Le decisioni prese

Discusse e approvate il 15/08/2026.

1. **L'importo teorico della commessa entra nel database subito**, anche se non verrà usato
   per ora: il database di produzione va toccato comunque per altre modifiche, e conviene
   una volta sola.
2. **Il cliente torna a essere il soggetto giuridico.**
3. **Una fattura non copre più di un ordine.** Assunzione esplicita, da far rispettare.
4. **Il documento di proposta si allega alla commessa.**
5. **La fattura ha una natura**: acconto, avanzamento o saldo.

### Osservazioni che cambiano la portata di queste decisioni

**Sul punto 1.** Le modifiche di struttura vanno consolidate in **una migration sola** —
tabella ordini, importo previsto, campi sulle fatture, campi sui clienti — da eseguire una
volta insieme alle quattro già in attesa di produzione. Una modifica di struttura che non
cambia comportamento si rilascia senza rischi; sono quelle di dati che vanno accompagnate
dal codice.

Il campo importo va chiamato `Importo_Previsto` e **non va mostrato** finché non si decide
di usarlo: un denominatore vuoto produce avanzamenti credibili e falsi.

**Sul punto 2, la fusione dei clienti non è una fusione.** I quattro pseudo-clienti Lactalis
non collassano in uno, e uno dei quattro **si divide fra due intestatari diversi**:

| Oggi | Realtà secondo gli ordini |
|---|---|
| `LACTALIS` (CLI0009) | Gruppo Lactalis Italia Srl — resta |
| `LACTALIS AMBROSI` (CLI0010) | ordine `4512210984` intestato a Gruppo Lactalis → confluisce in CLI0009 |
| `LACTALIS GALBANI` (CLI0011) | Egidio Galbani Srl — resta, soggetto distinto |
| `LACTALIS STAB CORTEOLONA NUOVA CASTELLI` (CLI0012) | **si divide**: Corteolona e Certosa a Galbani, l'audit Corte-Castelli a Gruppo Lactalis |

Non è quindi una rimappatura cliente → cliente, ma **commessa per commessa e fattura per
fattura**, decisa dall'ordine.

Due conseguenze:

- Gruppo Lactalis e Egidio Galbani **condividono la partita IVA** `IT11412360965`, perché
  stanno nello stesso gruppo IVA. Si distinguono per codice fiscale (`03419280965` per
  Galbani). Senza un campo codice fiscale i due soggetti restano indistinguibili proprio
  dove conta.
- **`ITALPIZZA - MANTUA` e `ITALPIZZA - MODENA` non vanno toccati**: sono Mantua.it Srl
  (P.IVA 04052170364) e Italpizza SpA (03095170365), due società vere. Non ogni separazione
  è un errore.

**Sul punto 4**, il campo `Documento_Offerta` c'è già: si tratta di dargli vita. Ha però il
limite di essere uno solo, mentre i progetti a fasi hanno più proposte — Melzo ne ha due,
Lindt quattro. Il taglio adottato: **sulla commessa la proposta commerciale che l'ha aperta,
sull'ordine l'offerta specifica da cui quell'ordine è nato**. Con questa divisione la tabella
ordini non ha bisogno di distinguere fra ordine e offerta.

**Sul punto 5**, con gli acconti l'avanzamento va letto su **due righe che possono
contraddirsi**: fatturato a stato avanzamento contro maturato, e totale fatturato contro
ordinato. Mostrarne una sola porta prima o poi a leggere un progetto al 90% che non è ancora
iniziato.

## 4. Il modello dati

### La cardinalità, letta sui documenti veri

I documenti in `docs/Ordini` rispondono senza ambiguità:

- **Certosa** ha due ordini, `4512155215` per la fase 1 e `4512249010` per la fase 2
- **Perfetti**, cartella `250922`, ha due ordini distinti (`124043` e `129980`) sullo stesso progetto
- **Corteolona** ha `4512149672` per la prima fase e `4512210994` per la seconda

Quindi **una commessa ha N ordini**, e un ordine appartiene a una commessa sola. L'ordine non
può essere un campo su `ANA_COMMESSE` — ed è probabilmente il motivo per cui i due campi
esistenti non sono mai stati compilati: erano sottodimensionati per il problema reale.

### Le modifiche

**Tabella nuova `ANA_ORDINI`**

| Campo | Note |
|---|---|
| `ID_ORDINE` | `ORD{yy}###`, sullo schema già usato per le fatture |
| `ID_COMMESSA` | obbligatorio |
| `Numero`, `Data` | il riferimento del cliente |
| `Tipo_Importo` | `Chiuso` oppure `A_giornate`. Vedi sotto |
| `Importo` | **il dato che oggi non esiste da nessuna parte**. Nullable |
| `Giornate_Previste` | solo sugli ordini a giornate che dichiarano un tetto in giornate |
| `ID_CLIENTE_INTESTATARIO` | a chi va intestata la fattura. Lo dice l'ordine, non la commessa |
| `Documento` | il PDF caricato |
| `Stato` | `Atteso`, `Ricevuto`, `Chiuso` |
| `Residuo_Alla_Chiusura`, `Note_Chiusura` | quanto è rimasto non fatturato quando l'ordine è stato chiuso, e perché |

`ID_CLIENTE_INTESTATARIO` sull'ordine e non solo sulla commessa perché è l'ordine a deciderlo:
`4512149513` chiede fattura a Egidio Galbani, `4512149558` a Gruppo Lactalis, e sono due
stabilimenti dello stesso gruppo.

### Ordini chiusi e ordini a giornate

Non tutti gli ordini hanno un importo, e le due forme esistono entrambe in archivio.

Gli ordini Lactalis portano un «Totale netto» esplicito, spaccato nelle tranche di
fatturazione: `4512149513` è 93.082,50 in quattro posizioni. Sono **ordini chiusi**, e su
questi l'avanzamento del fatturato ha senso in percentuale.

L'ordine Calvi `7130017952` invece regge nove fatture su due anni, ognuna a giornate per
collaboratore moltiplicate per la tariffa, senza un tetto visibile. È un **ordine a
giornate**: l'importo totale non esiste, e chiedere «a che percentuale siamo» non ha
risposta.

Per questo `Tipo_Importo` è un campo esplicito e non si deduce da `Importo` vuoto: un
importo mancante su un ordine chiuso è **un dato da recuperare**, su un ordine a giornate è
**la normalità**. Confonderli significa non sapere mai quali ordini vanno completati.

Conseguenze sulla lettura dell'avanzamento:

| Tipo | Cosa si mostra |
|---|---|
| `Chiuso` | percentuale fatturato / ordinato, e il residuo da fatturare |
| `A_giornate` | nessuna percentuale: fatturato e maturato in valore assoluto. Se l'ordine dichiara un tetto in giornate, la percentuale si calcola su quelle |

E un caso che va gestito fin dall'inizio: una commessa con **un ordine chiuso e uno a
giornate insieme** ha un ordinato solo parzialmente quantificato. Il pannello deve dirlo,
non calcolare una percentuale su un denominatore incompleto.

**Il fee giornaliero non va sull'ordine.** Il prezzo per giornata sta già sul task ed è il
cardine del modello economico: il prezzo sul task, il costo sulla tariffa del collaboratore,
la giornata che li mette in contatto. Duplicarlo sull'ordine creerebbe due verità da tenere
allineate. Se in futuro servisse verificare che il fee praticato coincide con quello
concordato, è un controllo da aggiungere, non un campo.

**Su `ANA_COMMESSE`:** `Importo_Previsto DECIMAL(12,2) NULL`, che per le commesse a giornate
resta vuoto — coerentemente col fatto che per ora non viene usato. `Documento_Offerta` resta e
viene finalmente usato per la proposta; `Documento_Ordine` **si elimina**, sostituito dalla
tabella ordini.

**Su `FACT_FATTURE`:** `ID_ORDINE` nullable, `Natura ENUM('Acconto','Avanzamento','Saldo')`.
`ID_COMMESSA` diventa obbligatorio, ma **solo al termine della fase 2**.

L'ordine resta nullable perché esistono fatture legittime senza: la 38/26 Emu è su vostra
offerta, la 40/26 Lucchini non cita alcun riferimento.

**Su `ANA_TASK`:** `Viaggi_Previsti DECIMAL(10,2) NULL`, accanto a `gg_previste` che c'è già.
Vedi sotto perché le giornate previste non bastano.

**Su `ANA_CLIENTI`:** `Codice_Fiscale`, e la compilazione di `P_IVA` sui clienti attivi.

### Chiudere la commessa quando l'ordine non è esaurito

Lo stato della commessa si cambia da una tendina nel form
([commesse-task-section.js:1239](../assets/js/modules/sections/commesse-task-section.js#L1239)):
oggi è un campo come gli altri, senza conseguenze. Con gli ordini collegati non può più
esserlo.

Quando una commessa passa a `Chiusa` o `Archiviata` e ha ordini ancora aperti, **va chiesto
se chiudere anche quelli**, mostrando cosa resta. La domanda cambia forma secondo il tipo:

- **ordine chiuso**: «restano 14.256,00 € non fatturati su `4512210994`. Chiudo anche
  l'ordine?»
- **ordine a giornate**: non c'è un residuo da mostrare, ma l'ordine resterebbe aperto per
  sempre, perché nulla lo esaurisce da solo. La domanda va fatta comunque.

Tre scelte da fare bene:

1. **Chiedere, non decidere.** La chiusura automatica cancellerebbe in silenzio
   l'informazione che qualcosa non è stato fatturato; il blocco impedirebbe di chiudere una
   commessa per un residuo di dieci euro. Va proposto con il numero davanti, con la chiusura
   di entrambi come opzione preselezionata.
2. **Registrare il residuo al momento della chiusura**, non solo lo stato. Un ordine chiuso
   con 14.256,00 € non fatturati è un'informazione commerciale — lavoro non venduto, o
   perimetro ridotto in corsa — e ricalcolarla a posteriori dà lo stesso numero senza dire
   il perché. Bastano un campo importo e una nota sull'ordine.
3. **Il caso specchio è più frequente e va segnalato lo stesso**: ordine esaurito e commessa
   ancora aperta significa che per continuare a fatturare serve un ordine nuovo. È
   esattamente la situazione di Certosa e Melzo, dove la fase 2 è arrivata con un ordine
   separato.

Ne discende un controllo di coerenza da avere anche fuori dal momento della chiusura, come
elenco: commesse chiuse con ordini aperti, e commesse aperte con tutti gli ordini esauriti.
Serve **anche una volta sola all'indietro**, perché delle 41 commesse attuali molte sono già
chiuse e riceveranno i loro ordini solo in fase 4.

### Il previsto delle spese: i viaggi, non le giornate

Il lato previsionale esiste già a metà. `ANA_TASK.gg_previste` è compilato su **75 task su
118** ed è mostrato nella scheda task accanto ai giorni effettuati: da lì si ricava il valore
lavori previsto, giornate previste per `Valore_gg`.

Per le spese non basta, e COM2025031 *Porcari Seconda Fase* lo mostra bene: **17,75 giornate
previste ma 14 viaggi previsti**. I due numeri non coincidono e la differenza non è
calcolabile, per due motivi indipendenti:

- una parte delle giornate si svolge in **desk**, e lì le spese non si addebitano;
- **una trasferta può coprire più giornate consecutive** — è la ragione per cui esiste il
  flag `Viaggio`, che si toglie quando il consulente resta in loco dal giorno prima.

Sul consuntivo la distinzione c'è ed è precisa: il calcolo conta separatamente le giornate
addebitabili (per il vitto) e quelle con viaggio effettuato (per i viaggi). Sul previsto
manca del tutto.

Serve quindi una **quantità di viaggi previsti sul task**, accanto a `gg_previste`. Senza,
l'avanzamento delle spese non è calcolabile: si sa quanto si è speso, non a che punto si è.
`Importo_Previsto` sulla commessa non copre il caso, perché è un totale e non dice da quante
trasferte è composto.

Verifica su COM2025031, che oggi non ha ancora giornate:

| | Valore |
|---|---:|
| Lavori previsti (17,75 gg × 1.550) | 27.512,50 |
| Spese previste (14 viaggi × 370) | 5.180,00 |
| Spese secondo il gestionale in produzione | 2.960,00 — una diaria per task, artefatto |
| Spese secondo la regola nuova | 0,00 — corretto come consuntivo, muto come previsione |

### Commesse senza ordine

Non richiede nulla di nuovo: basta che `ANA_ORDINI` possa essere vuota per quella commessa.
Serve renderlo visibile — uno stato derivato "in attesa d'ordine" e un avviso quando si
fattura su una commessa che non ne ha. Casi già presenti in archivio: Arexons, EOC, Maxion
Wheels, Vimar e Sammontana hanno solo offerte.

## 5. Le fasi

Le fasi 0, 1 e 2 hanno valore anche fermandosi lì. Dalla 3 in poi cambiano numeri già visti
da chi usa il gestionale.

### Fase 0 — pulizia indipendente · *mezza giornata*

Due difetti che esistono oggi e non dipendono da questo progetto:

- [`CommesseAPI::getStatistiche()`](../API/CommesseAPI.php) somma `WHERE TIPO = 'Fattura'` e
  quindi **conta come fatturato le sei fatture 2026 annullate** dalle note di credito;
- il selettore commessa nel form fattura elenca tutte le 41 commesse **senza filtrarle per
  cliente** ed è etichettato "opzionale" ([fatture-section.js:714](../assets/js/modules/sections/fatture-section.js#L714)).
  Con 41 voci in tendina e nessun vincolo, il campo vuoto sul 92% delle fatture 2026 non
  sorprende.

### Fase 1 — struttura, in una migration sola · *un giorno*

Tutte le modifiche di schema descritte al § 4. Nessun comportamento cambia, nessuna schermata
se ne accorge. Rilasciabile in produzione insieme alle quattro migration già in attesa.

### Fase 2 — collegare le fatture alle commesse · *un giorno, più la validazione*

Attribuire le 37 fatture 2026 orfane usando il numero d'ordine. La mappa proposta è
nell'**appendice A** e va validata riga per riga: una decina di casi sono evidenti, gli altri
no. Poi `ID_COMMESSA` diventa obbligatorio.

Da qui esce già il confronto maturato contro fatturato per commessa, senza aver toccato il
modello.

### Fase 3 — il cliente torna soggetto giuridico · *un giorno*

Rimappatura secondo l'**appendice B**, compilazione di partita IVA e codice fiscale sui
clienti attivi, eliminazione di CLI0010 e CLI0012. Va **dopo** la fase 2, quando la
granularità per stabilimento è già salva sul nome della commessa e non si perde nulla.

### Fase 4 — gli ordini · *due o tre giorni*

`OrdiniAPI`, upload dei documenti in `DB/uploads/ordini` sul modello già collaudato per le
foto delle consuntivazioni, scheda ordini dentro la commessa, caricamento dei 21 ordini che
hanno il documento più i 4 non ancora fatturati.

Attenzione: **14 documenti sono scansioni senza testo estraibile**, quindi numero, data e
importo vanno inseriti a mano.

### Fase 5 — avanzamento, incassato e coerenza degli stati · *tre giorni*

Il pannello con ordinato, maturato, fatturato e incassato, le due letture dell'avanzamento
per via degli acconti, il riepilogo di portafoglio. L'incassato è già possibile: le date di
pagamento sono state registrate il 14/08/2026.

Qui entra anche la domanda alla chiusura della commessa, l'elenco di coerenza fra stati e la
passata all'indietro sulle commesse già chiuse.

## 6. Rischi

**Il rischio principale non è tecnico.** Le fasi 2 e 3 poggiano su attribuzioni che deve
confermare chi conosce i progetti. Se vengono indovinate e sono sbagliate, l'errore si
sedimenta in tutte le statistiche a valle e diventa indistinguibile da un dato vero.

Gli altri, in ordine di peso:

- **`COM2025018` ha data di apertura 01/11/2026**, nel futuro, e le fatture che le
  apparterrebbero sono di aprile e maggio 2026. Un controllo di coerenza fra data ordine,
  apertura commessa e data fattura ne farà emergere altri.
- L'assunzione una-fattura-un-ordine regge su tutti gli 89 documenti, **ma nulla la impone**:
  senza un controllo si perde in silenzio e si scopre due anni dopo. Il caso più vicino al
  limite è la 32/26, «Castenedolo / Collecchio», che sta ancora dentro una commessa sola.
- La fase 4 tocca `commesse-task-section.js`, che con 1.428 righe è il file più grande
  dell'applicazione.

## 7. Cosa resta da decidere

1. Se le due fasi di uno stesso stabilimento sono **una commessa con due ordini** o due
   commesse. Le aperture del 13/08/2026 non sono uniformi: per Certosa e Melzo la fase
   successiva è diventata una commessa nuova, mentre per Castelli Reggio l'ordine
   `4512249011` non ha una commessa propria e su COM2025007 è comparso un task. Serve una
   regola, altrimenti l'avanzamento per commessa misura cose diverse da progetto a progetto.
2. Come trattare l'ordine `4512249003`, che è di sole **spese** e non appartiene a un
   progetto solo.
3. Se le commesse chiuse vanno bonificate come le altre o lasciate com'erano.
4. Se i clienti eliminati (CLI0010, CLI0012) vanno cancellati o conservati come storico.
5. Quali ordini sono **a giornate** e quali **chiusi**. Per i 21 documenti in archivio si
   legge dal PDF; per gli 8 di cui manca il documento — Calvi, i quattro Lavazza, i due
   Lindt del 2025 e IWT — serve una risposta. Calvi `7130017952`, con nove fatture a
   giornate su due anni, è quasi certamente aperto.

---

## Appendice A — mappa ordine → commessa, da validare

Ricavata dai riferimenti d'ordine delle fatture e dai nomi delle commesse. La colonna
*certezza* dice quanto è sicura l'attribuzione: **alta** = un solo abbinamento possibile,
**media** = coerente ma con alternative, **da decidere** = serve una scelta.

| Ordine | Fatture | Commessa proposta | Certezza |
|---|---|---|---|
| `7130017952` | 04/24, 03·07·10·14·18·26·29·39/25 | COM0001 CALVI SVIL MANAGERIALITA' | alta |
| `9000113088` | 05/24 | COM0005 PERFETTI SVILUPPO | media |
| `9000124038` | 35/25 | COM0005 o COM2025016 | da decidere |
| `9000124043` | 38·42·44/25, 01/26 | COM2025016 PERFETTI FORMAZIONE CAPITURNO 2026 | media |
| `9000129980` | 08·11·29/26 | COM2025016 | media |
| `4511977261` | 08/25 | COM0010 LACTALIS GALBANI COACHING (Melzo) | alta |
| `4511977300` | 09·19·40/25 | COM0009 LACTALIS LTF 2025 | alta |
| `4512037132` | 22/25 | COM0011 LACTALIS AMBROSI COACHING | alta |
| `4512064618` | 30/25 | COM0012 LACTALIS STAB AUDIT CORTE - CASTELLI | media |
| `4512092514` | 36/25 | COM0012 | media |
| `4512149513` | 15·21·26·36/26 | COM2025013 LACTALIS STAB CASALE CREMASCO | alta |
| `4512149558` | 07·31/26 | COM2025014 LACTALIS LTF 2026 | alta |
| `4512149672` | 17·23/26 | COM0013 o COM2025018 (Corteolona) | da decidere |
| `4512155215` | 19·25·27/26 | COM2025011 LACTALIS STAB CERTOSA | alta |
| `4512210984` | 32/26 | COM2025020 LACTALIS STAB AMBROSI | alta |
| `4512210990` | 33/26 | COM2025021 LACTALIS STAB MELZO | alta |
| `4512210994` | 34/26 | COM2025018 LACTALIS STAB CORTEOLONA SVILUPPO 2026 | media |
| `4512236024` | 39/26 | COM2025026 LACTALIS PORCARI | alta |
| `4500238831` | 34/25 | COM2025009 o COM2025010 (Lindt 2025) | da decidere |
| `4500241173` | 41/25 | COM2025010 o COM2025015 | da decidere |
| `4500247167` | 02·13·37/26 | COM2025015 LINDT SVILUPPO CapiTurno 2026 | media |
| `4500251625` | 30/26 | COM2025019 LINDT COACHING MIDDLE MANAGEMENT 2026 | alta |
| `1020201558` | 13/25 | commessa Lavazza da individuare | da decidere |
| `1020203362` | 17/25 | commessa Lavazza da individuare | da decidere |
| `1020205239` | 31/25 | COM0008 LAVAZZA HSE | media |
| `1020209062` | 43/25 | COM2025012 LAVAZZA DIREZIONE OPERATIONS | media |
| `1020213371` | 35/26 | COM2025022 o COM2025024 (Lavazza R&D) | da decidere |
| `8500032997` | 28/26 | COM2025017 LUCCHINI COACHING | alta |
| `WR2500969` | 37/25, 05/26 | COM2025004 IWT Coaching | alta |
| — (offerta) | 38/26 | COM2025023 EMU | alta |
| — | 40/26 | COM2025025 LUCCHINI FORMAZIONE | media |
| — | 32/25 | COM0015 SAMMONTANA FRANCIA | media |

**Ordini ricevuti e non ancora fatturati**, da caricare in fase 4. Il 13/08/2026 — dopo il
dump su cui era stata scritta la prima versione di questo documento — sono state aperte
quattro commesse che corrispondono in buona parte a questi ordini:

| Ordine | Importo | Commessa aperta il 13/08 |
|---|---:|---|
| `4512249010` Certosa fase 2 | 17.550,00 | COM2025028 LACTALIS CERTOSA SECONDA FASE |
| `4512249012` Melzo prima fase | 22.655,00 | COM2025029 LACTALIS MELZO Prima Fase |
| `4512249011` Castelli Reggio 2ª fase | 14.830,00 | **nessuna**: su COM2025007 è comparso un task |
| `4512249003` spese | 5.050,83 | **nessuna**: non appartiene a un progetto solo |

Più due commesse nate da offerte senza ordine: COM2025030 *LACTALIS CI Castenedolo e
Collecchio* e COM2025031 *LACTALIS PORCARI Seconda Fase*.

In totale **60.085,83 €** di portafoglio ordinato.

Le due commesse nuove confermano anche il problema dell'appendice B: COM2025028 è stata
aperta sotto `LACTALIS STAB CORTEOLONA NUOVA CASTELLI` mentre il suo ordine chiede fattura a
**Galbani**, e COM2025030 sotto `LACTALIS AMBROSI` mentre l'intestatario è Gruppo Lactalis.
La frammentazione si propaga a ogni commessa nuova.

**Residui su ordini già in corso:** `4512149558` 14.700,00 · `4512210994` 14.256,00 ·
`9000129980` 4.650,00.

## Appendice B — rimappatura dei clienti

| Cliente attuale | Destinazione | Criterio |
|---|---|---|
| CLI0009 `LACTALIS` | resta, diventa **Gruppo Lactalis Italia Srl** | — |
| CLI0011 `LACTALIS GALBANI` | resta, diventa **Egidio Galbani Srl** | CF 03419280965 |
| CLI0010 `LACTALIS AMBROSI` | → CLI0009 | ordine `4512210984` intestato a Gruppo Lactalis |
| CLI0012 `LACTALIS STAB CORTEOLONA NUOVA CASTELLI` | **si divide** | Corteolona e Certosa → CLI0011; audit Corte-Castelli (`4512064618`, `4512092514`) → CLI0009 |

Le undici fatture 2026 oggi registrate sotto `LACTALIS` o `LACTALIS STAB CORTEOLONA` che gli
ordini intestano a Galbani — 15, 17, 19, 21, 23, 25, 26, 27, 33, 34, 36 — si spostano su
CLI0011 nella stessa migration.

**Da non toccare:** `ITALPIZZA - MANTUA` e `ITALPIZZA - MODENA`, che sono due società
distinte.
