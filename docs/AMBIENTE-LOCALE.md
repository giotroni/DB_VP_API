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
database si perdono**, i file del progetto no. L'ultimo allineamento è del
**04/08/2026** (dump `260804`, 96 task e 463 giornate).

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
- **`FACT_FATTURE_COLLABORATORI` parte vuota.** La tabella manca dal dump del
  30/07/2026: resta da verificare su phpMyAdmin del server se in produzione esista
  (e contenga dati) oppure se non sia mai stata creata.
- L'invio email (reset password) non funziona: nel container non c'e' un MTA.
