# Ambiente di test locale (Docker)

Replica in locale il gestionale Vaglio & Partners con le stesse versioni del server
di produzione — **PHP 8.4 + MariaDB 11.4** — e i dati reali del backup, per provare
le modifiche senza toccare il server Serverplan.

> Il database contiene **dati veri** (nomi clienti, email, hash delle password).
> Per questo tutte le porte sono legate a `127.0.0.1`: nulla e' raggiungibile dalla rete.

## Requisiti

- Docker Desktop (backend WSL2)
- Il dump di produzione in `DB/Backup/<AAMMGG>_vaglioty_DB_VP.sql` (es. `260804_vaglioty_DB_VP.sql`)
- `DB/config.php` presente (non e' versionato; copiarlo da `DB/config.example.php`)

## Primo avvio

```powershell
cp .env.example .env      # poi scegli le password locali dentro .env
docker compose up -d --build
```

Al primo avvio il container `db` esegue in ordine gli script di `docker/initdb`:

| # | Script | Cosa fa |
|---|--------|---------|
| 01 | `DB/Backup/<BACKUP_DATE>_vaglioty_DB_VP.sql` | importa il dump (9 tabelle) |
| 02 | `02-fact_fatture_collaboratori.sql` | crea `FACT_FATTURE_COLLABORATORI`, **assente dal dump** |
| 03 | `03-utente-test-locale.sql` | aggiunge l'utente `testadmin` |
| 04 | `04-spese-viaggi-vitto.sql` | separa le spese in viaggi e vitto/alloggio ([REGOLE-SPESE](REGOLE-SPESE.md)) |
| 05 | `05-note-accredito.sql` | note di accredito negative e senza scadenza ([REGOLE-FATTURAZIONE](REGOLE-FATTURAZIONE.md)) |
| 06 | `06-allinea-fatture-pdf.sql` | allinea l'archivio alle fatture cartacee: numerazioni, doppioni, importi, due documenti mancanti, riferimenti d'ordine |
| 07 | `07-allinea-incassi.sql` | i 26 incassi presi dal registro Excel e tre date divergenti |
| 08 | `08-storno-note-accredito.sql` | colonna `ID_FATTURA_STORNATA` e i sette collegamenti nota → fattura |
| 09 | `09-attribuzioni-fatture-commesse.sql` | fatture e commesse toccate a mano: collegamento alla commessa, intestatario, nome, stato, data di apertura — **file generato**, vedi sotto |
| 10 | `10-spese-quattro-commesse.sql` | le correzioni a mano su regimi e flag `Viaggio` — **file generato** |
| 11 | `11-regime-spese.sql` | il regime di spesa esplicito e il forfait a corpo ([SCHEMA-SPESE-A-CORPO](SCHEMA-SPESE-A-CORPO.md)) |
| 12 | `12-task-creati-in-locale.sql` | i task **nati in locale** e le giornate spostate — **file generato**. Va dopo l'11 perché il suo `INSERT` elenca anche le colonne di regime |
| 13 | `13-documenti-commerciali.sql` | crea `ANA_DOCUMENTI_COMMERCIALI`, aggiunge `ID_DOCUMENTO` e `Natura` sulla fattura, `Importo_Previsto` sulla commessa, `Codice_Fiscale` sul cliente, ed elimina i due campi documento da `ANA_COMMESSE` ([PROGETTO-COMMESSE-ORDINI](PROGETTO-COMMESSE-ORDINI.md)) |

Gli script dal 04 all'08, l'11 e il 13 replicano migration che **in produzione
non sono ancora state eseguite**: qui servono perché il reset riparte dal dump, che ha
ancora lo schema e i dati vecchi. Vanno tenuti allineati alle rispettive
migration in `DB/migrations/` finché il dump non le contiene già.

Il 09, il 10 e il 12 sono un'altra cosa: non replicano nessuna migration,
**rimettono lavoro fatto a mano dall'interfaccia** che altrimenti il reset
perderebbe in silenzio. È successo il 17/08/2026: i conteggi delle tabelle
tornavano tutti giusti, il reset sembrava riuscito, e intanto il fatturato per
commessa era tornato indietro di otto righe senza che nulla lo segnalasse.

## Se modifichi i dati dall'interfaccia, rigenera le fotografie

I tre file sono **generati**, non si scrivono a mano. Dopo ogni giro di
correzioni fatte dall'interfaccia:

```bash
docker compose exec -T web php /var/www/html/docker/genera-09-attribuzioni.php
docker compose exec -T web php /var/www/html/docker/genera-10-spese.php
```

Il primo scrive lo script **09**, il secondo ne scrive **due**, il 10 e il 12.
Poi si committano i file rigenerati.

Cosa coprono, tabella per tabella:

| Generatore | File | Cosa fotografa |
|---|---|---|
| `genera-09-attribuzioni.php` | 09 | `FACT_FATTURE.ID_COMMESSA` e `.ID_CLIENTE`; `ANA_COMMESSE.ID_CLIENTE`, `.Commessa`, `.Stato_Commessa`, `.Data_Apertura_Commessa` |
| `genera-10-spese.php` | 10 | i regimi di spesa sui task, i flag `Viaggio` e `Desk` sulle giornate |
| `genera-10-spese.php` | 12 | i task **creati in locale**, i task modificati (stato, giornate previste, prezzo, regime) e le giornate **spostate** su un altro task |

Entrambi confrontano con il database `prod_260815`, il dump di produzione
caricato a parte: è il termine di paragone che dice quali righe sono state
toccate a mano.

### Le tre trappole

**`docker compose down -v` distrugge anche `prod_260815`.** Nessuno script di
initdb lo ricrea, quindi dopo ogni reset va ricaricato a mano e va rifatto il
permesso di lettura:

```bash
docker exec -i vp_db mariadb -uroot -p<pwd> < DB/Backup/<data>_prod_260815.sql
docker exec vp_db mariadb -uroot -p<pwd> -e "GRANT SELECT ON prod_260815.* TO 'vaglioty_DB_VP'@'%'"
```

**Rigenera solo quando il database è nello stato buono.** Rigenerare subito dopo
un reset che ha perso qualcosa fotografa la perdita, e la rende definitiva.

**Il confronto è una `LEFT JOIN`, non una `INNER`.** Le fatture 39/26 e 40/26 non
stanno nel dump — le crea la migration 06 — e con la `INNER` sparivano dal diff,
così le loro commesse non finivano nella fotografia. Una riga assente dal
riferimento è divergente per definizione.

**L'ordine conta.** Il 06 sistema le numerazioni e il 07 cerca le fatture per
numero: invertirli lascerebbe 26 incassi non registrati, in silenzio. Dopo un
reset i tre totali di controllo sono **13.705,50** (2024), **312.163,50** (2025)
e **401.687,50** (2026).

## Come si verifica che un reset sia riuscito

I conteggi delle tabelle **tornano giusti anche quando il reset ha perso righe**:
è esattamente così che la perdita è passata inosservata il 17/08/2026. L'unico
controllo che vale è il confronto riga per riga con un backup fatto prima.

```bash
# 1. backup, prima di toccare qualsiasi cosa
docker exec vp_db mariadb-dump -uroot -p<pwd> --single-transaction     --databases vaglioty_DB_VP > DB/Backup/<data>_PRIMA_DEL_RESET_vaglioty_DB_VP.sql
docker exec vp_db mariadb-dump -uroot -p<pwd> --single-transaction     --databases prod_260815 > DB/Backup/<data>_PRIMA_DEL_RESET_prod_260815.sql

# 2. reset
docker compose down -v && docker compose up -d

# 3. ricarica il backup in un database separato e confronta riga per riga
#    (SET time_zone='+00:00', altrimenti i timestamp slittano di 1-2 ore)
```

Il confronto va fatto su `FACT_FATTURE`, `ANA_COMMESSE`, `ANA_TASK`,
`FACT_GIORNATE` e `ANA_CLIENTI`, e deve dare **zero differenze** — sia sulle
colonne sia sul numero di righe, perché una riga in meno è il caso più insidioso.

Provato il 19/08/2026 con quattro reset veri. I primi tre hanno trovato sei tipi
di perdita che il confronto a tavolino non vedeva; il quarto ha ricostruito lo
stato al centesimo.

**`reset-db.ps1` chiede conferma con `Read-Host`**: da uno script non interattivo
va eseguito nei suoi due passi, `docker compose down -v` e `docker compose up -d`.

Quando `docker compose ps` mostra `vp_db` come `healthy`, l'ambiente e' pronto.

## Indirizzi

| Servizio | URL |
|----------|-----|
| Consuntivazione | http://127.0.0.1:8081/consuntivazione.html |
| Management | http://127.0.0.1:8081/management.html |
| Diagnostica DB | http://127.0.0.1:8081/DB/test_connection.php |
| phpMyAdmin | http://127.0.0.1:8082 |
| MariaDB (client esterni) | `127.0.0.1:3307` |

Porte e password si cambiano nel `.env`. La 3306 e la 8080 sono lasciate libere
per l'installazione XAMPP presente sulla macchina.

### Allineare il locale a un nuovo backup di produzione

1. copiare il dump in `DB/Backup/` mantenendo il nome `<AAMMGG>_vaglioty_DB_VP.sql`;
2. aggiornare `BACKUP_DATE` nel `.env` con quel prefisso (es. `260804`);
3. `.\docker\reset-db.ps1` — cancella il volume e reimporta.

Il volume `db_data` viene ricreato da zero: **le modifiche fatte in locale al
database si perdono**, i file del progetto no — tranne quelle che gli script 09,
10 e 12 rimettono, che sono il motivo per cui esistono. L'ultimo allineamento è del
**15/08/2026** (dump `260815`, 118 task e 464 giornate).

Il reset cancella anche il database di confronto `prod_260815`, che sta nello
stesso volume: si ricrea caricando lo stesso dump in uno schema a parte, vedi
[CONFRONTO-PRODUZIONE-LOCALE](CONFRONTO-PRODUZIONE-LOCALE.md).

Rispetto al dump precedente (`260804`) la produzione era cambiata in quattro punti:
il ruolo di CONS011 (User → Manager), il vitto/alloggio di una giornata del 05/08
con la foto allegata, e il solo utente di modifica su due task.

### Credenziali di accesso all'app

Le password nel dump sono hash bcrypt e non sono note, quindi con i soli dati di
produzione non si riesce a entrare. Lo script `03` aggiunge un utente dedicato:

```
username: testadmin
password: test1234
ruolo:    Admin
```

E' una **riga nuova**: nessun utente reale viene modificato, e l'utente esiste solo
in locale.

## Pilotare l'app dal browser

Sulla macchina i browser di Playwright ci sono già, scaricati da
`chrome-devtools-mcp`, in `%LOCALAPPDATA%\ms-playwright\chromium-1234`. Manca solo
la libreria che li pilota, ed è piccola: **non scarica alcun browser**.

```bash
npm i playwright-core        # nella cartella di lavoro, non nel repo
```

```js
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/<utente>/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
```

Il percorso per arrivare a una schermata non è ovvio e vale la pena averlo scritto:

1. l'app di gestione è **`management.html`**, non `index.html`;
2. login con `#username` / `#password` e `button[type=submit]`, poi ~4 secondi di attesa;
3. la navigazione sta **dietro l'hamburger**: prima `.fa-bars`, poi `text=Fatture`;
4. i dati dell'app sono raggiungibili da `window.app` — `app.fatture`, `app.commesse`,
   `app.tasks`, e le sezioni da `app.sections['commesse-task']`.

Serve per due cose, entrambe fatte il 19/08/2026:

- **verificare davvero una modifica**. Un test in Node che carica una funzione con
  dati finti può passare su codice che a schermo non funziona: è successo con un
  `ReferenceError` che il browser ha trovato subito e il test no.
- **leggere i numeri dall'app invece di ricalcolarli**. I badge dell'intestazione di
  commessa contengono già maturato, spese e fatturato con le formule vere: rileggerli
  dal DOM evita di scrivere l'ennesima copia delle stesse formule in uno script.

## Comandi utili

```powershell
docker compose up -d              # avvia
docker compose down               # ferma, il database resta nel volume
docker compose logs -f web        # log Apache/PHP
docker compose exec web bash      # shell nel container PHP
.\docker\reset-db.ps1             # ributta il DB allo stato del dump
```

## Come e' fatto

- **`web`** (`docker/php/Dockerfile`): `php:8.4-apache` con `pdo_mysql`, `mysqli`,
  `mod_rewrite`. Il repo e' montato su `/var/www/html`: le modifiche al codice sono
  immediate, senza rebuild.
- **DocumentRoot = radice del repo**, non una sottocartella: `API/ConsuntivazioneAPI.php`
  costruisce URL assoluti come `/DB/uploads/consuntivazioni`, che servito da una
  sottocartella si romperebbe.
- **`DB/config.php` legge le credenziali dalle variabili d'ambiente**
  (`getenv('DB_HOST') ?: 'localhost'`): in Docker punta all'host `db`, sul server
  — dove quelle variabili non esistono — resta identico a prima.
- **Fuso orario `Europe/Rome` su entrambi i container**: senza questo MariaDB sta
  in UTC e i `CURRENT_TIMESTAMP` (`Data_Modifica`) finiscono 2 ore indietro rispetto
  ai timestamp scritti da PHP.
- Le API REST vanno chiamate in **query string** (`API/index.php?resource=clienti`):
  gli `.htaccess` in `API/` sono disattivati, come in produzione.

## Limiti noti

- **Gli allegati delle consuntivazioni non si vedono tutti.** Il dump contiene le
  righe di `GIORNATE_IMMAGINI` ma non i file binari: in `DB/uploads/consuntivazioni`
  ci sono solo i file gia' presenti in locale. Per l'anteprima completa serve copiare
  `DB/uploads/` dal server.
- **`FACT_FATTURE_COLLABORATORI` parte vuota.** La tabella manca da tutti i dump
  esportati finora, compreso il `260813`: in produzione non esiste, e il ciclo
  passivo resta disattivato anche nel front-end.
- L'invio email (reset password) non funziona: nel container non c'e' un MTA.
