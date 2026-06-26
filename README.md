# 📊 Sistema Gestionale Vaglio & Partners

Sistema di gestione aziendale con **API REST in PHP**, **database MySQL** e **due applicazioni web** per la gestione di clienti, commesse, task, collaboratori, tariffe, giornate, consuntivazioni e fatture (attive e passive collaboratori).

## 🧩 Le due applicazioni

Il sistema è composto da due front-end distinti che condividono lo stesso database e lo stesso strato API:

| App | File | Destinatari | Scopo |
|-----|------|-------------|-------|
| **Management V&P** | [`management.html`](management.html) | Admin / Manager | Back-office completo: anagrafiche, commesse & task, giornate, fatture, statistiche |
| **Consuntivazione V&P** | [`consuntivazione.html`](consuntivazione.html) | Collaboratori | Registrazione giornate e spese, consultazione ed export delle proprie consuntivazioni |

---

## 🖥️ App Management (`management.html`)

Back-office single-page (vanilla JS + Bootstrap 5) orchestrato da [`assets/js/management.js`](assets/js/management.js), che monta in modo modulare le sezioni in [`assets/js/modules/sections/`](assets/js/modules/sections/). Tutte le sezioni dialogano con il router REST [`API/index.php`](API/index.php) tramite [`assets/js/modules/api.js`](assets/js/modules/api.js).

### Sezioni disponibili
- **Commesse & Task** — gestione progetti e relative attività; i task hanno `Tipo` (Campo, Monitoraggio, Promo, Sviluppo, Formazione), `Stato_Task`, e date `Data_Inizio`/`Data_Fine`. Validazione che impedisce **più task Monitoraggio attivi in sovrapposizione** sulla stessa commessa.
- **Clienti** — anagrafica clienti.
- **Collaboratori** — anagrafica collaboratori; include la vista **"Rimborso Totale Mese"** che, per il mese selezionato, elenca le giornate del collaboratore con **Costo Gg**, **Costo Spese** e **Rimborso Totale** (base per le fatture passive collaboratori).
- **Fatture** — fatturazione attiva verso clienti.
- **Giornate** — consultazione/gestione delle giornate consuntivate.
- **Statistiche** — metriche aggregate.

> La sezione **Fatture Collaboratori** ([`fatture-collaboratori-section.js`](assets/js/modules/sections/fatture-collaboratori-section.js)) è presente ma attualmente **disabilitata** nel wiring di `management.js`. Il backend (`FattureCollaboratoriAPI`) è già operativo.

### Visibilità per ruolo
Per i collaboratori con ruolo **`User`**, la visibilità di Collaboratori e Commesse è filtrata tramite la tabella `ANA_COMMESSE_VISIBILITA`, gestita da [`API/CommesseVisibilitaAPI.php`](API/CommesseVisibilitaAPI.php) (risorsa `commesse_visibilita`).

---

## 📱 App Consuntivazione (`consuntivazione.html`)

App mobile-friendly per i collaboratori, gestita interamente da [`assets/js/consuntivazione.js`](assets/js/consuntivazione.js). A differenza del Management **non** passa dal router REST ma da un endpoint dedicato **action-based**, [`API/ConsuntivazioneAPI.php`](API/ConsuntivazioneAPI.php), con autenticazione gestita da [`API/AuthAPI.php`](API/AuthAPI.php).

### Funzionalità
- 🔐 **Login con email aziendale** (collaboratore associato in `ANA_COLLABORATORI`).
- ⏱️ **Registrazione giornate** per commessa/task con tipo giornata (`Campo`, `Promo`, `Sviluppo`, `Formazione`) e frazione di giornata `gg`.
- 💰 **Gestione spese**: spese viaggio, vitto/alloggio, altre spese, quota fatturata a VP.
- 🖼️ **Allegati immagine** alle consuntivazioni (upload/list/serve/delete).
- 📊 **Dashboard statistiche** personali del periodo (giornate, spese, spese rimborsabili, **Costo gg Totale**).
- 🔍 **Consulta Consuntivazioni** con filtri Anno / Mese / Commessa.
- 📤 **Export CSV** completo (con `Costo gg` e totali) — pulsante *Esporta*.
- ✅ Le giornate **Confermata = 'Si'** non sono più modificabili/eliminabili dal collaboratore.

### Endpoint (POST `action` su `ConsuntivazioneAPI.php`)
`get_statistiche`, `get_ultime_consuntivazioni`, `cerca_consuntivazioni`, `get_anni_consuntivazioni`, `get_consuntivazione`, `salva_consuntivazione`, `update_consuntivazione`, `delete_consuntivazione`, `get_commesse`, `get_tasks`, `list_images`, `delete_image`, `test_db`. Immagini servite via GET `action=serve_image`.

---

## 💶 Calcolo "Costo gg" (logica condivisa)

Il **Costo gg** di una giornata è calcolato **solo per le giornate di tipo `Campo`** come:

```
Costo gg = gg × Tariffa_gg
```

dove `Tariffa_gg` è la tariffa attiva del collaboratore alla data della giornata, ricavata da `ANA_TARIFFE_COLLABORATORI` **risolvendo la commessa tramite ID** con priorità alla tariffa specifica per commessa e fallback alla tariffa standard (`ID_COMMESSA IS NULL`):

```sql
WHERE ID_COLLABORATORE = ? AND Dal <= ?
  AND (ID_COMMESSA = ? OR ID_COMMESSA IS NULL)
ORDER BY ID_COMMESSA DESC, Dal DESC LIMIT 1
```

La stessa semantica è usata sia in [`GiornateAPI::getTariffaAttiva()`](API/GiornateAPI.php) (vista "Rimborso Totale Mese") sia in [`ConsuntivazioneAPI::calcolaCostoGgConsuntivazione()`](API/ConsuntivazioneAPI.php) (consultazione ed export), garantendo coerenza tra le due app.

Il **Costo Spese** è: `(Spese_Viaggi + Vitto_alloggio + Altri_costi) − Spese_Fatturate_VP`; il **Rimborso Totale** = `Costo gg + Costo Spese`.

---

## 🌐 API REST (`API/index.php`)

Router resource-based. Chiamate via path (`/API/risorsa/{id}`) oppure via query string per compatibilità senza `.htaccess` (`?resource=risorsa&id=...`).

```bash
GET    /API/index.php?resource=clienti            # Lista
GET    /API/index.php?resource=clienti&id=1       # Dettaglio
POST   /API/index.php?resource=clienti            # Crea  (body JSON)
PUT    /API/index.php?resource=clienti&id=1       # Aggiorna
DELETE /API/index.php?resource=clienti&id=1       # Elimina
GET    /API/index.php?resource=status             # Stato API
```

### Risorse disponibili
| Risorsa | Classe | Tabella |
|---------|--------|---------|
| `clienti` | [`ClientiAPI`](API/ClientiAPI.php) | `ANA_CLIENTI` |
| `collaboratori` | [`CollaboratoriAPI`](API/CollaboratoriAPI.php) | `ANA_COLLABORATORI` |
| `commesse` | [`CommesseAPI`](API/CommesseAPI.php) | `ANA_COMMESSE` |
| `task` | [`TaskAPI`](API/TaskAPI.php) | `ANA_TASK` |
| `tariffe` | [`TariffeAPI`](API/TariffeAPI.php) | `ANA_TARIFFE_COLLABORATORI` |
| `giornate` | [`GiornateAPI`](API/GiornateAPI.php) | `FACT_GIORNATE` |
| `fatture` | [`FattureAPI`](API/FattureAPI.php) | `FACT_FATTURE` |
| `fatture_collaboratori` | [`FattureCollaboratoriAPI`](API/FattureCollaboratoriAPI.php) | `FACT_FATTURE_COLLABORATORI` |
| `commesse_visibilita` | [`CommesseVisibilitaAPI`](API/CommesseVisibilitaAPI.php) | `ANA_COMMESSE_VISIBILITA` |

### Endpoint fuori router
- [`API/ConsuntivazioneAPI.php`](API/ConsuntivazioneAPI.php) — endpoint action-based dell'app Consuntivazione (vedi sopra).
- [`API/AuthAPI.php`](API/AuthAPI.php) — autenticazione (login con email).

Tutte le classi CRUD estendono [`BaseAPI`](API/BaseAPI.php), che fornisce paginazione (`page`, `limit`), filtri, ordinamento (`sort`, `order`), validazione e gestione delle relazioni.

---

## 🗄️ Schema Database

### Tabelle principali
- **ANA_CLIENTI** — anagrafica clienti
- **ANA_COLLABORATORI** — collaboratori/utenti (campo `User` per login, ruoli incl. `Admin`/`Manager`/`User`)
- **ANA_COMMESSE** — commesse (`Tipo_Commessa` ENUM `Cliente`/`Interna`)
- **ANA_TASK** — task (`Tipo` ENUM `Campo`/`Monitoraggio`/`Promo`/`Sviluppo`/`Formazione`, `Data_Inizio`, `Data_Fine`, `Stato_Task`)
- **ANA_TARIFFE_COLLABORATORI** — tariffe giornaliere (`Tariffa_gg`, `ID_COMMESSA` NULL = standard, `Dal`)
- **ANA_COMMESSE_VISIBILITA** — visibilità commesse per collaboratore (ruolo `User`)
- **FACT_GIORNATE** — giornate consuntivate (`Tipo` ENUM `Campo`/`Promo`/`Sviluppo`/`Formazione`, `gg`, spese, `Confermata`)
- **FACT_FATTURE** — fatture attive verso clienti (`TIPO` ENUM `Fattura`/`Nota_Accredito`)
- **FACT_FATTURE_COLLABORATORI** — fatture passive collaboratori (`Importo_netto`, `Ritenuta_Acconto`, `Netto_pagare`, `Stato` ENUM `Ricevuta`/`Pagata`/`Annullata`)

### Relazioni chiave
- Clienti → Commesse (1:N)
- Commesse → Task (1:N) → Giornate (1:N)
- Collaboratori → Giornate / Tariffe / Fatture collaboratori (1:N)
- Collaboratori ↔ Commesse visibili (N:N via `ANA_COMMESSE_VISIBILITA`)

---

## 🛠️ Installazione e Setup

### Prerequisiti
- PHP 7.4+ (PDO, MySQL)
- MySQL 5.7+ / MariaDB 10.2+
- Web server (Apache/Nginx)

### Passi
```bash
# 1. Configura le credenziali in DB/config.php (DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_CHARSET)
# 2. Crea il database
php DB/create_database.php
# 3. Crea/aggiorna le tabelle
php DB/critical/setup.php
# 4. (Opzionale) importa i dati da CSV (DB/Dati/)
php DB/import_csv.php
# 5. Verifica la connessione
php DB/test_connection.php
```

Apri quindi `management.html` (back-office) o `consuntivazione.html` (collaboratori) dal web server.

---

## 📁 Struttura del progetto

```
DB_VP_API/
├── management.html              # App back-office (Admin/Manager)
├── consuntivazione.html         # App consuntivazione (collaboratori)
├── README.md                    # Questo file
├── API/                         # API REST e endpoint applicativi
│   ├── index.php                # Router REST (resource-based)
│   ├── BaseAPI.php              # Classe base CRUD
│   ├── ClientiAPI / CollaboratoriAPI / CommesseAPI / TaskAPI
│   ├── TariffeAPI / GiornateAPI / FattureAPI
│   ├── FattureCollaboratoriAPI / CommesseVisibilitaAPI
│   ├── ConsuntivazioneAPI.php   # Endpoint app consuntivazione
│   └── AuthAPI.php              # Autenticazione (login email)
├── DB/
│   ├── config.php               # Configurazione connessione
│   ├── create_database.php
│   ├── critical/setup.php       # Definizione/creazione tabelle
│   ├── import_csv.php           # Import dati da CSV
│   ├── Dati/                    # CSV di import
│   └── logs/
├── assets/
│   ├── css/
│   └── js/
│       ├── management.js                 # Orchestratore app Management
│       ├── consuntivazione.js            # App Consuntivazione
│       └── modules/
│           ├── api.js, ui-components.js, utils.js
│           └── sections/                 # Sezioni del Management
└── docs/                        # Documentazione di dettaglio (vedi sotto)
```

---

## 📚 Documentazione di dettaglio

Approfondimenti nella cartella [`docs/`](docs/):
- [API Documentation](API/README.md)
- [CONSUNTIVAZIONE_DOCS.md](docs/CONSUNTIVAZIONE_DOCS.md) — app consuntivazione
- [TASK_INTERFACE_DOCS.md](docs/TASK_INTERFACE_DOCS.md) / [TASK_IMPLEMENTATION_SUMMARY.md](docs/TASK_IMPLEMENTATION_SUMMARY.md)
- [ADMIN_MANAGER_FEATURES.md](docs/ADMIN_MANAGER_FEATURES.md) / [ADMIN_FEATURES_SUMMARY.md](docs/ADMIN_FEATURES_SUMMARY.md)
- [COSTO_GG_TESTING.md](docs/COSTO_GG_TESTING.md) / [FIX_COSTO_GG_STATISTICHE.md](docs/FIX_COSTO_GG_STATISTICHE.md)
- [DATABASE_UPDATES.md](docs/DATABASE_UPDATES.md)

---

**Sviluppato per Vaglio & Partners** — Sistema Gestionale (API REST + Management + Consuntivazione)
