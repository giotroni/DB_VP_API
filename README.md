# 📊 Sistema Gestionale Vaglio & Partners

Sistema completo di gestione aziendale con API REST, interfaccia web e database MySQL per la gestione di clienti, commesse, task, collaboratori, tariffe, giornate e fatture.

## 🚀 Caratteristiche Principali

### 🔧 **API REST Complete**
- **7 moduli principali**: Clienti, Collaboratori, Commesse, Task, Tariffe, Giornate, Fatture
- **Operazioni CRUD** complete per tutti i moduli
- **Paginazione automatica** con limite configurabile
- **Filtri avanzati** e ricerca testuale
- **Validazione completa** dei dati e relazioni
- **Calcoli automatici** (giornate effettuate, valori maturati)

### 🌐 **Interfaccia Web Moderna**
- **Task Management** con dashboard interattiva
- **App Consuntivazione** per registrazione ore e spese
- **Design responsive** ottimizzato per mobile
- **Filtri in tempo reale** e ricerca istantanea
- **Card animate** con indicatori di progresso
- **Modal per gestione** task completa

### 🗄️ **Database Strutturato**
- **Schema relazionale** ottimizzato
- **Import automatico** da file CSV
- **Backup e restore** dati
- **Log dettagliati** operazioni
- **Charset UTF-8** per caratteri speciali

## 📁 Struttura del Progetto

```
DB_VP_API/
├── 📂 API/                     # API REST
│   ├── BaseAPI.php            # Classe base per tutte le API
│   ├── ClientiAPI.php         # Gestione clienti
│   ├── CollaboratoriAPI.php   # Gestione collaboratori
│   ├── CommesseAPI.php        # Gestione commesse
│   ├── TaskAPI.php            # Gestione task
│   ├── TariffeAPI.php         # Gestione tariffe
│   ├── GiornateAPI.php        # Gestione giornate
│   ├── FattureAPI.php         # Gestione fatture
│   ├── index.php              # Router principale API
│   ├── examples.php           # Esempi di utilizzo
│   └── README.md              # Documentazione API completa
│
├── 📂 DB/                      # Database e configurazione
│   ├── config.php             # Configurazione connessione
│   ├── create_database.php    # Creazione database
│   ├── setup.php              # Setup tabelle
│   ├── import_csv.php         # Import dati da CSV
│   ├── test_connection.php    # Test connessione
│   ├── 📂 Dati/               # File CSV di import
│   └── 📂 logs/               # Log sistema
│
├── 📂 assets/                  # Risorse frontend
│   ├── 📂 css/                # Stili personalizzati
│   └── 📂 js/                 # JavaScript applicazione
│
├── task_management.html        # Interfaccia web gestione task
├── consuntivazione.html        # App consuntivazione ore e spese
├── debug_api.html             # Tool debug API
├── test_giornate_quick.php    # Test rapidi giornate
├── README.md                  # Questo file
└── TASK_INTERFACE_DOCS.md     # Documentazione interfaccia
```

## 🛠️ Installazione e Setup

### **Prerequisiti**
- PHP 7.4+ con estensioni PDO, MySQL
- MySQL 5.7+ o MariaDB 10.2+
- Web server (Apache/Nginx)
- (Opzionale) phpMyAdmin per gestione database

### **1. Configurazione Database**

```bash
# 1. Modifica le credenziali in DB/config.php
define('DB_HOST', 'localhost');
define('DB_NAME', 'il_tuo_database');
define('DB_USER', 'il_tuo_utente');
define('DB_PASS', 'la_tua_password');
```

### **2. Creazione Database**

```bash
# Esegui da browser o terminale
php DB/create_database.php
```

### **3. Setup Tabelle**

```bash
# Crea tutte le tabelle del sistema
php DB/setup.php
```

### **4. Import Dati (Opzionale)**

```bash
# Import dati da CSV
php DB/import_csv.php
```

### **5. Test Connessione**

```bash
# Verifica funzionamento
php DB/test_connection.php
```

## 📋 Utilizzo delle API

### **Base URL**
```
http://your-domain.com/gestione_VP/API/index.php
```

### **Formato Chiamate**
```bash
# GET - Lista risorse
GET /gestione_VP/API/index.php?resource=clienti

# GET - Risorsa specifica
GET /gestione_VP/API/index.php?resource=clienti&id=1

# POST - Crea nuova risorsa
POST /gestione_VP/API/index.php?resource=clienti
Content-Type: application/json
{
    "Cliente": "Nuovo Cliente SRL",
    "P_IVA": "12345678901"
}

# PUT - Aggiorna risorsa
PUT /gestione_VP/API/index.php?resource=clienti&id=1
Content-Type: application/json
{
    "Cliente": "Cliente Modificato SRL"
}

# DELETE - Elimina risorsa
DELETE /gestione_VP/API/index.php?resource=clienti&id=1
```

### **Risorse Disponibili**
- `clienti` - Gestione anagrafica clienti
- `collaboratori` - Gestione collaboratori e utenti
- `commesse` - Gestione progetti e commesse
- `task` - Gestione attività di commessa
- `tariffe` - Gestione tariffe collaboratori
- `giornate` - Registrazione ore lavorate
- `fatture` - Gestione fatturazione

### **Filtri e Paginazione**
```bash
# Paginazione
?resource=clienti&page=2&limit=25

# Filtri per data
?resource=giornate&data_da=2024-01-01&data_a=2024-12-31

# Ricerca testuale
?resource=clienti&cliente=ACME

# Ordinamento
?resource=task&sort=Data_Inizio&order=DESC
```

## 🎯 Interfacce Web

### **Gestione Task**
Apri `task_management.html` nel browser per accedere all'interfaccia di gestione task.

**Funzionalità:**
- ✅ **Vista Dashboard** con statistiche in tempo reale
- 🔍 **Ricerca e filtri** avanzati per task
- ➕ **Creazione task** con form guidato
- ✏️ **Modifica task** esistenti
- 📁 **Archiviazione task** completati
- 📊 **Indicatori progresso** visivi
- 📱 **Design responsive** per tutti i dispositivi

### **App Consuntivazione**
Apri `consuntivazione.html` nel browser per l'app di consuntivazione delle ore.

**Funzionalità:**
- 🔐 **Login sicuro** con credenziali database
- 📊 **Dashboard statistiche** personali
- ⏱️ **Registrazione ore** per commessa/task
- 💰 **Gestione spese** complete (viaggio, vitto, altro)
- 📱 **Interface responsive** mobile-friendly
- 📋 **Storico consuntivazioni** ultime attività
- ✅ **Validazione completa** dati

### **Stati Task**
- **🟢 In corso**: Task attualmente in lavorazione
- **🔵 Completato**: Task terminato con successo
- **🟡 Sospeso**: Task temporaneamente fermato
- **⚫ Archiviato**: Task definitivamente chiuso

## 🔧 File di Configurazione

### **Database (DB/config.php)**
```php
// Configurazioni database
define('DB_HOST', 'localhost');
define('DB_NAME', 'database_name');
define('DB_USER', 'username');
define('DB_PASS', 'password');
define('DB_CHARSET', 'utf8mb4');

// Configurazioni API
define('API_VERSION', '1.0.0');
define('TIMEZONE', 'Europe/Rome');
```

## 📊 Schema Database

### **Tabelle Principali**
- **ANA_CLIENTI**: Anagrafica clienti
- **ANA_COLLABORATORI**: Collaboratori e utenti sistema (aggiunto campo `User`)
- **ANA_COMMESSE**: Progetti e commesse di lavoro
- **ANA_TASK**: Task e attività di commessa
- **ANA_TARIFFE_COLLABORATORI**: Tariffe per collaboratori
- **FACT_GIORNATE**: Registrazione ore lavorate (aggiunto campo `Confermata`)
- **FACT_FATTURE**: Fatture emesse

### **Campi Aggiornati**

#### **ANA_COLLABORATORI**
```sql
-- Nuovo campo User per username di login
User VARCHAR(100)  -- Username per autenticazione
```

#### **FACT_GIORNATE**
```sql
-- Nuovo campo Confermata per stato di approvazione
Confermata ENUM('Si', 'No') DEFAULT 'No'  -- Stato conferma giornata
```

### **Relazioni Chiave**
- Clienti → Commesse (1:N)
- Commesse → Task (1:N)
- Collaboratori → Task (1:N)
- Task → Giornate (1:N)
- Clienti → Fatture (1:N)

## 🧪 Test e Debug

### **Tool di Debug**
- `debug_api.html` - Interfaccia web per test API
- `API/test_api.php` - Test automatici API
- `test_giornate_quick.php` - Test rapidi giornate

### **Log Sistema**
- `DB/logs/php_errors.log` - Errori PHP
- `DB/logs/system.log` - Log sistema
- `DB/logs/import_*.log` - Log import dati

## 🚀 Funzionalità Avanzate

### **Calcoli Automatici**
- **Giornate Effettuate**: Somma automatica per task
- **Valori Maturati**: Calcolo basato su tariffe
- **Progressi Task**: Percentuali completamento
- **Statistiche Dashboard**: Aggiornamento in tempo reale

### **Validazioni**
- **Integrità referenziale**: Controllo relazioni
- **Formati dati**: Email, P.IVA, date
- **Vincoli business**: Logica aziendale
- **Sicurezza**: Prevenzione SQL injection

## 📚 Documentazione Completa

- **[API Documentation](API/README.md)** - Documentazione completa delle API
- **[Task Interface Guide](TASK_INTERFACE_DOCS.md)** - Guida interfaccia web task
- **[Consuntivazione App Guide](CONSUNTIVAZIONE_DOCS.md)** - Guida app consuntivazione

## 🔄 Versioning

- **Versione corrente**: 1.0.0
- **Data aggiornamento**: Agosto 2025
- **Compatibilità**: PHP 7.4+, MySQL 5.7+

## 🤝 Supporto

Per assistenza tecnica:
1. Controlla i log in `DB/logs/`
2. Verifica configurazione database in `DB/config.php`
3. Testa connessione con `DB/test_connection.php`
4. Consulta documentazione API in `API/README.md`

## 📋 Roadmap Futura

### **Miglioramenti Pianificati**
- 🔐 Autenticazione JWT per API
- 📊 Dashboard avanzata con grafici
- 📅 Vista calendario per task e scadenze
- 📄 Export dati in Excel/PDF
- 📱 App mobile nativa
- 🔔 Sistema notifiche
- 📈 Reporting avanzato
- 🔄 Sincronizzazione cloud

---

**Sviluppato per Vaglio & Partners** | Sistema Gestionale Completo | Agosto 2025
