# 📋 Schema Database - Dettaglio Aggiornamenti

## 🔄 Modifiche Struttura Database

### **Data Aggiornamento**: 22 Agosto 2025

### 📝 **Modifiche Implementate**

#### 1. **Tabella ANA_COLLABORATORI**
```sql
-- PRIMA (struttura originale)
CREATE TABLE ANA_COLLABORATORI (
    ID_COLLABORATORE VARCHAR(50) PRIMARY KEY,
    Collaboratore VARCHAR(255),
    Email VARCHAR(255) UNIQUE,
    PWD VARCHAR(255),
    Ruolo ENUM('Admin', 'Manager', 'User', 'Amministrazione') DEFAULT 'User',
    ...
);

-- DOPO (con campo User aggiunto)
CREATE TABLE ANA_COLLABORATORI (
    ID_COLLABORATORE VARCHAR(50) PRIMARY KEY,
    Collaboratore VARCHAR(255),
    Email VARCHAR(255) UNIQUE,
    User VARCHAR(100),          -- ⭐ NUOVO CAMPO
    PWD VARCHAR(255),
    Ruolo ENUM('Admin', 'Manager', 'User', 'Amministrazione') DEFAULT 'User',
    ...
);
```

**Campo Aggiunto:**
- **`User`**: Username per autenticazione (VARCHAR(100))
  - Usato per login alternativo all'email
  - Permette username più corti e memorabili
  - Mappato dal file CSV `ANA_COLLABORATORI.csv`

#### 2. **Tabella FACT_GIORNATE**
```sql
-- PRIMA (struttura originale)
CREATE TABLE FACT_GIORNATE (
    ID_GIORNATA VARCHAR(50) PRIMARY KEY,
    Data DATE,
    ID_COLLABORATORE VARCHAR(50),
    ID_TASK VARCHAR(50),
    ...
    Note TEXT,
    Data_Creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ...
);

-- DOPO (con campo Confermata aggiunto)
CREATE TABLE FACT_GIORNATE (
    ID_GIORNATA VARCHAR(50) PRIMARY KEY,
    Data DATE,
    ID_COLLABORATORE VARCHAR(50),
    ID_TASK VARCHAR(50),
    ...
    Confermata ENUM('Si', 'No') DEFAULT 'No',  -- ⭐ NUOVO CAMPO
    Note TEXT,
    Data_Creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ...
);
```

**Campo Aggiunto:**
- **`Confermata`**: Stato di approvazione della giornata (ENUM)
  - Valori possibili: `'Si'`, `'No'`
  - Default: `'No'` (non confermata)
  - Permette workflow di approvazione delle ore lavorate
  - Indice aggiunto per performance (`INDEX idx_confermata`)

## 🔧 **Implementazione Aggiornamenti**

### **1. Script Setup Aggiornato**
Il file `DB/setup.php` è stato modificato per includere i nuovi campi:

```php
// ANA_COLLABORATORI con campo User
User VARCHAR(100),
INDEX idx_user (User),

// FACT_GIORNATE con campo Confermata  
Confermata ENUM('Si', 'No') DEFAULT 'No',
INDEX idx_confermata (Confermata)
```

### **2. Import CSV Automatico**
Il sistema di import `DB/import_csv.php` gestisce automaticamente i nuovi campi:

- **ANA_COLLABORATORI.csv**: Colonna `User` mappata automaticamente
- **FACT_GIORNATE.csv**: Colonna `Confermata` importata con valori `Si`/`No`

### **3. API Aggiornate**
Le API sono state aggiornate per gestire i nuovi campi:

#### **ConsuntivazioneAPISimple.php**
```php
// Salvataggio giornate con campo Confermata
$insertData = [
    // ... altri campi
    'Confermata' => 'No', // Default per nuove giornate
    // ...
];
```

## 📊 **Dati di Esempio**

### **ANA_COLLABORATORI.csv**
```csv
ID_COLLABORATORE;Collaboratore;Email;User;PWD;Ruolo
CONS001;Alessandro Vaglio;avaglio@vaglioandpartners.com;avaglio;Boss01;Manager
CONS003;Giorgio Troni;gtroni@vaglioandpartners.com;gtroni;Partner1963;Admin
```

### **FACT_GIORNATE.csv**
```csv
ID_GIORNATA;Data;ID_COLLABORATORE;ID_TASK;Tipo;Desk;gg;Spese_Viaggi;Vitto_alloggio;Altri_costi;Confermata;Note
DAY000000001;09/01/25;CONS001;TAS00006;Campo;;1;250;;;Si;
DAY000000150;04/08/25;CONS003;TAS00013;Campo;;1;170;90;;No;
```

## 🚀 **Come Applicare gli Aggiornamenti**

### **Per Database Esistenti:**
1. **Backup del database corrente**
2. **Esegui SQL di aggiornamento:**
   ```sql
   -- Aggiungi campo User a ANA_COLLABORATORI
   ALTER TABLE ANA_COLLABORATORI 
   ADD COLUMN User VARCHAR(100) AFTER Email,
   ADD INDEX idx_user (User);
   
   -- Aggiungi campo Confermata a FACT_GIORNATE
   ALTER TABLE FACT_GIORNATE 
   ADD COLUMN Confermata ENUM('Si', 'No') DEFAULT 'No' AFTER Altri_costi,
   ADD INDEX idx_confermata (Confermata);
   ```

### **Per Nuove Installazioni:**
1. **Esegui `DB/setup.php`** - Include già i nuovi campi
2. **Esegui `DB/import_csv.php`** - Importa dati con nuovi campi

## 🔍 **Impatto sulle Funzionalità**

### **Sistema di Autenticazione**
- Ora supporta login sia con `Email` che con `User`
- Username più corti e memorabili per i collaboratori

### **Gestione Giornate**
- Workflow di approvazione implementato
- Giornate salvate come "Non confermate" di default
- Possibilità di filtrare per stato di conferma

### **App Consuntivazione**
- Giornate inserite partono con `Confermata = 'No'`
- Interfaccia futura per approvazione amministrativa

## ✅ **Checklist Verifica**
- [ ] Campo `User` presente in `ANA_COLLABORATORI`
- [ ] Campo `Confermata` presente in `FACT_GIORNATE`  
- [ ] Indici creati correttamente
- [ ] Import CSV funzionante con nuovi campi
- [ ] API aggiornate per gestire nuovi campi
- [ ] Default values configurati correttamente

---
*Documentazione aggiornata il 22 Agosto 2025*