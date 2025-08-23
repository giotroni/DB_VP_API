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
        
        // Logout button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn') {
                e.preventDefault();
                this.handleLogout();
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
            this.loadUltimeConsuntivazioni()
        ]);
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
}

// Avvia l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    new ConsuntivazioneApp();
});