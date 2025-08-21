/**
 * Task Management JavaScript
 * Gestione completa del    async loadCommesse() {
        try {
            // Torna a usare il routing normale
            const response = await fetch(`${this.API_BASE}/commesse?limit=100`);
            const data = await response.json();
            
            if (data.success) {faccia task
 */

class TaskManager {
    constructor() {
        this.API_BASE = '/gestione_VP/API/index.php';
        this.allTasks = [];
        this.commesseList = [];
        this.collaboratoriList = [];
        this.taskToArchive = null;
        this.currentTaskId = null;
        this.currentPage = 1;
        this.tasksPerPage = 50;
        
        this.init();
    }
    
    async init() {
        await this.loadInitialData();
        this.setupEventListeners();
        this.setDefaultDate();
    }
    
    async loadInitialData() {
        try {
            this.showLoading(true);
            await Promise.all([
                this.loadTasks(),
                this.loadCommesse(),
                this.loadCollaboratori()
            ]);
        } catch (error) {
            console.error('Errore nel caricamento dati:', error);
            this.showAlert('Errore nel caricamento dei dati', 'danger');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadTasks() {
        try {
            const response = await fetch(`${this.API_BASE}?resource=task&limit=200`);
            const data = await response.json();
            
            if (data.success) {
                this.allTasks = data.data.data || [];
                this.renderTasks(this.allTasks);
                this.updateStats();
                this.updatePagination();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Errore caricamento task:', error);
            this.showAlert('Errore nel caricamento dei task', 'danger');
        }
    }
    
    async loadCommesse() {
        try {
            const response = await fetch(`${this.API_BASE}?resource=commesse&limit=200`);
            const data = await response.json();
            
            if (data.success) {
                this.commesseList = data.data.data || [];
                this.populateCommesseSelect();
            }
        } catch (error) {
            console.error('Errore caricamento commesse:', error);
        }
    }
    
    async loadCollaboratori() {
        try {
            const response = await fetch(`${this.API_BASE}?resource=collaboratori&limit=100`);
            const data = await response.json();
            
            if (data.success) {
                this.collaboratoriList = data.data.data || [];
                this.populateCollaboratoriSelect();
            }
        } catch (error) {
            console.error('Errore caricamento collaboratori:', error);
        }
    }
    
    populateCommesseSelect() {
        const selects = ['taskCommessa', 'filterCommessa'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            const firstOption = select.children[0].outerHTML;
            select.innerHTML = firstOption;
            
                this.commesseList.forEach(commessa => {
                    const option = document.createElement('option');
                    option.value = commessa.ID_COMMESSA;
                    option.textContent = `${commessa.Commessa}${commessa.Cliente ? ' - ' + commessa.Cliente : ''}`;
                    select.appendChild(option);
                });            if (currentValue) select.value = currentValue;
        });
    }
    
    populateCollaboratoriSelect() {
        const select = document.getElementById('taskCollaboratore');
        if (!select) return;
        
        const currentValue = select.value;
        const firstOption = select.children[0].outerHTML;
        select.innerHTML = firstOption;
        
        this.collaboratoriList.forEach(collaboratore => {
            const option = document.createElement('option');
            option.value = collaboratore.ID_COLLABORATORE;
            option.textContent = collaboratore.Collaboratore;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    }
    
    renderTasks(tasks) {
        const container = document.getElementById('tasksContainer');
        const noTasksDiv = document.getElementById('noTasks');
        const groupByCommessa = document.getElementById('groupByCommessa')?.checked;
        
        if (tasks.length === 0) {
            container.style.display = 'none';
            noTasksDiv.style.display = 'block';
            return;
        }
        
        container.style.display = 'flex';
        noTasksDiv.style.display = 'none';
        
        // Paginazione
        const startIndex = (this.currentPage - 1) * this.tasksPerPage;
        const endIndex = startIndex + this.tasksPerPage;
        const paginatedTasks = tasks.slice(startIndex, endIndex);
        
        if (groupByCommessa) {
            container.innerHTML = this.renderTasksByCommessa(paginatedTasks);
        } else {
            container.innerHTML = paginatedTasks.map(task => this.createTaskCard(task)).join('');
        }
        
        // Aggiorna le statistiche con tutti i task (non solo quelli paginati)
        this.updateStatistics(tasks);
    }
    
    renderTasksByCommessa(tasks) {
        // Raggruppa task per commessa
        const tasksByCommessa = tasks.reduce((groups, task) => {
            const commessaKey = task.ID_COMMESSA || 'no-commessa';
            if (!groups[commessaKey]) {
                groups[commessaKey] = {
                    commessa: task.commessa_nome || 'Nessuna Commessa',
                    cliente: task.cliente_nome || 'N/A',
                    responsabile: task.responsabile_commessa || 'N/A',
                    tasks: []
                };
            }
            groups[commessaKey].tasks.push(task);
            return groups;
        }, {});
        
        // Crea HTML per ogni gruppo
        return Object.entries(tasksByCommessa).map(([commessaId, group]) => {
            const totalValue = group.tasks.reduce((sum, task) => sum + (task.valore_tot_maturato || 0), 0);
            const totalGiornate = group.tasks.reduce((sum, task) => sum + (task.gg_effettuate || 0), 0);
            
            return `
                <div class="col-12 mb-4">
                    <div class="card commessa-group">
                        <div class="card-header bg-light">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <h5 class="mb-1">
                                        <i class="bi bi-briefcase me-2"></i>${group.commessa}
                                    </h5>
                                    <div class="text-muted small">
                                        <strong>Cliente:</strong> ${group.cliente} | 
                                        <strong>Responsabile:</strong> ${group.responsabile}
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <div class="row text-center">
                                        <div class="col-4">
                                            <div class="fw-bold text-primary">${group.tasks.length}</div>
                                            <small class="text-muted">Task</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-success">${totalGiornate.toFixed(1)}</div>
                                            <small class="text-muted">Giornate</small>
                                        </div>
                                        <div class="col-4">
                                            <div class="fw-bold text-info">€${this.formatCurrency(totalValue)}</div>
                                            <small class="text-muted">Valore</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                ${group.tasks.map(task => this.createTaskCard(task, true)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    createTaskCard(task, isInGroup = false) {
        // Usa i nuovi campi dalla query migliorata
        const commessaNome = task.commessa_nome || 'N/A';
        const clienteNome = task.cliente_nome || 'Interno';
        const collaboratoreNome = task.collaboratore_nome || 'N/A';
        const responsabileCommessa = task.responsabile_commessa || 'N/A';
        
        const progressPercent = task.gg_previste > 0 ? 
            Math.round((task.gg_effettuate || 0) / task.gg_previste * 100) : 0;
        
        const isArchived = task.Stato_Task === 'Archiviato';
        const statusClass = task.Stato_Task?.toLowerCase().replace(' ', '-') || 'unknown';
        
        // Valori maturati
        const valoreGgMaturato = task.valore_gg_maturato || 0;
        const valoreSpeseMaturo = task.valore_spese_maturato || 0;
        const valoreTotMaturato = task.valore_tot_maturato || 0;
        
        const colClass = isInGroup ? 'col-md-6 col-xl-4' : 'col-md-6 col-lg-4';
        
        return `
            <div class="${colClass}">
                <div class="card task-card ${isArchived ? 'archived-task' : ''} status-${statusClass}" 
                     data-task-id="${task.ID_TASK}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge badge-tipo-${task.Tipo?.toLowerCase() || 'unknown'}">${task.Tipo || 'N/A'}</span>
                            <span class="badge bg-secondary ms-1">${task.Stato_Task || 'N/A'}</span>
                        </div>
                        <div class="progress-circle" style="background: ${this.getProgressColor(progressPercent)}">
                            ${progressPercent}%
                        </div>
                    </div>
                    <div class="card-body" onclick="taskManager.showGiornateModal('${task.ID_TASK}')" style="cursor: pointer;">
                        <h6 class="card-title text-truncate" title="${task.Task}">${task.Task}</h6>
                        <p class="card-text text-muted small mb-2" title="${task.Desc_Task || 'Nessuna descrizione'}">
                            ${this.truncateText(task.Desc_Task || 'Nessuna descrizione', 80)}
                        </p>
                        
                        <div class="row text-center mb-2 small">
                            <div class="col-3">
                                <div class="text-muted">Previsti</div>
                                <div class="fw-bold">${task.gg_previste || 0} gg</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">Effettuati</div>
                                <div class="fw-bold text-primary">${task.gg_effettuate || 0} gg</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">Prezzo/gg</div>
                                <div class="fw-bold text-secondary">€${this.formatCurrency(task.Valore_gg || 0)}</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">Maturato</div>
                                <div class="fw-bold text-success">€${this.formatCurrency(valoreTotMaturato)}</div>
                            </div>
                        </div>
                        
                        <div class="row text-center mb-2 small">
                            <div class="col-6">
                                <div class="text-muted">Valore Giornate</div>
                                <div class="fw-bold text-info">€${this.formatCurrency(valoreGgMaturato)}</div>
                            </div>
                            <div class="col-6">
                                <div class="text-muted">Valore Spese</div>
                                <div class="fw-bold text-warning">€${this.formatCurrency(valoreSpeseMaturo)}</div>
                            </div>
                        </div>
                        
                        ${!isInGroup ? `
                        <hr class="my-2">
                        <div class="small text-muted">
                            <div class="text-truncate" title="${commessaNome}">
                                <strong>Commessa:</strong> ${this.truncateText(commessaNome, 25)}
                            </div>
                            <div class="text-truncate" title="${clienteNome}">
                                <strong>Cliente:</strong> ${this.truncateText(clienteNome, 25)}
                            </div>
                            <div class="text-truncate" title="${responsabileCommessa}">
                                <strong>Resp. Commessa:</strong> ${this.truncateText(responsabileCommessa, 25)}
                            </div>
                            ${task.ID_COLLABORATORE ? `
                                <div class="text-truncate" title="${collaboratoreNome}">
                                    <strong>Assegnato a:</strong> ${this.truncateText(collaboratoreNome, 25)}
                                </div>
                            ` : ''}
                            <div><strong>Apertura:</strong> ${this.formatDate(task.Data_Apertura_Task)}</div>
                            ${task.Data_Chiusura_Task ? `<div><strong>Chiusura:</strong> ${this.formatDate(task.Data_Chiusura_Task)}</div>` : ''}
                        </div>
                        ` : `
                        <div class="small text-muted">
                            ${task.ID_COLLABORATORE ? `
                                <div class="text-truncate" title="${collaboratoreNome}">
                                    <strong>Assegnato a:</strong> ${this.truncateText(collaboratoreNome, 25)}
                                </div>
                            ` : ''}
                            <div><strong>Apertura:</strong> ${this.formatDate(task.Data_Apertura_Task)}</div>
                        </div>
                        `}
                    </div>
                    <div class="card-footer d-flex justify-content-between">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="event.stopPropagation(); taskManager.editTask('${task.ID_TASK}')"
                                ${isArchived ? 'disabled' : ''}>
                            <i class="bi bi-pencil"></i> Modifica
                        </button>
                        <button class="btn btn-sm btn-outline-info" 
                                onclick="event.stopPropagation(); taskManager.showGiornateModal('${task.ID_TASK}')">
                            <i class="bi bi-calendar-week"></i> Giornate
                        </button>
                        ${!isArchived ? `
                            <button class="btn btn-sm btn-outline-warning" 
                                    onclick="event.stopPropagation(); taskManager.showArchiveModal('${task.ID_TASK}')">
                                <i class="bi bi-archive"></i>
                            </button>
                        ` : `
                            <span class="badge bg-secondary">Archiviato</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
    
    getProgressColor(percent) {
        if (percent >= 100) return '#28a745';
        if (percent >= 75) return '#17a2b8';
        if (percent >= 50) return '#ffc107';
        return '#dc3545';
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('it-IT');
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('it-IT').format(amount);
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    setupEventListeners() {
        // Filtri di ricerca
        const searchInput = document.getElementById('searchTask');
        const filterCommessa = document.getElementById('filterCommessa');
        const filterStato = document.getElementById('filterStato');
        const filterTipo = document.getElementById('filterTipo');
        
        if (searchInput) searchInput.addEventListener('input', () => this.filterTasks());
        if (filterCommessa) filterCommessa.addEventListener('change', () => this.filterTasks());
        if (filterStato) filterStato.addEventListener('change', () => this.filterTasks());
        if (filterTipo) filterTipo.addEventListener('change', () => this.filterTasks());
        
        // Reset form quando il modal si chiude
        const taskModal = document.getElementById('taskModal');
        if (taskModal) {
            taskModal.addEventListener('hidden.bs.modal', () => this.resetTaskForm());
        }
        
        // Gestione form submit
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTask();
            });
        }
    }
    
    filterTasks() {
        const searchText = document.getElementById('searchTask')?.value.toLowerCase() || '';
        const filterCommessa = document.getElementById('filterCommessa')?.value || '';
        const filterStato = document.getElementById('filterStato')?.value || '';
        const filterTipo = document.getElementById('filterTipo')?.value || '';
        
        const filteredTasks = this.allTasks.filter(task => {
            const matchesSearch = task.Task?.toLowerCase().includes(searchText) ||
                                (task.Desc_Task && task.Desc_Task.toLowerCase().includes(searchText));
            const matchesCommessa = !filterCommessa || task.ID_COMMESSA === filterCommessa;
            const matchesStato = !filterStato || task.Stato_Task === filterStato;
            const matchesTipo = !filterTipo || task.Tipo === filterTipo;
            
            return matchesSearch && matchesCommessa && matchesStato && matchesTipo;
        });
        
        this.currentPage = 1; // Reset alla prima pagina
        this.renderTasks(filteredTasks);
        this.updatePagination(filteredTasks.length);
    }
    
    updateStats() {
        const totalTasks = this.allTasks.length;
        const activeTasks = this.allTasks.filter(task => 
            task.Stato_Task !== 'Archiviato' && task.Stato_Task !== 'Completato'
        ).length;
        
        const totalTasksEl = document.getElementById('totalTasks');
        const activeTasksEl = document.getElementById('activeTasks');
        
        if (totalTasksEl) totalTasksEl.textContent = totalTasks;
        if (activeTasksEl) activeTasksEl.textContent = activeTasks;
    }
    
    updatePagination(totalTasks = null) {
        const total = totalTasks !== null ? totalTasks : this.allTasks.length;
        const totalPages = Math.ceil(total / this.tasksPerPage);
        
        // Implementazione paginazione se necessaria
        if (totalPages > 1) {
            // TODO: Implementare UI paginazione
        }
    }
    
    showLoading(show) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const tasksContainer = document.getElementById('tasksContainer');
        
        if (loadingSpinner) loadingSpinner.style.display = show ? 'block' : 'none';
        if (tasksContainer) tasksContainer.style.display = show ? 'none' : 'flex';
    }
    
    setDefaultDate() {
        const dateInput = document.getElementById('taskDataApertura');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
    
    resetTaskForm() {
        const form = document.getElementById('taskForm');
        const modalTitle = document.getElementById('modalTitle');
        const taskId = document.getElementById('taskId');
        
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }
        if (taskId) taskId.value = '';
        if (modalTitle) modalTitle.textContent = 'Nuovo Task';
        
        this.setDefaultDate();
    }
    
    editTask(taskId) {
        const task = this.allTasks.find(t => t.ID_TASK === taskId);
        if (!task) return;
        
        // Popola il form con i dati del task
        const fields = {
            'taskId': task.ID_TASK,
            'taskName': task.Task,
            'taskTipo': task.Tipo,
            'taskCommessa': task.ID_COMMESSA,
            'taskCollaboratore': task.ID_COLLABORATORE,
            'taskDescrizione': task.Desc_Task || '',
            'taskDataApertura': task.Data_Apertura_Task,
            'taskDataChiusura': task.Data_Chiusura_Task || '',
            'taskStato': task.Stato_Task || 'In corso',
            'taskGgPreviste': task.gg_previste || '',
            'taskValoreGg': task.Valore_gg || '',
            'taskSpeseComprese': task.Spese_Comprese || 'No',
            'taskValoreSpese': task.Valore_Spese_std || '',
            'taskNote': task.Note || ''
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) field.value = value;
        });
        
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Modifica Task';
        
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    }
    
    async saveTask() {
        const form = document.getElementById('taskForm');
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        
        const taskId = document.getElementById('taskId').value;
        const isEdit = !!taskId;
        
        const taskData = {
            Task: document.getElementById('taskName').value,
            Desc_Task: document.getElementById('taskDescrizione').value,
            ID_COMMESSA: document.getElementById('taskCommessa').value,
            ID_COLLABORATORE: document.getElementById('taskCollaboratore').value,
            Tipo: document.getElementById('taskTipo').value,
            Data_Apertura_Task: document.getElementById('taskDataApertura').value,
            Data_Chiusura_Task: document.getElementById('taskDataChiusura').value || null,
            Stato_Task: document.getElementById('taskStato').value,
            gg_previste: parseFloat(document.getElementById('taskGgPreviste').value) || null,
            Valore_gg: parseFloat(document.getElementById('taskValoreGg').value) || null,
            Spese_Comprese: document.getElementById('taskSpeseComprese').value,
            Valore_Spese_std: parseFloat(document.getElementById('taskValoreSpese').value) || null,
            Note: document.getElementById('taskNote').value
        };
        
        try {
            const url = isEdit ? 
                `${this.API_BASE}?resource=task&id=${taskId}` : 
                `${this.API_BASE}?resource=task`;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert(isEdit ? 'Task aggiornato con successo' : 'Task creato con successo', 'success');
                bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
                await this.loadTasks();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Errore salvataggio task:', error);
            this.showAlert('Errore nel salvataggio del task', 'danger');
        }
    }
    
    showArchiveModal(taskId) {
        this.taskToArchive = taskId;
        const modal = new bootstrap.Modal(document.getElementById('archiveModal'));
        modal.show();
    }
    
    async confirmArchive() {
        if (!this.taskToArchive) return;
        
        try {
            const response = await fetch(`${this.API_BASE}?resource=task&id=${this.taskToArchive}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Stato_Task: 'Archiviato',
                    Data_Chiusura_Task: new Date().toISOString().split('T')[0]
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Task archiviato con successo', 'success');
                bootstrap.Modal.getInstance(document.getElementById('archiveModal')).hide();
                await this.loadTasks();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Errore archiviazione task:', error);
            this.showAlert('Errore nell\'archiviazione del task', 'danger');
        } finally {
            this.taskToArchive = null;
        }
    }
    
    // Modal Giornate
    async showGiornateModal(taskId) {
        try {
            console.log('Loading giornate for task:', taskId);
            
            // Mostra il modal subito con lo spinner
            const modal = new bootstrap.Modal(document.getElementById('giornateModal'));
            modal.show();
            
            // Mostra lo spinner e nascondi il contenuto
            const loadingSpinner = document.getElementById('giornateLoadingSpinner');
            const giornateContainer = document.getElementById('giornateContainer');
            if (loadingSpinner) {
                loadingSpinner.style.display = 'block';
            }
            if (giornateContainer) {
                giornateContainer.style.display = 'none';
            }
            
            // Carica i dati del task
            const taskUrl = `${this.API_BASE}?resource=task&id=${taskId}`;
            console.log('Loading task from:', taskUrl);
            
            const taskResponse = await fetch(taskUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            console.log('Task response status:', taskResponse.status);
            
            if (!taskResponse.ok) {
                const errorText = await taskResponse.text();
                console.error('Task response error:', errorText);
                throw new Error(`Errore nel caricamento del task: ${taskResponse.status}`);
            }
            
            const taskData = await taskResponse.json();
            console.log('Task data loaded:', taskData);
            
            if (!taskData.success || !taskData.data) {
                throw new Error('Dati task non validi');
            }
            
            // Controlla se l'API del task include già le giornate
            let giornate = [];
            if (taskData.data.giornate && Array.isArray(taskData.data.giornate)) {
                giornate = taskData.data.giornate;
                console.log('✅ Using giornate from task API:', giornate.length);
            } else {
                console.log('❌ No giornate in task API, trying dedicated giornate API');
                
                // Prova l'API giornate con filtro task 
                const giornateUrl = `${this.API_BASE}?resource=giornate&task=${taskId}`;
                console.log('Loading giornate from:', giornateUrl);
                
                const giornateResponse = await fetch(giornateUrl, {
                    headers: { 'Accept': 'application/json' }
                });
                
                if (giornateResponse.ok) {
                    const giornateData = await giornateResponse.json();
                    if (giornateData.success && giornateData.data && giornateData.data.data) {
                        giornate = giornateData.data.data;
                        console.log('✅ Using filtered giornate API:', giornate.length);
                    } else {
                        console.log('❌ Filtered API failed, structure:', giornateData);
                    }
                }
            }
            
            console.log('📊 Final giornate array for modal:', giornate.length, 'items');
            
            this.renderGiornateModal(taskData.data, giornate);
            
        } catch (error) {
            console.error('Errore completo nel caricamento delle giornate:', error);
            this.showAlert(`Errore nel caricamento delle giornate: ${error.message}`, 'danger');
            
            // Nascondi lo spinner in caso di errore
            const loadingSpinner = document.getElementById('giornateLoadingSpinner');
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
        }
    }
    
    renderGiornateModal(task, giornate) {
        try {
            // Verifica che gli elementi del modal esistano
            const modalLabel = document.getElementById('giornateModalLabel');
            const totalGiornateEl = document.getElementById('totalGiornate');
            const totalSpeseEl = document.getElementById('totalSpese');
            const totalValoreMaturato = document.getElementById('totalValoreMaturato');
            const tbody = document.getElementById('giornateTableBody');
            const addGiornataBtn = document.getElementById('addGiornataBtn');
            const loadingSpinner = document.getElementById('giornateLoadingSpinner');
            const giornateContainer = document.getElementById('giornateContainer');
            
            if (!modalLabel || !totalGiornateEl || !totalSpeseEl || !totalValoreMaturato || !tbody || !addGiornataBtn) {
                console.error('Elementi del modal giornate non trovati');
                this.showAlert('Errore: modal delle giornate non configurato correttamente', 'danger');
                return;
            }
            
            // Nascondi lo spinner e mostra il contenuto
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
            if (giornateContainer) {
                giornateContainer.style.display = 'block';
            }
            
            // Aggiorna il titolo del modal
            modalLabel.textContent = `Giornate - ${task.Task || 'Task sconosciuto'}`;
            
            // Assicurati che giornate sia un array
            if (!Array.isArray(giornate)) {
                console.warn('Giornate non è un array:', giornate);
                giornate = [];
            }
            
            console.log('Giornate array processed:', giornate);
            
            // Calcola i totali
            const totaleGiornate = giornate.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
            const totaleSpese = giornate.reduce((sum, g) => {
                const speseViaggi = parseFloat(g.Spese_Viaggi) || 0;
                const vittoAlloggio = parseFloat(g.Vitto_alloggio) || 0;
                const altriCosti = parseFloat(g.Altri_costi) || 0;
                return sum + speseViaggi + vittoAlloggio + altriCosti;
            }, 0);
            
            // Calcola valore giornate basato sulla tariffa del task
            const prezzoGiornata = parseFloat(task.Valore_gg) || 1550; // Fallback a 1550 se non disponibile
            const valoreGiornate = totaleGiornate * prezzoGiornata;
            
            console.log('📊 Totali calcolati:');
            console.log('- Giornate totali:', totaleGiornate);
            console.log('- Prezzo per giornata:', prezzoGiornata);
            console.log('- Valore giornate:', valoreGiornate);
            console.log('- Spese totali:', totaleSpese);
            
            // Aggiorna le card di riepilogo
            totalGiornateEl.textContent = totaleGiornate.toFixed(2);
            totalSpeseEl.textContent = this.formatCurrency(totaleSpese);
            
            // Aggiorna il VALORE MATURATO (card verde in basso)
            if (totalValoreMaturato) {
                totalValoreMaturato.textContent = `€${valoreGiornate.toFixed(0)}`;
                console.log('✅ Updated Valore Maturato:', valoreGiornate);
            }
            
            // Aggiorna anche il Valore Giornate (card blu centrale) se esiste
            const valoreGiornateEl = document.getElementById('valoreGiornate') || 
                                   document.querySelector('.text-success');
            if (valoreGiornateEl && valoreGiornateEl !== totalValoreMaturato) {
                valoreGiornateEl.textContent = `€${valoreGiornate.toFixed(0)}`;
                console.log('✅ Updated Valore Giornate in center card:', valoreGiornate);
            }
            
            // Aggiorna elemento trasferta se esiste
            const totalTrasfertaEl = document.getElementById('totalTrasferta');
            if (totalTrasfertaEl) {
                totalTrasfertaEl.textContent = '€0.00';
            }
            
            // Non sovrascriviamo più il valore maturato con quello del database
            // totalValoreMaturato.textContent = this.formatCurrency(task.valore_tot_maturato || 0);
            
            // Aggiorna la tabella delle giornate
            tbody.innerHTML = '';
            
            if (giornate.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted py-4">
                            <i class="bi bi-calendar-x me-2"></i>
                            Nessuna giornata registrata per questo task
                        </td>
                    </tr>
                `;
            } else {
                giornate.forEach(async (giornata, index) => {
                    console.log('Rendering giornata:', giornata); // Debug per vedere i campi
                    
                    const speseViaggi = parseFloat(giornata.Spese_Viaggi) || 0;
                    const vittoAlloggio = parseFloat(giornata.Vitto_alloggio) || 0;
                    const altriCosti = parseFloat(giornata.Altri_costi) || 0;
                    const giornateNum = parseFloat(giornata.gg) || 0;
                    const prezzoGiornata = parseFloat(task.Valore_gg) || 1550;
                    
                    // Calcola il valore per questa giornata
                    const valoreGiornata = giornateNum * prezzoGiornata;
                    const totaleSpese = speseViaggi + vittoAlloggio + altriCosti;
                    
                    // Nome collaboratore migliorato - prova a convertire da ID a nome
                    let collaboratore = giornata.ID_COLLABORATORE;
                    if (collaboratore && collaboratore.startsWith('CON')) {
                        // Se abbiamo il campo collaboratore_info, usalo
                        if (giornata.collaboratore_info && giornata.collaboratore_info.Collaboratore) {
                            collaboratore = giornata.collaboratore_info.Collaboratore;
                        } else {
                            // Altrimenti mostra un nome più leggibile
                            collaboratore = `Collaboratore ${collaboratore.replace('CON', '')}`;
                        }
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${this.formatDate(giornata.Data)}</td>
                        <td>${collaboratore || 'N/A'}</td>
                        <td class="text-center">${giornata.Tipo || 'Campo'}</td>
                        <td class="text-end">${giornateNum.toFixed(2)}</td>
                        <td class="text-end">€${valoreGiornata.toFixed(0)}</td>
                        <td class="text-end">€${totaleSpese.toFixed(0)}</td>
                        <td class="text-truncate" style="max-width: 200px;" title="${giornata.Note || ''}">
                            ${giornata.Note || '-'}
                        </td>
                        <td class="text-end">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="taskManager.editGiornata('${giornata.ID_GIORNATA}')"
                                        title="Modifica">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm" 
                                        onclick="taskManager.deleteGiornata('${giornata.ID_GIORNATA}')"
                                        title="Elimina">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
            
            // Aggiorna i pulsanti con il taskId
            addGiornataBtn.setAttribute('data-task-id', task.ID_TASK);
            
            // Il modal è già stato mostrato in showGiornateModal, non serve mostrarlo di nuovo
            
        } catch (error) {
            console.error('Errore nel rendering del modal giornate:', error);
            this.showAlert('Errore nella visualizzazione delle giornate', 'danger');
        }
    }
    
    // Placeholder per le funzioni di gestione giornate
    editGiornata(giornataId) {
        console.log('Edit giornata:', giornataId);
        // TODO: Implementare la modifica di una giornata
        this.showAlert('Funzione di modifica giornata in sviluppo', 'info');
    }
    
    deleteGiornata(giornataId) {
        if (confirm('Sei sicuro di voler eliminare questa giornata?')) {
            console.log('Delete giornata:', giornataId);
            // TODO: Implementare l'eliminazione di una giornata
            this.showAlert('Funzione di eliminazione giornata in sviluppo', 'info');
        }
    }
    
    addGiornata() {
        const taskId = document.getElementById('addGiornataBtn').getAttribute('data-task-id');
        console.log('Add giornata for task:', taskId);
        // TODO: Implementare l'aggiunta di una nuova giornata
        this.showAlert('Funzione di aggiunta giornata in sviluppo', 'info');
    }
    
    // Toggle per raggruppamento per commessa
    toggleGroupByCommessa(isGrouped) {
        this.isGroupedByCommessa = isGrouped;
        this.renderTasks();
    }
    
    // Aggiornamento delle statistiche
    updateStatistics(tasks) {
        if (!tasks || tasks.length === 0) {
            // Resetta le statistiche se non ci sono task
            document.getElementById('totalTasks').textContent = '0';
            document.getElementById('totalValue').textContent = '€0';
            return;
        }
        
        // Calcola i totali
        const totalTasks = tasks.length;
        const totalValue = tasks.reduce((sum, task) => {
            return sum + (parseFloat(task.valore_tot_maturato) || 0);
        }, 0);
        
        // Aggiorna i display
        document.getElementById('totalTasks').textContent = totalTasks.toString();
        document.getElementById('totalValue').textContent = `€${this.formatCurrency(totalValue)}`;
    }
    
    showAlert(message, type = 'info') {
        const alertId = 'alert-' + Date.now();
        const alertDiv = document.createElement('div');
        alertDiv.id = alertId;
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove dopo 5 secondi
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert && alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Variabile globale per l'accesso da HTML
let taskManager;

// Inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    taskManager = new TaskManager();
    
    // Aggiungi event listener per il toggle di raggruppamento
    const groupToggle = document.getElementById('groupByCommessa');
    if (groupToggle) {
        groupToggle.addEventListener('change', function() {
            taskManager.toggleGroupByCommessa(this.checked);
        });
    }
});

// Funzioni globali per compatibilità con HTML
function confirmArchive() {
    if (taskManager) {
        taskManager.confirmArchive();
    }
}

function saveTask() {
    if (taskManager) {
        taskManager.saveTask();
    }
}

function addGiornata() {
    if (taskManager) {
        taskManager.addGiornata();
    }
}