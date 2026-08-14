# La sezione Statistiche — registro attività

*13/08/2026*

Fino a oggi Statistiche era uno stub ("Sezione in Sviluppo"). Ora risponde a una domanda
sola: **cos'è successo nel gestionale negli ultimi giorni, e chi l'ha fatto** — comprese le
modifiche che arrivano dalla consuntivazione.

---

## Chi la vede

**Solo il ruolo `Admin`.** È l'unica sezione con questa restrizione: tutte le altre
distinguono soltanto il ruolo `User` da Manager e Admin.

Il controllo che conta è nell'API: `AttivitaAPI` risponde **403** a chiunque non sia Admin,
verificato sui tre ruoli. La voce di menu nascosta in `management.js` e la guardia in
`showSection()` servono a non mostrare una schermata che non caricherebbe — nascondere un
pulsante non è una protezione.

Il motivo della restrizione: il registro mostra chi ha toccato cosa in tutto il gestionale,
fatture comprese.

---

## Cosa mostra

| Blocco | Contenuto |
|---|---|
| Cinque card | eventi nel periodo, inserimenti, modifiche, utenti attivi, errori nei log |
| Ripartizione | per tipo di dato e per utente |
| **Modifiche al database** | data e ora, azione, tipo, descrizione a parole, ID, utente, origine |
| **Log applicativi** | data e ora, livello, file, messaggio |

Filtri lato client su ricerca, origine (Management / Consuntivazione) e tipo
(inserimenti / modifiche); il periodo — 24 ore, settimana, mese, 3 mesi — ricarica i dati.
Export CSV di quello che è a schermo.

Le tabelle lette sono sette: `FACT_GIORNATE` (marcata **Consuntivazione**, perché è da lì
che i collaboratori inseriscono), `FACT_FATTURE`, `ANA_COMMESSE`, `ANA_TASK`,
`ANA_CLIENTI`, `ANA_COLLABORATORI`, `ANA_TARIFFE_COLLABORATORI`. Per aggiungerne una basta
una voce in `AttivitaAPI::fontiDati()`, con l'espressione SQL che descrive il record.

I file di log letti sono quattro: errori API, errori PHP, log di sistema e upload della
consuntivazione. Vengono lette le ultime 200 righe di ciascuno, tenute solo quelle datate
nel periodo.

---

## Come è fatto, e cosa non può dire

**Non esiste una tabella di audit.** La cronologia è ricostruita dalle colonne
`Data_Creazione` / `Data_Modifica` che tutte le tabelle principali già portano. Da qui tre
limiti, dichiarati anche a fondo pagina:

- le **cancellazioni non lasciano traccia**;
- di ogni record si vede solo l'**ultima** modifica, non lo storico;
- non si sa **quali campi** siano cambiati.

Un audit vero richiede una tabella scritta da `BaseAPI` a ogni scrittura: è un lavoro a sé,
e comunque non potrebbe raccontare i giorni già passati. La ricostruzione è ciò che si può
avere subito sui dati che ci sono.

Due dettagli di implementazione che non si indovinano leggendo la query:

1. Un evento di modifica esiste solo se `Data_Modifica > Data_Creazione`, perché la colonna
   nasce uguale alla creazione e altrimenti ogni inserimento comparirebbe due volte. **Ma i
   record importati dal vecchio archivio hanno `Data_Creazione` nulla**, e il confronto
   darebbe NULL: senza il caso esplicito `Data_Creazione IS NULL` le loro modifiche non
   comparirebbero mai. Si è visto perché comparivano 6 note di accredito su 7.
2. L'origine (Management / Consuntivazione) è dedotta dalla tabella, non registrata: il
   database non sa da quale applicazione arrivi una scrittura.

---

## Endpoint

```
GET API/index.php?resource=attivita&giorni=7
```

`giorni` va da 1 a 90, default 7. Restituisce `periodo`, `riepilogo`, `eventi` (max 500,
dal più recente) e `log`. Sola lettura: qualunque metodo diverso da GET risponde 405.
