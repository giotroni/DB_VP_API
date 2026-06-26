# Documentazione: Funzionalità Admin/Manager per Visualizzazione Consuntivazioni

## Panoramica delle Modifiche

Sono state implementate le funzionalità per permettere agli utenti con ruolo **Admin** o **Manager** di visualizzare le consuntivazioni di altri collaboratori.

## Modifiche Apportate

### 1. Backend - Autenticazione (API/auth.php e API/AuthAPI.php)

#### Nuova Azione API: `get_collaboratori`
- **Endpoint**: `API/auth.php` con `action: 'get_collaboratori'`
- **Permessi**: Solo utenti con ruolo `Admin` o `Manager`
- **Funzione**: Restituisce la lista di tutti i collaboratori del sistema

#### Nuovo Metodo: `getCollaboratoriList()`
- Implementato nella classe `AuthAPI`
- Verifica automaticamente i permessi dell'utente corrente
- Restituisce i dati dei collaboratori (ID, Nome, Email, Ruolo, etc.)

### 2. Backend - API Consuntivazione (API/ConsuntivazioneAPI.php)

#### Metodi Modificati per Supportare il Parametro `collaboratore_id`:

1. **`getStatistiche($collaboratoreId = null)`**
   - Ora accetta un parametro `collaboratore_id` opzionale
   - Verifica i permessi se si richiede un collaboratore diverso
   - Solo Admin/Manager possono visualizzare statistiche di altri

2. **`getUltimeConsuntivazioni($limit = 10, $collaboratoreId = null)`**
   - Supporta la selezione del collaboratore
   - Controlli di sicurezza per l'accesso ai dati

3. **`cercaConsuntivazioni($anno, $mese, $commessaId, $collaboratoreId = null)`**
   - Filtro aggiuntivo per collaboratore
   - Mantiene tutti i filtri esistenti (anno, mese, commessa)

#### Case Statements Aggiornati:
- `get_statistiche`: Accetta `collaboratore_id` dal payload
- `get_ultime_consuntivazioni`: Accetta `collaboratore_id` dal payload  
- `cerca_consuntivazioni`: Accetta `collaboratore_id` dal payload

### 3. Frontend - JavaScript (assets/js/consuntivazione.js)

#### Nuove Proprietà della Classe `ConsuntivazioneApp`:
- `selectedCollaboratore`: ID del collaboratore attualmente selezionato
- `collaboratori`: Array con la lista di tutti i collaboratori (per Admin/Manager)

#### Nuovi Metodi:
1. **`isAdminOrManager()`**: Verifica se l'utente corrente è Admin o Manager
2. **`loadCollaboratori()`**: Carica la lista dei collaboratori per Admin/Manager
3. **`updateCollaboratoreSelector()`**: Popola il select per la scelta del collaboratore
4. **`onCollaboratoreChanged()`**: Gestisce il cambio di collaboratore selezionato
5. **`updatePageTitle()`**: Aggiorna il titolo per indicare di chi sono le consuntivazioni
6. **`shouldShowConsuntivazioneForm()`**: Determina se mostrare il form di inserimento

#### Interfaccia Utente Modificata:
- **Selettore Collaboratore**: Visibile solo per Admin/Manager
- **Form Consuntivazione**: Nascosto quando si visualizzano dati di altri collaboratori
- **Pulsanti Modifica/Elimina**: Attivi solo per le proprie consuntivazioni
- **Indicatore Visivo**: Mostra chiaramente di chi sono i dati visualizzati

#### Metodi di Caricamento Dati Aggiornati:
- `loadStatistiche()`: Invia `collaboratore_id` nell'API call
- `loadUltimeConsuntivazioni()`: Invia `collaboratore_id` nell'API call
- `cercaConsuntivazioni()`: Invia `collaboratore_id` nell'API call
- `esportaConsuntivazioni()`: Include nome collaboratore nel file esportato

### 4. Sicurezza Implementata

#### Controlli Lato Server:
- Verifica ruolo utente per ogni richiesta di dati di altri collaboratori
- Validazione del parametro `collaboratore_id`
- Messaggi di errore specifici per accesso negato

#### Controlli Lato Client:
- Interface elements mostrati solo se appropriati al ruolo
- Disabilitazione funzioni di modifica per dati altrui
- Indicatori visivi chiari per distinguere modalità visualizzazione

## Funzionalità per Tipologia Utente

### Utenti con Ruolo "User"
- **Accesso**: Solo alle proprie consuntivazioni
- **Funzionalità**: Complete (inserimento, modifica, eliminazione, visualizzazione)
- **Interfaccia**: Standard senza selettore collaboratore

### Utenti con Ruolo "Admin" o "Manager"
- **Accesso**: Proprie consuntivazioni + visualizzazione di tutti gli altri collaboratori
- **Funzionalità Proprie**: Complete (inserimento, modifica, eliminazione, visualizzazione)
- **Funzionalità Altri**: Solo visualizzazione (statistiche, ultime consuntivazioni, ricerca, esportazione)
- **Interfaccia**: Selettore collaboratore + indicatori modalità visualizzazione

## File di Test

È stato creato `test_admin_features.html` per testare le nuove funzionalità:
- Test di login con diversi ruoli
- Test caricamento lista collaboratori
- Test visualizzazione dati per collaboratore specifico

## Retrocompatibilità

Tutte le modifiche sono retrocompatibili:
- I metodi API esistenti continuano a funzionare senza parametri aggiuntivi
- Gli utenti "User" non vedono differenze nell'interfaccia
- I parametri aggiuntivi sono opzionali

## Utilizzo

### Per testare la funzionalità:
1. Effettuare login con un utente Admin o Manager
2. Verificare la presenza del selettore collaboratore nell'header
3. Selezionare un collaboratore diverso dal dropdown
4. Osservare il cambio dei dati visualizzati
5. Notare la disabilitazione del form di inserimento
6. Testare l'esportazione con nome file personalizzato

### Log di Debug:
Le chiamate API includono logging per debugging e troubleshooting delle funzionalità.