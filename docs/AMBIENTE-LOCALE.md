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
| 09 | `09-attribuzioni-fatture-commesse.sql` | i collegamenti fattura → commessa, che **nessuna migration valorizza** |
| 10 | `10-spese-quattro-commesse.sql` | le correzioni a mano su regimi e flag `Viaggio` — **file generato**, vedi sotto |
| 11 | `11-regime-spese.sql` | il regime di spesa esplicito e il forfait a corpo ([SCHEMA-SPESE-A-CORPO](SCHEMA-SPESE-A-CORPO.md)) |

Gli script dal 04 all'08 e l'11 replicano migration che **in produzione non sono
ancora state eseguite**: qui servono perché il reset riparte dal dump, che ha
ancora lo schema e i dati vecchi. Vanno tenuti allineati alle rispettive
migration in `DB/migrations/` finché il dump non le contiene già.

Il 09 e il 10 sono un'altra cosa: non replicano nessuna migration, **rimettono
lavoro fatto a mano dall'interfaccia** che altrimenti il reset perderebbe in
silenzio. È successo il 17/08/2026: i conteggi delle tabelle tornavano tutti
giusti, il reset sembrava riuscito, e intanto il fatturato per commessa era
tornato indietro di otto righe senza che nulla lo segnalasse.

## Se modifichi i dati dall'interfaccia, rigenera lo script 10

Il 10 è una **fotografia**: contiene le righe di task e giornate che si scostano
da quello che producono dump più migration. Ogni correzione nuova la invecchia.

```bash
docker compose exec -T web php /var/www/html/docker/genera-10-spese.php
```

Va lanciato dopo aver cambiato dall'interfaccia un **regime di spesa**, un
**importo**, un flag **Viaggio** o **Desk**. Richiede il database di confronto
`prod_260815` — è il termine di paragone che dice quali righe sono state toccate
a mano. Poi si committa il file rigenerato.

Nel giro di poche ore del 17/08/2026 la fotografia era già invecchiata di due
task e due giornate: se la si aggiorna a mano, prima o poi non la si aggiorna.

Le attribuzioni fattura → commessa dello script 09 restano invece da aggiornare a
mano: sono poche e cambiano di rado. Spariranno con la fase 2 di
[PROGETTO-COMMESSE-ORDINI](PROGETTO-COMMESSE-ORDINI.md), che rende `ID_COMMESSA`
obbligatorio.

**L'ordine conta.** Il 06 sistema le numerazioni e il 07 cerca le fatture per
numero: invertirli lascerebbe 26 incassi non registrati, in silenzio. Dopo un
reset i tre totali di controllo sono **13.705,50** (2024), **312.163,50** (2025)
e **401.687,50** (2026).

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
database si perdono**, i file del progetto no — tranne quelle che gli script 09
e 10 rimettono, che sono il motivo per cui esistono. L'ultimo allineamento è del
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
