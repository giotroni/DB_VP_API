/**
 * App Management V&P - JavaScript (Refactored)
 * @version 2.4 - Aggiunta gestione password dimenticata
 */
class ManagementApp {
    
    constructor() {
        // --- Stato dell'Applicazione ---
        this.currentUser = null;
        this.currentSection = 'commesse-task';
        this.sidebarCollapsed = true;

        // --- Moduli e Componenti ---
        this.api = new APIClient();
        this.ui = UIComponents;
        this.utils = Utils;

        // --- Cache dei Dati Globali ---
        this.commesse = [];
        this.tasks = [];
        this.giornate = [];
        this.clienti = [];
        this.collaboratori = [];
        this.tariffe = [];
        this.fatture = [];
        this.fatture_collaboratori = []; // DISABILITATO - non viene caricato

        // --- Inizializzazione delle Sezioni Modulari ---
        this.sections = {
            'commesse-task': new CommesseTaskSection(this),
            'clienti': new ClientiSection(this),
            'collaboratori': new CollaboratoriSection(this),
            'fatture': new FattureSection(this),
            // 'fatture-collaboratori': new FattureCollaboratoriSection(this), // DISABILITATO
            'giornate': new GiornateSection(this),
            'statistiche': new StatisticheSection(this),
        };

        this.init();
    }

    async init() {
        const authenticated = await this.checkAuthentication();
        if (authenticated) {
            this.showDashboard();
            await this.loadInitialData();
        } else {
            this.showLogin();
        }
        this.setupEventListeners();
        window.addEventListener('resize', () => this.handleResize());
    }

    // ========================================================================
    // SEZIONE 1: AUTENTICAZIONE E GESTIONE UTENTE
    // ========================================================================

    async checkAuthentication() {
        try {
            const result = await this.api.checkAuth();
            if (result.success && result.authenticated) {
                this.currentUser = result.user;
                return true;
            }
            this.currentUser = null;
            return false;
        } catch (error) {
            console.error('Errore controllo autenticazione:', error);
            this.ui.showToast('Sessione scaduta o non valida.', 'error');
            return false;
        }
    }

    async handleLogin() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorDiv = document.getElementById('loginError');

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        errorDiv.classList.add('d-none');

        if (!username || !password) {
            errorDiv.textContent = 'Per favore, inserisci username e password.';
            errorDiv.classList.remove('d-none');
            return;
        }

        try {
            const result = await this.api.login(username, password);

            if (result.success && result.user) {
                this.ui.showToast('Login effettuato con successo!', 'success');
                this.currentUser = result.user;

                this.showDashboard();
                await this.loadInitialData();
            } else {
                errorDiv.textContent = result.message || 'Credenziali non valide. Riprova.';
                errorDiv.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Errore durante il login:', error);
            this.ui.showToast('Errore di connessione con il server.', 'error');
            errorDiv.textContent = 'Errore di connessione. Riprova più tardi.';
            errorDiv.classList.remove('d-none');
        }
    }
    
    // NUOVO: Metodo per gestire la richiesta di recupero password
    handleForgotPasswordClick() {
        const modalId = 'forgotPasswordModal';
        const content = `
            <p>Inserisci il tuo indirizzo email per ricevere una nuova password temporanea. Ti verrà richiesto di cambiarla al primo accesso.</p>
            <form id="forgotPasswordForm" onsubmit="return false;">
                <div class="mb-3">
                    <label for="forgotEmail" class="form-label">Indirizzo Email</label>
                    <input type="email" class="form-control" id="forgotEmail" required placeholder="mario.rossi@example.com">
                </div>
            </form>
        `;

        const actions = [{
            html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>'
        }, {
            html: `<button type="button" class="btn btn-vp-primary" id="sendResetEmailBtn">Invia Istruzioni</button>`,
            selector: '#sendResetEmailBtn',
            handler: async () => {
                const emailInput = document.getElementById('forgotEmail');
                const email = emailInput.value.trim();
                const modalInstance = bootstrap.Modal.getInstance(document.getElementById(modalId));

                if (!this.utils.validateEmail(email)) {
                    this.ui.showToast('Per favore, inserisci un indirizzo email valido.', 'warning');
                    return;
                }

                const sendButton = document.getElementById('sendResetEmailBtn');
                sendButton.disabled = true;
                sendButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Invio...';

                try {
                    const result = await this.api.forgotPassword(email);

                    if (result.success) {
                        this.ui.showToast(result.message, 'success');
                        if (modalInstance) modalInstance.hide();
                    } else {
                        // Per sicurezza, mostra un messaggio generico per non confermare se un'email esiste o meno.
                        this.ui.showToast('Se l\'indirizzo email è corretto, riceverai a breve le istruzioni.', 'info');
                        if (modalInstance) modalInstance.hide();
                    }
                } catch (error) {
                    console.error("Errore richiesta reset password:", error);
                    this.ui.showToast('Si è verificato un errore. Riprova più tardi.', 'error');
                } finally {
                    if (sendButton) {
                        sendButton.disabled = false;
                        sendButton.innerHTML = 'Invia Istruzioni';
                    }
                }
            }
        }];

        this.ui.createModal(modalId, 'Recupero Password', content, actions);
    }

    async handleLogout() {
        try {
            await this.api.logout();
        } catch (error) {
            console.error('Errore durante il logout:', error);
        } finally {
            this.currentUser = null;
            this.showLogin();
            this.ui.showToast('Disconnessione effettuata', 'info');
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
                                        <button class="btn btn-outline-secondary toggle-password-btn" type="button" data-target="currentPassword">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label for="newPassword" class="form-label">Nuova Password *</label>
                                    <div class="input-group">
                                        <input type="password" id="newPassword" class="form-control" 
                                               minlength="6" required>
                                        <button class="btn btn-outline-secondary toggle-password-btn" type="button" data-target="newPassword">
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
                                        <button class="btn btn-outline-secondary toggle-password-btn" type="button" data-target="confirmPassword">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div id="passwordMessage" class="mt-3"></div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="changePwdSaveBtn">
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
    console.debug('[showChangePasswordModal] inserted modal; existing count for #changePwdModal =', document.querySelectorAll('#changePwdModal').length);
        
        // Aggiungi validazione in tempo reale
        this.setupPasswordValidation();

        // Registra i listener per i pulsanti "occhio" e per il salvataggio
        const modalEl = document.getElementById('changePwdModal');
        if (modalEl) {
            // toggle password buttons
            modalEl.querySelectorAll('.toggle-password-btn').forEach(btn => {
                const target = btn.getAttribute('data-target');
                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    this.togglePasswordVisibility(target, btn);
                });
            });

            // save button
            const saveBtn = modalEl.querySelector('#changePwdSaveBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    this.changePassword();
                });
            }
        }

        // Mostra il modal
        const modal = new bootstrap.Modal(document.getElementById('changePwdModal'));
        modal.show();
    }

    setupPasswordValidation() {
        const modalEl = document.getElementById('changePwdModal');
        const newPasswordField = modalEl ? modalEl.querySelector('#newPassword') : document.getElementById('newPassword');
        const confirmPasswordField = modalEl ? modalEl.querySelector('#confirmPassword') : document.getElementById('confirmPassword');
        const messageDiv = modalEl ? modalEl.querySelector('#passwordMessage') : document.getElementById('passwordMessage');
        if (!newPasswordField || !confirmPasswordField || !messageDiv) return;
        
        const validatePasswords = () => {
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
        };
        
        newPasswordField.addEventListener('input', validatePasswords);
        confirmPasswordField.addEventListener('input', validatePasswords);
    }

    async changePassword() {
        const modalEl = document.getElementById('changePwdModal');
        const curEl = modalEl ? modalEl.querySelector('#currentPassword') : document.getElementById('currentPassword');
        const newEl = modalEl ? modalEl.querySelector('#newPassword') : document.getElementById('newPassword');
        const confEl = modalEl ? modalEl.querySelector('#confirmPassword') : document.getElementById('confirmPassword');
        const currentPassword = curEl ? curEl.value : undefined;
        const newPassword = newEl ? newEl.value : undefined;
        const confirmPassword = confEl ? confEl.value : undefined;
        const messageDiv = document.getElementById('passwordMessage');
        if (!messageDiv) return;
    console.debug('[changePassword] elements (modal-scoped):', { curElExists: !!curEl, newElExists: !!newEl, confElExists: !!confEl });
    console.debug('[changePassword] values (modal-scoped):', { currentPassword, newPassword, confirmPassword });
        
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
        const originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="loading-spinner"></span> Cambiando password...';
        }
        
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
                if (modal) modal.hide();
                
                // Mostra messaggio di successo
                alert('Password cambiata con successo! È stata inviata una email di conferma.');
            } else {
                messageDiv.innerHTML = `<div class="alert alert-danger">${result.message}</div>`;
            }
        } catch (error) {
            console.error('Errore cambio password:', error);
            messageDiv.innerHTML = '<div class="alert alert-danger">Errore durante il cambio password. Riprova.</div>';
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        }
    }

    /**
     * Toggle visibility della password
     */
    togglePasswordVisibility(inputId, button) {
        // prefer inputs inside the same modal as the button to avoid duplicate-id collisions
        const modalAncestor = button && button.closest ? button.closest('#changePwdModal') : null;
        const input = modalAncestor ? modalAncestor.querySelector('#' + inputId) : document.getElementById(inputId);
        const icon = button ? button.querySelector('i') : null;
        
        if (!input) {
            console.debug('[togglePasswordVisibility] input not found for', inputId);
            return;
        }
        console.debug('[togglePasswordVisibility] target (modal-scoped):', inputId, 'inputFound:', !!input, 'typeBefore:', input.type);
        
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.className = 'fas fa-eye-slash';
            button.title = 'Nascondi password';
            console.debug('[togglePasswordVisibility] now visible');
        } else {
            input.type = 'password';
            if (icon) icon.className = 'fas fa-eye';
            button.title = 'Mostra password';
            console.debug('[togglePasswordVisibility] now hidden');
        }
    }

    // ========================================================================
    // SEZIONE 2: LAYOUT E GESTIONE DELL'INTERFACCIA
    // ========================================================================

    showDashboard() {
        // NUOVO: Aggiunge la classe per attivare lo stile della dashboard
        document.body.classList.add('dashboard-active');

        const appContainer = document.getElementById('appContainer');
        appContainer.innerHTML = `
            <div class="management-sidebar" id="managementSidebar">
                 <div class="sidebar-header"><div class="vp-logo-text"><span class="vp-logo-v">V</span><span class="vp-logo-ampersand">&</span><span class="vp-logo-p">P</span></div><p class="sidebar-subtitle">Management Portal</p></div>
                <nav class="sidebar-nav">
                    <div class="nav-item"><button class="nav-link active" data-action="navigate" data-section="commesse-task"><i class="fas fa-tasks"></i>Commesse & Task</button></div>
                    <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="clienti"><i class="fas fa-building"></i>Clienti</button></div>
                    <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="collaboratori"><i class="fas fa-users"></i>Collaboratori</button></div>
                    <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="fatture"><i class="fas fa-file-invoice"></i>Fatture</button></div>
                    <!-- <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="fatture-collaboratori"><i class="fas fa-file-invoice"></i>Fatture Collaboratori</button></div> DISABILITATO -->
                    <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="giornate"><i class="fas fa-calendar-alt"></i>Giornate</button></div>
                    <div class="nav-item"><button class="nav-link" data-action="navigate" data-section="statistiche"><i class="fas fa-chart-bar"></i>Statistiche</button></div>
                </nav>
                <div class="sidebar-user">
                    <div class="user-info"><div class="user-avatar">${this.getUserInitials()}</div><div class="user-details"><div class="user-name">${this.currentUser.nome} ${this.currentUser.cognome}</div><div class="user-role">${this.currentUser.ruolo || 'Admin'}</div></div></div>
                    <div class="user-actions"><button type="button" class="btn btn-vp-secondary btn-sm" data-action="show-change-password-modal" title="Cambia Password"><i class="fas fa-key"></i></button><button type="button" class="btn btn-vp-danger btn-sm" data-action="logout" title="Logout"><i class="fas fa-sign-out-alt"></i></button></div>
                </div>
            </div>
            <div class="sidebar-overlay" id="sidebarOverlay" data-action="close-sidebar"></div>
            <div class="management-content" id="managementContent">
                <div class="management-topbar">
                    <div class="topbar-left"><button class="sidebar-toggle" data-action="toggle-sidebar"><i class="fas fa-bars"></i></button><div><h1 class="page-title" id="pageTitle"></h1><p class="page-subtitle" id="pageSubtitle"></p></div></div>
                    <div class="topbar-right"><div class="topbar-actions" id="topbarActions"></div></div>
                </div>
                <div class="management-section" id="contentArea"></div>
            </div>`;
        this.updateSidebarState();
    }

    showLogin() {
        // NUOVO: Rimuove la classe della dashboard per disattivare lo stile flex
        document.body.classList.remove('dashboard-active');

        const appContainer = document.getElementById('appContainer');
        // MODIFICATO: Aggiunto link per password dimenticata
        appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <div class="vp-logo-text"><span class="vp-logo-v">V</span><span class="vp-logo-ampersand">&</span><span class="vp-logo-p">P</span></div>
                        <h2 class="login-title">Management Portal</h2>
                        <p class="login-subtitle">Accedi per continuare</p>
                    </div>
                    <form id="loginForm" class="login-form">
                        <div id="loginError" class="alert alert-danger d-none" role="alert"></div>
                        <div class="mb-3">
                            <label for="username" class="form-label">Username o Email</label>
                            <input type="text" class="form-control" id="username" required>
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" required>
                        </div>
                        <button type="submit" class="btn btn-vp-primary w-100">Accedi</button>
                    </form>
                    <div class="text-center mt-3">
                        <a href="#" class="forgot-password-link" data-action="forgot-password">Password dimenticata?</a>
                    </div>
                </div>
            </div>
        `;
    }

    getUserInitials() {
        if (!this.currentUser) return 'V&P';
        const nome = this.currentUser.nome || '';
        const cognome = this.currentUser.cognome || '';
        return (nome.charAt(0) + cognome.charAt(0)).toUpperCase();
    }

    toggleSidebar(forceClose = false) { document.body.classList.toggle('sidebar-expanded', forceClose ? false : !document.body.classList.contains('sidebar-expanded')); }
    updateSidebarState() { document.body.classList.toggle('sidebar-expanded', !this.sidebarCollapsed); }
    handleResize() { this.sidebarCollapsed = window.innerWidth < 768; this.updateSidebarState(); }

    // ========================================================================
    // SEZIONE 3: GESTIONE EVENTI E NAVIGAZIONE
    // ========================================================================

    setupEventListeners() {
        document.getElementById('appContainer').addEventListener('click', this.handleAppClick.bind(this));
        // Aggiungi listener per il submit del form di login
        document.body.addEventListener('submit', (e) => {
            if (e.target.id === 'loginForm') {
                e.preventDefault();
                this.handleLogin();
            }
        });
    }

    handleAppClick(e) {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        const { action, section, id, type } = actionTarget.dataset;
        
        if (actionTarget.tagName !== 'A') { e.preventDefault(); }

        switch (action) {
            case 'navigate':
                e.preventDefault();
                this.showSection(section);
                break;
            case 'toggle-sidebar':
            case 'close-sidebar':
                e.preventDefault();
                this.toggleSidebar();
                break;
            case 'logout':
                e.preventDefault();
                this.handleLogout();
                break;
            // NUOVO: Gestione del click sul link "Password dimenticata"
            case 'forgot-password':
                e.preventDefault();
                this.handleForgotPasswordClick();
                break;
            // Gestione cambio password dalla sidebar
            case 'show-change-password-modal':
                e.preventDefault();
                // Apri la maschera per cambiare password
                if (typeof this.showChangePasswordModal === 'function') this.showChangePasswordModal();
                break;
            
            default:
                const currentSectionHandler = this.sections[this.currentSection];
                if (currentSectionHandler && typeof currentSectionHandler.handleAction === 'function') {
                    currentSectionHandler.handleAction(action, id, type, actionTarget, e);
                } else {
                    console.warn(`Nessun gestore per l'azione '${action}' nella sezione '${this.currentSection}'`);
                }
                break;
        }
    }

    async showSection(sectionName) {
        if (!sectionName || !this.sections[sectionName]) {
            console.error(`Sezione non esistente: "${sectionName}"`);
            return;
        }
        this.currentSection = sectionName;
        document.querySelectorAll('.nav-link[data-section]').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionName);
        });
        await this.sections[sectionName].initialize();
        if (window.innerWidth < 768) { this.toggleSidebar(true); }
    }

    // ========================================================================
    // SEZIONE 4: CARICAMENTO E GESTIONE DATI
    // ========================================================================

    async loadInitialData() {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) contentArea.innerHTML = this.ui.createLoadingState('Caricamento dati...');

        try {
            const responses = await Promise.all([
                this.api.getCommesse({ limit: 1000 }), this.api.getTasks({ limit: 1000 }), this.api.getAllGiornate(),
                this.api.getClienti({ limit: 1000 }), this.api.getCollaboratori({ limit: 1000 }), this.api.getTariffe({ limit: 1000 }), this.api.getFatture({ limit: 1000 }) // , this.api.getFattureCollaboratori() DISABILITATO
            ]);
            [ this.commesse, this.tasks, this.giornate, this.clienti, this.collaboratori, this.tariffe, this.fatture /* , this.fatture_collaboratori */ ] = responses.map(res => (res.success && res.data.data) ? res.data.data : []);
            console.log('✅ Dati iniziali caricati.');
            await this.showSection(this.currentSection);
        } catch (error) {
            console.error('Errore critico caricamento dati:', error);
            this.ui.showToast('Impossibile caricare i dati dal server.', 'error');
            if (contentArea) contentArea.innerHTML = this.ui.createEmptyState('fas fa-server', 'Errore di Connessione', 'Non è stato possibile caricare i dati.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new ManagementApp(); });
