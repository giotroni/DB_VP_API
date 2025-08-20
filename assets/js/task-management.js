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
        this.API_BASE = '/gestione_VP/API';
        this.allTasks = [];
        this.commesseList = [];
        this.collaboratoriList = [];
        this.taskToArchive = null;
        this.currentPage = 1;
        this.tasksPerPage = 12;
        
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
            // Torna a usare il routing normale
            const response = await fetch(`${this.API_BASE}/task?limit=100`);
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
            // Usa il file che carica tutte le commesse
            const response = await fetch(`${this.API_BASE}/commesse_all.php`);
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
            const response = await fetch(`${this.API_BASE}/collaboratori`);
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
        
        container.innerHTML = paginatedTasks.map(task => this.createTaskCard(task)).join('');
    }
    
    createTaskCard(task) {
        // Usa i nuovi campi dalla query migliorata
        const commessaNome = task.commessa_nome || 'N/A';
        const clienteNome = task.cliente_nome || 'Interno';
        const collaboratoreNome = task.collaboratore_nome || 'N/A';
        
        const progressPercent = task.gg_previste > 0 ? 
            Math.round((task.gg_effettuate || 0) / task.gg_previste * 100) : 0;
        
        const isArchived = task.Stato_Task === 'Archiviato';
        const statusClass = task.Stato_Task?.toLowerCase().replace(' ', '-') || 'unknown';
        
        return `
            <div class="col-md-6 col-lg-4">
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
                    <div class="card-body">
                        <h6 class="card-title text-truncate" title="${task.Task}">${task.Task}</h6>
                        <p class="card-text text-muted small mb-2" title="${task.Desc_Task || 'Nessuna descrizione'}">
                            ${this.truncateText(task.Desc_Task || 'Nessuna descrizione', 80)}
                        </p>
                        
                        <div class="row text-center mb-2">
                            <div class="col-4">
                                <small class="text-muted">Previsti</small>
                                <div class="fw-bold">${task.gg_previste || 0} gg</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Effettuati</small>
                                <div class="fw-bold">${task.gg_effettuate || 0} gg</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Valore</small>
                                <div class="fw-bold">€${this.formatCurrency(task.Valore_gg || 0)}</div>
                            </div>
                        </div>
                        
                        <hr class="my-2">
                        <div class="small text-muted">
                            <div class="text-truncate" title="${commessaNome}">
                                <strong>Commessa:</strong> ${this.truncateText(commessaNome, 25)}
                            </div>
                            <div class="text-truncate" title="${clienteNome}">
                                <strong>Cliente:</strong> ${this.truncateText(clienteNome, 25)}
                            </div>
                            <div class="text-truncate" title="${collaboratoreNome}">
                                <strong>Responsabile:</strong> ${this.truncateText(collaboratoreNome, 25)}
                            </div>
                            <div><strong>Apertura:</strong> ${this.formatDate(task.Data_Apertura_Task)}</div>
                            ${task.Data_Chiusura_Task ? `<div><strong>Chiusura:</strong> ${this.formatDate(task.Data_Chiusura_Task)}</div>` : ''}
                        </div>
                    </div>
                    <div class="card-footer d-flex justify-content-between">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="taskManager.editTask('${task.ID_TASK}')"
                                ${isArchived ? 'disabled' : ''}>
                            <i class="bi bi-pencil"></i> Modifica
                        </button>
                        ${!isArchived ? `
                            <button class="btn btn-sm btn-outline-warning" 
                                    onclick="taskManager.showArchiveModal('${task.ID_TASK}')">
                                <i class="bi bi-archive"></i> Archivia
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
            const url = isEdit ? `${this.API_BASE}/task/${taskId}` : `${this.API_BASE}/task`;
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
            const response = await fetch(`${this.API_BASE}/task/${this.taskToArchive}`, {
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