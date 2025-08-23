/**
 * App Consuntivazione V&P - JavaScript
 */

class ConsuntivazioneApp {
    constructor() {
        this.currentUser = null;
        this.commesse = [];
        this.tasks = [];
        this.statistiche = {};
        this.ultimeConsuntivazioni = [];
        
        this.init();
    }
    
    init() {
        // Controlla se l'utente è già autenticato
        this.checkAuthentication().then(() => {
            if (this.currentUser) {
               statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${this.statistiche.ore_mese || '0'}</div>
                <div class="stat-label">Giornate Questo Mese</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">€ ${this.statistiche.spese_mese || '0'}</div>
                <div class="stat-label">Spese del mese</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.statistiche.giorni_lavorati || '0'}</div>
                <div class="stat-label">Date inserite</div>
            </div>`;wDashboard();
                this.loadInitialData();
            } else {
                this.showLogin();
            }
        });
        
        // Event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Login form
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'loginForm') {
                e.preventDefault();
                this.handleLogin();
            }
        });
        
        // Logout and Change Password buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn') {
                e.preventDefault();
                this.handleLogout();
            }
            if (e.target.id === 'changePwdBtn') {
                e.preventDefault();
                this.showChangePasswordModal();
            }
        });
        
        // Form consuntivazione
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'consuntivazioneForm') {
                e.preventDefault();
                this.handleSalvaConsuntivazione();
            }
        });
        
        // Cambio commessa - aggiorna task
        document.addEventListener('change', (e) => {
            if (e.target.id === 'commessa') {
                this.loadTasksForCommessa(e.target.value);
            }
        });
        
        // Calcolo automatico totale spese
        document.addEventListener('input', (e) => {
            if (['speseViaggio', 'vittoAlloggio', 'altreSpese'].includes(e.target.id)) {
                this.calcolaTotaleSpese();
            }
        });
        
        // Reset form button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetForm') {
                e.preventDefault();
                this.resetForm();
            }
        });
    }
    
    async checkAuthentication() {
        try {
            const response = await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'check' })
            });
            
            const result = await response.json();
            
            if (result.success && result.authenticated) {
                this.currentUser = result.user;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Errore verifica autenticazione:', error);
            return false;
        }
    }
    
    showLogin() {
        const appContainer = document.getElementById('appContainer') || document.body;
        appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <img src="assets/images/logo_1.png" alt="V&P Logo" class="login-logo-img">
                        <h1 class="login-title">Accesso V&P Consuntivazione</h1>
                        <p class="login-subtitle">Inserisci le tue credenziali per accedere</p>
                    </div>
                    
                    <form id="loginForm">
                        <div class="form-group">
                            <label for="emailOrUsername" class="form-label">Email o User Name</label>
                            <input type="text" id="emailOrUsername" class="form-control" 
                                   placeholder="es. mario.rossi@company.com o username" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" id="password" class="form-control" placeholder="Password" required>
                        </div>
                        
                        <button type="submit" class="btn btn-vp-primary w-100" id="loginBtn">
                            🔓 Accedi
                        </button>
                        
                        <div class="forgot-password-link">
                            <a href="#" id="forgotPasswordLink">Password dimenticata?</a>
                        </div>
                    </form>
                    
                    <div id="loginMessage" class="mt-3"></div>
                </div>
            </div>
        `;
        
        // Event listener per "Password dimenticata"
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordForm();
        });
    }
    
    showForgotPasswordForm() {
        const appContainer = document.getElementById('appContainer') || document.body;
        appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-icon">
                            <i class="fas fa-key"></i>
                        </div>
                        <h1 class="login-title">🔑 Recupera Password</h1>
                        <p class="login-subtitle">Inserisci la tua email per ricevere una nuova password</p>
                    </div>
                    
                    <form id="forgotPasswordForm">
                        <div class="form-group">
                            <label for="resetEmail" class="form-label">Email</label>
                            <input type="email" id="resetEmail" class="form-control" 
                                   placeholder="es. mario.rossi@company.com" required>
                        </div>
                        
                        <div class="form-group">
                            <button type="submit" class="btn btn-primary" id="resetBtn">
                                📧 Invia Nuova Password
                            </button>
                            
                            <button type="button" class="btn btn-outline-secondary" id="backToLoginBtn">
                                ⬅️ Torna al Login
                            </button>
                        </div>
                    </form>
                    
                    <div id="resetMessage" class="mt-3"></div>
                </div>
            </div>
        `;
        
        // Event listener per tornare al login
        document.getElementById('backToLoginBtn').addEventListener('click', () => {
            this.showLogin();
        });
        
        // Event listener per il form di reset password
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
    }

    async handleForgotPassword() {
        const email = document.getElementById('resetEmail').value;
        const resetBtn = document.getElementById('resetBtn');
        const messageDiv = document.getElementById('resetMessage');
        
        // Disabilita il pulsante durante l'invio
        resetBtn.disabled = true;
        resetBtn.innerHTML = '⏳ Invio in corso...';
        
        try {
            const response = await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'reset_password',
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.innerHTML = `
                    <div class="alert alert-success">
                        ✅ Una nuova password è stata inviata alla tua email.
                        Controlla la tua casella di posta e poi torna al login.
                    </div>
                `;
                
                // Dopo 3 secondi torna automaticamente al login
                setTimeout(() => {
                    this.showLogin();
                }, 3000);
            } else {
                messageDiv.innerHTML = `
                    <div class="alert alert-danger">
                        ❌ ${data.message || 'Errore durante il reset della password'}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Errore reset password:', error);
            messageDiv.innerHTML = `
                <div class="alert alert-danger">
                    ❌ Errore di connessione. Riprova più tardi.
                </div>
            `;
        } finally {
            // Riabilita il pulsante
            resetBtn.disabled = false;
            resetBtn.innerHTML = '📧 Invia Nuova Password';
        }
    }
    
    showDashboard() {
        const appContainer = document.getElementById('appContainer') || document.body;
        appContainer.innerHTML = `
            <!-- Header V&P -->
            <header class="vp-header">
                <div class="container">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="vp-logo-container">
                                <img src="assets/images/white-logo.png" alt="Vaglio&Partners Logo" class="vp-logo-img-extended">
                                <div>
                                    <p class="vp-subtitle">Sistema di Consuntivazione</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="vp-user-info">
                                <p class="vp-user-welcome">Benvenuto, <span class="vp-user-name">${this.currentUser.name}</span></p>
                                <button id="changePwdBtn" class="btn btn-vp-secondary btn-sm me-2">
                                    <i class="fas fa-key me-1"></i>Cambia Pwd
                                </button>
                                <button id="logoutBtn" class="btn btn-vp-danger btn-sm">Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <!-- Main Content -->
            <div class="container mt-4">
                <div class="stats-grid" id="statsGrid">
                    <!-- Statistiche caricate dinamicamente -->
                </div>
                
                <div class="row">
                    <div class="col-12">
                        <div class="table-vp">
                            <div class="modal-header">
                                <h2 class="modal-title">
                                    <i class="fas fa-plus-circle me-2"></i>
                                    Consuntivazione Giornaliera
                                </h2>
                            </div>
                            <div class="modal-body">
                                <form id="consuntivazioneForm">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group mb-3">
                                                <label for="data" class="form-label">Data *</label>
                                                <input type="date" id="data" class="form-control" required>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-group mb-3">
                                                <label for="giornatelavorate" class="form-label">Giornate Lavorate *</label>
                                                <input type="number" id="giornatelavorate" class="form-control" 
                                                       min="0.1" max="1.0" step="0.1" value="1.0" required>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group mb-3">
                                                <label for="commessa" class="form-label">Progetto *</label>
                                                <select id="commessa" class="form-control" required>
                                                    <option value="">Seleziona progetto...</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-group mb-3">
                                                <label for="task" class="form-label">Task/Attività *</label>
                                                <select id="task" class="form-control" required>
                                                    <option value="">Prima seleziona un progetto</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <hr class="my-4">
                                    <h5 class="mb-3">
                                        <i class="fas fa-money-bill-wave me-2"></i>
                                        Spese Sostenute
                                    </h5>
                                    
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="form-group mb-3">
                                                <label for="speseViaggio" class="form-label">Spese Viaggio (€)</label>
                                                <input type="number" id="speseViaggio" class="form-control" 
                                                       min="0" step="0.01" value="0.00">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="form-group mb-3">
                                                <label for="vittoAlloggio" class="form-label">Vitto/Alloggio (€)</label>
                                                <input type="number" id="vittoAlloggio" class="form-control" 
                                                       min="0" step="0.01" value="0.00">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="form-group mb-3">
                                                <label for="altreSpese" class="form-label">Altre Spese (€)</label>
                                                <input type="number" id="altreSpese" class="form-control" 
                                                       min="0" step="0.01" value="0.00">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="alert alert-info">
                                        <strong>Totale Spese: € <span id="totaleSpese">0.00</span></strong>
                                    </div>
                                    
                                    <div class="form-group mb-3">
                                        <label for="note" class="form-label">Note</label>
                                        <textarea id="note" class="form-control" rows="4"
                                                placeholder="Descrivi le attività svolte, dettagli sui clienti incontrati, obiettivi raggiunti, spese sostenute..."></textarea>
                                    </div>
                                    
                                    <div class="d-flex justify-content-between">
                                        <button type="button" id="resetForm" class="btn btn-vp-secondary">
                                            <i class="fas fa-undo me-2"></i> Reset Form
                                        </button>
                                        <button type="submit" class="btn btn-vp-primary">
                                            <i class="fas fa-save me-2"></i> Salva Consuntivazione
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sezione Riepilogo Giornate -->
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="table-vp">
                            <div class="modal-header">
                                <h2 class="modal-title">
                                    <i class="fas fa-history me-2"></i>
                                    Ultime Consuntivazioni
                                </h2>
                            </div>
                            <div class="modal-body">
                                <div id="ultimeConsuntivazioni" class="table-responsive">
                                    <!-- Lista caricata dinamicamente -->
                                    <div class="text-center text-muted">
                                        <i class="fas fa-spinner fa-spin me-2"></i>
                                        Caricamento consuntivazioni in corso...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sezione Consultazione Consuntivazioni -->
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="table-vp">
                            <div class="modal-header">
                                <h2 class="modal-title">
                                    <i class="fas fa-search me-2"></i>
                                    Consulta Consuntivazioni
                                </h2>
                            </div>
                            <div class="modal-body">
                                <!-- Filtri -->
                                <div class="row mb-3">
                                    <div class="col-md-3">
                                        <label for="filterAnno" class="form-label">Anno</label>
                                        <select id="filterAnno" class="form-control">
                                            <option value="">Tutti gli anni</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label for="filterMese" class="form-label">Mese</label>
                                        <select id="filterMese" class="form-control">
                                            <option value="">Tutti i mesi</option>
                                            <option value="1">Gennaio</option>
                                            <option value="2">Febbraio</option>
                                            <option value="3">Marzo</option>
                                            <option value="4">Aprile</option>
                                            <option value="5">Maggio</option>
                                            <option value="6">Giugno</option>
                                            <option value="7">Luglio</option>
                                            <option value="8">Agosto</option>
                                            <option value="9">Settembre</option>
                                            <option value="10">Ottobre</option>
                                            <option value="11">Novembre</option>
                                            <option value="12">Dicembre</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label for="filterCommessa" class="form-label">Progetto</label>
                                        <select id="filterCommessa" class="form-control">
                                            <option value="">Tutti i progetti</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3 d-flex align-items-end">
                                        <button id="btnRicerca" class="btn btn-primary me-2">
                                            <i class="fas fa-search me-1"></i>
                                            Cerca
                                        </button>
                                        <button id="btnEsporta" class="btn btn-outline-primary">
                                            <i class="fas fa-download me-1"></i>
                                            Esporta
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Risultati -->
                                <div id="consuntivazioni-risultati" class="table-responsive">
                                    <div class="text-center text-muted py-4">
                                        <i class="fas fa-info-circle me-2"></i>
                                        Seleziona i filtri e clicca "Cerca" per visualizzare le consuntivazioni
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Messagi di sistema -->
                <div id="message" class="mt-3"></div>
            </div>
        `;
        
        // Imposta data di oggi come default
        document.getElementById('data').value = new Date().toISOString().split('T')[0];
        
        // Calcola totale spese iniziale
        this.calcolaTotaleSpese();
    }
    
    async handleLogin() {
        const emailOrUsername = document.getElementById('emailOrUsername').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const messageDiv = document.getElementById('loginMessage');
        
        // Disabilita il pulsante e mostra loading
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="loading-spinner"></span> Accesso in corso...';
        
        try {
            const response = await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login',
                    email: emailOrUsername,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentUser = result.user;
                this.showMessage('Login effettuato con successo!', 'success', messageDiv);
                
                // Aspetta un momento e poi carica il dashboard
                setTimeout(() => {
                    this.showDashboard();
                    this.loadInitialData();
                }, 1000);
            } else {
                this.showMessage(result.message, 'danger', messageDiv);
            }
        } catch (error) {
            this.showMessage('Errore di connessione. Riprova.', 'danger', messageDiv);
            console.error('Errore login:', error);
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '🔓 Accedi';
        }
    }
    
    async handleLogout() {
        try {
            await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'logout' })
            });
            
            this.currentUser = null;
            this.showLogin();
        } catch (error) {
            console.error('Errore logout:', error);
        }
    }
    
    async loadInitialData() {
        await Promise.all([
            this.loadStatistiche(),
            this.loadCommesse(),
            this.loadUltimeConsuntivazioni(),
            this.loadAnniConsuntivazioni(),
            this.loadComessePerFiltri()
        ]);
        this.initConsultazionePage();
    }
    
    async loadStatistiche() {
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'get_statistiche' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.statistiche = result.data;
                this.updateStatsGrid();
            }
        } catch (error) {
            console.error('Errore caricamento statistiche:', error);
        }
    }
    
    updateStatsGrid() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${this.statistiche.ore_mese || '0'}</div>
                <div class="stat-label">Giornate nel Mese</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">€ ${this.statistiche.spese_mese || '0'}</div>
                <div class="stat-label">Spese del mese</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.statistiche.giorni_lavorati || '0'}</div>
                <div class="stat-label">Date nel mese</div>
            </div>
        `;
    }
    
    async loadCommesse() {
        try {
            console.log('Loading commesse...');
            const response = await fetch('API/ConsuntivazioneAPISimple.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'get_commesse' })
            });
            
            console.log('Commesse response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const rawText = await response.text();
            console.log('Raw response text:', rawText.substring(0, 200) + '...');
            
            // Prova a pulire la risposta da eventuali caratteri extra
            let cleanText = rawText.trim();
            
            // Trova l'inizio del JSON
            const jsonStart = cleanText.indexOf('{');
            if (jsonStart > 0) {
                cleanText = cleanText.substring(jsonStart);
                console.log('Cleaned text:', cleanText.substring(0, 100) + '...');
            }
            
            const result = JSON.parse(cleanText);
            console.log('Commesse result:', result);
            
            if (result.success) {
                this.commesse = result.data;
                this.updateCommesseSelect();
                console.log('Commesse caricate:', this.commesse.length);
            } else {
                console.error('Errore API commesse:', result.message);
                this.showMessage('Errore nel caricamento delle commesse: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Errore caricamento commesse:', error);
            this.showMessage('Errore di connessione nel caricamento delle commesse: ' + error.message, 'danger');
        }
    }
    
    updateCommesseSelect() {
        const commessaSelect = document.getElementById('commessa');
        if (!commessaSelect) return;
        
        commessaSelect.innerHTML = '<option value="">Seleziona progetto...</option>';
        
        this.commesse.forEach(commessa => {
            const option = document.createElement('option');
            option.value = commessa.ID_COMMESSA;
            option.textContent = `${commessa.Commessa} - ${commessa.Cliente || 'Interno'}`;
            commessaSelect.appendChild(option);
        });
    }
    
    async loadTasksForCommessa(commessaId) {
        const taskSelect = document.getElementById('task');
        if (!taskSelect) return;
        
        taskSelect.innerHTML = '<option value="">Caricamento...</option>';
        
        if (!commessaId) {
            taskSelect.innerHTML = '<option value="">Prima seleziona un progetto</option>';
            return;
        }
        
        try {
            console.log('Loading tasks for commessa:', commessaId);
            const response = await fetch('API/ConsuntivazioneAPISimple.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_tasks',
                    commessa_id: commessaId
                })
            });
            
            console.log('Tasks response status:', response.status);
            const result = await response.json();
            console.log('Tasks result:', result);
            
            if (result.success) {
                this.tasks = result.data;
                this.updateTasksSelect();
                console.log('Tasks caricati:', this.tasks.length);
            } else {
                console.error('Errore API tasks:', result.message);
                taskSelect.innerHTML = '<option value="">Errore caricamento task</option>';
            }
        } catch (error) {
            console.error('Errore caricamento task:', error);
            taskSelect.innerHTML = '<option value="">Errore caricamento task</option>';
        }
    }
    
    updateTasksSelect() {
        const taskSelect = document.getElementById('task');
        if (!taskSelect) return;
        
        taskSelect.innerHTML = '<option value="">Seleziona task/attività...</option>';
        
        this.tasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.ID_TASK;
            option.textContent = `${task.Task} (${task.Tipo})`;
            taskSelect.appendChild(option);
        });
    }
    
    calcolaTotaleSpese() {
        const speseViaggio = parseFloat(document.getElementById('speseViaggio')?.value || 0);
        const vittoAlloggio = parseFloat(document.getElementById('vittoAlloggio')?.value || 0);
        const altreSpese = parseFloat(document.getElementById('altreSpese')?.value || 0);
        
        const totale = speseViaggio + vittoAlloggio + altreSpese;
        
        const totaleElement = document.getElementById('totaleSpese');
        if (totaleElement) {
            totaleElement.textContent = `Totale Spese: € ${totale.toFixed(2)}`;
        }
    }
    
    async handleSalvaConsuntivazione() {
        const form = document.getElementById('consuntivazioneForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Disabilita il pulsante
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Salvataggio...';
        
        // Raccoglie i dati del form
        const formData = {
            action: 'salva_consuntivazione',
            data: document.getElementById('data').value,
            giornate_lavorate: parseFloat(document.getElementById('giornatelavorate').value),
            commessa: document.getElementById('commessa').value,
            task: document.getElementById('task').value,
            spese_viaggio: parseFloat(document.getElementById('speseViaggio').value || 0),
            vitto_alloggio: parseFloat(document.getElementById('vittoAlloggio').value || 0),
            altre_spese: parseFloat(document.getElementById('altreSpese').value || 0),
            note: document.getElementById('note').value.trim()
        };
        
        console.log('Saving consuntivazione:', formData);
        
        try {
            const response = await fetch('API/ConsuntivazioneAPISimple.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            console.log('Save response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const rawText = await response.text();
            console.log('Save raw response:', rawText.substring(0, 200) + '...');
            
            // Pulisci la risposta
            let cleanText = rawText.trim();
            const jsonStart = cleanText.indexOf('{');
            if (jsonStart > 0) {
                cleanText = cleanText.substring(jsonStart);
            }
            
            const result = JSON.parse(cleanText);
            console.log('Save result:', result);
            
            if (result.success) {
                this.showMessage('Consuntivazione salvata con successo!', 'success');
                this.resetForm();
                
                // Ricarica dati
                await Promise.all([
                    this.loadStatistiche(),
                    this.loadUltimeConsuntivazioni()
                ]);
            } else {
                let errorMessage = result.message;
                if (result.errors && result.errors.length > 0) {
                    errorMessage += '\\n' + result.errors.join('\\n');
                }
                this.showMessage(errorMessage, 'danger');
            }
        } catch (error) {
            this.showMessage('Errore durante il salvataggio. Riprova.', 'danger');
            console.error('Errore salvataggio:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
    
    async loadUltimeConsuntivazioni() {
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_ultime_consuntivazioni',
                    limit: 10
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.ultimeConsuntivazioni = result.data;
                this.updateUltimeConsuntivazioni();
            }
        } catch (error) {
            console.error('Errore caricamento ultime consuntivazioni:', error);
        }
    }
    
    updateUltimeConsuntivazioni() {
        const container = document.getElementById('ultimeConsuntivazioni');
        if (!container) return;
        
        if (this.ultimeConsuntivazioni.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Nessuna consuntivazione trovata</p>';
            return;
        }
        
        container.innerHTML = this.ultimeConsuntivazioni.map(cons => `
            <div class="consuntivazione-item">
                <div class="consuntivazione-header">
                    <div class="consuntivazione-data">${this.formatDate(cons.Data)}</div>
                    <div class="consuntivazione-ore">${cons.gg} gg</div>
                    <div class="consuntivazione-status">
                        ${cons.Confermata === 'Si' ? 
                            '<span class="badge bg-success">Confermata</span>' : 
                            '<span class="badge bg-warning text-dark">Non Confermata</span>'
                        }
                    </div>
                </div>
                <div class="consuntivazione-details">
                    <strong>${cons.Task}</strong> - ${cons.Commessa}<br>
                    <small>${cons.Cliente || 'Progetto interno'}</small>
                </div>
                ${cons.Note ? `<div class="mt-1"><small><em>"${cons.Note}"</em></small></div>` : ''}
                <div class="consuntivazione-spese">
                    <span>Viaggi: € ${parseFloat(cons.Spese_Viaggi || 0).toFixed(2)}</span>
                    <span>Vitto: € ${parseFloat(cons.Vitto_alloggio || 0).toFixed(2)}</span>
                    <span>Altre: € ${parseFloat(cons.Altri_costi || 0).toFixed(2)}</span>
                    <strong>Tot: € ${parseFloat(cons.Totale_Spese || 0).toFixed(2)}</strong>
                </div>
                ${cons.Confermata === 'No' ? `
                    <div class="consuntivazione-actions mt-2">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="app.editConsuntivazione('${cons.ID_GIORNATA}')">
                            <i class="fas fa-edit me-1"></i>Modifica
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteConsuntivazione('${cons.ID_GIORNATA}')">
                            <i class="fas fa-trash me-1"></i>Elimina
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    resetForm() {
        const form = document.getElementById('consuntivazioneForm');
        if (form) {
            form.reset();
            
            // Reimposta data di oggi
            document.getElementById('data').value = new Date().toISOString().split('T')[0];
            document.getElementById('giornatelavorate').value = '1.0';
            
            // Reset tasks select
            const taskSelect = document.getElementById('task');
            taskSelect.innerHTML = '<option value="">Prima seleziona un progetto</option>';
            
            // Ricalcola totale spese
            this.calcolaTotaleSpese();
        }
    }
    
    showMessage(message, type, container = null) {
        const messageContainer = container || document.getElementById('message');
        if (!messageContainer) return;
        
        const alertClass = `alert alert-${type}`;
        messageContainer.innerHTML = `
            <div class="${alertClass}">
                ${message}
            </div>
        `;
        
        // Rimuovi il messaggio dopo 5 secondi
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 5000);
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    // ========== METODI PER CONSULTAZIONE CONSUNTIVAZIONI ==========
    
    async loadAnniConsuntivazioni() {
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_anni_consuntivazioni'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.anniDisponibili = result.data;
            }
        } catch (error) {
            console.error('Errore caricamento anni:', error);
        }
    }
    
    async loadComessePerFiltri() {
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_commesse'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.commessePerFiltri = result.data;
            }
        } catch (error) {
            console.error('Errore caricamento commesse per filtri:', error);
        }
    }
    
    initConsultazionePage() {
        // Popola select degli anni
        const selectAnno = document.getElementById('filterAnno');
        if (selectAnno && this.anniDisponibili) {
            this.anniDisponibili.forEach(item => {
                const option = document.createElement('option');
                option.value = item.anno;
                option.textContent = item.anno;
                selectAnno.appendChild(option);
            });
        }
        
        // Popola select delle commesse
        const selectCommessa = document.getElementById('filterCommessa');
        if (selectCommessa && this.commessePerFiltri) {
            this.commessePerFiltri.forEach(commessa => {
                const option = document.createElement('option');
                option.value = commessa.ID_COMMESSA;
                option.textContent = `${commessa.Commessa} - ${commessa.Cliente}`;
                selectCommessa.appendChild(option);
            });
        }
        
        // Aggiungi event listeners
        const btnRicerca = document.getElementById('btnRicerca');
        if (btnRicerca) {
            btnRicerca.addEventListener('click', () => this.cercaConsuntivazioni());
        }
        
        const btnEsporta = document.getElementById('btnEsporta');
        if (btnEsporta) {
            btnEsporta.addEventListener('click', () => this.esportaConsuntivazioni());
        }
    }
    
    async cercaConsuntivazioni() {
        const anno = document.getElementById('filterAnno').value;
        const mese = document.getElementById('filterMese').value;
        const commessaId = document.getElementById('filterCommessa').value;
        const risultatiDiv = document.getElementById('consuntivazioni-risultati');
        
        // Mostra loading
        risultatiDiv.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-spinner fa-spin me-2"></i>
                Ricerca in corso...
            </div>
        `;
        
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'cerca_consuntivazioni',
                    anno: anno || null,
                    mese: mese || null,
                    commessa_id: commessaId || null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.mostraRisultatiRicerca(result.data);
            } else {
                risultatiDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${result.message}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Errore ricerca consuntivazioni:', error);
            risultatiDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-times me-2"></i>
                    Errore durante la ricerca. Riprova.
                </div>
            `;
        }
    }
    
    mostraRisultatiRicerca(data) {
        const risultatiDiv = document.getElementById('consuntivazioni-risultati');
        const { consuntivazioni, statistiche, raggruppamento_mese } = data;
        
        if (consuntivazioni.length === 0) {
            risultatiDiv.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-search me-2"></i>
                    Nessuna consuntivazione trovata con i filtri selezionati
                </div>
            `;
            return;
        }
        
        let html = `
            <!-- Statistiche Generali -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h5>${statistiche.numero_consuntivazioni}</h5>
                            <small>Consuntivazioni Trovate</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h5>${statistiche.totale_giornate.toFixed(1)}</h5>
                            <small>Totale Giornate</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center">
                            <h5>€ ${statistiche.totale_spese.toFixed(2)}</h5>
                            <small>Totale Spese</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Raggruppamento per mese se presente
        if (raggruppamento_mese.length > 1) {
            html += `
                <h6 class="mb-3">
                    <i class="fas fa-calendar-alt me-2"></i>
                    Riepilogo per Mese
                </h6>
                <div class="table-responsive mb-4">
                    <table class="table table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>Mese</th>
                                <th class="text-center">Consuntivazioni</th>
                                <th class="text-center">Giornate</th>
                                <th class="text-end">Spese</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            raggruppamento_mese.forEach(mese => {
                html += `
                    <tr>
                        <td>${mese.nome_mese} ${mese.anno}</td>
                        <td class="text-center">${mese.count}</td>
                        <td class="text-center">${mese.giornate.toFixed(1)}</td>
                        <td class="text-end">€ ${mese.spese.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Tabella dettagliata delle consuntivazioni
        html += `
            <h6 class="mb-3">
                <i class="fas fa-list me-2"></i>
                Dettaglio Consuntivazioni
            </h6>
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>Data</th>
                            <th>Progetto</th>
                            <th>Task</th>
                            <th class="text-center">Giorni</th>
                            <th class="text-end">Spese</th>
                            <th class="text-center">Stato</th>
                            <th>Note</th>
                            <th class="text-center">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        consuntivazioni.forEach(cons => {
            html += `
                <tr>
                    <td>${this.formatDate(cons.Data)}</td>
                    <td>
                        <strong>${cons.Commessa}</strong><br>
                        <small class="text-muted">${cons.Cliente || 'Progetto interno'}</small>
                    </td>
                    <td>${cons.Task}</td>
                    <td class="text-center">
                        <span class="badge bg-primary">${cons.gg}</span>
                    </td>
                    <td class="text-end">
                        € ${parseFloat(cons.Totale_Spese || 0).toFixed(2)}
                    </td>
                    <td class="text-center">
                        ${cons.Confermata === 'Si' ? 
                            '<span class="badge bg-success">Confermata</span>' : 
                            '<span class="badge bg-warning text-dark">Non Confermata</span>'
                        }
                    </td>
                    <td>
                        ${cons.Note ? `<small>${cons.Note}</small>` : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-center">
                        ${cons.Confermata === 'No' ? `
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="app.editConsuntivazione('${cons.ID_GIORNATA}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="app.deleteConsuntivazione('${cons.ID_GIORNATA}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : '<span class="text-muted">-</span>'}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        risultatiDiv.innerHTML = html;
    }
    
    async esportaConsuntivazioni() {
        const anno = document.getElementById('filterAnno').value;
        const mese = document.getElementById('filterMese').value;
        const commessaId = document.getElementById('filterCommessa').value;
        
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'cerca_consuntivazioni',
                    anno: anno || null,
                    mese: mese || null,
                    commessa_id: commessaId || null
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data.consuntivazioni.length > 0) {
                this.downloadCSV(result.data.consuntivazioni, 'consuntivazioni_export.csv');
            } else {
                alert('Nessun dato da esportare con i filtri selezionati');
            }
        } catch (error) {
            console.error('Errore esportazione:', error);
            alert('Errore durante l\'esportazione');
        }
    }
    
    downloadCSV(data, filename) {
        const headers = ['Data', 'Progetto', 'Cliente', 'Task', 'Giorni', 'Spese Viaggio', 'Vitto/Alloggio', 'Altre Spese', 'Totale Spese', 'Note'];
        
        let csvContent = headers.join(';') + '\n';
        
        data.forEach(row => {
            const csvRow = [
                this.formatDate(row.Data),
                `"${row.Commessa || ''}"`,
                `"${row.Cliente || ''}"`,
                `"${row.Task || ''}"`,
                row.gg,
                row.Spese_Viaggi || 0,
                row.Vitto_alloggio || 0,
                row.Altri_costi || 0,
                row.Totale_Spese || 0,
                `"${row.Note || ''}"`
            ].join(';');
            csvContent += csvRow + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // ========== METODI PER EDITING E CANCELLAZIONE ==========
    
    async editConsuntivazione(idGiornata) {
        try {
            // Carica i dati della consuntivazione
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_consuntivazione',
                    id_giornata: idGiornata
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showEditModal(result.data);
            } else {
                alert('Errore: ' + result.message);
            }
        } catch (error) {
            console.error('Errore caricamento consuntivazione:', error);
            alert('Errore durante il caricamento della consuntivazione');
        }
    }
    
    showEditModal(consuntivazione) {
        const modalHtml = `
            <div class="modal fade" id="editModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>
                                Modifica Consuntivazione
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editForm">
                                <input type="hidden" id="editIdGiornata" value="${consuntivazione.ID_GIORNATA}">
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group mb-3">
                                            <label for="editData" class="form-label">Data *</label>
                                            <input type="date" id="editData" class="form-control" 
                                                   value="${consuntivazione.Data}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group mb-3">
                                            <label for="editGiornate" class="form-label">Giornate *</label>
                                            <input type="number" id="editGiornate" class="form-control" 
                                                   min="0.1" max="2" step="0.1" value="${consuntivazione.gg}" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group mb-3">
                                            <label for="editCommessa" class="form-label">Progetto *</label>
                                            <select id="editCommessa" class="form-control" required>
                                                <option value="">Seleziona progetto...</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group mb-3">
                                            <label for="editTask" class="form-label">Task/Attività *</label>
                                            <select id="editTask" class="form-control" required>
                                                <option value="">Prima seleziona un progetto</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <hr class="my-4">
                                <h6 class="mb-3">
                                    <i class="fas fa-money-bill-wave me-2"></i>
                                    Spese Sostenute
                                </h6>
                                
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="form-group mb-3">
                                            <label for="editSpeseViaggio" class="form-label">Spese Viaggio (€)</label>
                                            <input type="number" id="editSpeseViaggio" class="form-control" 
                                                   min="0" step="0.01" value="${consuntivazione.Spese_Viaggi}">
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group mb-3">
                                            <label for="editVittoAlloggio" class="form-label">Vitto/Alloggio (€)</label>
                                            <input type="number" id="editVittoAlloggio" class="form-control" 
                                                   min="0" step="0.01" value="${consuntivazione.Vitto_alloggio}">
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group mb-3">
                                            <label for="editAltreSpese" class="form-label">Altre Spese (€)</label>
                                            <input type="number" id="editAltreSpese" class="form-control" 
                                                   min="0" step="0.01" value="${consuntivazione.Altri_costi}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label for="editNote" class="form-label">Note</label>
                                    <textarea id="editNote" class="form-control" rows="3">${consuntivazione.Note || ''}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="app.saveEdit()">
                                <i class="fas fa-save me-1"></i>Salva Modifiche
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente e aggiungi il nuovo
        const existingModal = document.getElementById('editModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Popola le select
        this.populateEditSelects(consuntivazione);
        
        // Mostra il modal
        const modal = new bootstrap.Modal(document.getElementById('editModal'));
        modal.show();
    }
    
    async populateEditSelects(consuntivazione) {
        // Popola commesse
        const commessaSelect = document.getElementById('editCommessa');
        if (this.commesse) {
            this.commesse.forEach(commessa => {
                const option = document.createElement('option');
                option.value = commessa.ID_COMMESSA;
                option.textContent = `${commessa.Commessa} - ${commessa.Cliente}`;
                if (commessa.ID_COMMESSA == consuntivazione.ID_COMMESSA) {
                    option.selected = true;
                }
                commessaSelect.appendChild(option);
            });
        }
        
        // Carica tasks per la commessa selezionata
        if (consuntivazione.ID_COMMESSA) {
            await this.loadTasksForEdit(consuntivazione.ID_COMMESSA, consuntivazione.ID_TASK);
        }
        
        // Event listener per cambio commessa
        commessaSelect.addEventListener('change', (e) => {
            this.loadTasksForEdit(e.target.value);
        });
    }
    
    async loadTasksForEdit(commessaId, selectedTaskId = null) {
        const taskSelect = document.getElementById('editTask');
        taskSelect.innerHTML = '<option value="">Caricamento tasks...</option>';
        
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_tasks',
                    commessa_id: commessaId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskSelect.innerHTML = '<option value="">Seleziona task...</option>';
                result.data.forEach(task => {
                    const option = document.createElement('option');
                    option.value = task.ID_TASK;
                    option.textContent = task.Task;
                    if (task.ID_TASK == selectedTaskId) {
                        option.selected = true;
                    }
                    taskSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Errore caricamento tasks:', error);
            taskSelect.innerHTML = '<option value="">Errore caricamento</option>';
        }
    }
    
    async saveEdit() {
        const formData = {
            id_giornata: document.getElementById('editIdGiornata').value,
            data: document.getElementById('editData').value,
            gg: document.getElementById('editGiornate').value,
            id_task: document.getElementById('editTask').value,
            spese_viaggi: document.getElementById('editSpeseViaggio').value || 0,
            vitto_alloggio: document.getElementById('editVittoAlloggio').value || 0,
            altri_costi: document.getElementById('editAltreSpese').value || 0,
            note: document.getElementById('editNote').value
        };
        
        // Validazione
        if (!formData.data || !formData.gg || !formData.id_task) {
            alert('Compila tutti i campi obbligatori');
            return;
        }
        
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'update_consuntivazione',
                    ...formData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Chiudi modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
                modal.hide();
                
                // Ricarica dati
                this.loadInitialData();
                
                alert('Consuntivazione aggiornata con successo!');
            } else {
                alert('Errore: ' + result.message);
            }
        } catch (error) {
            console.error('Errore salvataggio:', error);
            alert('Errore durante il salvataggio');
        }
    }
    
    async deleteConsuntivazione(idGiornata) {
        if (!confirm('Sei sicuro di voler cancellare questa consuntivazione? L\'operazione non può essere annullata.')) {
            return;
        }
        
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete_consuntivazione',
                    id_giornata: idGiornata
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Ricarica dati
                this.loadInitialData();
                alert('Consuntivazione cancellata con successo!');
            } else {
                alert('Errore: ' + result.message);
            }
        } catch (error) {
            console.error('Errore cancellazione:', error);
            alert('Errore durante la cancellazione');
        }
    }
    
    // ========== METODI PER CAMBIO PASSWORD ==========
    
    showChangePasswordModal() {
        const modalHtml = `
            <div class="modal fade" id="changePwdModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-key me-2"></i>
                                Cambia Password
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="changePwdForm">
                                <div class="form-group mb-3">
                                    <label for="currentPassword" class="form-label">Password Attuale *</label>
                                    <div class="input-group">
                                        <input type="password" id="currentPassword" class="form-control" required>
                                        <button class="btn btn-outline-secondary" type="button" 
                                                onclick="app.togglePasswordVisibility('currentPassword', this)">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label for="newPassword" class="form-label">Nuova Password *</label>
                                    <div class="input-group">
                                        <input type="password" id="newPassword" class="form-control" 
                                               minlength="6" required>
                                        <button class="btn btn-outline-secondary" type="button" 
                                                onclick="app.togglePasswordVisibility('newPassword', this)">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                    <div class="form-text">La password deve essere lunga almeno 6 caratteri</div>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label for="confirmPassword" class="form-label">Conferma Nuova Password *</label>
                                    <div class="input-group">
                                        <input type="password" id="confirmPassword" class="form-control" 
                                               minlength="6" required>
                                        <button class="btn btn-outline-secondary" type="button" 
                                                onclick="app.togglePasswordVisibility('confirmPassword', this)">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div id="passwordMessage" class="mt-3"></div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="app.changePassword()">
                                <i class="fas fa-save me-1"></i>Cambia Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente e aggiungi il nuovo
        const existingModal = document.getElementById('changePwdModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Aggiungi validazione in tempo reale
        this.setupPasswordValidation();
        
        // Mostra il modal
        const modal = new bootstrap.Modal(document.getElementById('changePwdModal'));
        modal.show();
    }
    
    setupPasswordValidation() {
        const newPasswordField = document.getElementById('newPassword');
        const confirmPasswordField = document.getElementById('confirmPassword');
        const messageDiv = document.getElementById('passwordMessage');
        
        function validatePasswords() {
            const newPassword = newPasswordField.value;
            const confirmPassword = confirmPasswordField.value;
            
            messageDiv.innerHTML = '';
            
            // Controlla lunghezza minima
            if (newPassword.length > 0 && newPassword.length < 6) {
                messageDiv.innerHTML = '<div class="alert alert-warning">La password deve essere lunga almeno 6 caratteri</div>';
                return false;
            }
            
            // Controlla se le password coincidono
            if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
                messageDiv.innerHTML = '<div class="alert alert-danger">Le password non coincidono</div>';
                return false;
            }
            
            // Password valide
            if (newPassword.length >= 6 && newPassword === confirmPassword && confirmPassword.length > 0) {
                messageDiv.innerHTML = '<div class="alert alert-success">Password valida e confermata</div>';
                return true;
            }
            
            return false;
        }
        
        newPasswordField.addEventListener('input', validatePasswords);
        confirmPasswordField.addEventListener('input', validatePasswords);
    }
    
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const messageDiv = document.getElementById('passwordMessage');
        
        // Validazioni lato client
        if (!currentPassword || !newPassword || !confirmPassword) {
            messageDiv.innerHTML = '<div class="alert alert-danger">Compila tutti i campi</div>';
            return;
        }
        
        if (newPassword.length < 6) {
            messageDiv.innerHTML = '<div class="alert alert-danger">La password deve essere lunga almeno 6 caratteri</div>';
            return;
        }
        
        if (newPassword !== confirmPassword) {
            messageDiv.innerHTML = '<div class="alert alert-danger">Le password non coincidono</div>';
            return;
        }
        
        // Disabilita il pulsante e mostra loading
        const saveBtn = document.querySelector('#changePwdModal .btn-primary');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading-spinner"></span> Cambiando password...';
        
        try {
            const response = await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'change_password',
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Chiudi modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePwdModal'));
                modal.hide();
                
                // Mostra messaggio di successo
                alert('Password cambiata con successo! È stata inviata una email di conferma.');
            } else {
                messageDiv.innerHTML = `<div class="alert alert-danger">${result.message}</div>`;
            }
        } catch (error) {
            console.error('Errore cambio password:', error);
            messageDiv.innerHTML = '<div class="alert alert-danger">Errore durante il cambio password. Riprova.</div>';
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
    
    /**
     * Toggle visibility della password
     */
    togglePasswordVisibility(inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
            button.title = 'Nascondi password';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
            button.title = 'Mostra password';
        }
    }
}

// Variabile globale per accesso dall'HTML
let app;

// Avvia l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    app = new ConsuntivazioneApp();
});