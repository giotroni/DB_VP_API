# API Vaglio & Partners - Documentazione Completa

## Indice
- [Introduzione](#introduzione)
- [Autenticazione](#autenticazione)
- [Struttura delle Risposte](#struttura-delle-risposte)
- [Paginazione](#paginazione)
- [Filtri e Ordinamento](#filtri-e-ordinamento)
- [API Endpoints](#api-endpoints)
  - [Clienti](#clienti)
  - [Collaboratori](#collaboratori)
  - [Commesse](#commesse)
  - [Task](#task)
  - [Tariffe](#tariffe)
  - [Giornate](#giornate)
  - [Fatture](#fatture)
- [Esempi di Utilizzo](#esempi-di-utilizzo)
- [Codici di Errore](#codici-di-errore)

## Introduzione

Le API Vaglio & Partners forniscono accesso completo al database aziendale tramite interfacce REST. Tutte le API supportano operazioni CRUD (Create, Read, Update, Delete) con validazione completa dei dati e gestione delle relazioni.

**Base URL**: `http://your-domain.com/API/`
**Versione API**: 1.0
**Formato**: JSON

## Autenticazione

⚠️ **In sviluppo**: L'autenticazione JWT sarà implementata in una versione futura. Attualmente le API sono accessibili senza autenticazione per scopi di sviluppo.

## Struttura delle Risposte

Tutte le risposte API seguono questa struttura standardizzata:

```json
{
  "success": true|false,
  "message": "Messaggio descrittivo",
  "data": { ... },
  "timestamp": "2025-01-20 10:30:45"
}
```

### Risposta di Successo (Lista)
```json
{
  "success": true,
  "message": "Operazione completata con successo",
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "pages": 2
    }
  },
  "timestamp": "2025-01-20 10:30:45"
}
```

### Risposta di Errore
```json
{
  "success": false,
  "error": "Messaggio di errore",
  "timestamp": "2025-01-20 10:30:45"
}
```

## Paginazione

Tutte le liste supportano la paginazione:

- `page`: Numero di pagina (default: 1)
- `limit`: Elementi per pagina (default: 50, max: 100)

**Esempio**: `GET /clienti?page=2&limit=25`

## Filtri e Ordinamento

### Ordinamento
- `sort`: Campo per ordinamento
- `order`: ASC o DESC (default: ASC)

**Esempio**: `GET /clienti?sort=Cliente&order=DESC`

### Filtri Comuni
Ogni endpoint supporta filtri specifici documentati nelle singole sezioni.

---

## API Endpoints

## Clienti

Gestione dell'anagrafica clienti.

### GET /clienti
Recupera la lista dei clienti.

**Filtri disponibili:**
- `cliente`: Filtra per nome cliente (ricerca parziale)
- `citta`: Filtra per città (ricerca parziale)
- `provincia`: Filtra per provincia (match esatto)
- `piva`: Filtra per P.IVA (ricerca parziale)

**Esempio:**
```
GET /clienti?cliente=CALVI&provincia=MI&page=1&limit=10
```

### GET /clienti/{id}
Recupera un singolo cliente per ID.

**Risposta include:**
- Dati base del cliente
- Statistiche: commesse, fatturato, ultima fattura

### POST /clienti
Crea un nuovo cliente.

**Campi richiesti:**
- `Cliente`: Nome cliente (max 255 caratteri)

**Campi opzionali:**
- `Denominazione_Sociale`: Ragione sociale
- `Indirizzo`: Indirizzo completo
- `Citta`: Città
- `CAP`: Codice postale (5 cifre)
- `Provincia`: Provincia (2 caratteri)
- `P_IVA`: Partita IVA (11 cifre)

**Esempio:**
```json
POST /clienti
{
  "Cliente": "ACME SRL",
  "Denominazione_Sociale": "ACME Soluzioni SRL",
  "Indirizzo": "Via Roma 123",
  "Citta": "Milano",
  "CAP": "20100",
  "Provincia": "MI",
  "P_IVA": "12345678901"
}
```

### PUT /clienti/{id}
Aggiorna un cliente esistente.

### DELETE /clienti/{id}
Elimina un cliente (solo se non ha commesse o fatture associate).

---

## Collaboratori

Gestione dell'anagrafica collaboratori.

### GET /collaboratori
Recupera la lista dei collaboratori.

**Filtri disponibili:**
- `collaboratore`: Filtra per nome (ricerca parziale)
- `email`: Filtra per email (ricerca parziale)
- `ruolo`: Filtra per ruolo (Admin, Manager, User, Amministrazione)

### GET /collaboratori/{id}
Recupera un singolo collaboratore per ID.

**Nota**: La password non viene mai restituita nelle risposte.

### POST /collaboratori
Crea un nuovo collaboratore.

**Campi richiesti:**
- `Collaboratore`: Nome completo
- `Email`: Email univoca

**Campi opzionali:**
- `PWD`: Password (min 6 caratteri)
- `Ruolo`: Admin, Manager, User, Amministrazione (default: User)
- `PIVA`: Partita IVA (11 cifre)

**Esempio:**
```json
POST /collaboratori
{
  "Collaboratore": "Mario Rossi",
  "Email": "mario.rossi@company.com",
  "PWD": "password123",
  "Ruolo": "User"
}
```

### PUT /collaboratori/{id}
Aggiorna un collaboratore esistente.

### DELETE /collaboratori/{id}
Elimina un collaboratore (solo se non ha attività associate).

---

## Commesse

Gestione delle commesse aziendali.

### GET /commesse
Recupera la lista delle commesse.

**Filtri disponibili:**
- `commessa`: Filtra per nome commessa
- `tipo`: Cliente o Interna
- `cliente`: ID cliente
- `collaboratore`: ID collaboratore responsabile
- `stato`: In corso, Sospesa, Chiusa, Archiviata
- `data_da` / `data_a`: Range data apertura

### GET /commesse/{id}
Recupera una singola commessa con statistiche complete.

### POST /commesse
Crea una nuova commessa.

**Campi richiesti:**
- `Commessa`: Nome commessa
- `Tipo_Commessa`: Cliente o Interna

**Validazioni:**
- Se tipo "Cliente", deve avere `ID_CLIENTE`
- Se tipo "Interna", non può avere cliente

**Esempio:**
```json
POST /commesse
{
  "Commessa": "Audit Sicurezza Alimentare",
  "Desc_Commessa": "Audit completo del sistema HACCP",
  "Tipo_Commessa": "Cliente",
  "ID_CLIENTE": "CLI0001",
  "ID_COLLABORATORE": "CONS001",
  "Commissione": 0.15,
  "Data_Apertura_Commessa": "2025-01-20"
}
```

### PUT /commesse/{id}
Aggiorna una commessa esistente.

### DELETE /commesse/{id}
Elimina una commessa (solo se non ha task o fatture associate).

---

## Task

Gestione dei task di commessa.

### GET /task
Recupera la lista dei task.

**Filtri disponibili:**
- `task`: Filtra per nome task
- `commessa`: ID commessa
- `collaboratore`: ID collaboratore assegnato
- `tipo`: Campo, Monitoraggio, Promo, Sviluppo, Formazione
- `stato`: In corso, Sospeso, Chiuso, Archiviato
- `data_da` / `data_a`: Range data apertura
- `spese_comprese`: Si o No

### GET /task/{id}
Recupera un singolo task con informazioni correlate.

### POST /task
Crea un nuovo task.

**Campi richiesti:**
- `Task`: Nome task
- `ID_COMMESSA`: ID della commessa parent

**Esempio:**
```json
POST /task
{
  "Task": "Audit Magazzino Principale",
  "Desc_Task": "Verifica procedure di stoccaggio",
  "ID_COMMESSA": "COM0001",
  "ID_COLLABORATORE": "CONS001",
  "Tipo": "Campo",
  "Data_Apertura_Task": "2025-01-20",
  "gg_previste": 3.0,
  "Spese_Comprese": "No",
  "Valore_Spese_std": 200.00,
  "Valore_gg": 1200.00
}
```

### PUT /task/{id}
Aggiorna un task esistente.

### DELETE /task/{id}
Elimina un task (solo se non ha giornate registrate).

---

## Tariffe

Gestione delle tariffe collaboratori.

### GET /tariffe
Recupera la lista delle tariffe.

**Filtri disponibili:**
- `collaboratore`: ID collaboratore
- `commessa`: ID commessa (o "null" per tariffe generali)
- `spese_comprese`: Si o No
- `data_da` / `data_a`: Range validità
- `tariffa_min` / `tariffa_max`: Range tariffa
- `attive`: true per tariffe valide alla data odierna

### GET /tariffe/{id}
Recupera una singola tariffa.

### POST /tariffe
Crea una nuova tariffa.

**Campi richiesti:**
- `ID_COLLABORATORE`: ID collaboratore
- `Tariffa_gg`: Tariffa giornaliera
- `Dal`: Data di validità

**Validazioni:**
- Non può sovrapporsi con tariffe esistenti per stesso collaboratore/commessa

**Esempio:**
```json
POST /tariffe
{
  "ID_COLLABORATORE": "CONS001",
  "ID_COMMESSA": "COM0001",
  "Tariffa_gg": 1200.00,
  "Spese_comprese": "No",
  "Dal": "2025-01-01"
}
```

### PUT /tariffe/{id}
Aggiorna una tariffa esistente.

### DELETE /tariffe/{id}
Elimina una tariffa.

---

## Giornate

Gestione delle giornate lavorative.

### GET /giornate
Recupera la lista delle giornate.

**Filtri disponibili:**
- `collaboratore`: ID collaboratore
- `task`: ID task
- `tipo`: Campo, Promo, Sviluppo, Formazione
- `desk`: Si o No
- `data_da` / `data_a`: Range date
- `mese` + `anno`: Filtra per mese specifico
- `commessa`: ID commessa (tramite task)
- `con_spese`: true per giornate con spese

### GET /giornate/{id}
Recupera una singola giornata con tutti i dettagli correlati.

### POST /giornate
Crea una nuova giornata lavorativa.

**Campi richiesti:**
- `Data`: Data della giornata (non futura)
- `ID_COLLABORATORE`: ID collaboratore
- `ID_TASK`: ID task
- `gg`: Frazione di giornata (0-1)

**Validazioni:**
- Non può essere una data futura
- Il totale giornate per collaboratore/data non può superare 1
- Non possono esistere duplicati per collaboratore/task/data

**Esempio:**
```json
POST /giornate
{
  "Data": "2025-01-20",
  "ID_COLLABORATORE": "CONS001",
  "ID_TASK": "TAS00001",
  "Tipo": "Campo",
  "Desk": "No",
  "gg": 1.0,
  "Spese_Viaggi": 150.00,
  "Vitto_alloggio": 80.00,
  "Altri_costi": 20.00,
  "Note": "Audit presso cliente"
}
```

### PUT /giornate/{id}
Aggiorna una giornata esistente.

### DELETE /giornate/{id}
Elimina una giornata.

---

## Fatture

Gestione delle fatture emesse.

### GET /fatture
Recupera la lista delle fatture.

**Filtri disponibili:**
- `cliente`: ID cliente
- `commessa`: ID commessa
- `tipo`: Fattura o Nota_Accredito
- `numero`: Numero fattura (ricerca parziale)
- `data_da` / `data_a`: Range date emissione
- `anno`: Anno emissione
- `mese` + `anno`: Mese specifico
- `stato_pagamento`: pagata, non_pagata, scaduta, in_scadenza
- `importo_min` / `importo_max`: Range importo

### GET /fatture/{id}
Recupera una singola fattura con calcoli automatici dello stato.

### POST /fatture
Crea una nuova fattura.

**Campi richiesti:**
- `Data`: Data emissione
- `ID_CLIENTE`: ID cliente
- `NR`: Numero fattura (univoco per anno)

**Validazioni automatiche:**
- Controllo univocità numero per anno
- Calcolo automatico totale se non specificato
- Calcolo scadenza pagamento se specificati i tempi
- Verifica coerenza date e importi

**Esempio:**
```json
POST /fatture
{
  "Data": "2025-01-20",
  "ID_CLIENTE": "CLI0001",
  "TIPO": "Fattura",
  "NR": "25_001",
  "ID_COMMESSA": "COM0001",
  "Fatturato_gg": 3600.00,
  "Fatturato_Spese": 450.00,
  "Fatturato_TOT": 4050.00,
  "Note": "Fattura per attività di consulenza",
  "Tempi_Pagamento": 30
}
```

### PUT /fatture/{id}
Aggiorna una fattura esistente.

### DELETE /fatture/{id}
Elimina una fattura (solo se non pagata).

---

## Esempi di Utilizzo

### Scenario 1: Creazione completa di una commessa

```bash
# 1. Crea cliente
curl -X POST http://your-domain.com/API/clienti \
  -H "Content-Type: application/json" \
  -d '{
    "Cliente": "TECH SOLUTIONS SRL",
    "P_IVA": "12345678901",
    "Citta": "Milano"
  }'

# 2. Crea commessa
curl -X POST http://your-domain.com/API/commesse \
  -H "Content-Type: application/json" \
  -d '{
    "Commessa": "Implementazione ISO 9001",
    "Tipo_Commessa": "Cliente",
    "ID_CLIENTE": "CLI0001",
    "ID_COLLABORATORE": "CONS001"
  }'

# 3. Crea task
curl -X POST http://your-domain.com/API/task \
  -H "Content-Type: application/json" \
  -d '{
    "Task": "Analisi Gap ISO 9001",
    "ID_COMMESSA": "COM0001",
    "Tipo": "Campo",
    "gg_previste": 5.0
  }'
```

### Scenario 2: Registrazione giornata lavorativa

```bash
# Registra giornata
curl -X POST http://your-domain.com/API/giornate \
  -H "Content-Type: application/json" \
  -d '{
    "Data": "2025-01-20",
    "ID_COLLABORATORE": "CONS001",
    "ID_TASK": "TAS00001",
    "gg": 1.0,
    "Spese_Viaggi": 120.00,
    "Note": "Prima giornata di analisi"
  }'
```

### Scenario 3: Query con filtri avanzati

```bash
# Giornate di un collaboratore per gennaio 2025
curl "http://your-domain.com/API/giornate?collaboratore=CONS001&mese=1&anno=2025"

# Fatture scadute
curl "http://your-domain.com/API/fatture?stato_pagamento=scaduta"

# Commesse attive di un cliente
curl "http://your-domain.com/API/commesse?cliente=CLI0001&stato=In%20corso"
```

---

## Codici di Errore

| Codice | Descrizione |
|--------|-------------|
| 200 | OK - Operazione completata |
| 400 | Bad Request - Dati non validi |
| 404 | Not Found - Risorsa non trovata |
| 405 | Method Not Allowed - Metodo HTTP non supportato |
| 409 | Conflict - Violazione vincoli (duplicati, foreign key) |
| 500 | Internal Server Error - Errore interno |

### Esempi di Errori Comuni

```json
{
  "success": false,
  "error": "Dati non validi: Campo 'Cliente' richiesto, Email già esistente",
  "timestamp": "2025-01-20 10:30:45"
}
```

```json
{
  "success": false,
  "error": "Record non trovato",
  "timestamp": "2025-01-20 10:30:45"
}
```

```json
{
  "success": false,
  "error": "Impossibile eliminare: cliente ha commesse associate",
  "timestamp": "2025-01-20 10:30:45"
}
```

---

## Note per gli Sviluppatori

### Struttura del Database
Le API rispettano completamente la struttura del database esistente con:
- Gestione automatica dei timestamp (Data_Creazione, Data_Modifica)
- Generazione automatica degli ID con prefissi (CLI, CONS, COM, TAS, etc.)
- Validazione completa delle foreign key
- Controllo dei vincoli business logic

### Prestazioni
- Tutte le query sono ottimizzate con indici appropriati
- La paginazione è sempre applicata per evitare sovraccarichi
- I JOIN sono utilizzati solo quando necessario

### Estensibilità
Il sistema è progettato per essere facilmente estendibile:
- Nuovi endpoint possono ereditare da BaseAPI
- Filtri e validazioni personalizzabili per tabella
- Sistema di logging integrato per audit

### Sicurezza
- Validazione completa dell'input
- Prepared statements per prevenire SQL injection  
- Sistema di autenticazione JWT (in sviluppo)

---

**Ultima aggiornamento**: 20 Gennaio 2025
**Versione API**: 1.0