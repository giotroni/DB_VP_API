/**
 * @file commesse-task-section.js
 * @description Classe per la gestione della sezione "Commesse & Task".
 * @version 2.9 - Corretta la chiusura delle modali dopo l'eliminazione.
 */

class CommesseTaskSection extends BaseSection {
    constructor(appInstance) {
        super('Commesse & Task', appInstance);
        this.commesseConTask = [];
    }

    // ========================================================================
    // METODI DEL CICLO DI VITA DELLA SEZIONE
    // ========================================================================

    async loadData() {
        this.commesseConTask = this.groupTasksByCommessa();
        this.isLoaded = true;
    }

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
                    <div class="col-md-4"><label class="form-label">Cerca commessa/task</label><input type="text" class="form-control" id="searchCommesseTask" placeholder="Nome, codice, cliente..."></div>
                    <div class="col-md-3"><label class="form-label">Commessa</label><select class="form-select" id="filterCommesse"><option value="">Tutte le commesse</option>${this.app.commesse.map(c => `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`).join('')}</select></div>
                    <div class="col-md-3"><label class="form-label">Stato Commessa</label><select class="form-select" id="filterStatoCommesse"><option value="">Tutti gli stati</option><option value="In corso">In corso</option><option value="Chiusa">Chiusa</option><option value="Sospesa">Sospesa</option></select></div>
                    <div class="col-md-2"><label class="form-label">&nbsp;</label><div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="filter" title="Applica Filtri"><i class="fas fa-search"></i></button><button class="btn btn-outline-primary" data-action="toggle-all-commesse" id="toggleAllBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button></div></div>
                </div>
            </div>
            <div id="commesseTaskContainer">${this.renderCommesseCards(this.commesseConTask)}</div>
        `;
        this.bindEvents();
    }

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

    handleAction(action, id, type, targetElement) {
        if (targetElement && targetElement.closest('.management-card-header') && !['toggle-commessa', 'edit-commessa'].includes(action)) {
            event.stopPropagation();
        }
        switch (action) {
            case 'add-commessa': this.showNewCommessaModal(); break;
            case 'edit-commessa': this.showEditCommessaModal(id); break;
            case 'add-task': this.showNewTaskModal(id); break;
            case 'edit-task': this.showEditTaskModal(id); break;
            case 'toggle-commessa': this.toggleCommessa(id); break;
            case 'view-task': this.showTaskDetailsModal(id); break;
            case 'view-giornate': this.showGiornateModal(id); break;
            case 'filter': this.filterData(); break;
            case 'toggle-all-commesse': this.toggleAllCommesse(); break;
            default: console.warn(`Azione non gestita: ${action}`);
        }
    }
    // ========================================================================
    // SEZIONE: RENDERING DEI COMPONENTI
    // ========================================================================

    renderCommesseCards(data) {
        if (data.length === 0) { return this.ui.createEmptyState('fas fa-search', 'Nessuna Commessa Trovata', 'Prova a modificare i filtri di ricerca.'); }
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
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-briefcase me-2"></i>${commessa.Commessa}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary">${totalTasks} Task</span>
                            <span class="badge bg-success">${totalGiornate.toFixed(1)} Giorni</span>
                            <button class="btn btn-sm btn-outline-light" data-action="edit-commessa" data-id="${commessa.ID_COMMESSA}" title="Modifica Commessa"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn btn-vp-primary btn-sm" data-action="add-task" data-id="${commessa.ID_COMMESSA}" title="Aggiungi nuovo task"><i class="fas fa-plus me-1"></i>Nuovo Task</button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${commessa.ID_COMMESSA}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small">
                        <i class="fas fa-building me-1"></i> ${commessa.Tipo_Commessa === 'Interna' ? 'Interna' : `Cliente: ${commessa.cliente_nome}`} |
                        <i class="fas fa-user me-1"></i> Responsabile: ${commessa.responsabile_nome} |
                        <i class="fas fa-tasks me-1"></i> Task attivi: ${activeTasks}
                    </div>
                </div>
                <div class="collapse" id="commessa-${commessa.ID_COMMESSA}">
                    <div class="management-card-body"><div class="row">${commessa.tasks.length > 0 ? commessa.tasks.map(task => this.createTaskCard(task)).join('') : '<p class="text-muted">Nessun task associato a questa commessa.</p>'}</div></div>
                </div>
            </div>`;
    }

    createTaskCard(task) {
        const giornateHtml = task.giornate.length > 0
            ? `<button class="btn btn-outline-primary btn-sm w-100 mt-3" data-action="view-giornate" data-id="${task.ID_TASK}"><i class="fas fa-calendar-alt me-1"></i> Visualizza ${task.giornate.length} Giornate</button>`
            : `<p class="text-muted text-center small mt-3 mb-0"><i class="fas fa-calendar-times me-1"></i> Nessuna giornata registrata</p>`;
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
                            <div class="col-6"><div class="fw-bold text-primary">${task.totale_giornate.toFixed(1)}</div><small class="text-muted">Tot. Giorni</small></div>
                            <div class="col-6"><div class="fw-bold">${task.gg_previste || '-'}</div><small class="text-muted">Previsti</small></div>
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
    
    toggleCommessa(commessaId, forceState = null) {
        const collapseElement = document.getElementById(`commessa-${commessaId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${commessaId}`);
        if (!collapseElement || !toggleBtn) return;
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        if (forceState === true) { bsCollapse.show(); } 
        else if (forceState === false) { bsCollapse.hide(); } 
        else { bsCollapse.toggle(); }
        const onShown = () => this.updateToggleButton(toggleBtn, true);
        const onHidden = () => this.updateToggleButton(toggleBtn, false);
        collapseElement.addEventListener('shown.bs.collapse', onShown, { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', onHidden, { once: true });
        this.updateToggleButton(toggleBtn, collapseElement.classList.contains('show'));
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        btn.classList.toggle('expanded', isShown);
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
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

    showNewCommessaModal() {
        const modalTitle = 'Crea Nuova Commessa';
        const modalId = 'newCommessaModal';
        const modalBody = this.getCommessaFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Commessa</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCommessaFormListeners(`${modalId}_form`);
    }

    showEditCommessaModal(commessaId) {
        const commessa = this.commesseConTask.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) { this.ui.showToast('Commessa non trovata.', 'error'); return; }

        const modalTitle = `Modifica Commessa: ${commessa.Commessa}`;
        const modalId = `editCommessaModal_${commessaId}`;
        const modalBody = this.getCommessaFormHTML(commessa);
        
        const canDelete = commessa.tasks.length === 0;
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? 'Elimina prima i task associati' : 'Elimina commessa'}">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteCommessa(commessaId)
        };
        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCommessaFormListeners(`${modalId}_form`);
    }

    showNewTaskModal(commessaId) {
        const commessa = this.app.commesse.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) return;
        const modalTitle = `Nuovo Task per: ${commessa.Commessa}`;
        const defaultTaskData = {
            ID_COMMESSA: commessaId, Tipo: 'Campo', Stato_Task: 'In corso',
            Data_Apertura_Task: new Date().toISOString().split('T')[0], Spese_Comprese: 'No'
        };
        const modalBody = this.getTaskFormHTML(defaultTaskData);
        const modalId = `newTaskModal_${commessaId}`;
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Task</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addTaskFormListeners(`${modalId}_form`);
    }

    showEditTaskModal(taskId) {
        const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
        if (!task) { this.ui.showToast('Task non trovato.', 'error'); return; }

        const modalTitle = `Modifica Task: ${task.Task}`;
        const modalBody = this.getTaskFormHTML(task);
        const modalId = `editTaskModal_${taskId}`;

        const canDelete = task.giornate.length === 0;
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? 'Elimina prima le giornate associate' : 'Elimina task'}">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteTask(taskId)
        };

        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addTaskFormListeners(`${modalId}_form`);
    }


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
            { 
                html: `<button type="button" class="btn btn-primary">Modifica</button>`,
                selector: `.btn-primary`,
                handler: (e) => {
                    bootstrap.Modal.getInstance(e.target.closest('.modal'))?.hide();
                    this.showEditTaskModal(taskId);
                }
            }
        ];

        this.ui.createModal(`taskDetailsModal_${taskId}`, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
    }

    /**
     * Mostra la modale con l'elenco delle giornate di un task.
     * @param {string} taskId L'ID del task.
     */

    showGiornateModal(taskId) {
        const task = this.app.tasks.find(t => t.ID_TASK === taskId);
        if (!task) {
            this.ui.showToast('Task non trovato.', 'error');
            return;
        }

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
    // SEZIONE: GESTIONE FORM E SALVATAGGI
    // ========================================================================

    addCommessaFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const commessaId = form.id.includes('editCommessaModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleCommessaFormSubmit(e, commessaId));
        const tipoSelect = form.querySelector('#Tipo_Commessa');
        const clienteContainer = form.querySelector('#clienteFieldContainer');
        const responsabileContainer = form.querySelector('#responsabileFieldContainer');
        const commissioneContainer = form.querySelector('#commissioneFieldContainer');
        const toggleCommessaFields = () => {
            const isCliente = tipoSelect.value === 'Cliente';
            clienteContainer.style.display = isCliente ? 'block' : 'none';
            responsabileContainer.style.display = isCliente ? 'block' : 'none';
            commissioneContainer.style.display = isCliente ? 'block' : 'none';
            form.querySelector('#ID_CLIENTE').required = isCliente;
            form.querySelector('#ID_COLLABORATORE').required = isCliente;
            form.querySelector('#Commissione').required = isCliente;
        };
        tipoSelect?.addEventListener('change', toggleCommessaFields);
        toggleCommessaFields();
    }

    async handleCommessaFormSubmit(event, commessaId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const commessaData = Object.fromEntries(formData.entries());

        if (commessaData.Tipo_Commessa === 'Interna') {
            commessaData.ID_CLIENTE = null;
            commessaData.ID_COLLABORATORE = null;
            commessaData.Commissione = null;
        }
        if (!commessaId) { commessaData.ID_COMMESSA = this.generateCommessaCode(); }

        try {
            const result = commessaId
                ? await this.api.updateCommessa(commessaId, commessaData)
                : await this.api.createCommessa(commessaData);
            if (result.success) {
                this.ui.showToast(`Commessa ${commessaId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio della commessa.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    addTaskFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const taskId = form.id.includes('editTaskModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleTaskFormSubmit(e, taskId));
        const tipoSelect = form.querySelector('#Tipo');
        const assegnatoContainer = form.querySelector('#assegnatoAContainer');
        const speseSelect = form.querySelector('#Spese_Comprese');
        const speseStdContainer = form.querySelector('#valoreSpeseStdContainer');
        const toggleAssegnato = () => { assegnatoContainer.style.display = tipoSelect.value === 'Monitoraggio' ? 'block' : 'none'; };
        const toggleSpeseStd = () => { speseStdContainer.style.display = speseSelect.value === 'No' ? 'block' : 'none'; };
        tipoSelect?.addEventListener('change', toggleAssegnato);
        speseSelect?.addEventListener('change', toggleSpeseStd);
        toggleAssegnato();
        toggleSpeseStd();
    }

    async handleTaskFormSubmit(event, taskId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const taskData = Object.fromEntries(formData.entries());
        for (const key in taskData) { if (taskData[key] === '') { taskData[key] = null; } }
        try {
            const result = taskId
                ? await this.api.updateTask(taskId, taskData)
                : await this.api.createTask(taskData);
            if (result.success) {
                this.ui.showToast(`Task ${taskId ? 'aggiornato' : 'creato'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio del task.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    // ========================================================================
    // SEZIONE: AZIONI DI ELIMINAZIONE
    // ========================================================================

    async handleDeleteCommessa(commessaId) {
        const commessa = this.commesseConTask.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) return;
        if (commessa.tasks.length > 0) {
            this.ui.showToast('Impossibile eliminare: ci sono task associati.', 'error');
            return;
        }
        if (confirm(`Sei sicuro di voler eliminare la commessa "${commessa.Commessa}"? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteCommessa(commessaId);
                if (result.success) {
                    this.ui.showToast('Commessa eliminata!', 'success');
                    const modalElement = document.getElementById(`editCommessaModal_${commessaId}`);
                    if (modalElement) {
                        bootstrap.Modal.getInstance(modalElement)?.hide();
                    }
                    await this.app.loadInitialData();
                } else { throw new Error(result.message); }
            } catch (error) { this.ui.showToast(error.message, 'error'); }
        }
    }

    async handleDeleteTask(taskId) {
        const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
        if (!task) return;
        if (task.giornate.length > 0) {
            this.ui.showToast('Impossibile eliminare: ci sono giornate associate.', 'error');
            return;
        }
        if (confirm(`Sei sicuro di voler eliminare il task "${task.Task}"? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteTask(taskId);
                if (result.success) {
                    this.ui.showToast('Task eliminato!', 'success');
                    const modalElement = document.getElementById(`editTaskModal_${taskId}`);
                    if (modalElement) {
                        bootstrap.Modal.getInstance(modalElement)?.hide();
                    }
                    await this.app.loadInitialData();
                } else { throw new Error(result.message); }
            } catch (error) { this.ui.showToast(error.message, 'error'); }
        }
    }

    // ========================================================================
    // SEZIONE: GENERAZIONE HTML E UTILITÀ
    // ========================================================================
    
    getCommessaFormHTML(commessa = {}) {
        const formId = commessa.ID_COMMESSA ? `editCommessaModal_${commessa.ID_COMMESSA}_form` : 'newCommessaModal_form';
        const clientiOptions = this.app.clienti.map(c => `<option value="${c.ID_CLIENTE}" ${commessa.ID_CLIENTE == c.ID_CLIENTE ? 'selected' : ''}>${c.Cliente}</option>`).join('');
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}" ${commessa.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        const stati = ['In corso', 'Sospesa', 'Chiusa', 'Archiviata'];
        const statiOptions = stati.map(s => `<option value="${s}" ${(commessa.Stato_Commessa || 'In corso') === s ? 'selected' : ''}>${s}</option>`).join('');
        const today = new Date().toISOString().split('T')[0];
        const dataApertura = commessa.Data_Apertura_Commessa ? new Date(commessa.Data_Apertura_Commessa).toISOString().split('T')[0] : today;

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Commessa" class="form-label">Nome Commessa</label><input type="text" class="form-control" id="Commessa" name="Commessa" value="${commessa.Commessa || ''}" required></div>
                    <div class="col-md-3 mb-3"><label for="Tipo_Commessa" class="form-label">Tipo</label><select class="form-select" id="Tipo_Commessa" name="Tipo_Commessa"><option value="Cliente" ${commessa.Tipo_Commessa === 'Cliente' ? 'selected' : ''}>Cliente</option><option value="Interna" ${commessa.Tipo_Commessa === 'Interna' ? 'selected' : ''}>Interna</option></select></div>
                    <div class="col-md-3 mb-3"><label for="Stato_Commessa" class="form-label">Stato</label><select class="form-select" id="Stato_Commessa" name="Stato_Commessa" required>${statiOptions}</select></div>
                </div>
                <div id="clienteFieldsContainer">
                    <div class="mb-3" id="clienteFieldContainer"><label for="ID_CLIENTE" class="form-label">Cliente</label><select class="form-select" id="ID_CLIENTE" name="ID_CLIENTE"><option value="">Seleziona cliente...</option>${clientiOptions}</select></div>
                    <div class="mb-3" id="responsabileFieldContainer"><label for="ID_COLLABORATORE" class="form-label">Responsabile</label><select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE"><option value="">Seleziona responsabile...</option>${collaboratoriOptions}</select></div>
                    <div class="mb-3" id="commissioneFieldContainer"><label for="Commissione" class="form-label">Commissione</label><input type="number" class="form-control" id="Commissione" name="Commissione" min="0" max="1" step="0.01" value="${commessa.Commissione || '0.27'}"></div>
                </div>
                <div class="mb-3"><label for="Data_Apertura_Commessa" class="form-label">Data Inizio</label><input type="date" class="form-control" id="Data_Apertura_Commessa" name="Data_Apertura_Commessa" value="${dataApertura}"></div>
                <div class="mb-3"><label for="Desc_Commessa" class="form-label">Descrizione</label><textarea class="form-control" id="Desc_Commessa" name="Desc_Commessa" rows="3">${commessa.Desc_Commessa || ''}</textarea></div>
            </form>
        `;
    }

    getTaskFormHTML(task = {}) {
        const formId = task.ID_TASK ? `editTaskModal_${task.ID_TASK}_form` : `newTaskModal_${task.ID_COMMESSA}_form`;
        const tipiTask = ['Campo', 'Monitoraggio', 'Promo', 'Sviluppo', 'Formazione'];
        const tipiOptions = tipiTask.map(t => `<option value="${t}" ${task.Tipo === t ? 'selected' : ''}>${t}</option>`).join('');
        const statiTask = ['In corso', 'Sospeso', 'Chiuso', 'Archiviato'];
        const statiOptions = statiTask.map(s => `<option value="${s}" ${task.Stato_Task === s ? 'selected' : ''}>${s}</option>`).join('');
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}" ${task.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        const dataAperturaFormatted = (task.Data_Apertura_Task ? new Date(task.Data_Apertura_Task) : new Date()).toISOString().split('T')[0];

        return `
            <form id="${formId}" novalidate>
                <input type="hidden" name="ID_COMMESSA" value="${task.ID_COMMESSA || ''}">
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Task" class="form-label">Nome Task</label><input type="text" class="form-control" id="Task" name="Task" value="${task.Task || ''}" required></div>
                    <div class="col-md-6 mb-3"><label for="Tipo" class="form-label">Tipo Task</label><select class="form-select" id="Tipo" name="Tipo">${tipiOptions}</select></div>
                </div>
                <div class="mb-3"><label for="Desc_Task" class="form-label">Descrizione</label><textarea class="form-control" id="Desc_Task" name="Desc_Task" rows="2">${task.Desc_Task || ''}</textarea></div>
                <div class="mb-3" id="assegnatoAContainer" style="display: none;"><label for="ID_COLLABORATORE" class="form-label">Assegnato a (per Monitoraggio)</label><select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE"><option value="">Nessuno</option>${collaboratoriOptions}</select></div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Stato_Task" class="form-label">Stato</label><select class="form-select" id="Stato_Task" name="Stato_Task" required>${statiOptions}</select></div>
                    <div class="col-md-6 mb-3"><label for="Data_Apertura_Task" class="form-label">Data Apertura</label><input type="date" class="form-control" id="Data_Apertura_Task" name="Data_Apertura_Task" value="${dataAperturaFormatted}" required></div>
                </div>
                <hr>
                <h5>Dettagli Economici</h5>
                <div class="row align-items-end">
                    <div class="col-md-4 mb-3"><label for="gg_previste" class="form-label">Giorni Previsti</label><input type="number" step="0.5" class="form-control" id="gg_previste" name="gg_previste" value="${task.gg_previste || ''}"></div>
                    <div class="col-md-4 mb-3"><label for="Spese_Comprese" class="form-label">Spese Comprese</label><select class="form-select" id="Spese_Comprese" name="Spese_Comprese"><option value="No" ${task.Spese_Comprese === 'No' || !task.Spese_Comprese ? 'selected' : ''}>No</option><option value="Si" ${task.Spese_Comprese === 'Si' ? 'selected' : ''}>Si</option></select></div>
                    <div class="col-md-4 mb-3" id="valoreSpeseStdContainer" style="display: none;"><label for="Valore_Spese_std" class="form-label">Valore Spese Standard (€)</label><input type="number" step="0.01" class="form-control" id="Valore_Spese_std" name="Valore_Spese_std" value="${task.Valore_Spese_std || ''}"></div>
                </div>
                 <div class="row"><div class="col-md-4 mb-3"><label for="Valore_gg" class="form-label">Valore Giorno (€)</label><input type="number" step="0.01" class="form-control" id="Valore_gg" name="Valore_gg" value="${task.Valore_gg || ''}"></div></div>
            </form>
        `;
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

    groupTasksByCommessa() {
        const commesseMap = new Map();
        this.app.commesse.forEach(commessa => {
            const cliente = this.app.clienti.find(c => c.ID_CLIENTE == commessa.ID_CLIENTE);
            const responsabile = this.app.collaboratori.find(c => c.ID_COLLABORATORE == commessa.ID_COLLABORATORE);
            commesseMap.set(commessa.ID_COMMESSA, { ...commessa, cliente_nome: cliente?.Cliente || 'N/D', responsabile_nome: responsabile?.Collaboratore || 'N/D', tasks: [] });
        });
        this.app.tasks.forEach(task => {
            if (commesseMap.has(task.ID_COMMESSA)) {
                const giornateTask = this.app.giornate.filter(g => String(g.ID_TASK) === String(task.ID_TASK));
                const totaleGiornate = giornateTask.reduce((sum, g) => sum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0), 0);
                commesseMap.get(task.ID_COMMESSA).tasks.push({ ...task, giornate: giornateTask, totale_giornate: totaleGiornate });
            }
        });
        return Array.from(commesseMap.values()).sort((a, b) => (a.Commessa || '').localeCompare(b.Commessa || ''));
    }
}

