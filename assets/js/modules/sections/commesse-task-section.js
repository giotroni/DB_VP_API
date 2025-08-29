/**
 * @file commesse-task-section.js
 * @description Classe per la gestione della sezione "Commesse & Task".
 * Contiene tutta la logica per il rendering, la gestione degli eventi
 * e le interazioni utente relative a commesse e task.
 * @version 2.2 - Corretti stili e funzionalità dei pulsanti task.
 */
class CommesseTaskSection extends BaseSection {
    constructor(appInstance) {
        super('Commesse & Task', appInstance);
        this.commesseConTask = []; // Dati processati per il rendering
    }

    /**
     * Prepara i dati necessari per la sezione, raggruppando i task per commessa.
     */
    async loadData() {
        this.commesseConTask = this.groupTasksByCommessa();
        this.isLoaded = true;
    }

    /**
     * Renderizza l'intera interfaccia della sezione.
     */
    render() {
        this.updatePageTitle('Situazione Commesse e Task', 'Visualizza e gestisci commesse e task');
        this.updateTopbarActions(`
            <button class="btn btn-vp-primary" data-action="add-commessa">
                <i class="fas fa-plus me-2"></i>Nuova Commessa
            </button>
        `);

        const container = this.getContainer();
        const activeCommesse = this.app.commesse.filter(c => c.Stato_Commessa === 'In corso').length;
        const totalGiornate = this.app.giornate.reduce((sum, g) => sum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0), 0);

        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-briefcase', this.app.commesse.length, 'Commesse Totali')}
                ${this.ui.createStatsCard('fas fa-tasks', this.app.tasks.length, 'Task Totali')}
                ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate.toFixed(1), 'Giornate Totali')}
                ${this.ui.createStatsCard('fas fa-clock', activeCommesse, 'Commesse Attive')}
            </div>
            
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
                            ${this.app.commesse.map(c => `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Stato Commessa</label>
                        <select class="form-select" id="filterStatoCommesse">
                            <option value="">Tutti gli stati</option>
                            <option value="In corso">In corso</option>
                            <option value="Chiusa">Chiusa</option>
                            <option value="Sospesa">Sospesa</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">&nbsp;</label>
                        <div class="d-flex gap-2">
                            <button class="btn btn-vp-primary" data-action="filter" title="Applica Filtri"><i class="fas fa-search"></i></button>
                            <button class="btn btn-outline-primary" data-action="toggle-all-commesse" id="toggleAllBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="commesseTaskContainer">
                ${this.renderCommesseCards(this.commesseConTask)}
            </div>
        `;
    }

    /**
     * Imposta i listener per gli input di filtro.
     */
    bindEvents() {
        const searchInput = document.getElementById('searchCommesseTask');
        if (searchInput) {
            let debounceTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => this.filterData(), 300);
            });
        }

        document.getElementById('filterCommesse')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterStatoCommesse')?.addEventListener('change', () => this.filterData());
    }

    /**
     * Gestore centrale per tutte le azioni specifiche di questa sezione.
     */
    handleAction(action, id) {
        switch (action) {
            case 'toggle-commessa':
                this.toggleCommessa(id);
                break;
            case 'view-task':
                this.showTaskDetailsModal(id);
                break;
            case 'view-giornate': // Azione per visualizzare le giornate
                this.showGiornateModal(id);
                break;
            case 'edit-task':
                this.ui.showToast(`Modifica task ${id} (in sviluppo)`, 'info');
                break;
            case 'add-task':
                this.ui.showToast(`Aggiungi task a commessa ${id} (in sviluppo)`, 'info');
                break;
            case 'add-commessa':
                this.ui.showToast('Aggiungi commessa (in sviluppo)', 'info');
                break;
            case 'filter':
                this.filterData();
                break;
            case 'toggle-all-commesse':
                this.toggleAllCommesse();
                break;
            default:
                console.warn(`Azione non gestita in CommesseTaskSection: ${action}`);
        }
    }

    // ========================================================================
    // SEZIONE: LOGICA DI RENDERING
    // ========================================================================

    renderCommesseCards(data) {
        if (data.length === 0) {
            return this.ui.createEmptyState('fas fa-search', 'Nessuna Commessa Trovata', 'Prova a modificare i filtri di ricerca.');
        }
        return data.map(commessa => this.createCommessaCard(commessa)).join('');
    }

    createCommessaCard(commessa) {
        const totalTasks = commessa.tasks.length;
        const activeTasks = commessa.tasks.filter(t => t.Stato_Task === 'In corso').length;
        const totalGiornate = commessa.tasks.reduce((sum, task) => sum + task.totale_giornate, 0);

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-commessa" data-id="${commessa.ID_COMMESSA}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2">
                            <i class="fas fa-briefcase me-2"></i>${commessa.Commessa}
                        </h5>
                        <div class="d-flex align-items-center gap-3">
                            <span class="badge bg-primary">${totalTasks} Task</span>
                            <span class="badge bg-success">${totalGiornate.toFixed(1)} Giorni</span>
                            <button class="btn btn-vp-primary btn-sm" data-action="add-task" data-id="${commessa.ID_COMMESSA}" title="Aggiungi nuovo task"><i class="fas fa-plus me-1"></i>Nuovo Task</button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${commessa.ID_COMMESSA}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small">
                        <i class="fas fa-building me-1"></i>
                        ${commessa.Tipo_Commessa === 'Interna' ? 'Interna' : `Cliente: ${commessa.cliente_nome}`} |
                        <i class="fas fa-user me-1"></i>Responsabile: ${commessa.responsabile_nome} |
                        <i class="fas fa-tasks me-1"></i>Task attivi: ${activeTasks}
                    </div>
                </div>
                <div class="collapse" id="commessa-${commessa.ID_COMMESSA}">
                    <div class="management-card-body">
                        <div class="row">
                            ${commessa.tasks.length > 0 ? commessa.tasks.map(task => this.createTaskCard(task)).join('') : '<p class="text-muted">Nessun task associato a questa commessa.</p>'}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    createTaskCard(task) {
        const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === task.ID_COLLABORATORE);
        
        const giornateHtml = task.giornate.length > 0
            ? `<button class="btn btn-outline-primary btn-sm w-100 mt-3" data-action="view-giornate" data-id="${task.ID_TASK}">
                   <i class="fas fa-calendar-alt me-1"></i>
                   Visualizza ${task.giornate.length} Giornate
               </button>`
            : `<p class="text-muted text-center small mt-3 mb-0">
                   <i class="fas fa-calendar-times me-1"></i>
                   Nessuna giornata registrata
               </p>`;

        return `
            <div class="col-lg-6 col-xl-4 mb-3">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column">
                    <div class="card-header bg-light border-0">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="card-title mb-0 fw-bold">${task.Task}</h6>
                            <span class="status-badge ${task.Stato_Task === 'In corso' ? 'active' : 'inactive'}"><i class="fas fa-circle"></i> ${task.Stato_Task}</span>
                        </div>
                        <small class="text-muted d-block"><i class="fas fa-tag me-1"></i>${task.Tipo || 'Campo'}</small>
                    </div>
                    <div class="card-body">
                        <p class="card-text text-muted small">${task.Desc_Task || ''}</p>
                        <div class="row text-center">
                            <div class="col-6">
                                <div class="fw-bold text-primary">${task.totale_giornate.toFixed(1)}</div>
                                <small class="text-muted">Tot. Giorni</small>
                            </div>
                            <div class="col-6">
                                 <div class="fw-bold">${task.gg_previste || '-'}</div>
                                 <small class="text-muted">Previsti</small>
                            </div>
                        </div>
                        ${giornateHtml}
                    </div>
                    <div class="card-footer bg-transparent border-0 mt-auto">
                        <div class="action-buttons d-flex justify-content-end gap-2">
                            <button class="btn btn-outline-secondary btn-sm" data-action="view-task" data-id="${task.ID_TASK}" title="Visualizza dettagli"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-primary btn-sm" data-action="edit-task" data-id="${task.ID_TASK}" title="Modifica task"><i class="fas fa-edit"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE E FILTRI
    // ========================================================================

    toggleCommessa(commessaId) {
        const collapseElement = document.getElementById(`commessa-${commessaId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${commessaId}`);
        if (!collapseElement || !toggleBtn) return;
        
        const isOpening = !collapseElement.classList.contains('show');
        bootstrap.Collapse.getOrCreateInstance(collapseElement).toggle();

        toggleBtn.classList.toggle('expanded', isOpening);
        const icon = toggleBtn.querySelector('i');
        icon.classList.toggle('fa-chevron-down', !isOpening);
        icon.classList.toggle('fa-chevron-up', isOpening);
    }
    
    toggleAllCommesse() {
        const allCollapses = document.querySelectorAll('#commesseTaskContainer .collapse');
        const isAnyCollapsed = Array.from(allCollapses).some(el => !el.classList.contains('show'));
        
        allCollapses.forEach(el => {
            const id = el.id.replace('commessa-', '');
            this.toggleCommessa(id, isAnyCollapsed);
        });

        const toggleAllBtn = document.getElementById('toggleAllBtn');
        toggleAllBtn.innerHTML = isAnyCollapsed ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
        toggleAllBtn.title = isAnyCollapsed ? 'Comprimi tutto' : 'Espandi tutto';
    }

    filterData() {
        const searchText = document.getElementById('searchCommesseTask')?.value.toLowerCase() || '';
        const selectedCommessa = document.getElementById('filterCommesse')?.value || '';
        const selectedStato = document.getElementById('filterStatoCommesse')?.value || '';

        const allData = this.groupTasksByCommessa();

        const filteredData = allData.filter(commessa => {
            const matchCommessaId = !selectedCommessa || commessa.ID_COMMESSA === selectedCommessa;
            const matchStato = !selectedStato || commessa.Stato_Commessa === selectedStato;
            
            const matchSearch = !searchText ||
                (commessa.Commessa || '').toLowerCase().includes(searchText) ||
                (commessa.cliente_nome || '').toLowerCase().includes(searchText) ||
                commessa.tasks.some(task => (task.Task || '').toLowerCase().includes(searchText));

            return matchCommessaId && matchStato && matchSearch;
        });

        document.getElementById('commesseTaskContainer').innerHTML = this.renderCommesseCards(filteredData);
    }

    // ========================================================================
    // SEZIONE: GESTIONE MODALI
    // ========================================================================

    showTaskDetailsModal(taskId) {
        const task = this.app.tasks.find(t => t.ID_TASK === taskId);
        if (!task) {
            this.ui.showToast('Task non trovato.', 'error');
            return;
        }

        const modalTitle = `<i class="fas fa-tasks me-2"></i>Dettagli Task: ${task.Task}`;
        const modalBody = `
            <div>
                <h5>Informazioni Generali</h5>
                <p><strong>Descrizione:</strong> ${task.Desc_Task || '-'}</p>
                <p><strong>Stato:</strong> ${task.Stato_Task}</p>
                <hr/>
                <h5>Informazioni Economiche</h5>
                <p><strong>Giorni Previsti:</strong> ${task.gg_previste || '-'}</p>
                <p><strong>Valore/Giorno:</strong> ${this.app.utils.formatCurrency(task.Valore_gg)}</p>
            </div>
        `;
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' },
            { html: `<button type="button" class="btn btn-primary" data-action="edit-task" data-id="${taskId}">Modifica</button>`, 
              selector: `[data-action="edit-task"][data-id="${taskId}"]`,
              handler: (e) => {
                bootstrap.Modal.getInstance(e.target.closest('.modal'))?.hide();
                this.handleAction('edit-task', taskId);
              }
            }
        ];

        this.ui.createModal(`taskDetailsModal_${taskId}`, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
    }

    showGiornateModal(taskId) {
        const task = this.app.tasks.find(t => t.ID_TASK === taskId);
        if (!task) return;

        const giornateTask = this.app.giornate.filter(g => String(g.ID_TASK) === String(taskId));

        const modalTitle = `<i class="fas fa-calendar-day me-2"></i>Giornate - ${task.Task}`;
        const modalBody = giornateTask.length === 0
            ? '<p class="text-muted">Nessuna giornata registrata per questo task.</p>'
            : `<div class="table-responsive">
                   <table class="table table-sm table-hover">
                       <thead><tr><th>Data</th><th>Collaboratore</th><th>Ore</th><th>Tipo</th><th>Note</th></tr></thead>
                       <tbody>
                           ${giornateTask.map(g => {
                               const collab = this.app.collaboratori.find(c => c.ID_COLLABORATORE === g.ID_COLLABORATORE);
                               return `<tr>
                                   <td>${new Date(g.Data).toLocaleDateString('it-IT')}</td>
                                   <td>${collab?.Collaboratore || 'N/A'}</td>
                                   <td><span class="badge bg-primary">${g.gg}h</span></td>
                                   <td>${g.Tipo}</td>
                                   <td>${g.Note || '-'}</td>
                               </tr>`;
                           }).join('')}
                       </tbody>
                   </table>
               </div>`;

        const modalActions = [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }];
        this.ui.createModal(`giornateModal_${taskId}`, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
    }
    
    // ========================================================================
    // SEZIONE: METODI DI UTILITÀ
    // ========================================================================

    groupTasksByCommessa() {
        const commesseMap = new Map();

        this.app.commesse.forEach(commessa => {
            const cliente = this.app.clienti.find(c => c.ID_CLIENTE == commessa.ID_CLIENTE);
            const responsabile = this.app.collaboratori.find(c => c.ID_COLLABORATORE == commessa.ID_COLLABORATORE);
            commesseMap.set(commessa.ID_COMMESSA, {
                ...commessa,
                cliente_nome: cliente?.Cliente || 'N/D',
                responsabile_nome: responsabile?.Collaboratore || 'N/D',
                tasks: []
            });
        });

        this.app.tasks.forEach(task => {
            if (commesseMap.has(task.ID_COMMESSA)) {
                const giornateTask = this.app.giornate.filter(g => String(g.ID_TASK) === String(task.ID_TASK));
                const totaleGiornate = giornateTask.reduce((sum, g) => sum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0), 0);
                
                commesseMap.get(task.ID_COMMESSA).tasks.push({ 
                    ...task, 
                    giornate: giornateTask, // Aggiunge l'array delle giornate
                    totale_giornate: totaleGiornate 
                });
            }
        });

        return Array.from(commesseMap.values()).sort((a, b) => (a.Commessa || '').localeCompare(b.Commessa || ''));
    }
}