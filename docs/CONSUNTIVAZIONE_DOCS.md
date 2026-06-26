# 📊 App Consuntivazione Vaglio & Partners

Applicazione web per la consuntivazione delle attività lavorative e delle spese dei collaboratori con calcolo automatico del "Costo gg".

## 🎯 Caratteristiche Principali

### 🔐 **Autenticazione Sicura**
- Login con credenziali memorizzate nel database
- Verifica tramite tabella `ANA_COLLABORATORI`
- Supporto per password in plain text e hash
- Gestione sessioni con timeout automatico

### 📋 **Dashboard Interattiva**
- **Statistiche in tempo reale**: Ore del mese, progetti attivi, spese, giorni lavorati, **Costo gg**
- **Form di consuntivazione** con validazione completa e selezione tipo giornata
- **Selezione dinamica** di commesse e task basata sui permessi utente
- **Calcolo automatico** del totale spese e costo giornaliero

### 💰 **Gestione Spese Complete**
- **Spese viaggio**: Trasporti, carburante, pedaggi
- **Vitto/Alloggio**: Pasti, hotel, trasferte
- **Altre spese**: Materiali, servizi aggiuntivi
- **Totale automatico** con aggiornamento in tempo reale
- **Formattazione italiana**: Visualizzazione con virgola decimali e punto migliaia

### 💵 **Calcolo Automatico Costo gg**
- **Solo per giornate "Campo"**: Altri tipi (Ufficio, Trasferta, ecc.) hanno costo zero
- **Tariffe dinamiche**: Priorità a tariffe specifiche del progetto, fallback a tariffe standard
- **Validità temporale**: Selezione tariffa basata sulla data della giornata
- **Statistiche aggregate**: Totali per periodo e raggruppamento mensile

### 🔍 **Consultazione Avanzata**
- **Filtri per anno, mese, progetto**: Ricerca mirata delle consuntivazioni
- **Statistiche aggregate**: Totali giornate, spese, spese rimborsabili, **costo gg**
- **Raggruppamento mensile**: Vista riassuntiva per mese con tutti i totali
- **Esportazione CSV completa**: Include tipo giornata e costo gg calcolato

### 📱 **Design Responsive**
- **Interfaccia moderna** ispirata alle immagini fornite
- **Mobile-friendly** per uso su smartphone e tablet
- **Animazioni fluide** e feedback visivo
- **Tema V&P** con colori aziendali
- **Tag colorati** per tipo giornata nelle ultime consuntivazioni

## 🏗️ Architettura

### **Frontend**
```
consuntivazione.html          # Pagina principale
assets/
├── css/
│   └── consuntivazione.css   # Stili personalizzati
└── js/
    └── consuntivazione.js    # Logica applicazione
```

### **Backend API**
```
API/
├── AuthAPI.php              # Autenticazione e gestione sessioni
└── ConsuntivazioneAPI.php   # Gestione consuntivazioni e statistiche
```

### **Database**
Utilizza le tabelle esistenti del sistema V&P:
- `ANA_COLLABORATORI` - Utenti e credenziali (con campo `User` per username)
- `ANA_COMMESSE` - Progetti disponibili
- `ANA_TASK` - Attività specifiche
- `FACT_GIORNATE` - Consuntivazioni registrate (con campo `Confermata` per stato approvazione)

## 🚀 Installazione e Utilizzo

### **1. Installazione**

L'app utilizza l'infrastruttura esistente del sistema V&P. Assicurati che:

1. **Database configurato** con tutte le tabelle
2. **API esistenti** funzionanti
3. **Web server** attivo (Apache/Nginx)

### **2. Accesso all'Applicazione**

Apri nel browser: `http://your-domain.com/consuntivazione.html`

### **3. Login**

Utilizza le credenziali dei collaboratori memorizzate nel database:
- **Email**: Campo `Email` della tabella `ANA_COLLABORATORI`
- **Password**: Campo `PWD` crittografato della tabella `ANA_COLLABORATORI`

**Nota**: Le password devono essere hashate con `password_hash()` di PHP per la sicurezza.

### **4. Preparazione Password (Importante!)**

Le password nel database devono essere crittografate. Puoi usare:

#### **🌐 Tool Web (Raccomandato)**
Apri nel browser: `http://your-domain.com/../DB/password_admin.html`

**Funzionalità disponibili:**
- ✅ **Controllo automatico** stato password all'apertura
- 🔍 **Visualizzazione tabella** con stato di ogni collaboratore
- 🔒 **Crittografia massiva** di tutte le password plain text
- 👤 **Imposta password** per utente specifico
- 🧪 **Test login** per verificare email/password

#### **📋 Comandi da terminale (alternativo)**
```bash
# Controlla stato delle password attuali
php DB/password_hasher.php check

# Crittografa tutte le password in plain text
php DB/password_hasher.php hash_all

# Imposta password per un utente specifico
php DB/password_hasher.php set_password mario@company.com nuovapassword

# Testa la verifica di una password
php DB/password_hasher.php test mario@company.com password123
```

#### **🌐 URL diretti (solo lettura)**
```
# Controlla stato password
http://your-domain.com/../DB/password_hasher.php?action=check

# Testa una password
http://your-domain.com/../DB/password_hasher.php?action=test&email=mario@company.com&password=password123
```

## 📋 Funzionalità Dettagliate

### **🔍 Dashboard Statistiche**

Il dashboard mostra in tempo reale:
- **Ore Questo Mese**: Somma delle giornate lavorate nel mese corrente
- **Progetti Attivi**: Numero di commesse in corso o sospese
- **Spese del Mese**: Totale spese sostenute nel mese (formato italiano)
- **Spese Rimborsabili**: Spese non fatturate VP (formato italiano)
- **Costo gg**: Costo giornaliero totale calcolato SOLO per giornate di tipo "Campo"
- **Giorni Lavorati**: Numero di giorni unici con consuntivazioni

### **📝 Form Consuntivazione**

#### **Campi Obbligatori**
- **Data**: Data della giornata lavorativa (non futura)
- **Giornate Lavorate**: Frazione di giornata (0.1 - 1.0)
- **Tipo Giornata**: Campo, Ufficio, Trasferta, Formazione, Malattia, Ferie, Permesso
- **Progetto**: Commessa selezionabile tra quelle accessibili
- **Task/Attività**: Task della commessa selezionata

#### **Spese (Opzionali)**
- **Spese Viaggio**: Trasporti, carburante, pedaggi
- **Vitto/Alloggio**: Pasti e sistemazioni
- **Altre Spese**: Costi aggiuntivi
- **Spese Fatturate VP**: Spese da fatturare al cliente
- **Totale**: Calcolato automaticamente in formato italiano

#### **Note**
Campo libero per descrizioni dettagliate delle attività svolte.

### **📊 Ultime Consuntivazioni**

Lista delle ultime 10 consuntivazioni con:
- Data e ore lavorate
- **Tag colorato per tipo giornata** (Campo=verde, Ufficio=blu, ecc.)
- Progetto e task
- Cliente associato
- Spese dettagliate in formato italiano
- Note inserite
- Stato confermata/non confermata

### **🔍 Consultazione Consuntivazioni**

Modulo avanzato per ricerca e analisi:

#### **Filtri Disponibili**
- **Anno**: Selezione anno tra quelli disponibili
- **Mese**: Filtro per mese specifico
- **Progetto**: Filtro per commessa specifica

#### **Statistiche Visualizzate**
- **Consuntivazioni Trovate**: Numero totale righe
- **Totale Giornate**: Somma giornate lavorate
- **Totale Spese**: Somma tutte le spese (formato italiano)
- **Spese Rimborsabili**: Spese non fatturate VP (formato italiano)
- **Costo gg Totale**: Somma costi giornalieri per giornate "Campo" (formato italiano)

#### **Raggruppamento Mensile**
Tabella riassuntiva per mese con:
- Mese e anno
- Numero consuntivazioni
- Totale giornate
- Totale spese (formato italiano)
- Spese rimborsabili (formato italiano)
- **Costo gg mensile** (formato italiano)

#### **Esportazione CSV**
File CSV completo con tutte le colonne:
- Data, Progetto, Cliente, Task, **Tipo**, Giorni
- Spese Viaggio, Vitto/Alloggio, Altre Spese, Spese Fatturate VP
- Totale Spese, Spese Rimborsabili, **Costo gg**, Note
- **Formato numeri**: Solo virgola per decimali (es: 1000,50)

## 🔧 API Endpoints

### **AuthAPI.php**

#### **POST /API/AuthAPI.php**

**Login**
```json
{
    "action": "login",
    "email": "mario.rossi@company.com",
    "password": "password123"
}
```

**Controllo Sessione**
```json
{
    "action": "check"
}
```

**Logout**
```json
{
    "action": "logout"
}
```

**Lista Commesse Utente**
```json
{
    "action": "get_commesse"
}
```

**Lista Task per Commessa**
```json
{
    "action": "get_tasks",
    "commessa_id": "COM001"
}
```

### **ConsuntivazioneAPI.php**

#### **POST /API/ConsuntivazioneAPI.php**

**Salva Consuntivazione**
```json
{
    "action": "salva_consuntivazione",
    "data": "2025-08-21",
    "giornate_lavorate": 1.0,
    "task": "TAS001",
    "spese_viaggio": 25.50,
    "vitto_alloggio": 45.00,
    "altre_spese": 10.00,
    "note": "Descrizione attività"
}
```

**Statistiche Dashboard**
```json
{
    "action": "get_statistiche"
}
```

**Risposta con Costo gg**
```json
{
    "success": true,
    "data": {
        "ore_mese": 15.5,
        "spese_mese": 450.75,
        "spese_rimborsabili": 320.50,
        "costo_gg": 7750.00,
        "giorni_lavorati": 12
    }
}
```

**Consultazione Consuntivazioni**
```json
{
    "action": "cerca_consuntivazioni",
    "anno": 2025,
    "mese": 8,
    "commessa_id": "COM001"
}
```

**Risposta Consultazione**
```json
{
    "success": true,
    "data": {
        "consuntivazioni": [...],
        "statistiche": {
            "numero_consuntivazioni": 25,
            "totale_giornate": 18.5,
            "totale_spese": 1250.75,
            "totale_spese_rimborsabili": 980.50,
            "totale_costo_gg": 9250.00
        },
        "raggruppamento_mese": [
            {
                "nome_mese": "Agosto",
                "anno": 2025,
                "count": 15,
                "giornate": 12.5,
                "spese": 750.25,
                "spese_rimborsabili": 600.00,
                "costo_gg": 6250.00
            }
        ]
    }
}
```

## 🎨 Personalizzazione UI

### **Colori Aziendali**
```css
:root {
    --primary-color: #667eea;
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
}
```

### **Responsive Breakpoints**
- **Desktop**: 3 colonne statistiche (≥992px)
- **Tablet**: 2 colonne (768px-991px) 
- **Mobile**: 1 colonna (<768px)

## 🔒 Sicurezza

### **Autenticazione**
- Verifica credenziali contro database (solo Email)
- Supporto solo password crittografate con password_hash()
- Timeout sessione (24 ore)
- Protezione CSRF di base

### **Validazione Dati**
- **Lato Client**: Validazione immediata form
- **Lato Server**: Controlli business logic
- **Database**: Vincoli di integrità referenziale

### **Controlli Accesso**
- Utente vede solo le proprie commesse/task
- Validazione permessi per ogni operazione
- Prevenzione SQL injection con prepared statements

## 📱 Compatibilità

### **Browser Supportati**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### **Dispositivi**
- Desktop Windows/Mac/Linux
- Tablet iOS/Android
- Smartphone iOS/Android

## 🐛 Troubleshooting

### **Problemi Comuni**

#### **Login Non Funziona**
1. Verifica che l'email sia esatta nel database
2. Controlla che il campo `PWD` sia crittografato con password_hash()
3. Verifica configurazione database in `config.php`
4. Le password devono essere hashate, non in plain text

#### **Commesse Non Si Caricano**
1. Verifica che l'utente abbia task assegnati
2. Controlla stato commesse (devono essere 'In corso' o 'Sospesa')
3. Verifica foreign key tra tabelle

#### **Errori di Salvataggio**
1. Controlla formato data (YYYY-MM-DD)
2. Verifica che giornate_lavorate sia tra 0.1 e 1.0
3. Controlla che il task sia valido e accessibile

### **Log e Debug**
- **Console Browser**: F12 per errori JavaScript
- **Network Tab**: Verifica chiamate API
- **PHP Error Log**: Controlla `DB/logs/php_errors.log`

## � Logica Calcolo "Costo gg"

### **Criteri di Calcolo**
1. **Solo giornate "Campo"**: Giornate di altri tipi (Ufficio, Trasferta, Formazione, Malattia, Ferie, Permesso) hanno costo = 0
2. **Priorità tariffe**: 
   - Prima: Tariffa specifica del progetto (ID_COMMESSA = valore specifico)
   - Poi: Tariffa standard (ID_COMMESSA = NULL)
3. **Validità temporale**: Tariffa deve essere valida alla data della giornata (Dal <= Data)
4. **Calcolo**: Giornate × Tariffa_gg appropriata

### **Esempio Pratico**
```
Giornata: 1.0 gg di tipo "Campo" del 15/08/2025
Progetto: COM001
Collaboratore: Mario Rossi

Tariffe disponibili:
- Tariffa standard: 500€/gg (ID_COMMESSA = NULL)
- Tariffa progetto COM001: 600€/gg (ID_COMMESSA = COM001)

Risultato: 1.0 × 600€ = 600€ (usa la tariffa specifica del progetto)
```

### **Formattazione Display**
- **Visualizzazione**: Formato italiano con virgola decimali e punto migliaia (es: 1.250,75)
- **Esportazione CSV**: Solo virgola decimali senza separatori migliaia (es: 1250,75)
- **Calcoli interni**: Precisione decimale mantenuta fino al salvataggio

## �🔄 Miglioramenti Futuri

### **Funzionalità Pianificate**
- **Offline Mode**: Lavoro senza connessione
- **Export Excel**: Esportazione consuntivazioni
- **Notifiche Push**: Promemoria scadenze
- **Mobile App**: Applicazione nativa
- **Approvazione Manager**: Workflow approvazioni
- **Grafici Avanzati**: Dashboard con charts

### **Ottimizzazioni Tecniche**
- **Service Worker**: Cache per performance
- **PWA**: Installazione come app
- **WebSockets**: Aggiornamenti real-time
- **API Caching**: Cache intelligente dati

---

## 📞 Supporto

Per assistenza tecnica:
1. Controlla i log browser (F12)
2. Verifica connessione database
3. Consulta documentazione API principale
4. Contatta il team di sviluppo

**Versione**: 1.0.0  
**Data Creazione**: Agosto 2025  
**Ultima Modifica**: Agosto 2025