# Rilascio del gestionale — procedura

Questa cartella contiene tutto ciò che serve per portare il database dallo stato
di produzione del 15/08/2026 allo stato collaudato in locale.

Si esegue **due volte**: prima su `vaglioty_DB_VP_TEST`, per far verificare
l'amministrazione, poi su `vaglioty_DB_VP` quando danno l'ok. **La stessa
identica sequenza**, così quello che approvano è quello che va in produzione.

| File | Cosa fa |
|---|---|
| `01-catena.sql` | le undici modifiche, in ordine, in un file solo |
| `02-verifica.sql` | solo interrogazioni: stampa i numeri da confrontare qui sotto |

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

### 4. Esegui `02-verifica.sql` e confronta

Da `SQL`, non da `Importa`, così vedi i risultati. Confronta con la tabella
[Numeri attesi](#numeri-attesi) qui sotto. Devono tornare **tutti**.

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
5. **Esegui `02-verifica.sql`** e confronta con gli stessi numeri attesi.
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

### Struttura

| Controllo | Atteso |
|---|---|
| Colonne nuove trovate | **14** |
| `Documento_Offerta` e `Documento_Ordine` su ANA_COMMESSE | eliminati → `si` |
| Utenti di prova | **0** |

L'ultima riga è un controllo di sicurezza: l'ambiente locale ha un utente
`testadmin` con ruolo Admin e password nota. Se comparisse su un server,
qualcosa è stato copiato che non doveva.

---

## Come è stata verificata questa catena

Il 19/08/2026, in locale, su due database separati:

1. dal dump 260815 grezzo, eseguendo gli undici script **uno per uno**;
2. dallo stesso dump, eseguendo `01-catena.sql` **in un colpo solo**.

I due risultati sono identici fra loro e identici al database locale collaudato
— 673 righe su 11 tabelle, confrontate colonna per colonna ignorando solo i
timestamp di servizio. L'unica differenza voluta è l'utente di prova, che nella
catena non c'è.
