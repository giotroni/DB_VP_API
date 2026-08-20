# Rilascio del gestionale — procedura

Questa cartella contiene tutto ciò che serve per portare il database dallo stato
di produzione del 15/08/2026 allo stato collaudato in locale.

Si esegue **due volte**: prima su `vaglioty_DB_VP_TEST`, per far verificare
l'amministrazione, poi su `vaglioty_DB_VP` quando danno l'ok. **La stessa
identica sequenza**, così quello che approvano è quello che va in produzione.

| File | Cosa fa |
|---|---|
| `01-catena.sql` | le dodici modifiche, in ordine, in un file solo |
| `02-verifica.sql` | i controlli sui **dati** |
| `03-verifica-struttura.sql` | i controlli sulla **struttura** |

I due file di verifica sono separati per una ragione precisa, non per ordine:
phpMyAdmin, quando incontra una query su `INFORMATION_SCHEMA`, **sposta il
database corrente** a `information_schema` per tutte le istruzioni successive.
Mescolarli fa fallire le query che vengono dopo, e — molto peggio — fa
rispondere «tutto a posto» a quelle che usano `DATABASE()`, perché la valutano
sul database sbagliato.

Per lo stesso motivo `03` non usa `DATABASE()`: il nome del database si scrive
a mano nella prima riga.

Il dump **non** sta qui: è `DB/Backup/260815_vaglioty_DB_VP.sql`, ed è
l'esportazione della produzione fatta il 15/08.

---

## Parte 1 — l'ambiente di collaudo

### 1. Controlla che `vaglioty_DB_VP_TEST` sia davvero vuoto

In phpMyAdmin, selezionalo: deve dire *nessuna tabella*. Se ci fosse qualcosa,
fermati e capisci di chi è prima di cancellarlo.

### 2. Importa il dump

`Importa` → `260815_vaglioty_DB_VP.sql`. Il file non contiene `CREATE DATABASE`
né `USE`, quindi finisce nel database selezionato: **controlla di essere su
`vaglioty_DB_VP_TEST` e non su `vaglioty_DB_VP`.** È l'unico passaggio in cui
un errore di distrazione fa danno.

Al termine: 9 tabelle, 770 righe in totale.

### 3. Esegui `01-catena.sql`

Sempre da `Importa`, sullo stesso database. Sono 68 KB, non serve spezzarlo.

Non deve comparire nessun errore. Se ne compare uno, **fermati e mandamelo**:
la catena è stata provata e un errore qui significa che la produzione è diversa
da come la conosciamo.

### 4. Esegui le due verifiche e confronta

Da `SQL`, non da `Importa`, così vedi i risultati.

Prima `02-verifica.sql`, che non va toccato. Poi `03-verifica-struttura.sql`,
**dopo aver scritto il nome del database nella prima riga**:

```sql
SET @schema := 'vaglioty_DB_VP_TEST';
```

Nel `03` guarda per prima cosa la riga `tabelle`. Se dice **0**, il nome è
scritto male e tutti i controlli sotto rispondono sul vuoto — cioè rispondono
bene per il motivo sbagliato. Deve dire **11**.

Confronta il resto con [Numeri attesi](#numeri-attesi) qui sotto. Devono
tornare **tutti**.

### 5. Punta il sito di collaudo al database di collaudo

Il software va installato in `https://vaglioandpartners.com/gestione_VP_TEST`
dal branch `main`, con `config.php` che punta a `vaglioty_DB_VP_TEST`.

Tre cose da non dimenticare:

- una scritta ben visibile **«AMBIENTE DI PROVA»**, altrimenti qualcuno ci
  lavorerà davvero;
- protezione da accesso pubblico e da indicizzazione;
- gli stessi utenti della produzione, che arrivano con il dump: le password
  restano quelle che conoscono.

### 6. Cosa devono verificare i colleghi

Non «se funziona»: **se i numeri sono quelli giusti**, contro i loro prospetti.

| Cosa | Dove guardare |
|---|---|
| Il fatturato per anno e per cliente | Management → Clienti |
| Le sei fatture 2026 annullate, che devono sparire dallo scaduto | Fatture → scadenzario |
| I 26 incassi registrati dal registro Excel | Fatture → incassi |
| **Le 89 attribuzioni fattura → commessa** | Commesse → badge fatturato |

L'ultima riga è la più importante: è l'unica parte fatta a mano, quindi l'unica
dove un errore è possibile. Un'attribuzione sbagliata non la trova nessun
controllo automatico — sembra un dato vero.

**Regola per i colleghi: si guarda, non si inserisce.** Tutto ciò che viene
scritto nel collaudo verrà buttato via al momento del rilascio.

---

## Parte 2 — la produzione

Quando l'amministrazione dà l'ok:

1. **Ferma gli inserimenti.** Mezz'ora basta, ma va detto prima.
2. **Esporta `vaglioty_DB_VP`.** È il backup, ed è l'unica via di ritorno: il
   binlog è `OFF`, quindi non esiste il recupero a un istante preciso.
3. **Confronta il backup appena fatto con quello del 15/08.** Se qualcuno ha
   inserito o modificato qualcosa nel frattempo, va saputo *prima*, non dopo.
   Gli script 09, 10 e 12 riscrivono righe precise: se una di quelle righe è
   stata toccata a mano dal 15/08, il valore nuovo tornerebbe indietro in
   silenzio.
4. **Esegui `01-catena.sql`** su `vaglioty_DB_VP`.
5. **Esegui le due verifiche** e confronta con gli stessi numeri attesi. Nel
   `03` ricordati di cambiare il nome del database in `'vaglioty_DB_VP'`.
6. **Aggiorna il software** in `gestione_VP` dal branch `main`.
7. **Riapri gli inserimenti.**

I passi 4 e 6 vanno insieme e in quest'ordine. Il front-end nuovo somma valori
firmati: su dati non migrati **sottrarrebbe** le note di accredito invece di
stornarle.

---

## Numeri attesi

Rilevati il 19/08/2026 sulla ricostruzione dal dump 260815.

### Righe per tabella

| Tabella | Righe |
|---|---:|
| ANA_CLIENTI | 22 |
| ANA_COLLABORATORI | 10 |
| ANA_COMMESSE | 45 |
| ANA_COMMESSE_VISIBILITA | 11 |
| ANA_TARIFFE_COLLABORATORI | 10 |
| ANA_TASK | 119 |
| FACT_FATTURE | 89 |
| FACT_FATTURE_COLLABORATORI | 0 |
| FACT_GIORNATE | 464 |
| GIORNATE_IMMAGINI | 2 |
| ANA_DOCUMENTI_COMMERCIALI | 0 |

`ANA_TASK` passa da 118 a 119 (un task creato a mano) e `FACT_FATTURE` da 88 a
89: entrano la 39/26 e la 40/26, che nell'archivio non c'erano, ed esce il
doppione `03/26` datato 31/12/2025.

`ANA_DOCUMENTI_COMMERCIALI` è vuota ed è giusto così: la riempirà la fase 4.

### Fatturato per anno, al netto degli storni

| Anno | Documenti | Fatture | Note | Fatturato netto |
|---|---:|---:|---:|---:|
| 2024 | 5 | 5 | 0 | 13.705,50 |
| 2025 | 44 | 43 | 1 | 312.163,50 |
| 2026 | 40 | 34 | 6 | 401.687,50 |
| **Totale** | **89** | **82** | **7** | **727.556,50** |

### Attribuzioni, storni, incassi

| Controllo | Atteso |
|---|---|
| Fatture con commessa | 89 su 89, **zero senza** |
| Importo attribuito | 727.556,50 |
| Note di accredito collegate | 7 su 7, **zero scoperte** |
| Documenti incassati | 71, per 653.473,50 |

### Regimi di spesa sui task

| Viaggi | Task | | Vitto e alloggio | Task |
|---|---:|---|---|---:|
| Compreso | 39 | | Compreso | 88 |
| Diaria | 50 | | A corpo | 1 |
| Reali | 30 | | Reali | 30 |

### Utenti di prova — `02-verifica.sql`

| Controllo | Atteso |
|---|---|
| Utenti di prova | **0** |

È un controllo di sicurezza: l'ambiente locale ha un utente `testadmin` con
ruolo Admin e password nota. Se comparisse su un server, qualcosa è stato
copiato che non doveva.

### Il registro attività dopo il rilascio

La catena tocca centinaia di righe, e `Data_Modifica` si aggiorna da sola —
è `ON UPDATE current_timestamp()` — mentre `ID_UTENTE_MODIFICA` lo scrive solo
il codice PHP. Senza correttivo, Statistiche mostrerebbe per una settimana un
muro di «Modificato» tutti allo stesso minuto e senza nome.

Lo script `14` timbra quelle righe come **SYSTEM**: l'evento resta — i dati
sono cambiati davvero — ma dice chi è stato. Timbra **solo** dove il nome
manca: le attribuzioni vere non si toccano, perché sovrascriverle non si
recupera più.

Restano una quindicina di righe in cui il registro mostra il nome di chi le
aveva salvate mesi prima. Sono riconoscibili: hanno la stessa ora di tutte le
altre.

### Struttura — `03-verifica-struttura.sql`

| Controllo | Atteso |
|---|---|
| Tabelle | **11** — se è 0, il nome del database è sbagliato |
| Colonne nuove trovate | **14** |
| Campi documento rimasti su ANA_COMMESSE | **0** |
| Vincoli su ANA_DOCUMENTI_COMMERCIALI | **4**: tre chiavi esterne e un `CHECK` |

Le 11 tabelle sono le 9 del dump più `FACT_FATTURE_COLLABORATORI` e
`ANA_DOCUMENTI_COMMERCIALI`.

---

## Come è stata verificata questa catena

Il 19/08/2026, in locale, su due database separati:

1. dal dump 260815 grezzo, eseguendo gli undici script **uno per uno**;
2. dallo stesso dump, eseguendo `01-catena.sql` **in un colpo solo**.

I due risultati sono identici fra loro e identici al database locale collaudato
— 673 righe su 11 tabelle, confrontate colonna per colonna ignorando solo i
timestamp di servizio. L'unica differenza voluta è l'utente di prova, che nella
catena non c'è.
