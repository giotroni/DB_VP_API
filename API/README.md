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

**Base URL**: `http://your-domain.com/gestione_VP/API/index.php`
**Versione API**: 1.0.0
**Formato**: JSON

### Modalità di Chiamata

Le API utilizzano un sistema di routing basato su parametri GET:

- **Formato base**: `GET /gestione_VP/API/index.php?resource={risorsa}`
- **Con ID**: `GET /gestione_VP/API/index.php?resource={risorsa}&id={id}`
- **Con filtri**: `GET /gestione_VP/API/index.php?resource={risorsa}&page=1&limit=50`

**Esempi**:
- `GET /gestione_VP/API/index.php?resource=task` - Lista task
- `GET /gestione_VP/API/index.php?resource=task&id=TAS00001` - Task specifico
- `POST /gestione_VP/API/index.php?resource=task` - Crea nuovo task
- `PUT /gestione_VP/API/index.php?resource=task&id=TAS00001` - Aggiorna task

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
- `limit`: Elementi per pagina (default: 50, max: 200)

**Esempio**: `GET /gestione_VP/API/index.php?resource=clienti&page=2&limit=25`

## Filtri e Ordinamento

### Ordinamento
- `sort`: Campo per ordinamento
- `order`: ASC o DESC (default: ASC)

**Esempio**: `GET /gestione_VP/API/index.php?resource=clienti&sort=Cliente&order=DESC`

### Filtri Comuni
Ogni endpoint supporta filtri specifici documentati nelle singole sezioni.

---

## API Endpoints

## Clienti

Gestione dell'anagrafica clienti.

### GET /gestione_VP/API/index.php?resource=clienti
Recupera la lista dei clienti.

**Filtri disponibili:**
- `cliente`: Filtra per nome cliente (ricerca parziale)
- `citta`: Filtra per città (ricerca parziale)
- `provincia`: Filtra per provincia (match esatto)
- `piva`: Filtra per P.IVA (ricerca parziale)

**Esempio:**
```
GET /gestione_VP/API/index.php?resource=clienti&cliente=CALVI&provincia=MI&page=1&limit=10
```

### GET /gestione_VP/API/index.php?resource=clienti&id={id}
Recupera un singolo cliente per ID.

**Risposta include:**
- Dati base del cliente
- Statistiche: commesse, fatturato, ultima fattura

### POST /gestione_VP/API/index.php?resource=clienti
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
POST /gestione_VP/API/index.php?resource=clienti
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

### PUT /gestione_VP/API/index.php?resource=clienti&id={id}
Aggiorna un cliente esistente.

### DELETE /gestione_VP/API/index.php?resource=clienti&id={id}
Elimina un cliente (solo se non ha commesse o fatture associate).

---

## Collaboratori

Gestione dell'anagrafica collaboratori.

### GET /gestione_VP/API/index.php?resource=collaboratori
Recupera la lista dei collaboratori.

**Filtri disponibili:**
- `collaboratore`: Filtra per nome (ricerca parziale)
- `email`: Filtra per email (ricerca parziale)
- `ruolo`: Filtra per ruolo (Admin, Manager, User, Amministrazione)

### GET /gestione_VP/API/index.php?resource=collaboratori&id={id}
Recupera un singolo collaboratore per ID.

**Nota**: La password non viene mai restituita nelle risposte.

### POST /gestione_VP/API/index.php?resource=collaboratori
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
POST /gestione_VP/API/index.php?resource=collaboratori
{
  "Collaboratore": "Mario Rossi",
  "Email": "mario.rossi@company.com",
  "PWD": "password123",
  "Ruolo": "User"
}
```

### PUT /gestione_VP/API/index.php?resource=collaboratori&id={id}
Aggiorna un collaboratore esistente.

### DELETE /gestione_VP/API/index.php?resource=collaboratori&id={id}
Elimina un collaboratore (solo se non ha attività associate).

---

## Commesse

Gestione delle commesse di lavoro.

### GET /gestione_VP/API/index.php?resource=commesse
Recupera la lista delle commesse.

**Filtri disponibili:**
- `commessa`: Filtra per nome commessa (ricerca parziale)
- `cliente`: Filtra per ID cliente
- `stato`: Filtra per stato (Attiva, Completata, Sospesa)

**Campi nella risposta:**
- `Commessa_ID`: ID unico della commessa
- `Commessa`: Nome della commessa
- `Responsabile_Commessa`: Nome del responsabile
- `Data_Inizio`: Data di inizio (YYYY-MM-DD)
- `Data_Fine`: Data di fine (YYYY-MM-DD)
- `Stato`: Stato attuale
- `Cliente_ID`: ID del cliente associato
- `Cliente`: Nome del cliente (JOIN)

### GET /gestione_VP/API/index.php?resource=commesse&id={id}
Recupera una singola commessa per ID.

### POST /gestione_VP/API/index.php?resource=commesse
Crea una nuova commessa.

**Campi richiesti:**
- `Commessa`: Nome della commessa
- `Cliente_ID`: ID del cliente
- `Data_Inizio`: Data di inizio (YYYY-MM-DD)

**Campi opzionali:**
- `Responsabile_Commessa`: ID del responsabile (default: nessuno)
- `Data_Fine`: Data di fine prevista
- `Stato`: Stato (default: Attiva)

**Esempio:**
```json
POST /gestione_VP/API/index.php?resource=commesse
{
  "Commessa": "Nuovo Sito Web E-commerce",
  "Cliente_ID": 1,
  "Responsabile_Commessa": 5,
  "Data_Inizio": "2024-01-15",
  "Data_Fine": "2024-06-30",
  "Stato": "Attiva"
}
```

### PUT /gestione_VP/API/index.php?resource=commesse&id={id}
Aggiorna una commessa esistente.

### DELETE /gestione_VP/API/index.php?resource=commesse&id={id}
Elimina una commessa (solo se non ha task associate).

---

## Task

Gestione dei task di commessa.

### GET /gestione_VP/API/index.php?resource=task
Recupera la lista dei task.

**Filtri disponibili:**
- `task`: Filtra per nome task (ricerca parziale)
- `commessa`: Filtra per ID commessa
- `collaboratore`: Filtra per ID collaboratore assegnato
- `stato`: Filtra per stato

**Campi nella risposta:**
- `Task_ID`: ID unico del task
- `Task`: Nome del task
- `Commessa_ID`: ID della commessa associata
- `Commessa`: Nome della commessa (JOIN)
- `Responsabile_Commessa`: Nome del responsabile commessa (JOIN)
- `Collaboratore_ID`: ID del collaboratore assegnato
- `Collaboratore`: Nome del collaboratore (JOIN)
- `Descrizione`: Descrizione dettagliata
- `Data_Inizio`: Data di inizio (YYYY-MM-DD)
- `Data_Fine_Prevista`: Data fine prevista (YYYY-MM-DD)
- `GG_Previsti`: Giorni previsti (decimale)
- `GG_Effettuate`: Giorni effettuati calcolati (decimale)
- `Valore_GG_Maturato`: Valore maturato per giornate Campo (decimale)
- `Valore_Spese_Maturato`: Valore maturato per spese (decimale)
- `Valore_TOT_Maturato`: Valore totale maturato (decimale)
- `Stato`: Stato attuale

**Nota**: I campi `GG_Effettuate`, `Valore_GG_Maturato`, `Valore_Spese_Maturato` e `Valore_TOT_Maturato` sono calcolati automaticamente:
- **GG_Effettuate**: Somma delle giornate lavorate per questo task
- **Valore_GG_Maturato**: Somma delle giornate di tipo "Campo" moltiplicate per la tariffa del collaboratore
- **Valore_Spese_Maturato**: Se Spese_Comprese='No', considera Valore_Spese_std o la somma delle spese dalle giornate, altrimenti 0
- **Valore_TOT_Maturato**: Somma di Valore_GG_Maturato + Valore_Spese_Maturato

### GET /gestione_VP/API/index.php?resource=task&id={id}
Recupera un singolo task per ID con informazioni correlate.

### POST /gestione_VP/API/index.php?resource=task
Crea un nuovo task.

**Campi richiesti:**
- `Task`: Nome del task
- `Commessa_ID`: ID della commessa
- `Data_Inizio`: Data di inizio (YYYY-MM-DD)

**Campi opzionali:**
- `Collaboratore_ID`: ID del collaboratore assegnato
- `Descrizione`: Descrizione dettagliata
- `Data_Fine_Prevista`: Data fine prevista
- `GG_Previsti`: Giorni previsti (decimale)
- `Stato`: Stato (default: Attivo)

**Esempio:**
```json
POST /gestione_VP/API/index.php?resource=task
{
  "Task": "Sviluppo Frontend",
  "Commessa_ID": 1,
  "Collaboratore_ID": 3,
  "Descrizione": "Sviluppo interfaccia utente responsive",
  "Data_Inizio": "2024-02-01",
  "Data_Fine_Prevista": "2024-02-15",
  "GG_Previsti": 10.5,
  "Stato": "Attivo"
}
```

### PUT /gestione_VP/API/index.php?resource=task&id={id}
Aggiorna un task esistente.

### DELETE /gestione_VP/API/index.php?resource=task&id={id}
Elimina un task (solo se non ha giornate associate).

---

## Tariffe

Gestione delle tariffe collaboratori.

### GET /gestione_VP/API/index.php?resource=tariffe
Recupera la lista delle tariffe.

**Filtri disponibili:**
- `collaboratore`: Filtra per ID collaboratore
- `commessa`: Filtra per ID commessa
- `data_da` / `data_a`: Range validità (YYYY-MM-DD)

**Campi nella risposta:**
- `Tariffa_ID`: ID unico della tariffa
- `Collaboratore_ID`: ID del collaboratore
- `Collaboratore`: Nome del collaboratore (JOIN)
- `Commessa_ID`: ID della commessa (null per tariffa generale)
- `Commessa`: Nome della commessa (JOIN)
- `Tariffa_GG`: Tariffa giornaliera (decimale)
- `Dal`: Data inizio validità (YYYY-MM-DD)
- `Al`: Data fine validità (YYYY-MM-DD)

### GET /gestione_VP/API/index.php?resource=tariffe&id={id}
Recupera una singola tariffa per ID.

### POST /gestione_VP/API/index.php?resource=tariffe
Crea una nuova tariffa.

**Campi richiesti:**
- `Collaboratore_ID`: ID del collaboratore
- `Tariffa_GG`: Tariffa giornaliera (decimale)
- `Dal`: Data inizio validità (YYYY-MM-DD)

**Campi opzionali:**
- `Commessa_ID`: ID commessa specifica (default: tariffa generale)
- `Al`: Data fine validità

**Esempio:**
```json
POST /gestione_VP/API/index.php?resource=tariffe
{
  "Collaboratore_ID": 1,
  "Commessa_ID": 5,
  "Tariffa_GG": 450.00,
  "Dal": "2024-01-01",
  "Al": "2024-12-31"
}
```

### PUT /gestione_VP/API/index.php?resource=tariffe&id={id}
Aggiorna una tariffa esistente.

### DELETE /gestione_VP/API/index.php?resource=tariffe&id={id}
Elimina una tariffa (solo se non ha giornate associate).

---

## Giornate

Gestione delle giornate lavorative.

### GET /gestione_VP/API/index.php?resource=giornate
Recupera la lista delle giornate.

**Filtri disponibili:**
- `collaboratore`: Filtra per ID collaboratore
- `task`: Filtra per ID task
- `commessa`: Filtra per ID commessa (tramite task)
- `data_da` / `data_a`: Range date (YYYY-MM-DD)

**Campi nella risposta:**
- `Giornata_ID`: ID unico della giornata
- `Data`: Data della giornata (YYYY-MM-DD)
- `Collaboratore_ID`: ID del collaboratore
- `Collaboratore`: Nome del collaboratore (JOIN)
- `Task_ID`: ID del task
- `Task`: Nome del task (JOIN)
- `Commessa`: Nome della commessa (JOIN)
- `GG`: Frazione di giornata lavorata (decimale)
- `Tariffa_GG`: Tariffa applicata (decimale)
- `Note`: Note aggiuntive

### GET /gestione_VP/API/index.php?resource=giornate&id={id}
Recupera una singola giornata per ID.

### POST /gestione_VP/API/index.php?resource=giornate
Crea una nuova giornata lavorativa.

**Campi richiesti:**
- `Data`: Data della giornata (YYYY-MM-DD, non futura)
- `Collaboratore_ID`: ID del collaboratore
- `Task_ID`: ID del task
- `GG`: Frazione di giornata (decimale, max 1.0)

**Campi opzionali:**
- `Tariffa_GG`: Tariffa specifica (default: da anagrafica)
- `Note`: Note aggiuntive

**Esempio:**
```json
POST /gestione_VP/API/index.php?resource=giornate
{
  "Data": "2024-01-20",
  "Collaboratore_ID": 1,
  "Task_ID": 5,
  "GG": 0.5,
  "Tariffa_GG": 450.00,
  "Note": "Lavoro pomeridiano"
}
```

### PUT /gestione_VP/API/index.php?resource=giornate&id={id}
Aggiorna una giornata esistente.

### DELETE /gestione_VP/API/index.php?resource=giornate&id={id}
Elimina una giornata.

---

## Fatture

Gestione delle fatture emesse.

### GET /gestione_VP/API/index.php?resource=fatture
Recupera la lista delle fatture.

**Filtri disponibili:**
- `cliente`: Filtra per ID cliente
- `numero`: Filtra per numero fattura (ricerca parziale)
- `data_da` / `data_a`: Range date emissione (YYYY-MM-DD)
- `importo_min` / `importo_max`: Range importo

**Campi nella risposta:**
- `Fattura_ID`: ID unico della fattura
- `Numero_Fattura`: Numero progressivo
- `Data_Emissione`: Data emissione (YYYY-MM-DD)
- `Cliente_ID`: ID del cliente
- `Cliente`: Nome del cliente (JOIN)
- `Imponibile`: Importo imponibile (decimale)
- `IVA`: Importo IVA (decimale)
- `Totale`: Importo totale (decimale)
- `Scadenza`: Data scadenza (YYYY-MM-DD)
- `Pagata`: Flag pagamento (boolean)

### GET /gestione_VP/API/index.php?resource=fatture&id={id}
Recupera una singola fattura per ID con dettagli completi.

### POST /gestione_VP/API/index.php?resource=fatture
Crea una nuova fattura.

**Campi richiesti:**
- `Cliente_ID`: ID del cliente
- `Data_Emissione`: Data emissione (YYYY-MM-DD)
- `Imponibile`: Importo imponibile (decimale)
- `IVA`: Importo IVA (decimale)

**Campi opzionali:**
- `Numero_Fattura`: Numero (auto-generato se omesso)
- `Scadenza`: Data scadenza (default: +30 giorni)
- `Pagata`: Flag pagamento (default: false)
- `Note`: Note aggiuntive

**Esempio:**
```json
POST /gestione_VP/API/index.php?resource=fatture
{
  "Cliente_ID": 1,
  "Data_Emissione": "2024-01-15",
  "Imponibile": 1000.00,
  "IVA": 220.00,
  "Scadenza": "2024-02-15",
  "Note": "Fattura per servizi gennaio"
}
```

### PUT /gestione_VP/API/index.php?resource=fatture&id={id}
Aggiorna una fattura esistente.

### DELETE /gestione_VP/API/index.php?resource=fatture&id={id}
Elimina una fattura.

---

## Esempi di Utilizzo

### Scenario 1: Creazione completa di una commessa

```bash
# 1. Crea cliente
curl -X POST "http://your-domain.com/gestione_VP/API/index.php?resource=clienti" \
  -H "Content-Type: application/json" \
  -d '{
    "Cliente": "TECH SOLUTIONS SRL",
    "P_IVA": "12345678901",
    "Citta": "Milano"
  }'

# 2. Crea commessa
curl -X POST "http://your-domain.com/gestione_VP/API/index.php?resource=commesse" \
  -H "Content-Type: application/json" \
  -d '{
    "Commessa": "Implementazione Sito Web",
    "Cliente_ID": 1,
    "Responsabile_Commessa": 2,
    "Data_Inizio": "2024-02-01"
  }'

# 3. Crea task
curl -X POST "http://your-domain.com/gestione_VP/API/index.php?resource=task" \
  -H "Content-Type: application/json" \
  -d '{
    "Task": "Analisi Requisiti",
    "Commessa_ID": 1,
    "Collaboratore_ID": 2,
    "Data_Inizio": "2024-02-01",
    "GG_Previsti": 5.0
  }'
```

### Scenario 2: Registrazione giornata lavorativa

```bash
# Registra giornata
curl -X POST "http://your-domain.com/gestione_VP/API/index.php?resource=giornate" \
  -H "Content-Type: application/json" \
  -d '{
    "Data": "2024-02-05",
    "Collaboratore_ID": 2,
    "Task_ID": 1,
    "GG": 1.0,
    "Note": "Prima giornata di analisi"
  }'
```

### Scenario 3: Recupero dati con filtri

```bash
# Lista task per commessa con paginazione
curl "http://your-domain.com/gestione_VP/API/index.php?resource=task&commessa=1&page=1&limit=50"

# Lista giornate per collaboratore in un periodo
curl "http://your-domain.com/gestione_VP/API/index.php?resource=giornate&collaboratore=2&data_da=2024-02-01&data_a=2024-02-29"

# Lista fatture per cliente
curl "http://your-domain.com/gestione_VP/API/index.php?resource=fatture&cliente=1&data_da=2024-01-01"
```

---

## Codici di Errore

| Codice | Descrizione |
|--------|-------------|
| 200 | OK - Operazione completata con successo |
| 400 | Bad Request - Dati non validi o mancanti |
| 404 | Not Found - Risorsa non trovata |
| 405 | Method Not Allowed - Metodo HTTP non supportato |
| 409 | Conflict - Violazione vincoli (duplicati, foreign key) |
| 500 | Internal Server Error - Errore interno del server |

### Esempi di Risposte di Errore

```json
{
  "success": false,
  "error": "Dati non validi: Campo 'Cliente' richiesto",
  "timestamp": "2024-01-20 10:30:45"
}
```

```json
{
  "success": false,
  "error": "Record non trovato con ID: 999",
  "timestamp": "2024-01-20 10:30:45"
}
```

```json
{
  "success": false,
  "error": "Impossibile eliminare: cliente ha commesse associate",
  "timestamp": "2024-01-20 10:30:45"
}
```

---

## Note per gli Sviluppatori

### Architettura del Sistema
- **Routing**: Sistema parametrico via `?resource=nome_risorsa`
- **Base URL**: `/gestione_VP/API/index.php`
- **Versione**: 1.0.0
- **Formato**: JSON per request/response
- **Encoding**: UTF-8

### Caratteristiche delle API
- **Paginazione**: Automatica con `page` e `limit` (default: 50, max: 200)
- **Filtri**: Supporto per ricerca parziale e range di date
- **Join**: Dati correlati inclusi automaticamente (es. nome cliente, responsabile commessa)
- **Calcoli**: Campi calcolati come `GG_Effettuate` per i task
- **Validazione**: Controllo completo dei vincoli di integrità

### Gestione Decimali
Il sistema gestisce correttamente i decimali italiani:
- **Import CSV**: Converte virgole in punti automaticamente
- **Database**: Memorizzazione in formato standard (punto decimale)
- **API**: Restituisce valori con precisione decimale corretta

### Nuovi Campi Implementati
- **Task**: Campo `GG_Effettuate` calcolato dalla somma delle giornate
- **Commesse**: Campo `Responsabile_Commessa` con JOIN al nome del collaboratore
- **Frontend**: Supporto completo per i nuovi campi nell'interfaccia web

### Performance e Limiti
- **Paginazione**: Limite massimo 200 record per chiamata
- **Query**: Ottimizzate con indici appropriati
- **Memory**: Gestione efficiente per dataset grandi
- **Timeout**: 30 secondi per operazioni complesse

---

**Ultimo aggiornamento**: 20 Gennaio 2025  
**Versione API**: 1.0.0  
**Compatibilità**: PHP 7.4+, MySQL 5.7+