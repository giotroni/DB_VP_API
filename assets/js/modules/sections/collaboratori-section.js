/**
 * @file collaboratori-section.js
 * @description Classe per la gestione della sezione "Collaboratori".
 * @version 1.0
 */
class CollaboratoriSection extends BaseSection {
    constructor(appInstance) {
        super('Collaboratori', appInstance);
        this.collaboratoriConGiornate = [];
    }

    async loadData() {
        this.collaboratoriConGiornate = this.groupGiornateByCollaboratore();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Collaboratori', 'Anagrafica, giornate e costi del personale');
        this.updateTopbarActions(`<button class="btn btn-vp-primary" data-action="add-collaboratore"><i class="fas fa-user-plus me-2"></i>Nuovo Collaboratore</button>`);
        
        const container = this.getContainer();
        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-4 col-md-6">
                        <label for="searchCollaboratori" class="form-label">Cerca collaboratore</label>
                        <input type="text" class="form-control" id="searchCollaboratori" placeholder="Nome, email, utente...">
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <label for="filterRuolo" class="form-label">Filtra per Ruolo</label>
                        <select class="form-select" id="filterRuolo">
                            <option value="">Tutti i ruoli</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="User">User</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="collaboratoriContainer">
                ${this.renderCollaboratoriCards(this.collaboratoriConGiornate)}
            </div>
        `;

        this.updateStats(this.collaboratoriConGiornate);
        this.bindEvents();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchCollaboratori');
        const filterRuolo = document.getElementById('filterRuolo');

        // Debounce the search input to avoid filtering on every keystroke
        let debounceTimeout;
        searchInput?.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => this.filterData(), 300);
        });

        filterRuolo?.addEventListener('change', () => this.filterData());
    }
    
    handleAction(action, id) {
        switch (action) {
            case 'add-collaboratore':
                this.showNewCollaboratoreModal();
                break;
            case 'edit-collaboratore':
                this.showEditCollaboratoreModal(id);
                break;
            case 'toggle-collaboratore':
                this.toggleCollaboratore(id);
                break;
            default:
                console.warn(`Azione non gestita: ${action}`);
        }
    }

    // ========================================================================
    // SEZIONE: RENDERING
    // ========================================================================

    renderCollaboratoriCards(collaboratori) {
        if (!collaboratori || collaboratori.length === 0) {
            return this.ui.createEmptyState('fas fa-users-slash', 'Nessun Collaboratore Trovato', 'Non ci sono collaboratori che corrispondono ai filtri di ricerca.');
        }
        return collaboratori.map(c => this.createCollaboratoreCard(c)).join('');
    }

    createCollaboratoreCard(collaboratore) {
        const stats = collaboratore.statistics || {};
        const totalGiornate = collaboratore.giornate.length;

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-user-circle me-2"></i>${collaboratore.Collaboratore}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary" title="Ruolo"><i class="fas fa-shield-alt me-1"></i>${collaboratore.Ruolo}</span>
                            <span class="badge bg-info text-dark" title="Commesse Assegnate"><i class="fas fa-briefcase me-1"></i>${stats.commesse_assegnate || 0}</span>
                            <span class="badge bg-secondary" title="Task Assegnati"><i class="fas fa-tasks me-1"></i>${stats.task_assegnati || 0}</span>
                             <span class="badge bg-success" title="Totale Giornate Registrate"><i class="fas fa-calendar-check me-1"></i>${totalGiornate}</span>
                            <button class="btn btn-sm btn-outline-light" data-action="edit-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}" title="Modifica Collaboratore"><i class="fas fa-pencil-alt"></i></button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${collaboratore.ID_COLLABORATORE}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small">
                        <i class="fas fa-envelope me-1"></i> ${collaboratore.Email} |
                        <i class="fas fa-user me-1"></i> User: ${collaboratore.User}
                    </div>
                </div>
                <div class="collapse" id="collaboratore-${collaboratore.ID_COLLABORATORE}">
                    <div class="management-card-body">
                        ${this.renderGiornateByMonth(collaboratore.giornateByMonth)}
                    </div>
                </div>
            </div>`;
    }

    renderGiornateByMonth(giornateByMonth) {
        const months = Object.keys(giornateByMonth).sort().reverse(); // Ordina i mesi dal più recente
        if (months.length === 0) {
            return '<p class="text-muted">Nessuna giornata registrata per questo collaboratore.</p>';
        }

        return months.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const giornate = giornateByMonth[monthKey];
            
            const totalCostoMese = giornate.reduce((sum, g) => sum + (g.costo_calcolato || 0), 0);

            return `
                <div class="mb-4">
                    <h6 class="mb-2 d-flex justify-content-between">
                        <span><i class="fas fa-calendar-alt me-2"></i>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                        <span class="fw-bold">Costo Totale Mese: ${this.app.utils.formatCurrency(totalCostoMese)}</span>
                    </h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover table-bordered">
                            <thead class="table-light">
                                <tr>
                                    <th>Data</th>
                                    <th>Commessa</th>
                                    <th>Task</th>
                                    <th>gg</th>
                                    <th>Tipo</th>
                                    <th class="text-end">Costo Giornata</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${giornate.map(g => this.renderGiornataRow(g)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderGiornataRow(giornata) {
        // 1. Trova il task associato alla giornata (come già avviene)
        const task = this.app.tasks.find(t => String(t.ID_TASK) === String(giornata.ID_TASK));
        
        // 2. CORREZIONE: Cerca la commessa usando l'ID_COMMESSA dal task trovato, non dalla giornata
        const commessa = task ? this.app.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA) : null;
        
        const costo = giornata.costo_calcolato || 0;

        return `
            <tr>
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${commessa ? commessa.Commessa : 'N/D'}</td>
                <td>${task ? task.Task : 'N/D'}</td>
                <td><span class="badge bg-primary">${giornata.gg}g</span></td>
                <td>${giornata.Tipo}</td>
                <td class="text-end fw-bold ${costo > 0 ? 'text-success' : ''}">${this.app.utils.formatCurrency(costo)}</td>
            </tr>
        `;
    }

    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE E FILTRI
    // ========================================================================
    
    filterData() {
        const searchText = document.getElementById('searchCollaboratori')?.value.toLowerCase() || '';
        const selectedRuolo = document.getElementById('filterRuolo')?.value || '';

        const filteredData = this.collaboratoriConGiornate.filter(c => {
            const matchSearch = !searchText ||
                (c.Collaboratore || '').toLowerCase().includes(searchText) ||
                (c.Email || '').toLowerCase().includes(searchText) ||
                (c.User || '').toLowerCase().includes(searchText);
            
            const matchRuolo = !selectedRuolo || c.Ruolo === selectedRuolo;

            return matchSearch && matchRuolo;
        });

        document.getElementById('collaboratoriContainer').innerHTML = this.renderCollaboratoriCards(filteredData);
        this.updateStats(filteredData);
    }
    
    toggleCollaboratore(collaboratoreId, forceState = null) {
        const collapseElement = document.getElementById(`collaboratore-${collaboratoreId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${collaboratoreId}`);
        if (!collapseElement || !toggleBtn) return;

        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        if (forceState === true) bsCollapse.show();
        else if (forceState === false) bsCollapse.hide();
        else bsCollapse.toggle();

        collapseElement.addEventListener('shown.bs.collapse', () => this.updateToggleButton(toggleBtn, true), { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', () => this.updateToggleButton(toggleBtn, false), { once: true });
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
    }
    
    // ========================================================================
    // SEZIONE: GESTIONE MODALI E FORM
    // ========================================================================

    showNewCollaboratoreModal() {
        const modalTitle = 'Crea Nuovo Collaboratore';
        const modalId = 'newCollaboratoreModal';
        const modalBody = this.getCollaboratoreFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Collaboratore</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
    }
    
    showEditCollaboratoreModal(collaboratoreId) {
        const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === collaboratoreId);
        if (!collaboratore) {
            this.ui.showToast('Collaboratore non trovato.', 'error');
            return;
        }

        const modalTitle = `Modifica Collaboratore: ${collaboratore.Collaboratore}`;
        const modalId = `editCollaboratoreModal_${collaboratoreId}`;
        const modalBody = this.getCollaboratoreFormHTML(collaboratore);
        
        // TODO: Aggiungere logica di eliminazione con controllo dei vincoli
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
    }
    
    getCollaboratoreFormHTML(collaboratore = {}) {
        const formId = collaboratore.ID_COLLABORATORE ? `editCollaboratoreModal_${collaboratore.ID_COLLABORATORE}_form` : 'newCollaboratoreModal_form';
        const isEdit = !!collaboratore.ID_COLLABORATORE;
        
        const ruoli = ['User', 'Manager', 'Admin'];
        const ruoliOptions = ruoli.map(r => `<option value="${r}" ${(collaboratore.Ruolo || 'User') === r ? 'selected' : ''}>${r}</option>`).join('');

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-8 mb-3">
                        <label for="Collaboratore" class="form-label">Nome e Cognome</label>
                        <input type="text" class="form-control" id="Collaboratore" name="Collaboratore" value="${collaboratore.Collaboratore || ''}" required>
                    </div>
                    <div class="col-md-4 mb-3">
                         <label for="Ruolo" class="form-label">Ruolo</label>
                         <select class="form-select" id="Ruolo" name="Ruolo" required>${ruoliOptions}</select>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="Email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="Email" name="Email" value="${collaboratore.Email || ''}" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="User" class="form-label">Username</label>
                        <input type="text" class="form-control" id="User" name="User" value="${collaboratore.User || ''}" required>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="PWD" class="form-label">${isEdit ? 'Nuova Password (lascia vuoto per non cambiare)' : 'Password'}</label>
                        <input type="password" class="form-control" id="PWD" name="PWD" ${isEdit ? '' : 'required'}>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="PIVA" class="form-label">Partita IVA (opzionale)</label>
                        <input type="text" class="form-control" id="PIVA" name="PIVA" value="${collaboratore.PIVA || ''}">
                    </div>
                </div>
                ${!isEdit ? `<div class="form-text">La password verrà inviata via email al nuovo collaboratore.</div>` : ''}
            </form>
        `;
    }

    // ========================================================================
    // SEZIONE: CALCOLI E GROUPING
    // ========================================================================

    groupGiornateByCollaboratore() {
        return this.app.collaboratori.map(collaboratore => {
            const giornate = this.app.giornate
                .filter(g => g.ID_COLLABORATORE === collaboratore.ID_COLLABORATORE)
                .map(g => ({
                    ...g,
                    costo_calcolato: this.calculateGiornataCost(g)
                }))
                .sort((a, b) => new Date(b.Data) - new Date(a.Data)); // Ordina per data decrescente

            const giornateByMonth = giornate.reduce((acc, g) => {
                const monthKey = g.Data.substring(0, 7); // "YYYY-MM"
                if (!acc[monthKey]) {
                    acc[monthKey] = [];
                }
                acc[monthKey].push(g);
                return acc;
            }, {});

            return {
                ...collaboratore,
                giornate,
                giornateByMonth
            };
        }).sort((a, b) => a.Collaboratore.localeCompare(b.Collaboratore));
    }
    
    calculateGiornataCost(giornata) {
        if (giornata.Tipo !== 'Campo') {
            return 0;
        }

        const tariffa = this.findTariffa(giornata.ID_COLLABORATORE, giornata.Data);
        const tariffaGiornaliera = tariffa ? parseFloat(tariffa.Tariffa_gg) : 0;
        const giorniLavorati = parseFloat(giornata.gg) || 0;
        const valoreSpese = parseFloat(giornata.Valore_spese) || 0;

        const costoLavoro = tariffaGiornaliera * giorniLavorati;
        
        return costoLavoro + valoreSpese;
    }

    findTariffa(collaboratoreId, data) {
        const dataGiornata = new Date(data);
        
        const tariffeValide = this.app.tariffe
            .filter(t => t.ID_COLLABORATORE === collaboratoreId && new Date(t.Data_Inizio_Validita) <= dataGiornata)
            .sort((a, b) => new Date(b.Data_Inizio_Validita) - new Date(a.Data_Inizio_Validita));

        return tariffeValide.length > 0 ? tariffeValide[0] : null;
    }
    
    updateStats(data) {
        const collaboratoriCount = data.length;
        
        const totalGiornate = data.reduce((sum, c) => sum + c.giornate.length, 0);
        
        const totalCosto = data.reduce((sum, c) => {
            const costoCollaboratore = c.giornate.reduce((s, g) => s + (g.costo_calcolato || 0), 0);
            return sum + costoCollaboratore;
        }, 0);
        
        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriCount, 'Collaboratori Visualizzati')}
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate, "Totale Giornate Registrate")}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totalCosto), 'Costo Totale Stimato')}
                </div>
            `;
        }
    }
}