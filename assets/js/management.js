/**
 * App Management V&P - JavaScript
 * Sistema di gestione per amministratori Vaglio & Partners
 */

class ManagementApp {
    async showEditCommessaModal(idCommessa) {
        const commessa = this.commesse.find(c => c.ID_COMMESSA === idCommessa);
        if (!commessa) {
            this.showToast('Commessa non trovata', 'error');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const modalHtml = `
            <div class="modal fade" id="editCommessaModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>
                                Modifica Commessa
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="editCommessaForm">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editCommessaName" class="form-label">Nome Commessa *</label>
                                            <input type="text" class="form-control" id="editCommessaName" value="${commessa.Commessa || ''}" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="editCommessaTipo" class="form-label">Tipo Commessa *</label>
                                            <select class="form-select" id="editCommessaTipo" required>
                                                <option value="">Seleziona tipo</option>
                                                <option value="Cliente" ${commessa.Tipo_Commessa === 'Cliente' ? 'selected' : ''}>Cliente</option>
                                                <option value="Interna" ${commessa.Tipo_Commessa === 'Interna' ? 'selected' : ''}>Interna</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label for="editCommessaStato" class="form-label">Stato Commessa *</label>
                                            <select class="form-select" id="editCommessaStato" required>
                                                <option value="In corso" ${commessa.Stato_Commessa === 'In corso' ? 'selected' : ''}>In corso</option>
                                                <option value="Sospesa" ${commessa.Stato_Commessa === 'Sospesa' ? 'selected' : ''}>Sospesa</option>
                                                <option value="Chiusa" ${commessa.Stato_Commessa === 'Chiusa' ? 'selected' : ''}>Chiusa</option>
                                                <option value="Archiviata" ${commessa.Stato_Commessa === 'Archiviata' ? 'selected' : ''}>Archiviata</option>
                                            </select>
                                        </div>
                                        <div class="mb-3" id="editCommessaClienteContainer" style="${commessa.Tipo_Commessa === 'Cliente' ? '' : 'display: none;'}">
                                            <label for="editCommessaCliente" class="form-label">Cliente *</label>
                                            <select class="form-select" id="editCommessaCliente">
                                                <option value="">Seleziona Cliente</option>
                                                ${this.clienti.map(c => 
                                                    `<option value="${c.ID_CLIENTE}" ${commessa.ID_CLIENTE == c.ID_CLIENTE ? 'selected' : ''}>${c.Cliente}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                        <div class="mb-3" id="editCommessaCommissioneContainer" style="${commessa.Tipo_Commessa === 'Cliente' ? '' : 'display: none;'}">
                                            <label for="editCommessaCommissione" class="form-label">Commissione (da 0 a 1, es. 0.25 per 25%)</label>
                                            <input type="number" class="form-control" id="editCommessaCommissione" min="0" max="1" step="0.01" placeholder="0.25" value="${commessa.Commissione || ''}">
                                        </div>
                                        <div class="mb-3">
                                            <label for="editCommessaResponsabile" class="form-label">Responsabile *</label>
                                            <select class="form-select" id="editCommessaResponsabile" required>
                                                <option value="">Seleziona responsabile</option>
                                                ${this.collaboratori.map(c => 
                                                    `<option value="${c.ID_COLLABORATORE}" ${commessa.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editCommessaDescrizione" class="form-label">Descrizione Commessa</label>
                                            <textarea class="form-control" id="editCommessaDescrizione" rows="3">${commessa.Desc_Commessa || ''}</textarea>
                                        </div>
                                        <div class="mb-3">
                                            <label for="editCommessaDataInizio" class="form-label">Data Inizio</label>
                                            <input type="date" class="form-control" id="editCommessaDataInizio" value="${commessa.Data_Apertura_Commessa || today}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times me-1"></i>Annulla
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-1"></i>Salva Modifiche
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('editCommessaModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('editCommessaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.querySelector('#editCommessaForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Salvataggio...';
            submitBtn.disabled = true;
            // Raccogli dati
            const tipoCommessa = document.getElementById('editCommessaTipo').value;
            let idCliente = document.getElementById('editCommessaCliente').value || null;
            if (tipoCommessa === 'Interna') {
                idCliente = null;
            }
            const updatedCommessa = {
                ID_COMMESSA: commessa.ID_COMMESSA,
                Commessa: document.getElementById('editCommessaName').value,
                Desc_Commessa: document.getElementById('editCommessaDescrizione').value || null,
                Tipo_Commessa: tipoCommessa,
                Stato_Commessa: document.getElementById('editCommessaStato').value,
                ID_CLIENTE: idCliente,
                Commissione: document.getElementById('editCommessaCommissione').value || 0,
                ID_COLLABORATORE: document.getElementById('editCommessaResponsabile').value || null,
                Data_Apertura_Commessa: document.getElementById('editCommessaDataInizio').value || null
            };
            // Validazioni
            if (!updatedCommessa.Commessa.trim()) {
                this.showToast('Inserisci il nome della commessa', 'error');
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
                return;
            }
            if (!updatedCommessa.Tipo_Commessa) {
                this.showToast('Seleziona il tipo di commessa', 'error');
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
                return;
            }
            if (updatedCommessa.Tipo_Commessa === 'Cliente' && !updatedCommessa.ID_CLIENTE) {
                this.showToast('Seleziona un cliente per le commesse di tipo Cliente', 'error');
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
                return;
            }
            if (!updatedCommessa.ID_COLLABORATORE) {
                this.showToast('Seleziona il responsabile della commessa', 'error');
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
                return;
            }
            // Chiamata API per aggiornare la commessa (PUT, ID in URL)
            try {
                const response = await fetch(`API/index.php?resource=commesse&action=update&id=${encodeURIComponent(commessa.ID_COMMESSA)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedCommessa)
                });
                const result = await response.json();
                if (result.success) {
                    this.showToast('Commessa aggiornata con successo!', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editCommessaModal'));
                    modal.hide();
                    await this.loadCommesse();
                    if (typeof this.renderCommesseTask === 'function') {
                        this.renderCommesseTask();
                    } else if (typeof this.renderCommesse === 'function') {
                        this.renderCommesse();
                    }
                } else {
                    console.error('Errore API:', result);
                    this.showToast(result.message || result.error || 'Errore durante l\'aggiornamento della commessa', 'error');
                }
            } catch (error) {
                this.showToast('Errore di rete: ' + error.message, 'error');
            } finally {
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
            }
        });
        document.getElementById('editCommessaTipo').addEventListener('change', () => {
            const tipo = document.getElementById('editCommessaTipo').value;
            document.getElementById('editCommessaClienteContainer').style.display = tipo === 'Cliente' ? '' : 'none';
            document.getElementById('editCommessaCommissioneContainer').style.display = tipo === 'Cliente' ? '' : 'none';
        });
        const modal = new bootstrap.Modal(document.getElementById('editCommessaModal'));
        modal.show();
    }
    constructor() {
        this.currentUser = null;
        this.currentSection = 'commesse-task';
        this.sidebarCollapsed = true; // Inizia con sidebar collassato
        this.isMobile = window.innerWidth < 768;
        
        // Dati cache
        this.commesse = [];
        this.tasks = [];
        this.giornate = [];
        this.clienti = [];
        this.collaboratori = [];
        this.tariffe = [];
        this.fatture = [];
        
        this.init();
    }
    
    init() {
        // Controlla se l'utente è già autenticato
        this.checkAuthentication().then(() => {
            if (this.currentUser) {
                this.showDashboard();
                this.loadInitialData();
            } else {
                this.showLogin();
            }
        });
        
        // Event listeners
        this.setupEventListeners();
        
        // Responsive handling
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
    }
    
    async checkAuthentication() {
        try {
            const response = await fetch('API/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'check_auth' })
            });
            
            const result = await response.json();
            
            if (result.success && result.authenticated) {
                this.currentUser = result.user;
                return true;
            } else {
                this.currentUser = null;
                return false;
            }
        } catch (error) {
            console.error('Errore controllo autenticazione:', error);
            return false;
        }
    }
    
    setupEventListeners() {
        // Login form
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'loginForm') {
                e.preventDefault();
                this.handleLogin();
            }
            if (e.target.id === 'changePasswordForm') {
                e.preventDefault();
                this.handleChangePassword();
            }
        });
        
        // Navigation clicks
        document.addEventListener('click', (e) => {
            // Sidebar toggle
            if (e.target.closest('.sidebar-toggle') || e.target.closest('[data-action="toggle-sidebar"]')) {
                e.preventDefault();
                this.toggleSidebar();
            }
            
            // Navigation links
            if (e.target.closest('.nav-link[data-section]')) {
                e.preventDefault();
                const section = e.target.closest('.nav-link').dataset.section;
                this.showSection(section);
            }
            
            // Logout
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.handleLogout();
            }
            
            // Change password
            if (e.target.id === 'changePwdBtn' || e.target.closest('#changePwdBtn')) {
                e.preventDefault();
                this.showChangePasswordModal();
            }
            
            // Sidebar overlay (mobile)
            if (e.target.classList.contains('sidebar-overlay')) {
                this.closeSidebar();
            }
            
            // Action buttons
            if (e.target.closest('[data-action]')) {
                const action = e.target.closest('[data-action]').dataset.action;
                const itemId = e.target.closest('[data-action]').dataset.id;
                const itemType = e.target.closest('[data-action]').dataset.type;
                this.handleAction(action, itemType, itemId);
            }
        });
    }
    
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 768;
        
        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                this.sidebarCollapsed = true;
            } else {
                this.sidebarCollapsed = false;
                this.closeSidebarOverlay();
            }
            this.updateSidebarState();
        }
    }
    
    showLogin() {
        const appContainer = document.getElementById('appContainer');
        appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-logo-text">
                            <span class="login-logo-v">V</span>
                            <span class="login-logo-ampersand">&</span>
                            <span class="login-logo-p">P</span>
                        </div>
                        <h2 class="login-title">Management Portal</h2>
                        <p class="login-subtitle">Accedi con email o username al sistema di gestione</p>
                    </div>
                    
                    <form id="loginForm">
                        <div class="mb-3">
                            <label for="emailOrUsername" class="form-label">Email o Username</label>
                            <input type="text" class="form-control" id="emailOrUsername" name="emailOrUsername" required 
                                   placeholder="inserisci email o username">
                        </div>
                        <div class="mb-4">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" name="password" required 
                                   placeholder="inserisci la tua password">
                        </div>
                        
                        <div id="loginError" class="alert alert-vp-danger d-none mb-3">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <span id="loginErrorMessage"></span>
                        </div>
                        
                        <button type="submit" class="btn btn-vp-primary w-100">
                            <span class="btn-text">Accedi al Management</span>
                            <span class="loading-spinner d-none"></span>
                        </button>
                    </form>
                    
                    <div class="text-center mt-3">
                        <small class="text-muted">
                            <i class="fas fa-shield-alt me-1"></i>
                            Sistema riservato agli amministratori V&P
                        </small>
                    </div>
                </div>
            </div>
        `;
    }
    
    async handleLogin() {
        const emailOrUsername = document.getElementById('emailOrUsername').value;
        const password = document.getElementById('password').value;
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.loading-spinner');
        const errorDiv = document.getElementById('loginError');
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Accesso in corso...';
        spinner.classList.remove('d-none');
        errorDiv.classList.add('d-none');
        
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
                
                // Verifica che l'utente abbia i permessi di gestione
                if (!this.currentUser.ruolo || !['Admin', 'Manager'].includes(this.currentUser.ruolo)) {
                    throw new Error('Accesso non autorizzato. Contatta l\'amministratore.');
                }
                
                this.showToast('Accesso effettuato con successo!', 'success');
                
                setTimeout(() => {
                    this.showDashboard();
                    this.loadInitialData();
                }, 500);
                
            } else {
                throw new Error(result.message || 'Errore durante l\'accesso');
            }
            
        } catch (error) {
            console.error('Errore login:', error);
            errorDiv.classList.remove('d-none');
            document.getElementById('loginErrorMessage').textContent = error.message;
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.textContent = 'Accedi al Management';
            spinner.classList.add('d-none');
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
        } catch (error) {
            console.error('Errore logout:', error);
        }
        
        this.currentUser = null;
        this.showLogin();
        this.showToast('Disconnessione effettuata', 'info');
    }
    
    showDashboard() {
        const appContainer = document.getElementById('appContainer');
        appContainer.innerHTML = `
            <!-- Sidebar -->
            <div class="management-sidebar" id="managementSidebar">
                <div class="sidebar-header">
                    <div class="vp-logo-text">
                        <span class="vp-logo-v">V</span>
                        <span class="vp-logo-ampersand">&</span>
                        <span class="vp-logo-p">P</span>
                    </div>
                    <p class="sidebar-subtitle">Management Portal</p>
                </div>
                
                <nav class="sidebar-nav">
                    <div class="nav-item">
                        <button class="nav-link active" data-section="commesse-task">
                            <i class="fas fa-tasks"></i>
                            Commesse & Task
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="clienti">
                            <i class="fas fa-building"></i>
                            Clienti
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="collaboratori">
                            <i class="fas fa-users"></i>
                            Collaboratori
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="tariffe">
                            <i class="fas fa-euro-sign"></i>
                            Tariffe
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="fatture">
                            <i class="fas fa-file-invoice"></i>
                            Fatture
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="giornate">
                            <i class="fas fa-calendar-alt"></i>
                            Giornate
                        </button>
                    </div>
                    <div class="nav-item">
                        <button class="nav-link" data-section="statistiche">
                            <i class="fas fa-chart-bar"></i>
                            Statistiche
                        </button>
                    </div>
                </nav>
                
                <div class="sidebar-user">
                    <div class="user-info">
                        <div class="user-avatar">
                            ${this.getUserInitials()}
                        </div>
                        <div class="user-details">
                            <div class="user-name">${this.currentUser.nome} ${this.currentUser.cognome}</div>
                            <div class="user-role">${this.currentUser.ruolo || 'Admin'}</div>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button type="button" class="btn btn-vp-secondary btn-sm" id="changePwdBtn">
                            <i class="fas fa-key"></i>
                        </button>
                        <button type="button" class="btn btn-vp-danger btn-sm" id="logoutBtn">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Overlay per mobile -->
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
            
            <!-- Main Content -->
            <div class="management-content" id="managementContent">
                <!-- Top Bar -->
                <div class="management-topbar">
                    <div class="topbar-left">
                        <button class="sidebar-toggle" data-action="toggle-sidebar">
                            <i class="fas fa-bars"></i>
                        </button>
                        <div>
                            <h1 class="page-title" id="pageTitle">Situazione Commesse e Task</h1>
                            <p class="page-subtitle" id="pageSubtitle">Visualizza e gestisci commesse e task</p>
                        </div>
                    </div>
                    <div class="topbar-right">
                        <div class="topbar-actions">
                            <button class="btn btn-vp-primary" data-action="add" data-type="commessa">
                                <i class="fas fa-plus me-2"></i>Nuova Commessa
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="management-section" id="contentArea">
                    <!-- Il contenuto viene caricato dinamicamente -->
                </div>
            </div>
        `;
        
        this.updateSidebarState();
        this.showSection('commesse-task');
    }
    
    getUserInitials() {
        if (!this.currentUser) return 'VP';
        const nome = this.currentUser.nome || '';
        const cognome = this.currentUser.cognome || '';
        return (nome.charAt(0) + cognome.charAt(0)).toUpperCase();
    }
    
    toggleSidebar() {
        if (this.isMobile) {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            if (!this.sidebarCollapsed) {
                this.showSidebarOverlay();
            } else {
                this.closeSidebarOverlay();
            }
        } else {
            this.sidebarCollapsed = !this.sidebarCollapsed;
        }
        this.updateSidebarState();
    }
    
    closeSidebar() {
        if (this.isMobile) {
            this.sidebarCollapsed = true;
            this.closeSidebarOverlay();
            this.updateSidebarState();
        }
    }
    
    showSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.classList.add('show');
        }
    }
    
    closeSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    updateSidebarState() {
        const sidebar = document.getElementById('managementSidebar');
        const content = document.getElementById('managementContent');
        
        if (!sidebar || !content) return;
        
        if (this.isMobile) {
            if (this.sidebarCollapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('show');
            }
            content.classList.add('expanded');
        } else {
            sidebar.classList.remove('show');
            if (this.sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                content.classList.add('expanded');
            } else {
                sidebar.classList.remove('collapsed');
                content.classList.remove('expanded');
            }
        }
    }
    
    showSection(sectionName) {
        this.currentSection = sectionName;
        
        // Aggiorna navigazione attiva
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
        
        // Aggiorna titolo
        this.updatePageTitle(sectionName);
        
        // Carica contenuto sezione
        switch (sectionName) {
            case 'commesse-task':
                this.showCommesseTaskSection();
                break;
            case 'clienti':
                this.showClientiSection();
                break;
            case 'collaboratori':
                this.showCollaboratoriSection();
                break;
            case 'tariffe':
                this.showTariffeSection();
                break;
            case 'fatture':
                this.showFattureSection();
                break;
            case 'giornate':
                this.showGiornateSection();
                break;
            case 'statistiche':
                this.showStatisticheSection();
                break;
            default:
                this.showCommesseTaskSection();
        }
        
        // Chiudi sidebar su mobile dopo navigazione
        if (this.isMobile) {
            this.closeSidebar();
        }
    }
    
    updatePageTitle(sectionName) {
        const titles = {
            'commesse-task': {
                title: 'Situazione Commesse e Task',
                subtitle: 'Visualizza e gestisci commesse e task'
            },
            'clienti': {
                title: 'Gestione Clienti',
                subtitle: 'Visualizza e gestisci i clienti'
            },
            'collaboratori': {
                title: 'Gestione Collaboratori',
                subtitle: 'Visualizza e gestisci i collaboratori'
            },
            'tariffe': {
                title: 'Gestione Tariffe',
                subtitle: 'Visualizza e gestisci le tariffe'
            },
            'fatture': {
                title: 'Gestione Fatture',
                subtitle: 'Visualizza e gestisci le fatture'
            },
            'giornate': {
                title: 'Gestione Giornate',
                subtitle: 'Visualizza le giornate lavorate'
            },
            'statistiche': {
                title: 'Statistiche',
                subtitle: 'Visualizza statistiche e report'
            }
        };
        
        const pageInfo = titles[sectionName] || titles['commesse-task'];
        
        const titleEl = document.getElementById('pageTitle');
        const subtitleEl = document.getElementById('pageSubtitle');
        
        if (titleEl) titleEl.textContent = pageInfo.title;
        if (subtitleEl) subtitleEl.textContent = pageInfo.subtitle;
    }
    
    async loadInitialData() {
        try {
            // Test rapido del router API
            console.log('Test connessione API...');
            try {
                const testResponse = await fetch('API/index.php?resource=status');
                const testResult = await testResponse.text();
                console.log('API Status test:', testResult);
            } catch (error) {
                console.error('API Status test failed:', error);
            }
            
            // Carica dati in sequenza per evitare problemi di timing
            console.log('=== INIZIO CARICAMENTO DATI ===');
            
            await this.loadCommesse();
            console.log('✓ Commesse caricate:', this.commesse.length);
            
            await this.loadTasks();
            console.log('✓ Task caricati:', this.tasks.length);
            
            await this.loadGiornate();
            console.log('✓ Giornate caricate:', this.giornate.length);
            
            await this.loadClienti();
            console.log('✓ Clienti caricati:', this.clienti.length);
            
            await this.loadCollaboratori();
            console.log('✓ Collaboratori caricati:', this.collaboratori.length);
            
            console.log('=== FINE CARICAMENTO DATI ===');
            
            // Aggiorna le statistiche dopo che tutti i dati sono caricati
            console.log('Aggiornamento statistiche dopo caricamento dati...');
            this.updateStatistics();
            
            // Se siamo nella pagina commesse-task, ricarica i dati
            if (this.currentSection === 'commesse-task') {
                this.loadCommesseTaskData();
            }
        } catch (error) {
            console.error('Errore caricamento dati iniziali:', error);
            this.showToast('Errore nel caricamento dei dati', 'error');
        }
    }
    
    updateStatistics() {
        console.log('Aggiornamento statistiche...');
        
        // Aggiorna statistiche solo se siamo nella pagina corretta
        const totalCommesseEl = document.getElementById('totalCommesse');
        const totalTasksEl = document.getElementById('totalTasks');
        const totalGiornateEl = document.getElementById('totalGiornate');
        const commesseAttiveEl = document.getElementById('commesseAttive');
        
        if (totalCommesseEl) {
            totalCommesseEl.textContent = this.commesse.length;
        }
        
        if (totalTasksEl) {
            totalTasksEl.textContent = this.tasks.length;
        }
        
        if (totalGiornateEl) {
            // Fix calcolo giornate - gestisce sia formati numerici che con virgola
            const totalGiornate = this.giornate.reduce((sum, g) => {
                let gg = g.gg || 0;
                if (typeof gg === 'string') {
                    gg = parseFloat(gg.replace(',', '.'));
                }
                return sum + (isNaN(gg) ? 0 : gg);
            }, 0);
            totalGiornateEl.textContent = totalGiornate.toFixed(1);
            console.log('✓ Totale giornate aggiornato:', totalGiornate.toFixed(1), 'su', this.giornate.length, 'records');
        }
        
        if (commesseAttiveEl) {
            // Possibili stati: 'In corso', 'Sospesa', 'Chiusa', 'Archiviata', o vuoto
            // Consideriamo "In corso" e vuoto come attive (per compatibilità con dati esistenti)
            const commesseAttive = this.commesse.filter(c => 
                c.Stato_Commessa === 'In corso' || 
                !c.Stato_Commessa || 
                c.Stato_Commessa.trim() === ''
            ).length;
            commesseAttiveEl.textContent = commesseAttive;
            console.log('✓ Commesse attive aggiornate:', commesseAttive);
        }
        
        // Aggiorna anche i filtri dopo aver caricato i dati
        this.populateCommesseTaskFilters();
        
        // Se siamo nella pagina commesse-task, assicuriamoci che i filtri siano popolati
        setTimeout(() => {
            if (this.currentSection === 'commesse-task') {
                this.populateCommesseTaskFilters();
            }
        }, 100);
    }
    
    async loadCommesse() {
        try {
            const response = await fetch('API/index.php?resource=commesse&action=getAll');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            
            if (!responseText.trim()) {
                console.warn('Risposta vuota dall\'API Commesse');
                this.commesse = [];
                return;
            }
            
            const result = JSON.parse(responseText);
            
            if (result.success) {
                this.commesse = result.data.data || [];
                console.log('✓ Commesse caricate:', this.commesse.length);
            } else {
                throw new Error(result.message || 'Errore caricamento commesse');
            }
        } catch (error) {
            console.error('Errore caricamento commesse:', error);
            this.commesse = [];
        }
    }
    
    async loadTasks() {
        try {
            const response = await fetch('API/index.php?resource=task&action=getAll&limit=100');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            
            if (!responseText.trim()) {
                console.warn('Risposta vuota dall\'API Task');
                this.tasks = [];
                return;
            }
            
            const result = JSON.parse(responseText);
            
            if (result.success) {
                this.tasks = result.data.data || [];
                console.log('✓ Task caricati:', this.tasks.length);
            } else {
                throw new Error(result.message || 'Errore caricamento task');
            }
        } catch (error) {
            console.error('Errore caricamento task:', error);
            this.tasks = [];
        }
    }
    
    async loadGiornate() {
        try {
            console.log('Caricamento giornate...');
            
            let allGiornate = [];
            let currentPage = 1;
            let totalPages = 1;
            
            // Carica tutte le pagine di giornate
            do {
                const response = await fetch(`API/index.php?resource=giornate&action=getAll&limit=100&page=${currentPage}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const responseText = await response.text();
                
                if (!responseText.trim()) {
                    console.warn('Risposta vuota dall\'API Giornate');
                    break;
                }
                
                const result = JSON.parse(responseText);
                
                if (result.success) {
                    const pageData = result.data.data || [];
                    allGiornate = allGiornate.concat(pageData);
                    
                    if (result.data.pagination) {
                        totalPages = result.data.pagination.pages;
                        console.log(`✓ Pagina ${currentPage}/${totalPages} caricata: ${pageData.length} giornate`);
                    }
                    
                    currentPage++;
                } else {
                    throw new Error(result.message || 'Errore caricamento giornate');
                }
            } while (currentPage <= totalPages);
            
            this.giornate = allGiornate;
            console.log(`✓ Giornate caricate completamente: ${this.giornate.length} totali`);
            
            // Test calcolo totale
            if (this.giornate.length > 0) {
                const totalTest = this.giornate.reduce((sum, g) => {
                    let gg = g.gg || 0;
                    if (typeof gg === 'string') {
                        gg = parseFloat(gg.replace(',', '.'));
                    }
                    return sum + (isNaN(gg) ? 0 : gg);
                }, 0);
                console.log(`✓ Totale ore calcolate: ${totalTest.toFixed(1)}`);
            }
            
        } catch (error) {
            console.error('❌ Errore caricamento giornate:', error);
            this.giornate = [];
        }
    }
    
    async loadClienti() {
        try {
            const response = await fetch('API/index.php?resource=clienti&action=getAll');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            
            if (!responseText.trim()) {
                console.warn('Risposta vuota dall\'API Clienti');
                this.clienti = [];
                return;
            }
            
            const result = JSON.parse(responseText);
            
            if (result.success) {
                this.clienti = result.data.data || [];
                console.log('✓ Clienti caricati:', this.clienti.length);
            } else {
                throw new Error(result.message || 'Errore caricamento clienti');
            }
        } catch (error) {
            console.error('Errore caricamento clienti:', error);
            this.clienti = [];
        }
    }
    
    async loadCollaboratori() {
        try {
            const response = await fetch('API/index.php?resource=collaboratori&action=getAll');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            
            if (!responseText.trim()) {
                console.warn('Risposta vuota dall\'API Collaboratori');
                this.collaboratori = [];
                return;
            }
            
            const result = JSON.parse(responseText);
            
            if (result.success) {
                this.collaboratori = result.data.data || [];
                console.log('✓ Collaboratori caricati:', this.collaboratori.length);
            } else {
                throw new Error(result.message || 'Errore caricamento collaboratori');
            }
        } catch (error) {
            console.error('Errore caricamento collaboratori:', error);
            this.collaboratori = [];
        }
    }
    
    showCommesseTaskSection() {
        console.log('showCommesseTaskSection chiamata');
        console.log('Dati disponibili:', {
            commesse: this.commesse.length,
            tasks: this.tasks.length,
            giornate: this.giornate.length
        });
        
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <!-- Statistiche rapide -->
            <div class="stats-row">
                <div class="stat-card-management">
                    <div class="stat-icon">
                        <i class="fas fa-briefcase"></i>
                    </div>
                    <div class="stat-number" id="totalCommesse">-</div>
                    <div class="stat-label">Commesse Totali</div>
                </div>
                <div class="stat-card-management">
                    <div class="stat-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="stat-number" id="totalTasks">-</div>
                    <div class="stat-label">Task Totali</div>
                </div>
                <div class="stat-card-management">
                    <div class="stat-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="stat-number" id="totalGiornate">-</div>
                    <div class="stat-label">Giornate Totali</div>
                </div>
                <div class="stat-card-management">
                    <div class="stat-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-number" id="activeCommesse">-</div>
                    <div class="stat-label">Commesse Attive</div>
                </div>
            </div>
            
            <!-- Filtri di ricerca -->
            <div class="search-filters">
                <div class="row">
                    <div class="col-md-4">
                        <label class="form-label">Cerca commessa/task</label>
                        <input type="text" class="form-control" id="searchCommesseTask" placeholder="Nome, codice, cliente...">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Commessa</label>
                        <select class="form-select" id="filterCommesse">
                            <option value="">Tutte le commesse</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Stato Commessa</label>
                        <select class="form-select" id="filterStatoCommesse">
                            <option value="">Tutti gli stati</option>
                            <option value="attiva">Attiva</option>
                            <option value="completata">Completata</option>
                            <option value="sospesa">Sospesa</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">&nbsp;</label>
                        <div class="d-flex gap-2">
                            <button class="btn btn-vp-primary" onclick="app.filterCommesseTask()">
                                <i class="fas fa-search"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="app.toggleAllCommesse()" id="toggleAllBtn" title="Espandi/Comprimi tutto">
                                <i class="fas fa-expand-arrows-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Contenitore principale per commesse e task -->
            <div id="commesseTaskContainer">
                <div class="text-center py-5">
                    <div class="loading-text">
                        <div class="loading-spinner"></div>
                        Caricamento commesse e task...
                    </div>
                </div>
            </div>
        `;
        
        // Carica i dati nelle tabelle - IMPORTANTE: solo se i dati sono già caricati
        if (this.commesse.length > 0 && this.tasks.length > 0) {
            console.log('Dati già disponibili, caricamento immediato');
            this.updateCommesseTaskStats();
            this.populateCommesseTaskFilters();
            this.loadCommesseTaskData();
        } else {
            console.log('Dati non ancora disponibili, verranno caricati da loadInitialData');
        }
    }
    
    updateCommesseTaskStats() {
        // Aggiorna le statistiche
        document.getElementById('totalCommesse').textContent = this.commesse.length;
        document.getElementById('totalTasks').textContent = this.tasks.length;
        
        // Calcolo corretto del totale giornate
        const totalGiornate = this.giornate.reduce((sum, g) => {
            let gg = g.gg || 0;
            if (typeof gg === 'string') {
                gg = parseFloat(gg.replace(',', '.'));
            }
            return sum + (isNaN(gg) ? 0 : gg);
        }, 0);
        document.getElementById('totalGiornate').textContent = totalGiornate.toFixed(1);
        
        // Correggi qui il calcolo delle commesse attive
        const activeCommesse = this.commesse.filter(c => c.Stato_Commessa === 'In corso').length;
        document.getElementById('activeCommesse').textContent = activeCommesse;
        
        console.log('Stats aggiornate - Commesse attive:', activeCommesse, 'di', this.commesse.length);
    }
    
    populateCommesseTaskFilters() {
        // Popola filtro commesse
        const filterCommesse = document.getElementById('filterCommesse');
        
        if (filterCommesse && this.commesse.length > 0) {
            // Salva il valore corrente
            const currentValue = filterCommesse.value;
            
            filterCommesse.innerHTML = '<option value="">Tutte le commesse</option>';
            this.commesse.forEach(commessa => {
                filterCommesse.innerHTML += `<option value="${commessa.ID_COMMESSA}">${commessa.Commessa}</option>`;
            });
            
            // Ripristina il valore se era selezionato qualcosa
            if (currentValue) {
                filterCommesse.value = currentValue;
            }
            
            // Aggiungi event listener per filtro automatico (solo se non già presente)
            if (!filterCommesse.hasAttribute('data-listener-added')) {
                filterCommesse.addEventListener('change', () => {
                    this.filterCommesseTask();
                });
                filterCommesse.setAttribute('data-listener-added', 'true');
            }
        }
        
        // Aggiungi anche listeners agli altri filtri (solo se non già presenti)
        const searchInput = document.getElementById('searchCommesseTask');
        const statoFilter = document.getElementById('filterStatoCommesse');
        
        if (searchInput && !searchInput.hasAttribute('data-listener-added')) {
            searchInput.addEventListener('input', () => {
                // Filtro con debounce per non sovraccaricare
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.filterCommesseTask();
                }, 300);
            });
            searchInput.setAttribute('data-listener-added', 'true');
        }
        
        if (statoFilter && !statoFilter.hasAttribute('data-listener-added')) {
            statoFilter.addEventListener('change', () => {
                this.filterCommesseTask();
            });
            statoFilter.setAttribute('data-listener-added', 'true');
        }
    }
    
    loadCommesseTaskData() {
        const container = document.getElementById('commesseTaskContainer');
        if (!container) return;
        
        // Raggruppa i task per commessa
        const commesseConTask = this.groupTasksByCommessa();
        
        if (commesseConTask.length === 0) {
            container.innerHTML = `
                <div class="management-card">
                    <div class="management-card-body">
                        <div class="empty-state">
                            <i class="fas fa-briefcase"></i>
                            <h5>Nessuna commessa trovata</h5>
                            <p>Non ci sono commesse o task da visualizzare</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = commesseConTask.map(commessa => this.createCommessaCard(commessa)).join('');
    }
    
    groupTasksByCommessa() {
        const commesseMap = new Map();
        
        // Crea mappa delle commesse
        this.commesse.forEach(commessa => {
            const cliente = this.clienti.find(c => c.ID_CLIENTE == commessa.ID_CLIENTE);
            const responsabile = this.collaboratori.find(c => c.ID_COLLABORATORE == commessa.ID_COLLABORATORE);
            
            commesseMap.set(commessa.ID_COMMESSA, {
                ...commessa,
                cliente_nome: cliente ? cliente.Cliente : '-',
                responsabile_nome: responsabile ? responsabile.Collaboratore : '-',
                tasks: []
            });
        });
        
        // Aggiungi i task alle commesse
        this.tasks.forEach(task => {
            if (commesseMap.has(task.ID_COMMESSA)) {
                const commessa = commesseMap.get(task.ID_COMMESSA);
                
                // Calcola le giornate per questo task - VERIFICA MATCH RIGOROSO
                const giornateTask = this.giornate.filter(g => {
                    // Prova match sia stringhe che numeri
                    const match = g.ID_TASK == task.ID_TASK || g.ID_TASK === task.ID_TASK ||
                                  String(g.ID_TASK) === String(task.ID_TASK);
                    return match;
                });
                
                const totaleGiornate = giornateTask.reduce((sum, g) => {
                    let gg = g.gg || 0;
                    if (typeof gg === 'string') {
                        gg = parseFloat(gg.replace(',', '.'));
                    }
                    return sum + (isNaN(gg) ? 0 : gg);
                }, 0);
                
                commessa.tasks.push({
                    ...task,
                    giornate: giornateTask,
                    totale_giornate: totaleGiornate
                });
            }
        });
        
        // Mostra tutte le commesse 'In corso', anche senza task
        const result = Array.from(commesseMap.values())
            .filter(commessa => commessa.Stato_Commessa === 'In corso')
            .sort((a, b) => (a.Commessa || '').localeCompare(b.Commessa || ''));

        console.log('✓ Commesse attive mostrate:', result.length);
        return result;
    }
    
    createCommessaCard(commessa) {
        const totaleTasks = commessa.tasks.length;
        const totaleGiornate = commessa.tasks.reduce((sum, task) => sum + task.totale_giornate, 0);
        const tasksAttivi = commessa.tasks.filter(t => t.Stato_Task === 'In corso').length;
        
        return `
            <div class="management-card mb-4">
                <div class="management-card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <h5 class="management-card-title mb-0 me-2">
                                <i class="fas fa-briefcase me-2"></i>
                                ${commessa.Commessa || commessa.ID_COMMESSA || 'Commessa'}
                            </h5>
                            <button class="btn btn-warning btn-sm ms-2" onclick="app.showEditCommessaModal('${commessa.ID_COMMESSA}')" title="Modifica questa commessa">
                                <i class="fas fa-edit me-1"></i>Modifica
                            </button>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="badge bg-primary">${totaleTasks} Task</span>
                            <span class="badge bg-success">${totaleGiornate.toFixed(1)} Giorni</span>
                            <button class="btn btn-vp-primary btn-sm" onclick="app.showNewTaskModalForCommessa('${commessa.ID_COMMESSA}')" title="Aggiungi nuovo task a questa commessa">
                                <i class="fas fa-plus me-1"></i>Nuovo Task
                            </button>
                            <button class="btn btn-light btn-sm" onclick="app.toggleCommessa('${commessa.ID_COMMESSA}')" id="toggleBtn-${commessa.ID_COMMESSA}">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-light">
                            <i class="fas fa-building me-1"></i>
                            ${commessa.Tipo_Commessa === 'Interna' ? 'Interna' : `Cliente: ${commessa.cliente_nome}`} |
                            <i class="fas fa-user me-1"></i>Responsabile: ${commessa.responsabile_nome} |
                            <i class="fas fa-tasks me-1"></i>Task attivi: ${tasksAttivi}
                        </small>
                    </div>
                </div>
                <div class="collapse" id="commessa-${commessa.ID_COMMESSA}">
                    <div class="management-card-body">
                        <div class="row">
                            ${commessa.tasks.map(task => this.createTaskCard(task)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    createTaskCard(task) {
        const collaboratore = this.collaboratori.find(c => c.ID_COLLABORATORE === task.ID_COLLABORATORE);
        const collaboratoreNome = collaboratore ? collaboratore.Collaboratore : 'Non assegnato';
        
        // Statistiche giornate
        const giornateStats = this.calculateGiornateStats(task.giornate);
        
        return `
            <div class="col-lg-6 col-xl-4 mb-3">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-header bg-light border-0">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="card-title mb-0 fw-bold">${task.Task}</h6>
                            <span class="status-badge ${task.Stato_Task === 'In corso' ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${task.Stato_Task}
                            </span>
                        </div>
                        <small class="text-muted">
                            <i class="fas fa-tag me-1"></i>${task.Tipo || 'Campo'}
                        </small>
                    </div>
                    <div class="card-body">
                        ${task.Desc_Task ? `<p class="card-text text-muted small">${task.Desc_Task}</p>` : ''}
                        
                        <div class="mb-3">
                            ${task.Tipo === 'Monitoraggio' ? `<small class="text-muted d-block">
                                <i class="fas fa-user me-1"></i>Assegnato a: ${collaboratoreNome}
                            </small>` : ''}
                            ${task.gg_previste ? `<small class="text-muted d-block">
                                <i class="fas fa-calendar me-1"></i>Giorni previsti: ${task.gg_previste}
                            </small>` : ''}
                        </div>
                        
                        <!-- Statistiche Giornate -->
                        <div class="row text-center mb-3">
                            <div class="${task.Tipo === 'Monitoraggio' ? 'col-12' : 'col-4'}">
                                <div class="border rounded p-2">
                                    <div class="fw-bold text-primary">${task.totale_giornate.toFixed(1)}</div>
                                    <small class="text-muted">Tot. Giorni</small>
                                </div>
                            </div>
                            ${task.Tipo !== 'Monitoraggio' ? `
                            <div class="col-4">
                                <div class="border rounded p-2">
                                    <div class="fw-bold text-success">${giornateStats.giornate_campo.toFixed(1)}</div>
                                    <small class="text-muted">Campo</small>
                                </div>
                            </div>
                            <div class="col-4">
                                <div class="border rounded p-2">
                                    <div class="fw-bold text-warning">€${giornateStats.totale_spese.toFixed(0)}</div>
                                    <small class="text-muted">Spese</small>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Lista Giornate -->
                        ${task.giornate.length > 0 ? `
                            <button class="btn btn-outline-primary btn-sm w-100" 
                                    onclick="app.showGiornateModal('${task.ID_TASK}')">
                                <i class="fas fa-calendar-alt me-1"></i>
                                Visualizza ${task.giornate.length} Giornate
                                <i class="fas fa-external-link-alt ms-1"></i>
                            </button>
                        ` : `
                            <p class="text-muted text-center mb-0">
                                <i class="fas fa-calendar-times me-1"></i>
                                Nessuna giornata registrata
                            </p>
                        `}
                    </div>
                    <div class="card-footer bg-transparent border-0">
                        <div class="action-buttons d-flex justify-content-center">
                            <button class="btn-action view" data-action="view" data-type="task" data-id="${task.ID_TASK}" title="Visualizza dettagli completi del task">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateGiornateStats(giornate) {
        let giornate_campo = 0;
        let totale_spese = 0;
        
        giornate.forEach(g => {
            let gg = g.gg || 0;
            if (typeof gg === 'string') {
                gg = parseFloat(gg.replace(',', '.'));
            }
            gg = isNaN(gg) ? 0 : gg;
            
            if (g.Tipo === 'Campo') {
                giornate_campo += gg;
            }
            
            // Calcola spese totali
            const spese_viaggi = parseFloat((g.Spese_Viaggi || '0').toString().replace(',', '.')) || 0;
            const vitto_alloggio = parseFloat((g.Vitto_alloggio || '0').toString().replace(',', '.')) || 0;
            const altri_costi = parseFloat((g.Altri_costi || '0').toString().replace(',', '.')) || 0;
            
            totale_spese += spese_viaggi + vitto_alloggio + altri_costi;
        });
        
        return {
            giornate_campo,
            totale_spese
        };
    }
    
    createGiornataRow(giornata) {
        const collaboratore = this.collaboratori.find(c => c.id === giornata.ID_COLLABORATORE);
        const collaboratoreNome = collaboratore ? collaboratore.nome.split(' ')[0] : 'N/A';
        
        const spese_viaggi = parseFloat(giornata.Spese_Viaggi?.replace(',', '.') || 0);
        const vitto_alloggio = parseFloat(giornata.Vitto_alloggio?.replace(',', '.') || 0);
        const altri_costi = parseFloat(giornata.Altri_costi?.replace(',', '.') || 0);
        const totale_spese = spese_viaggi + vitto_alloggio + altri_costi;
        
        return `
            <tr>
                <td>
                    <small>${this.formatDate(giornata.Data)}</small>
                </td>
                <td>
                    <small>${collaboratoreNome}</small>
                </td>
                <td>
                    <span class="badge bg-primary">${giornata.gg}</span>
                </td>
                <td>
                    <small class="text-muted">${giornata.Tipo || 'Campo'}</small>
                </td>
                <td>
                    <small class="text-warning">€${totale_spese.toFixed(0)}</small>
                </td>
            </tr>
        `;
    }
    
    toggleAllCommesse() {
        const allCollapsed = document.querySelectorAll('#commesseTaskContainer .collapse:not(.show)');
        const allExpanded = document.querySelectorAll('#commesseTaskContainer .collapse.show');
        const toggleBtn = document.getElementById('toggleAllBtn');
        
        if (allCollapsed.length > allExpanded.length) {
            // Espandi tutto
            document.querySelectorAll('#commesseTaskContainer .collapse').forEach(collapse => {
                new bootstrap.Collapse(collapse, { show: true });
            });
            toggleBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i>';
            toggleBtn.title = 'Comprimi tutto';
        } else {
            // Comprimi tutto
            document.querySelectorAll('#commesseTaskContainer .collapse.show').forEach(collapse => {
                new bootstrap.Collapse(collapse, { hide: true });
            });
            toggleBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
            toggleBtn.title = 'Espandi tutto';
        }
    }
    
    showGiornateModal(taskId) {
        const task = this.tasks.find(t => t.ID_TASK === taskId);
        if (!task) return;
        
        const giornateTask = this.giornate.filter(g => g.ID_TASK === taskId);
        
        const modalHtml = `
            <div class="modal fade" id="giornateModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-calendar-day me-2"></i>
                                Giornate - ${task.Task}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${giornateTask.length === 0 ? 
                                '<p class="text-muted">Nessuna giornata registrata per questo task.</p>' :
                                `<div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Data</th>
                                                <th>Collaboratore</th>
                                                <th>Ore</th>
                                                <th>Tipo</th>
                                                <th>Spese</th>
                                                <th>Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${giornateTask.map(g => `
                                                <tr>
                                                    <td>${new Date(g.Data).toLocaleDateString('it-IT')}</td>
                                                    <td>
                                                        ${g.collaboratore_info ? g.collaboratore_info.Collaboratore : 'Non specificato'}
                                                    </td>
                                                    <td><span class="badge bg-primary">${g.gg}h</span></td>
                                                    <td>
                                                        <span class="badge ${g.Tipo === 'Campo' ? 'bg-success' : 'bg-info'}">
                                                            ${g.Tipo}
                                                        </span>
                                                        ${g.Desk === 'Si' ? '<span class="badge bg-secondary ms-1">Desk</span>' : ''}
                                                    </td>
                                                    <td>€${g.spese_totali || 0}</td>
                                                    <td>${g.Note || '-'}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>`
                            }
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente
        const existingModal = document.getElementById('giornateModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('giornateModal'));
        modal.show();
    }
    
    toggleCommessa(commessaId) {
        const collapseElement = document.getElementById(`commessa-${commessaId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${commessaId}`);
        
        if (collapseElement && toggleBtn) {
            const bsCollapse = new bootstrap.Collapse(collapseElement, { toggle: false });
            
            if (collapseElement.classList.contains('show')) {
                bsCollapse.hide();
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                bsCollapse.show();
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        }
    }
    
    toggleTaskGiornate(taskId) {
        const collapseElement = document.getElementById(`giornate-${taskId}`);
        const toggleBtn = document.getElementById(`toggleGiornateBtn-${taskId}`);
        
        if (collapseElement && toggleBtn) {
            const bsCollapse = new bootstrap.Collapse(collapseElement, { toggle: false });
            
            if (collapseElement.classList.contains('show')) {
                bsCollapse.hide();
                toggleBtn.querySelector('.fa-chevron-up')?.classList.replace('fa-chevron-up', 'fa-chevron-down');
            } else {
                bsCollapse.show();
                toggleBtn.querySelector('.fa-chevron-down')?.classList.replace('fa-chevron-down', 'fa-chevron-up');
            }
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return '-';
        
        try {
            // Gestisce formato DD/MM/YY e varianti
            const parts = dateString.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                let year = parts[2];
                
                // Converte anno a 2 cifre in 4 cifre
                if (year.length === 2) {
                    year = parseInt(year) > 50 ? '19' + year : '20' + year;
                }
                
                return `${day}/${month}/${year.slice(-2)}`;
            }
            
            return dateString;
        } catch (error) {
            return dateString;
        }
    }
    
    filterCommesseTask() {
        console.log('Filtro commesse e task attivato');
        
        const searchText = document.getElementById('searchCommesseTask')?.value.toLowerCase() || '';
        const selectedCommessa = document.getElementById('filterCommesse')?.value || '';
        const selectedStato = document.getElementById('filterStatoCommesse')?.value || '';
        
        console.log('Filtri applicati:', { searchText, selectedCommessa, selectedStato });
        
        // Filtra le commesse in base ai criteri
        let commesseFiltrate = this.commesse;
        
        // Filtro per commessa specifica
        if (selectedCommessa) {
            commesseFiltrate = commesseFiltrate.filter(c => c.ID_COMMESSA === selectedCommessa);
        }
        
        // Filtro per stato commessa
        if (selectedStato) {
            const statoMap = {
                'attiva': 'In corso',
                'completata': 'Chiusa',
                'sospesa': 'Sospesa'
            };
            const statoReale = statoMap[selectedStato] || selectedStato;
            commesseFiltrate = commesseFiltrate.filter(c => c.Stato_Commessa === statoReale);
        }
        
        // Filtro per testo di ricerca (nome commessa, task, cliente)
        if (searchText) {
            commesseFiltrate = commesseFiltrate.filter(commessa => {
                const nomeCommessa = (commessa.Commessa || '').toLowerCase();
                const cliente = (commessa.cliente_nome || '').toLowerCase();
                
                // Cerca anche nei task di questa commessa
                const tasks = this.tasks.filter(t => t.ID_COMMESSA === commessa.ID_COMMESSA);
                const hasTaskMatch = tasks.some(task => 
                    (task.Task || '').toLowerCase().includes(searchText) ||
                    (task.Desc_Task || '').toLowerCase().includes(searchText)
                );
                
                return nomeCommessa.includes(searchText) || 
                       cliente.includes(searchText) || 
                       hasTaskMatch;
            });
        }
        
        console.log('Commesse filtrate:', commesseFiltrate.length);
        
        // Ricostruisci la visualizzazione con le commesse filtrate
        this.renderFilteredCommesse(commesseFiltrate);
    }
    
    renderFilteredCommesse(commesseFiltrate) {
        const container = document.getElementById('commesseTaskContainer');
        if (!container) return;
        
        // Raggruppa i task per le commesse filtrate
        const commesseConTask = [];
        
        commesseFiltrate.forEach(commessa => {
            const cliente = this.clienti.find(c => c.ID_CLIENTE == commessa.ID_CLIENTE);
            const responsabile = this.collaboratori.find(c => c.ID_COLLABORATORE == commessa.ID_COLLABORATORE);
            
            const commessaData = {
                ...commessa,
                cliente_nome: cliente ? cliente.Cliente : '-',
                responsabile_nome: responsabile ? responsabile.Collaboratore : '-',
                tasks: []
            };
            
            // Aggiungi i task di questa commessa
            this.tasks.forEach(task => {
                if (task.ID_COMMESSA === commessa.ID_COMMESSA) {
                    // Calcola le giornate per questo task
                    const giornateTask = this.giornate.filter(g => g.ID_TASK === task.ID_TASK);
                    const totaleGiornate = giornateTask.reduce((sum, g) => {
                        let gg = g.gg || 0;
                        if (typeof gg === 'string') {
                            gg = parseFloat(gg.replace(',', '.'));
                        }
                        return sum + (isNaN(gg) ? 0 : gg);
                    }, 0);
                    
                    commessaData.tasks.push({
                        ...task,
                        giornate: giornateTask,
                        totale_giornate: totaleGiornate
                    });
                }
            });
            
            // Includi solo commesse con task
            if (commessaData.tasks.length > 0) {
                commesseConTask.push(commessaData);
            }
        });
        
        if (commesseConTask.length === 0) {
            container.innerHTML = `
                <div class="management-card">
                    <div class="management-card-body">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h5>Nessun risultato</h5>
                            <p>Nessuna commessa corrisponde ai filtri selezionati</p>
                            <button class="btn btn-outline-primary" onclick="app.clearFilters()">
                                <i class="fas fa-times me-1"></i>Cancella filtri
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = commesseConTask
            .sort((a, b) => (a.Commessa || '').localeCompare(b.Commessa || ''))
            .map(commessa => this.createCommessaCard(commessa))
            .join('');
    }
    
    clearFilters() {
        document.getElementById('searchCommesseTask').value = '';
        document.getElementById('filterCommesse').value = '';
        document.getElementById('filterStatoCommesse').value = '';
        this.loadCommesseTaskData(); // Ricarica tutti i dati
    }
    
    // Placeholder per altre sezioni
    showClientiSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-building"></i>
                        Gestione Clienti
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-building"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>La gestione clienti sarà disponibile nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showCollaboratoriSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-users"></i>
                        Gestione Collaboratori
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>La gestione collaboratori sarà disponibile nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showTariffeSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-euro-sign"></i>
                        Gestione Tariffe
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-euro-sign"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>La gestione tariffe sarà disponibile nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showFattureSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-file-invoice"></i>
                        Gestione Fatture
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-file-invoice"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>La gestione fatture sarà disponibile nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showGiornateSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-calendar-alt"></i>
                        Gestione Giornate
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-calendar-alt"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>La gestione giornate sarà disponibile nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showStatisticheSection() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-chart-bar"></i>
                        Statistiche e Report
                    </h5>
                </div>
                <div class="management-card-body">
                    <div class="empty-state">
                        <i class="fas fa-chart-bar"></i>
                        <h5>Sezione in sviluppo</h5>
                        <p>Le statistiche saranno disponibili nelle prossime versioni</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Funzioni di utilità
    handleAction(action, type, id) {
        switch (action) {
            case 'view':
                this.viewItem(type, id);
                break;
            case 'edit':
                this.editItem(type, id);
                break;
            case 'delete':
                this.deleteItem(type, id);
                break;
            case 'add':
                this.addItem(type);
                break;
        }
    }
    
    viewItem(type, id) {
        console.log(`Visualizza ${type} con ID: ${id}`);
        
        switch (type) {
            case 'task':
                this.showTaskDetails(id);
                break;
            case 'commessa':
                this.showCommessaDetails(id);
                break;
            case 'giornata':
                this.showGiornataDetails(id);
                break;
            default:
                this.showToast(`Visualizzazione ${type} - Funzione in sviluppo`, 'info');
        }
    }
    
    showTaskDetails(taskId) {
        const task = this.tasks.find(t => t.ID_TASK === taskId);
        if (!task) {
            this.showToast('Task non trovato', 'error');
            return;
        }
        
        // Trova la commessa associata
        const commessa = this.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA);
        const cliente = this.clienti.find(c => c.ID_CLIENTE === commessa?.ID_CLIENTE);
        const collaboratore = this.collaboratori.find(c => c.ID_COLLABORATORE === task.ID_COLLABORATORE);
        
        // Calcola le giornate per questo task
        const giornateTask = this.giornate.filter(g => g.ID_TASK === taskId);
        const totaleGiornate = giornateTask.reduce((sum, g) => {
            let gg = g.gg || 0;
            if (typeof gg === 'string') {
                gg = parseFloat(gg.replace(',', '.'));
            }
            return sum + (isNaN(gg) ? 0 : gg);
        }, 0);
        
        // Calcola le statistiche
        const giornateStats = this.calculateGiornateStats(giornateTask);
        const valoreCalcolato = totaleGiornate * parseFloat(task.Valore_gg || 0);
        
        const modalHtml = `
            <div class="modal fade" id="taskDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-tasks me-2"></i>
                                Dettagli Task: ${task.Task}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <!-- Informazioni principali -->
                                <div class="col-md-6">
                                    <div class="card h-100">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-info-circle me-1"></i>Informazioni Generali</h6>
                                        </div>
                                        <div class="card-body">
                                            <table class="table table-sm">
                                                <tr>
                                                    <th>ID Task:</th>
                                                    <td>${task.ID_TASK}</td>
                                                </tr>
                                                <tr>
                                                    <th>Nome:</th>
                                                    <td><strong>${task.Task}</strong></td>
                                                </tr>
                                                <tr>
                                                    <th>Descrizione:</th>
                                                    <td>${task.Desc_Task || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <th>Commessa:</th>
                                                    <td>${commessa?.Commessa || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <th>Cliente:</th>
                                                    <td>${cliente?.Cliente || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <th>Tipo:</th>
                                                    <td><span class="badge bg-info">${task.Tipo}</span></td>
                                                </tr>
                                                <tr>
                                                    <th>Stato:</th>
                                                    <td><span class="badge ${task.Stato_Task === 'In corso' ? 'bg-success' : 'bg-secondary'}">${task.Stato_Task}</span></td>
                                                </tr>
                                                <tr>
                                                    <th>Data Apertura:</th>
                                                    <td>${task.Data_Apertura_Task ? new Date(task.Data_Apertura_Task).toLocaleDateString('it-IT') : '-'}</td>
                                                </tr>
                                                ${task.Tipo === 'Monitoraggio' ? `
                                                <tr>
                                                    <th>Collaboratore:</th>
                                                    <td>${collaboratore?.Collaboratore || 'Non assegnato'}</td>
                                                </tr>
                                                ` : ''}
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Informazioni economiche -->
                                <div class="col-md-6">
                                    <div class="card h-100">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-euro-sign me-1"></i>Informazioni Economiche</h6>
                                        </div>
                                        <div class="card-body">
                                            <table class="table table-sm">
                                                <tr>
                                                    <th>Giorni Previsti:</th>
                                                    <td>${task.gg_previste || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <th>Giorni Effettuati:</th>
                                                    <td><strong>${totaleGiornate.toFixed(1)}</strong></td>
                                                </tr>
                                                <tr>
                                                    <th>Valore per Giorno:</th>
                                                    <td>€${parseFloat(task.Valore_gg || 0).toFixed(2)}</td>
                                                </tr>
                                                <tr>
                                                    <th>Valore Calcolato:</th>
                                                    <td><strong>€${valoreCalcolato.toFixed(2)}</strong></td>
                                                </tr>
                                                <tr>
                                                    <th>Spese Comprese:</th>
                                                    <td><span class="badge ${task.Spese_Comprese === 'Si' ? 'bg-success' : 'bg-warning'}">${task.Spese_Comprese}</span></td>
                                                </tr>
                                                <tr>
                                                    <th>Valore Spese Std:</th>
                                                    <td>€${parseFloat(task.Valore_Spese_std || 0).toFixed(2)}</td>
                                                </tr>
                                                <tr>
                                                    <th>Spese Totali:</th>
                                                    <td><strong>€${giornateStats.totale_spese.toFixed(2)}</strong></td>
                                                </tr>
                                                <tr>
                                                    <th>Giorni Campo:</th>
                                                    <td>${giornateStats.giornate_campo.toFixed(1)}</td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Giornate del task -->
                            <div class="row mt-3">
                                <div class="col-12">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0">
                                                <i class="fas fa-calendar-alt me-1"></i>
                                                Giornate Registrate (${giornateTask.length})
                                            </h6>
                                        </div>
                                        <div class="card-body">
                                            ${giornateTask.length === 0 ? 
                                                '<p class="text-muted">Nessuna giornata registrata per questo task.</p>' :
                                                `<div class="table-responsive">
                                                    <table class="table table-hover table-sm">
                                                        <thead>
                                                            <tr>
                                                                <th>Data</th>
                                                                <th>Collaboratore</th>
                                                                <th>Ore</th>
                                                                <th>Tipo</th>
                                                                <th>Desk</th>
                                                                <th>Spese Viaggi</th>
                                                                <th>Vitto/Alloggio</th>
                                                                <th>Altri Costi</th>
                                                                <th>Note</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            ${giornateTask.map(g => {
                                                                const collab = this.collaboratori.find(c => c.ID_COLLABORATORE === g.ID_COLLABORATORE);
                                                                return `
                                                                    <tr>
                                                                        <td>${new Date(g.Data).toLocaleDateString('it-IT')}</td>
                                                                        <td>${collab?.Collaboratore || 'N/A'}</td>
                                                                        <td><span class="badge bg-primary">${g.gg}h</span></td>
                                                                        <td>
                                                                            <span class="badge ${g.Tipo === 'Campo' ? 'bg-success' : 'bg-info'}">
                                                                                ${g.Tipo}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            ${g.Desk === 'Si' ? '<span class="badge bg-secondary">Si</span>' : '-'}
                                                                        </td>
                                                                        <td>€${parseFloat(g.Spese_Viaggi || 0).toFixed(2)}</td>
                                                                        <td>€${parseFloat(g.Vitto_alloggio || 0).toFixed(2)}</td>
                                                                        <td>€${parseFloat(g.Altri_costi || 0).toFixed(2)}</td>
                                                                        <td>${g.Note || '-'}</td>
                                                                    </tr>
                                                                `;
                                                            }).join('')}
                                                        </tbody>
                                                    </table>
                                                </div>`
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                            <button type="button" class="btn btn-primary" onclick="app.switchToEditMode('${taskId}')">
                                <i class="fas fa-edit me-1"></i>Modifica Task
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente
        const existingModal = document.getElementById('taskDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
        modal.show();
    }
    
    switchToEditMode(taskId) {
        const task = this.tasks.find(t => t.ID_TASK === taskId);
        if (!task) {
            this.showToast('Task non trovato', 'error');
            return;
        }
        
        // Trova la commessa associata
        const commessa = this.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA);
        
        // Crea il form di editing
        const editModalHtml = `
            <div class="modal fade" id="taskEditModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>
                                Modifica Task: ${task.Task}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="editTaskForm">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editTaskName" class="form-label">Nome Task *</label>
                                            <input type="text" class="form-control" id="editTaskName" value="${task.Task}" required>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editTaskDesc" class="form-label">Descrizione</label>
                                            <textarea class="form-control" id="editTaskDesc" rows="3">${task.Desc_Task || ''}</textarea>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editTaskCommessa" class="form-label">Commessa</label>
                                            <input type="text" class="form-control" id="editTaskCommessa" value="${commessa?.Commessa || ''}" readonly>
                                            <input type="hidden" id="editTaskCommessaId" value="${task.ID_COMMESSA}">
                                        </div>
                                        
                                        ${task.Tipo === 'Monitoraggio' ? `
                                        <div class="mb-3">
                                            <label for="editTaskCollaboratore" class="form-label">Collaboratore</label>
                                            <select class="form-select" id="editTaskCollaboratore">
                                                <option value="">Non assegnato</option>
                                                ${this.collaboratori.map(c => 
                                                    `<option value="${c.ID_COLLABORATORE}" ${c.ID_COLLABORATORE === task.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                        ` : ''}
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editTaskTipo" class="form-label">Tipo *</label>
                                            <select class="form-select" id="editTaskTipo" required>
                                                <option value="Campo" ${task.Tipo === 'Campo' ? 'selected' : ''}>Campo</option>
                                                <option value="Monitoraggio" ${task.Tipo === 'Monitoraggio' ? 'selected' : ''}>Monitoraggio</option>
                                                <option value="Promo" ${task.Tipo === 'Promo' ? 'selected' : ''}>Promo</option>
                                                <option value="Sviluppo" ${task.Tipo === 'Sviluppo' ? 'selected' : ''}>Sviluppo</option>
                                                <option value="Formazione" ${task.Tipo === 'Formazione' ? 'selected' : ''}>Formazione</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editTaskStato" class="form-label">Stato *</label>
                                            <select class="form-select" id="editTaskStato" required>
                                                <option value="In corso" ${task.Stato_Task === 'In corso' ? 'selected' : ''}>In corso</option>
                                                <option value="Chiuso" ${task.Stato_Task === 'Chiuso' ? 'selected' : ''}>Chiuso</option>
                                                <option value="Sospeso" ${task.Stato_Task === 'Sospeso' ? 'selected' : ''}>Sospeso</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editTaskDataApertura" class="form-label">Data Apertura</label>
                                            <input type="date" class="form-control" id="editTaskDataApertura" 
                                                   value="${task.Data_Apertura_Task ? task.Data_Apertura_Task.split('T')[0] : ''}">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editTaskGgPreviste" class="form-label">Giorni Previsti</label>
                                            <input type="number" step="0.5" class="form-control" id="editTaskGgPreviste" 
                                                   value="${task.gg_previste || ''}">
                                        </div>
                                    </div>
                                </div>
                                
                                <hr>
                                <h6><i class="fas fa-euro-sign me-1"></i>Informazioni Economiche</h6>
                                
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="editTaskValoreGg" class="form-label">Valore per Giorno (€)</label>
                                            <input type="number" step="0.01" class="form-control" id="editTaskValoreGg" 
                                                   value="${task.Valore_gg || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="editTaskSpeseComprese" class="form-label">Spese Comprese</label>
                                            <select class="form-select" id="editTaskSpeseComprese" onchange="app.toggleValoreSpese()">
                                                <option value="Si" ${task.Spese_Comprese === 'Si' ? 'selected' : ''}>Si</option>
                                                <option value="No" ${task.Spese_Comprese === 'No' ? 'selected' : ''}>No</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="mb-3" id="valoreSpesesContainer" style="display: ${task.Spese_Comprese === 'No' ? 'block' : 'none'}">
                                            <label for="editTaskValoreSpese" class="form-label">Valore Spese Standard (€)</label>
                                            <input type="number" step="0.01" class="form-control" id="editTaskValoreSpese" 
                                                   value="${task.Valore_Spese_std || ''}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="app.showTaskDetails('${taskId}')">
                                    <i class="fas fa-eye me-1"></i>Torna a Visualizza
                                </button>
                                <button type="button" class="btn btn-danger" onclick="app.deleteTaskWithValidation('${taskId}')">
                                    <i class="fas fa-trash me-1"></i>Elimina Task
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-1"></i>Salva Modifiche
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistenti
        document.getElementById('taskDetailsModal')?.remove();
        document.getElementById('taskEditModal')?.remove();
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', editModalHtml);
        
        // Aggiungi event listener per il submit
        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskChanges(taskId);
        });
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('taskEditModal'));
        modal.show();
    }
    
    toggleValoreSpese() {
        const speseComprese = document.getElementById('editTaskSpeseComprese').value;
        const valoreSpesesContainer = document.getElementById('valoreSpesesContainer');
        
        if (speseComprese === 'No') {
            valoreSpesesContainer.style.display = 'block';
        } else {
            valoreSpesesContainer.style.display = 'none';
            // Reset del valore quando le spese sono comprese
            document.getElementById('editTaskValoreSpese').value = '';
        }
    }
    
    async deleteTaskWithValidation(taskId) {
        try {
            const task = this.tasks.find(t => t.ID_TASK === taskId);
            if (!task) {
                this.showToast('Task non trovato', 'error');
                return;
            }
            
            // Verifica se ci sono giornate associate al task
            const giornateAssociate = this.giornate.filter(g => g.ID_TASK === taskId);
            
            if (giornateAssociate.length > 0) {
                // Mostra modal di errore se ci sono giornate
                this.showDeleteTaskErrorModal(task.Task, giornateAssociate.length);
                return;
            }
            
            // Se non ci sono giornate, procedi con la conferma eliminazione
            this.showDeleteTaskConfirmModal(taskId, task.Task);
            
        } catch (error) {
            console.error('Errore validazione eliminazione task:', error);
            this.showToast('Errore durante la validazione', 'error');
        }
    }
    
    showDeleteTaskErrorModal(taskName, numGiornate) {
        const modalHtml = `
            <div class="modal fade" id="deleteTaskErrorModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Impossibile Eliminare Task
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <h6><i class="fas fa-warning me-1"></i>Task con Giornate Associate</h6>
                                <p>Il task <strong>"${taskName}"</strong> non può essere eliminato perché ha <strong>${numGiornate} giornate</strong> associate in FACT_GIORNATE.</p>
                            </div>
                            
                            <h6>Per eliminare questo task:</h6>
                            <ol>
                                <li>Cancella prima tutte le <strong>${numGiornate} giornate</strong> associate al task</li>
                                <li>Torna qui per eliminare il task</li>
                            </ol>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-lightbulb me-1"></i>
                                <strong>Suggerimento:</strong> Puoi visualizzare le giornate del task cliccando su "Visualizza Giornate" nella scheda del task.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i>Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistenti
        document.getElementById('deleteTaskErrorModal')?.remove();
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('deleteTaskErrorModal'));
        modal.show();
    }
    
    showDeleteTaskConfirmModal(taskId, taskName) {
        const modalHtml = `
            <div class="modal fade" id="deleteTaskConfirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-question-circle me-2"></i>
                                Conferma Eliminazione Task
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <h6><i class="fas fa-exclamation-triangle me-1"></i>Attenzione!</h6>
                                <p>Sei sicuro di voler eliminare il task <strong>"${taskName}"</strong>?</p>
                                <p class="mb-0"><strong>Questa azione non può essere annullata.</strong></p>
                            </div>
                            
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle me-1"></i>
                                Il task non ha giornate associate, l'eliminazione è sicura.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i>Annulla
                            </button>
                            <button type="button" class="btn btn-danger" onclick="app.executeTaskDeletion('${taskId}')">
                                <i class="fas fa-trash me-1"></i>Elimina Task
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistenti
        document.getElementById('deleteTaskConfirmModal')?.remove();
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('deleteTaskConfirmModal'));
        modal.show();
    }
    
    async executeTaskDeletion(taskId) {
        try {
            const response = await fetch(`API/index.php?resource=task&action=delete&id=${taskId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Task eliminato con successo', 'success');
                
                // Chiudi tutti i modal
                bootstrap.Modal.getInstance(document.getElementById('deleteTaskConfirmModal'))?.hide();
                bootstrap.Modal.getInstance(document.getElementById('taskEditModal'))?.hide();
                
                // Ricarica i dati
                await this.loadTasks();
                
                // Ricarica la visualizzazione delle commesse
                if (this.currentSection === 'commesse-task') {
                    this.loadCommesseTaskData();
                }
                
            } else {
                throw new Error(result.message || 'Errore durante l\'eliminazione');
            }
            
        } catch (error) {
            console.error('Errore eliminazione task:', error);
            this.showToast(error.message, 'error');
        }
    }
    
    async saveTaskChanges(taskId) {
        try {
            const formData = {
                Task: document.getElementById('editTaskName').value,
                Desc_Task: document.getElementById('editTaskDesc').value,
                ID_COMMESSA: document.getElementById('editTaskCommessaId').value, // Usa l'hidden field
                Tipo: document.getElementById('editTaskTipo').value,
                Stato_Task: document.getElementById('editTaskStato').value,
                Data_Apertura_Task: document.getElementById('editTaskDataApertura').value || null,
                gg_previste: document.getElementById('editTaskGgPreviste').value || null,
                Valore_gg: document.getElementById('editTaskValoreGg').value || null,
                Spese_Comprese: document.getElementById('editTaskSpeseComprese').value
            };
            
            // Aggiungi collaboratore solo se è un task di monitoraggio
            const task = this.tasks.find(t => t.ID_TASK === taskId);
            if (task && task.Tipo === 'Monitoraggio') {
                const collaboratoreElement = document.getElementById('editTaskCollaboratore');
                formData.ID_COLLABORATORE = collaboratoreElement ? collaboratoreElement.value || null : null;
            } else {
                formData.ID_COLLABORATORE = null;
            }
            
            // Aggiungi valore spese solo se spese non comprese
            if (formData.Spese_Comprese === 'No') {
                formData.Valore_Spese_std = document.getElementById('editTaskValoreSpese').value || null;
            } else {
                formData.Valore_Spese_std = null;
            }
            
            // Mostra loading
            const submitBtn = document.querySelector('#editTaskForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Salvando...';
            submitBtn.disabled = true;
            
            const response = await fetch(`API/index.php?resource=task&action=update&id=${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Task aggiornato con successo', 'success');
                
                // Ricarica i dati
                await this.loadTasks();
                
                // Chiudi modal e torna alla visualizzazione
                bootstrap.Modal.getInstance(document.getElementById('taskEditModal')).hide();
                
                // Ricarica la visualizzazione delle commesse
                if (this.currentSection === 'commesse-task') {
                    this.loadCommesseTaskData();
                }
                
                // Mostra di nuovo i dettagli del task aggiornato
                setTimeout(() => {
                    this.showTaskDetails(taskId);
                }, 500);
                
            } else {
                throw new Error(result.message || 'Errore durante il salvataggio');
            }
            
        } catch (error) {
            console.error('Errore salvataggio task:', error);
            this.showToast(error.message, 'error');
        } finally {
            // Ripristina pulsante
            const submitBtn = document.querySelector('#editTaskForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
                submitBtn.disabled = false;
            }
        }
    }
    
    editItem(type, id) {
        console.log(`Modifica ${type} con ID: ${id}`);
        this.showToast(`Modifica ${type} - Funzione in sviluppo`, 'info');
    }
    
    deleteItem(type, id) {
        const confirmMessage = `Sei sicuro di voler eliminare questo ${type}?`;
        
        if (confirm(confirmMessage)) {
            console.log(`Elimina ${type} con ID: ${id}`);
            this.showToast(`Eliminazione ${type} - Funzione in sviluppo`, 'info');
        }
    }
    
    addItem(type) {
        console.log(`Aggiungi nuovo ${type}`);
        
        switch (type) {
            case 'commessa':
                this.showNewCommessaModal();
                break;
            case 'task':
                this.showNewTaskModal();
                break;
            default:
                this.showToast(`Aggiunta ${type} - Funzione in sviluppo`, 'info');
        }
    }
    
    showNewCommessaModal() {
        // Ottieni la data odierna in formato YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];
        
        const modalHtml = `
            <div class="modal fade" id="newCommessaModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-plus me-2"></i>
                                Nuova Commessa
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="newCommessaForm">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="newCommessaName" class="form-label">Nome Commessa *</label>
                                            <input type="text" class="form-control" id="newCommessaName" required>
                                        </div>

                                        <div class="mb-3">
                                            <label for="newCommessaTipo" class="form-label">Tipo Commessa *</label>
                                            <select class="form-select" id="newCommessaTipo" required>
                                                <option value="">Seleziona tipo</option>
                                                <option value="Cliente">Cliente</option>
                                                <option value="Interna">Interna</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3" id="newCommessaClienteContainer" style="display: none;">
                                            <label for="newCommessaCliente" class="form-label">Cliente *</label>
                                            <select class="form-select" id="newCommessaCliente">
                                                <option value="">Seleziona Cliente</option>
                                                ${this.clienti.map(c => 
                                                    `<option value="${c.ID_CLIENTE}">${c.Cliente}</option>`
                                                ).join('')}
                                            </select>
                                        </div>

                                        <div class="mb-3" id="newCommessaCommissioneContainer" style="display: none;">
                                            <label for="newCommessaCommissione" class="form-label">Commissione (da 0 a 1, es. 0.25 per 25%)</label>
                                            <input type="number" class="form-control" id="newCommessaCommissione" min="0" max="1" step="0.01" placeholder="0.25">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="newCommessaResponsabile" class="form-label">Responsabile *</label>
                                            <select class="form-select" id="newCommessaResponsabile" required>
                                                <option value="">Seleziona responsabile</option>
                                                ${this.collaboratori.map(c => 
                                                    `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="newCommessaDescrizione" class="form-label">Descrizione Commessa</label>
                                            <textarea class="form-control" id="newCommessaDescrizione" rows="3"></textarea>
                                        </div>

                                        <div class="mb-3">
                                            <label for="newCommessaDataInizio" class="form-label">Data Inizio</label>
                                            <input type="date" class="form-control" id="newCommessaDataInizio" value="${today}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times me-1"></i>Annulla
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-plus me-1"></i>Crea Commessa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistenti
        document.getElementById('newCommessaModal')?.remove();
        
        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Aggiungi event listener per il submit
        document.getElementById('newCommessaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewCommessaWithTask();
        });

        // Aggiungi event listener per il tipo commessa
        document.getElementById('newCommessaTipo').addEventListener('change', () => {
            this.toggleCommissioneField();
        });
        
        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('newCommessaModal'));
        modal.show();
    }
    
    async createNewCommessaWithTask() {
        try {
            const submitBtn = document.querySelector('#newCommessaForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Creazione...';
            submitBtn.disabled = true;

            // Raccogli i dati della commessa
            const commessaData = {
                Commessa: document.getElementById('newCommessaName').value,
                Desc_Commessa: document.getElementById('newCommessaDescrizione').value || null,
                Tipo_Commessa: document.getElementById('newCommessaTipo').value,
                ID_CLIENTE: document.getElementById('newCommessaCliente').value || null,
                Commissione: document.getElementById('newCommessaCommissione').value || 0,
                ID_COLLABORATORE: document.getElementById('newCommessaResponsabile').value || null,
                Data_Apertura_Commessa: document.getElementById('newCommessaDataInizio').value || null,
                Stato_Commessa: 'In corso' // Default per nuove commesse
            };

            // Genera automaticamente il codice commessa
            commessaData.ID_COMMESSA = this.generateCommessaCode();

            // Validazioni
            if (!commessaData.Commessa.trim()) {
                throw new Error('Inserisci il nome della commessa');
            }
            if (!commessaData.Tipo_Commessa) {
                throw new Error('Seleziona il tipo di commessa');
            }
            if (commessaData.Tipo_Commessa === 'Cliente' && !commessaData.ID_CLIENTE) {
                throw new Error('Seleziona un cliente per le commesse di tipo Cliente');
            }
            if (!commessaData.ID_COLLABORATORE) {
                throw new Error('Seleziona il responsabile della commessa');
            }

            console.log('Dati commessa da creare:', commessaData);

            // Chiamata API per creare la commessa - ENDPOINT ROUTER
            const response = await fetch('API/index.php?resource=commesse&action=create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commessaData)
            });

            const result = await response.json();
            // ...removed accidental HTML injection...
            console.log('Risposta creazione commessa:', result);

            if (result.success) {
                this.showToast('Commessa creata con successo!', 'success');
                // Chiudi il modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('newCommessaModal'));
                modal.hide();
                // Ricarica i dati e aggiorna la vista
                await this.loadCommesse();
                // Refresh automatico della vista commesse
                if (typeof this.renderCommesseTask === 'function') {
                    this.renderCommesseTask();
                } else if (typeof this.renderCommesse === 'function') {
                    this.renderCommesse();
                } else {
                    // Aggiornamento manuale della lista commesse se non esiste funzione dedicata
                    const commesseList = document.getElementById('commesseList');
                    if (commesseList) {
                        commesseList.innerHTML = this.commesse.map(c => `<li>${c.Commessa}</li>`).join('');
                    }
                }
                // Refresh automatico del filtro commesse (header)
                const filterCommessa = document.getElementById('filterCommessa');
                if (filterCommessa) {
                    let options = '<option value="">Tutte le commesse</option>';
                    this.commesse.forEach(c => {
                        options += `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`;
                    });
                    filterCommessa.innerHTML = options;
                }
            } else {
                throw new Error(result.message || 'Errore durante la creazione della commessa');
            }

        } catch (error) {
            console.error('Errore creazione commessa:', error);
            this.showToast(error.message, 'error');
        } finally {
            // Ripristina pulsante
            const submitBtn = document.querySelector('#newCommessaForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Crea Commessa';
                submitBtn.disabled = false;
            }
        }
    }

    generateCommessaCode() {
        // Genera un codice automatico nel formato COM + anno + numero progressivo
        const year = new Date().getFullYear();
        const existingCommesse = this.commesse || [];
        
        // Trova il numero progressivo più alto per l'anno corrente
        let maxNumber = 0;
        const yearPrefix = `COM${year}`;
        
        existingCommesse.forEach(commessa => {
            if (commessa.ID_COMMESSA && commessa.ID_COMMESSA.startsWith(yearPrefix)) {
                const numberPart = commessa.ID_COMMESSA.replace(yearPrefix, '');
                const number = parseInt(numberPart, 10);
                if (!isNaN(number) && number > maxNumber) {
                    maxNumber = number;
                }
            }
        });
        
        // Incrementa e formatta con zero padding
        const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
        return `${yearPrefix}${nextNumber}`;
    }

    toggleCommissioneField() {
        const tipoCommessa = document.getElementById('newCommessaTipo').value;
        const clienteContainer = document.getElementById('newCommessaClienteContainer');
        const commissioneContainer = document.getElementById('newCommessaCommissioneContainer');
        const clienteSelect = document.getElementById('newCommessaCliente');
        
        if (tipoCommessa === 'Cliente') {
            clienteContainer.style.display = 'block';
            commissioneContainer.style.display = 'block';
            clienteSelect.required = true;
        } else if (tipoCommessa === 'Interna') {
            clienteContainer.style.display = 'none';
            commissioneContainer.style.display = 'none';
            clienteSelect.required = false;
            clienteSelect.value = '';
            document.getElementById('newCommessaCommissione').value = '';
        }
    }

    showNewTaskModal() {
        this.showNewTaskModalForCommessa(null);
    }

    showNewTaskModalForCommessa(commessaId) {
        console.log('Mostra modal nuovo task', commessaId ? `per commessa ${commessaId}` : 'generale');
        
        // Filtra clienti e collaboratori per i dropdown
        const clientiOptions = this.clienti.map(c => 
            `<option value="${c.id_cliente}">${c.nome_cliente}</option>`
        ).join('');
        
        const collaboratoriOptions = this.collaboratori.map(c => 
            `<option value="${c.id_collaboratore}">${c.nome} ${c.cognome}</option>`
        ).join('');

        // Filtra commesse per il dropdown (se non è specificata una commessa)
        let commesseDropdown = '';
        if (!commessaId) {
            commesseDropdown = `<div class="mb-3">
                <label for="newTaskCommessa" class="form-label">Commessa *</label>
                <select class="form-select" id="newTaskCommessa" required>
                    ${this.commesse.map(c => `<option value="${c.id_commessa}">${c.nome_commessa}</option>`).join('')}
                </select>
            </div>`;
        }

        const modalHtml = `
            <div class="modal fade" id="newTaskModal" tabindex="-1" aria-labelledby="newTaskModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="newTaskModalLabel">
                                <i class="fas fa-plus-circle me-2"></i>Nuovo Task${commessaId ? ' per Commessa' : ''}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="newTaskForm">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        ${commesseDropdown}
                                        <div class="mb-3">
                                            <label for="newTaskNome" class="form-label">Nome Task *</label>
                                            <input type="text" class="form-control" id="newTaskNome" required />
                                        </div>
                                        <div class="mb-3">
                                            <label for="newTaskDescrizione" class="form-label">Descrizione</label>
                                            <textarea class="form-control" id="newTaskDescrizione" rows="3"></textarea>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="newTaskTipo" class="form-label">Tipo *</label>
                                            <select class="form-select" id="newTaskTipo" required>
                                                <option value="Campo">Campo</option>
                                                <option value="Monitoraggio">Monitoraggio</option>
                                                <option value="Promo">Promo</option>
                                                <option value="Sviluppo">Sviluppo</option>
                                                <option value="Formazione">Formazione</option>
                                            </select>
                                        </div>
                                        <div class="mb-3" id="newTaskCollaboratoreContainer" style="display:none;">
                                            <label for="newTaskCollaboratore" class="form-label">Collaboratore</label>
                                            <select class="form-select" id="newTaskCollaboratore">
                                                <option value="">Seleziona...</option>
                                                ${this.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label for="newTaskDataApertura" class="form-label">Data Apertura</label>
                                            <input type="date" class="form-control" id="newTaskDataApertura" />
                                        </div>
                                        <div class="mb-3">
                                            <label for="newTaskGgPreviste" class="form-label">Giorni Previsti</label>
                                            <input type="number" step="0.5" class="form-control" id="newTaskGgPreviste" />
                                        </div>
                                    </div>
                                </div>
                                <hr />
                                <h6><i class="fas fa-euro-sign me-1"></i>Informazioni Economiche</h6>
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="newTaskValoreGg" class="form-label">Valore per Giorno (€)</label>
                                            <input type="number" step="0.01" class="form-control" id="newTaskValoreGg" />
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="newTaskSpeseComprese" class="form-label">Spese Comprese</label>
                                            <select class="form-select" id="newTaskSpeseComprese" onchange="app.toggleValoreSpeseForNewTask()">
                                                <option value="No">No</option>
                                                <option value="Si">Si</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3" id="newTaskValoreSpeseContainer" style="display: none;">
                                            <label for="newTaskValoreSpese" class="form-label">Valore Spese Standard (€)</label>
                                            <input type="number" step="0.01" class="form-control" id="newTaskValoreSpese" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-plus me-1"></i>Crea Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Rimuovi modal esistente se presente
        const existingModal = document.getElementById('newTaskModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Aggiungi il modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Se commessaId è specificato, impostalo come valore fisso
        if (commessaId) {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = 'newTaskCommessaFixed';
            hiddenInput.value = commessaId;
            document.getElementById('newTaskForm').appendChild(hiddenInput);
        }

        // Imposta la data di apertura di default a oggi
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('newTaskDataApertura').value = today;

        // Mostra/nascondi collaboratore in base al tipo
        document.getElementById('newTaskTipo').addEventListener('change', function() {
            const collabContainer = document.getElementById('newTaskCollaboratoreContainer');
            if (this.value === 'Monitoraggio') {
                collabContainer.style.display = 'block';
            } else {
                collabContainer.style.display = 'none';
                document.getElementById('newTaskCollaboratore').value = '';
            }
        });

        // Gestione submit del form
        document.getElementById('newTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewTask(commessaId);
        });

        // Mostra il modal
        const modal = new bootstrap.Modal(document.getElementById('newTaskModal'));
        modal.show();
    }

    toggleCollaboratoreForNewTask(collaboratoreId) {
        console.log('Toggle collaboratore per nuovo task:', collaboratoreId);
        // Logica per gestire la selezione/deselezione dei collaboratori
        // Potrebbe essere utilizzata per validazioni o feedback visivi
    }

    toggleValoreSpeseForNewTask() {
        const checkbox = document.getElementById('newTaskConSpese');
        const container = document.getElementById('newTaskValoreSpeseContainer');
        
        if (checkbox.checked) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            document.getElementById('newTaskValoreSpese').value = '';
        }
    }

    async createNewTask(commessaId = null) {
        try {
            const submitBtn = document.querySelector('#newTaskForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Creazione...';
            submitBtn.disabled = true;

            // Raccogli i dati dal form
                const formData = {
                    ID_COMMESSA: commessaId || document.getElementById('newTaskCommessa').value,
                    Task: document.getElementById('newTaskNome').value,
                    Desc_Task: document.getElementById('newTaskDescrizione').value || null,
                    Tipo: document.getElementById('newTaskTipo').value,
                    Stato_Task: 'In corso',
                    Data_Apertura_Task: document.getElementById('newTaskDataApertura').value || null,
                    gg_previste: document.getElementById('newTaskGgPreviste').value || null,
                    Valore_gg: document.getElementById('newTaskValoreGg').value || 0,
                    Spese_Comprese: document.getElementById('newTaskSpeseComprese').value,
                    Valore_Spese_std: document.getElementById('newTaskValoreSpese').value || null
                };

                // Aggiungi ID_COLLABORATORE solo se il tipo è Monitoraggio
                if (document.getElementById('newTaskTipo').value === 'Monitoraggio') {
                    formData.ID_COLLABORATORE = document.getElementById('newTaskCollaboratore').value || null;
                }

            const apiUrl = 'API/index.php?resource=task&action=create';
            const payload = { ...formData };
            console.log('[Nuovo Task] Chiamata API:', apiUrl);
            console.log('[Nuovo Task] Payload inviato:', payload);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const responseText = await response.text();
            console.log('[Nuovo Task] Risposta grezza:', responseText);
            let result = null;
            try {
                result = JSON.parse(responseText);
            } catch (err) {
                console.error('Risposta API non valida o vuota:', responseText);
                this.showToast('Errore API: risposta non valida o vuota', 'error');
                throw new Error('API response not valid JSON');
            }

            if (result && result.success) {
                this.showToast('Task creato con successo', 'success');
                bootstrap.Modal.getInstance(document.getElementById('newTaskModal')).hide();
                document.getElementById('newTaskForm').reset();
                // Aggiorna la UI, ad esempio ricarica i task della commessa
                if (typeof this.loadTasksForCommessa === 'function') {
                    this.loadTasksForCommessa(formData.ID_COMMESSA);
                }
            } else {
                console.error('Errore creazione task:', result);
                throw new Error((result && result.message) || 'Errore creazione task');
            }
        } catch (error) {
            console.error('Errore creazione task:', error);
            this.showToast(error.message, 'error');
        }
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast_' + Date.now();
        
        const toastHtml = `
            <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas fa-${this.getToastIcon(type)} me-2"></i>
                    <strong class="me-auto">${this.getToastTitle(type)}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        // Rimuovi il toast dal DOM dopo che è stato nascosto
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    getToastTitle(type) {
        const titles = {
            success: 'Successo',
            error: 'Errore',
            warning: 'Attenzione',
            info: 'Informazione'
        };
        return titles[type] || 'Notifica';
    }
}

// Inizializza l'applicazione quando il DOM è caricato
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ManagementApp();
});

// Esponi l'app globalmente per debug
window.managementApp = app;