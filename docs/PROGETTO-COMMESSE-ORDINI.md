# Progetto: le fatture sulla commessa, e la commessa sull'ordine

*15/08/2026 — documento di progetto, in attesa di approvazione*
*Rivisto il 18/08/2026: l'offerta confermata diventa un documento commerciale come l'ordine,
e ogni fattura ne ha uno. Vedi le decisioni 7 e 8 e il § 4.*

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

Discusse e approvate il 15/08/2026, la sesta il 16/08/2026.

1. **L'importo teorico della commessa entra nel database subito**, anche se non verrà usato
   per ora: il database di produzione va toccato comunque per altre modifiche, e conviene
   una volta sola.
2. **Il cliente torna a essere il soggetto giuridico.**
3. **Una fattura non copre più di un ordine.** Assunzione esplicita, da far rispettare.
4. **I documenti commerciali si caricano dalla maschera di commessa**, offerte e ordini
   insieme, con i loro dati e importi. Rivista il 18/08/2026: prima era «il documento di
   proposta si allega alla commessa», cioè un campo solo.
5. **La fattura ha una natura**: acconto, avanzamento o saldo.
6. **Si prevedono solo le attività, non le spese.** Le spese restano un dato di sola
   consuntivazione. Deciso il 16/08/2026, vedi «Le tre letture dell'avanzamento».
7. **Ogni fattura sta su un documento commerciale** — un ordine, oppure un'offerta confermata
   quando l'ordine non c'è — e da quel documento eredita la commessa. Deciso il 18/08/2026.
8. **Si registrano solo le offerte confermate**, ma **tutte**, anche quando l'ordine c'è. La
   pipeline delle offerte in corso resta fuori dal gestionale. Deciso il 18/08/2026.

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

**Sul punto 4**, il campo `Documento_Offerta` esisteva già e si era pensato di dargli vita.
Non basta: è uno solo, mentre i progetti a fasi hanno più proposte — Melzo ne ha due, Lindt
quattro. Con l'offerta promossa a riga della tabella dei documenti il limite sparisce, e da
`ANA_COMMESSE` si eliminano **entrambi** i campi documento, non solo `Documento_Ordine`.

**Sui punti 7 e 8, l'offerta è un documento commerciale come l'ordine.** Le fatture senza
ordine non sono un'eccezione da tollerare con un campo nullable: sono fatture su offerta. Lo
dice l'archivio, dove `Arexons`, `EOC`, `Maxion Wheels`, `Vimar` ed `Emu` contengono solo
offerte, e ogni cartella d'ordine ha accanto l'offerta da cui l'ordine è nato. Il collegamento
fattura → commessa smette così di essere un dato da compilare a mano — vuoto oggi sul 92%
delle fatture 2026 — e diventa **derivato dal documento**.

Registrando solo le offerte confermate (punto 8), non serve alcuno stato per le offerte perse
o superate: l'offerta `250708` di Castelli-Corte, rifiutata e rifatta a settembre, non si
carica affatto. Entra solo la `250923`, che ha generato i due ordini.

**L'offerta si carica comunque, anche quando l'ordine c'è**, e per due scopi diversi:

1. **Quando l'ordine manca, l'offerta fa fede per la fatturazione.** È il titolo su cui si
   emette la fattura, e il documento a cui si torna per sapere quanto resta da fatturare.
2. **Quando l'ordine c'è, l'offerta spiega il contenuto.** L'ordine del cliente porta un
   totale netto e delle posizioni contabili; l'offerta porta il dettaglio dell'attività e la
   suddivisione fra lavori, spese ed eventuali voci a corpo. È l'unico documento che dice
   *cosa* è stato venduto, e serve per capire una fattura o un residuo a distanza di mesi.

C'è poi la ragione che tiene insieme le due: **l'attività parte alla conferma dell'offerta, e
l'ordine, se arriva, arriva dopo.** Non è quindi che l'offerta supplisce all'ordine mancante
in qualche caso raro — è il documento con cui il lavoro comincia, quasi sempre. L'ordine è una
formalizzazione successiva, e talvolta non arriva affatto.

Da questo secondo scopo **non discende un campo**, almeno per ora. La suddivisione
attività/spese dell'offerta resta nel PDF e si legge aprendolo: portarla a database
significherebbe registrare una previsione di spesa, che la decisione 6 ha scartato con dei
numeri davanti. Se un giorno servisse confrontare le spese offerte con quelle consuntivate,
si aggiungono allora `Importo_Attività` e `Importo_Spese` sul documento — ma con quel caso
sul tavolo, non per completezza.

**Sul punto 5**, un acconto è fatturato ma non corrisponde a lavoro svolto. Nella lettura
economica va contato — è denaro fatturato sull'ordine — ma non va confuso con l'avanzamento
del lavoro, che si legge sulla riga operativa. È una delle ragioni per cui le letture sono
tre e separate: mostrarne una sola porta prima o poi a leggere un progetto al 90% che non è
ancora iniziato.

## 4. Il modello dati

### Quale commessa: la decide il lavoro che il documento paga

*Deciso il 19/08/2026, chiudendo la prima decisione aperta.*

Le aperture del 13/08/2026 sembravano incoerenti: per Corteolona, Certosa e Melzo la fase
successiva è diventata una commessa nuova, mentre per Castelli Reggio l'ordine `4512249011`
è finito su `COM2025007 LACTALIS STAB CASTELLI RE SVILUPPO 2025`, cioè la commessa del 2025,
dove il 13/08 è comparso un task.

Non è un'incoerenza. **L'offerta 260723 e il suo ordine comprendono anche attività già
iniziate nel 2025**, quelle registrate su COM2025007. Il documento paga quel lavoro, e quel
lavoro sta lì.

Ne esce la regola, che non è cronologica né per fase:

> **Un documento commerciale si attacca alla commessa che contiene il lavoro che autorizza.**
> Se apre lavoro nuovo e separato, la commessa è nuova — Corteolona, Certosa, Melzo. Se paga
> anche lavoro già in corso su una commessa aperta, va su quella — Castelli Reggio.

Il criterio operativo è semplice da applicare: *l'ordine copre giornate già consuntivate su
una commessa aperta?* Se sì, è la sua. È anche l'unica lettura compatibile con la cardinalità
del paragrafo seguente: aprendo una commessa nuova per Castelli, l'ordine `4512249011` si
sarebbe dovuto spezzare fra due commesse, che il modello non ammette.

Va accettata una conseguenza estetica: `COM2025007` si chiama «SVILUPPO 2025» e ospita lavoro
del 2026. Il nome non è un dato, e rinominarla è una scelta libera.

### La cardinalità, letta sui documenti veri

I documenti in `docs/Ordini` rispondono senza ambiguità:

- **Certosa** ha due ordini, `4512155215` per la fase 1 e `4512249010` per la fase 2
- **Perfetti**, cartella `250922`, ha due ordini distinti (`124043` e `129980`) sullo stesso progetto
- **Corteolona** ha `4512149672` per la prima fase e `4512210994` per la seconda

Quindi **una commessa ha N ordini**, e un ordine appartiene a una commessa sola. L'ordine non
può essere un campo su `ANA_COMMESSE` — ed è probabilmente il motivo per cui i due campi
esistenti non sono mai stati compilati: erano sottodimensionati per il problema reale.

C'è un secondo livello di cardinalità, che si vede solo guardando le offerte: **un'offerta può
generare più ordini**. L'offerta `250923 Reggio Corte Audit` copre `4512064618` (14.416,50) e
`4512092514` (11.486,00), 25.902,50 in totale. Non è quindi sufficiente una riga sola che si
trasforma da offerta in ordine quando l'ordine arriva: serve che l'ordine possa puntare
all'offerta da cui discende.

### Le modifiche

**Tabella nuova `ANA_DOCUMENTI_COMMERCIALI`**

Una tabella sola per offerte e ordini, non due: la fattura deve poter puntare all'una o
all'altro con un campo solo, e le due entità condividono importo, intestatario, documento e
stato. Le distingue `Tipo`, e le lega `ID_PADRE`.

| Campo | Note |
|---|---|
| `ID_DOCUMENTO` | `DOC{yy}###`, sullo schema già usato per le fatture |
| `Tipo` | `Offerta` oppure `Ordine` |
| `ID_PADRE` | sull'ordine, l'offerta da cui nasce. Nullable: non tutti gli ordini hanno un'offerta a monte, e nessuna offerta ha un padre |
| `ID_COMMESSA` | obbligatorio, anche sulle offerte: si registrano solo quelle confermate |
| `Numero`, `Data` | il riferimento del cliente per l'ordine, il nostro protocollo per l'offerta |
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
resta vuoto — coerentemente col fatto che per ora non viene usato. `Documento_Offerta` e
`Documento_Ordine` **si eliminano entrambi**, sostituiti dalla tabella dei documenti.

**Su `FACT_FATTURE`:** `ID_DOCUMENTO`, `Natura ENUM('Acconto','Avanzamento','Saldo')`.
`ID_DOCUMENTO` e `ID_COMMESSA` diventano obbligatori, ma **solo al termine della fase 2**,
quando il backfill è completo.

`ID_COMMESSA` sulla fattura diventa a quel punto un dato **derivato** dal documento. Resta
però una colonna vera, compilata automaticamente e non modificabile a mano: toglierla
vorrebbe dire riscrivere ogni query che oggi la usa, e il rischio di divergenza si copre con
un controllo di coerenza invece che con una join in più ovunque.

Le note di credito ereditano il documento della fattura che stornano, coerentemente con la
regola già scritta in [REGOLE-FATTURAZIONE.md](REGOLE-FATTURAZIONE.md).

**Su `ANA_TASK`:** nulla. `gg_previste` c'è già ed è l'unica previsione che serve — vedi
«Le tre letture dell'avanzamento».

**Su `ANA_CLIENTI`:** `Codice_Fiscale`, e la compilazione di `P_IVA` sui clienti attivi.

### Chiudere la commessa quando l'ordine non è esaurito

Il meccanismo esiste già a metà: `CommesseAPI::propagaChiusuraAiTask()` allinea i task
quando la commessa passa a `Chiusa` o `Archiviata`, e lo fa solo sul **cambio** di stato,
così risalvare una commessa già chiusa non richiude un task riaperto di proposito. È il
punto a cui agganciare la stessa domanda per gli ordini.

Differenza importante: sui task la propagazione è automatica e silenziosa, perché un task
senza la sua commessa non ha significato. Sugli ordini **non può esserlo**, perché un ordine
chiuso con un residuo non fatturato è un'informazione commerciale che va registrata, non
dedotta.

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

### Le tre letture dell'avanzamento

Un solo numero di avanzamento non si può dare, perché le grandezze in gioco non sono
omogenee: l'ordine comprende lavori e spese insieme, la previsione interna riguarda le
giornate, le spese non hanno un previsto attendibile. Mescolarle produce una percentuale che
sembra completa e non lo è.

Le letture sono tre, separate e ognuna coerente al proprio interno:

| Lettura | Formula | Risponde a |
|---|---|---|
| **Economica** | fatturato / ordinato | «quanto resta da fatturare» |
| **Operativa** | giornate consuntivate / `gg_previste` | «sto sforando» |
| **Spese** | ricavo e costo a consuntivo, **senza denominatore e senza percentuale** | «quanto è costato» |

Sull'economica entrambi i termini comprendono le spese, quindi il rapporto è pulito.
Sull'operativa entrambi riguardano solo i lavori. Le spese restano una colonna a fianco.

**Perché le spese non hanno una previsione.** È stato valutato di aggiungere una quantità di
viaggi previsti sul task, e la scelta è stata di non farlo. Le ragioni, misurate
sull'archivio:

- pesano il **2,8%** del valore (17.749,54 di ricavo spese contro 616.977,50 di lavori) e il
  margine che ci si gioca sopra è lo **0,33%** del fatturato;
- solo **23 commesse su 44** hanno spese movimentate: sulle altre il campo resterebbe vuoto
  per costruzione;
- `gg_previste`, che è la previsione con il valore informativo più alto, è compilata sul
  **64%** dei task. Un secondo campo previsionale verrebbe compilato meno, e un previsto
  compilato a metà è peggio di nessun previsto: fa risultare in anticipo chi non l'ha
  riempito;
- **il margine sulle spese non è stabile nemmeno a consuntivo**: LINDT CapiTurno 2026 e
  Certosa risultano oggi con ricavo rispettivamente 1.260 e 1.000 e costo **zero**, perché le
  spese non sono ancora state registrate. Prevedere una grandezza che non è affidabile
  neanche a posteriori è lavoro sprecato;
- la diaria è per costruzione una **partita di giro concordata**: copre la trasferta, non
  produce margine. Prevederne lo scostamento non guida alcuna decisione.

`Importo_Previsto` sulla commessa resta, ed è la previsione economica: essendo un totale
commerciale comprende naturalmente anche le spese, quindi non soffre del problema di
eterogeneità.

Se un domani arrivasse una commessa con trasferte pesanti — estero, lunghe permanenze — il
campo si aggiunge allora, con un caso vero davanti invece che per completezza.

### Solo le commesse Cliente hanno documenti

`ANA_COMMESSE.Tipo_Commessa` è già `enum('Cliente','Interna')`, e
[CommesseAPI.php](../API/CommesseAPI.php) impone già che una commessa interna non abbia un
cliente. Offerte e ordini seguono la stessa regola: **si caricano solo sulle commesse
Cliente**. Una commessa interna non ha una controparte che ordina, quindi non ha un titolo da
cui fatturare né un contenuto venduto da documentare.

Le commesse interne oggi sono due — `COM0016` *Attività di Promozione VP* e `COM2025001`
*Sviluppo* — con 6 task e **zero fatture**. Il vincolo è quindi già rispettato dai dati: si
scrive senza bonifiche, e `ID_DOCUMENTO` obbligatorio sulla fattura non entra in conflitto.

Conseguenze concrete:

- la scheda documenti **non compare** sulla maschera di una commessa interna, come già non vi
  compare il cliente;
- creare un documento su una commessa interna è un errore di validazione, sul modello di
  quello che già esiste per il cliente;
- l'avanzamento di una commessa interna ha **solo la lettura operativa** (giornate
  consuntivate su `gg_previste`) e quella delle spese. L'economica non si mostra affatto:
  senza ordinato e senza fatturato non è vuota, è priva di senso.

### Quando l'ordine arriva dopo

Se il lavoro parte sull'offerta e l'ordine arriva mesi più tardi, quando arriva possono essere
già state emesse delle fatture, agganciate all'offerta perché all'epoca era l'unico titolo.
Va deciso cosa succede a quelle fatture.

**La scelta adottata: l'arrivo dell'ordine è un'azione esplicita**, non la semplice creazione
di una riga nuova. Si apre l'ordine dall'offerta, e le fatture già emesse su quell'offerta si
spostano sull'ordine insieme a lei.

L'alternativa era lasciare le fatture dove sono e leggere fatturato e residuo sulla
*famiglia* offerta + ordini. Conserva meglio la storia, ma costringe ogni lettura a
ricomporre la famiglia, e soprattutto rende impossibile rispondere a «quanto resta su
`4512155215`» guardando l'ordine: il residuo di un ordine deve essere leggibile sull'ordine.

Con lo spostamento, invece, la regola dell'ordinato qui sotto resta vera senza eccezioni, e
l'assunzione una-fattura-un-documento non si complica.

**Serve anche sapere se l'ordine è atteso o non arriverà mai.** Sono due situazioni diverse:
un'offerta confermata in attesa d'ordine è un sollecito da fare, un'offerta su cui il cliente
non emette ordini è la normalità (Emu, Sammontana, EOC). Un flag `Ordine_Atteso` sull'offerta
distingue i due casi e alimenta l'elenco delle offerte da sollecitare. Senza, l'unico modo di
saperlo è ricordarselo.

### Ordinato e confermato: la regola contro il doppio conteggio

Se offerte e ordini stanno nella stessa tabella, sommarli tutti conta due volte lo stesso
impegno: l'offerta `260113 Certosa` e l'ordine `4512155215` che ne discende sono lo stesso
lavoro. La regola è quindi esplicita:

> **ordinato = ordini + offerte che non hanno generato ordini.**

Un'offerta con `ID_PADRE` che punta a lei da almeno un ordine esce dal totale, sostituita dai
suoi ordini. È anche la ragione per cui l'importo dell'offerta va conservato: quando i due
non coincidono — e su Castelli-Corte coincidono al centesimo, 25.902,50 — lo scostamento è
un'informazione, non un errore da correggere.

Il portafoglio si legge su **due numeri distinti**, entrambi confermati:

| | Cosa contiene |
|---|---|
| **Ordinato** | ordine formale del cliente ricevuto |
| **Confermato senza ordine** | offerta accettata su cui l'ordine non è previsto o non è ancora arrivato |

Le commesse che stanno solo nella seconda colonna esistono già in archivio: Arexons, EOC,
Maxion Wheels, Vimar, Sammontana ed Emu hanno la sola offerta. Non sono un caso degenere da
segnalare come mancanza — sono clienti che lavorano così.

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

### Fase 1 — struttura, in una migration sola · **fatta il 19/08/2026**

Tutte le modifiche di schema descritte al § 4, in
[`add_documenti_commerciali.sql`](../DB/migrations/add_documenti_commerciali.sql) col suo
runner. Nessun comportamento cambia, nessuna schermata se ne accorge. Rilasciabile in
produzione insieme alle quattro migration già in attesa; in locale è anche lo script
`docker/initdb/13-documenti-commerciali.sql`, così il reset la riapplica.

Due cose sono state decise scrivendola, e non stavano nel § 4:

- **`ID_PADRE` è `ON DELETE RESTRICT`, non `SET NULL`.** Cancellare un'offerta che ha
  generato ordini non deve slegarli in silenzio: il legame offerta-ordine è l'unico posto in
  cui è scritto che i 25.902,50 di Reggio Corte sono una fornitura sola. Coincide con un
  vincolo tecnico: MariaDB rifiuta (errore 1901) un `CHECK` che riferisce una colonna
  soggetta a `ON DELETE SET NULL`, e senza `RESTRICT` il vincolo «solo un ordine può avere un
  padre» non sarebbe creabile.
- **`ID_DOCUMENTO` sulla fattura resta nullable**, come previsto, ma vale la pena dirlo:
  renderlo obbligatorio oggi bloccherebbe l'inserimento di qualunque fattura nuova, ed è
  esattamente il tipo di rilascio che questa fase evita. Diventa `NOT NULL` a backfill
  completo, quando la 40/26 Lucchini e la 32/25 Sammontana avranno un documento.

Verificata in locale: migration eseguita e rieseguita (idempotente), i quattro casi che
devono essere respinti lo sono — offerta con un padre, documento senza commessa, commessa
inesistente, cancellazione di un'offerta con ordini figli — e cancellando un documento la
fattura resta con il legame azzerato. 45 commesse e 89 fatture invariate, API commesse,
fatture e clienti interrogate e `Importo_Previsto` salvato e riletto dal form commessa.

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

### Fase 4 — i documenti commerciali · *tre o quattro giorni*

`DocumentiCommercialiAPI`, upload in `DB/uploads/documenti` sul modello già collaudato per le
foto delle consuntivazioni, e la **scheda documenti dentro la maschera di commessa**: è da lì
che si caricano offerte e ordini con i loro dati e importi, con l'ordine agganciato alla sua
offerta.

Il caricamento cresce rispetto alla stima iniziale: ai 21 ordini con documento e ai 4 non
ancora fatturati si aggiungono le **offerte confermate**, circa una ventina, comprese quelle
delle commesse che un ordine non ce l'hanno.

Attenzione: **14 documenti d'ordine sono scansioni senza testo estraibile**, quindi numero,
data e importo vanno inseriti a mano.

### Fase 5 — avanzamento, incassato e coerenza degli stati · *tre giorni*

Il pannello con ordinato, maturato, fatturato e incassato, **le tre letture separate**
dell'avanzamento, il riepilogo di portafoglio. L'incassato è già possibile: le date di
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
- L'assunzione una-fattura-un-documento regge su tutti gli 89 documenti, **ma nulla la impone**:
  senza un controllo si perde in silenzio e si scopre due anni dopo. Il caso più vicino al
  limite è la 32/26, «Castenedolo / Collecchio», che sta ancora dentro una commessa sola.
- La fase 4 tocca `commesse-task-section.js`, che con 1.428 righe è il file più grande
  dell'applicazione.

## 7. Cosa resta da decidere

1. Come trattare l'ordine `4512249003`, che è di sole **spese** e non appartiene a un
   progetto solo.
2. Se le commesse chiuse vanno bonificate come le altre o lasciate com'erano.
3. Se i clienti eliminati (CLI0010, CLI0012) vanno cancellati o conservati come storico.
4. Per la **40/26 Lucchini** e la **32/25 Sammontana** va individuata l'offerta di
   riferimento: sono le due righe dell'appendice A senza alcun riferimento documentale, e
   finché restano scoperte `ID_DOCUMENTO` non può diventare obbligatorio. Per la 38/26 Emu
   l'offerta c'è (`Offerta 260724 EMU Quadro.pdf`).
5. Quali ordini sono **a giornate** e quali **chiusi**. Per i 21 documenti in archivio si
   legge dal PDF; per gli 8 di cui manca il documento — Calvi, i quattro Lavazza, i due
   Lindt del 2025 e IWT — serve una risposta. Calvi `7130017952`, con nove fatture a
   giornate su due anni, è quasi certamente aperto.

---

## Appendice A — mappa ordine → commessa, da validare

> **Rivista il 17/08/2026** contro le descrizioni dei PDF di fattura, i documenti
> d'ordine e i prospetti Lactalis. Quattro righe erano sbagliate, e le correzioni
> sono qui sotto: la tabella che segue è quella originale, da leggere con queste
> rettifiche in mano. Il file `docs/Fatture/260817_attribuzioni-fatture-commesse.xlsx`
> (non versionato) ha il dettaglio riga per riga con le evidenze.
>
> - **`4512149672` → COM0013, non COM2025018.** L'offerta 260114 dice «impegno
>   ipotizzato/**realizzato**» ed elenca esattamente le giornate di COM0013 —
>   24/10 Vaglio-Troni, 31/10, 6/11, 12/11 Bevilacqua e Silvestri, 26/11. I task di
>   COM2025018 si chiamano «Seconda fase» e corrispondono all'offerta 260430, cioè
>   all'ordine `4512210994`. Guardando le sole fatture non si distinguevano: dicono
>   «capiturno Corteolona» entrambe.
> - **`9000124043` → COM2025006, non COM2025016.** Le sue quattro fatture sommano
>   **12.400,00 €**, il maturato esatto di COM2025006; le tre di `9000129980`
>   sommano anch'esse 12.400,00, il maturato esatto di COM2025016. Quindi la 01/26,
>   benché datata 2026, appartiene alla commessa 2025.
> - **La 36/25 è già attribuita male a database**: sta su COM0013 ma l'offerta 250923
>   «Castelli-Corte Audit» copre due ordini per 25.902,50 = 14.416,50 (30/25) +
>   11.486,00 (36/25), quindi è **COM0012**. Lo conferma un indizio indipendente: è
>   l'unica fattura, con la 05/24, datata prima della prima giornata della sua commessa.
> - **`1020213371` non è «da decidere»**: la 35/26 vale 7.000,00 €, il maturato esatto
>   di **COM2025022** LAVAZZA R&D AUDIT, contro i 1.000 € di COM2025024.
>
> **Dieci ordini su quindici quadrano al centesimo** col totale delle loro fatture, il
> che rende la mappa molto più solida di una deduzione: 6.200,00 · 55.800,00 ·
> 9.832,50 · 93.082,50 · 51.040,00 · 39.512,50 · 7.340,00 · 11.292,50 · 7.190,00.
> I cinque con residuo fanno **89.041,83 €** di portafoglio da fatturare.
>
> Ne esce anche una regola per la prima decisione aperta: **una fase = una commessa**
> vale per Corteolona, Certosa e Melzo. L'unica eccezione è Castelli Reggio, dove
> l'ordine `4512249011` non ha una commessa propria.

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
