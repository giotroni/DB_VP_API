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
            this.populateAnnoSelect();
            this.populateMeseSelect();
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
    
    populateAnnoSelect() {
        const select = document.getElementById('filterAnno');
        if (!select) return;
        
        const currentValue = select.value;
        const firstOption = select.children[0].outerHTML;
        select.innerHTML = firstOption;
        
        const currentYear = new Date().getFullYear();
        
        // Genera anni dal 2024 fino all'anno corrente
        for (let year = currentYear; year >= 2024; year--) {
            const option = document.createElement('option');
            option.value = year.toString();
            option.textContent = year.toString();
            select.appendChild(option);
        }
        
        if (currentValue) select.value = currentValue;
    }
    
    populateMeseSelect() {
        const select = document.getElementById('filterMese');
        if (!select) return;
        
        const currentValue = select.value;
        const firstOption = select.children[0].outerHTML;
        select.innerHTML = firstOption;
        
        const mesi = [
            { value: '01', label: 'Gennaio' },
            { value: '02', label: 'Febbraio' },
            { value: '03', label: 'Marzo' },
            { value: '04', label: 'Aprile' },
            { value: '05', label: 'Maggio' },
            { value: '06', label: 'Giugno' },
            { value: '07', label: 'Luglio' },
            { value: '08', label: 'Agosto' },
            { value: '09', label: 'Settembre' },
            { value: '10', label: 'Ottobre' },
            { value: '11', label: 'Novembre' },
            { value: '12', label: 'Dicembre' }
        ];
        
        mesi.forEach(mese => {
            const option = document.createElement('option');
            option.value = mese.value;
            option.textContent = mese.label;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    }
    
    async updateCommesseBasedOnPeriod() {
        const anno = document.getElementById('filterAnno')?.value || '';
        const mese = document.getElementById('filterMese')?.value || '';
        
        try {
            if (!anno) {
                // Se non c'è un anno selezionato, mostra tutte le commesse
                this.populateCommesseSelect();
                return;
            }
            
            // Prepara il parametro per l'API
            let annoMeseParam = '';
            if (anno && mese) {
                // Anno e mese specificati
                annoMeseParam = `${anno}-${mese}`;
            } else if (anno) {
                // Solo anno specificato - usa un range per tutto l'anno
                annoMeseParam = anno; // L'API gestirà questo caso
            }
            
            if (annoMeseParam) {
                // Chiama l'API per ottenere le commesse con giornate nel periodo selezionato
                const response = await fetch(`${this.API_BASE}?resource=commesse&anno_mese=${annoMeseParam}`);
                const data = await response.json();
                
                if (data.success) {
                    const commesseConGiornate = data.data.data || [];
                    this.updateCommesseSelect(commesseConGiornate);
                } else {
                    console.warn('Errore nel caricamento commesse per periodo:', data.error);
                    // Fallback: mostra tutte le commesse
                    this.populateCommesseSelect();
                }
            } else {
                this.populateCommesseSelect();
            }
        } catch (error) {
            console.error('Errore nell\'aggiornamento commesse per periodo:', error);
            // Fallback: mostra tutte le commesse
            this.populateCommesseSelect();
        }
    }
    
    updateCommesseSelect(commesseList) {
        const select = document.getElementById('filterCommessa');
        if (!select) return;
        
        const currentValue = select.value;
        const firstOption = select.children[0].outerHTML;
        select.innerHTML = firstOption;
        
        if (commesseList && commesseList.length > 0) {
            commesseList.forEach(commessa => {
                const option = document.createElement('option');
                option.value = commessa.ID_COMMESSA;
                option.textContent = `${commessa.Commessa}${commessa.Cliente ? ' - ' + commessa.Cliente : ''}`;
                select.appendChild(option);
            });
        }
        
        // Se la commessa precedentemente selezionata non è più disponibile, resettala
        if (currentValue && !commesseList.find(c => c.ID_COMMESSA === currentValue)) {
            select.value = '';
        } else if (currentValue) {
            select.value = currentValue;
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
            });
            
            if (currentValue) select.value = currentValue;
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
            this.updateStatistics([]); // Aggiorna statistiche con array vuoto
            return;
        }
        
        container.style.display = 'flex';
        noTasksDiv.style.display = 'none';
        
        // Paginazione
        const startIndex = (this.currentPage - 1) * this.tasksPerPage;
        const endIndex = startIndex + this.tasksPerPage;
        const paginatedTasks = tasks.slice(startIndex, endIndex);
        
        // Sempre raggruppato per commessa
        container.innerHTML = this.renderTasksByCommessa(paginatedTasks);
        
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
        return Object.entries(tasksByCommessa).map(([commessaId, group], index) => {
            // Calcola statistiche filtrate per periodo
            const stats = this.calculateCommessaStatsFiltered(group.tasks);
            const collapseId = `commessa-collapse-${index}`;
            
            return `
                <div class="col-12 mb-4">
                    <div class="card commessa-group">
                        <div class="card-header bg-light" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                            <div class="row align-items-center">
                                <div class="col-md-7">
                                    <h5 class="mb-1">
                                        <i class="bi bi-chevron-right me-2 collapse-icon" id="icon-${collapseId}"></i>
                                        <i class="bi bi-briefcase me-2"></i>${group.commessa}
                                    </h5>
                                    <div class="text-muted small">
                                        <strong>Cliente:</strong> ${group.cliente} | 
                                        <strong>Responsabile:</strong> ${group.responsabile}
                                    </div>
                                </div>
                                <div class="col-md-5 text-end">
                                    <div class="d-flex justify-content-end align-items-center gap-2">
                                        <button class="btn btn-outline-primary btn-sm" 
                                                onclick="event.stopPropagation(); taskManager.editCommessa('${commessaId}')"
                                                title="Modifica Commessa">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <div class="row text-center" style="min-width: 240px;">
                                            <div class="col-4">
                                                <div class="fw-bold text-primary">${group.tasks.length}</div>
                                                <small class="text-muted">Task</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="fw-bold text-success">${stats.totalGiornate.toFixed(1)}</div>
                                                <small class="text-muted">Giornate</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="fw-bold text-info" 
                                                     style="font-size: 0.9rem;" 
                                                     title="€${this.formatCurrencyFull(stats.totalValore)}">
                                                    €${this.formatCurrency(stats.totalValore)}
                                                </div>
                                                <small class="text-muted">Valore</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="collapse" id="${collapseId}">
                            <div class="card-body">
                                <div class="row g-3">
                                    ${group.tasks.map(task => this.createTaskCard(task, true)).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    calculateCommessaStatsFiltered(tasks) {
        // Calcola le statistiche basandosi sui dati già filtrati per periodo
        // I task arrivano già con i valori maturati filtrati dall'API
        const totalGiornate = tasks.reduce((sum, task) => sum + (task.gg_effettuate_filtrate || task.gg_effettuate || 0), 0);
        const totalValore = tasks.reduce((sum, task) => sum + (task.valore_tot_maturato_filtrato || task.valore_tot_maturato || 0), 0);
        
        return {
            totalGiornate: totalGiornate,
            totalValore: totalValore
        };
    }
    
    createTaskCard(task, isInGroup = false) {
        // Usa i nuovi campi dalla query migliorata
        const commessaNome = task.commessa_nome || 'N/A';
        const clienteNome = task.cliente_nome || 'Interno';
        const collaboratoreNome = task.collaboratore_nome || 'N/A';
        const responsabileCommessa = task.responsabile_commessa || 'N/A';
        
        // Calcolo percentuale di avanzamento
        const ggEffettuateCalc = task.gg_effettuate_filtrate || task.gg_effettuate || 0;
        let progressPercent;
        
        if (task.gg_previste > 0) {
            // Caso normale: ci sono giorni previsti
            progressPercent = Math.round(ggEffettuateCalc / task.gg_previste * 100);
        } else if (ggEffettuateCalc === 0) {
            // Caso speciale: 0 giorni previsti e 0 giorni effettuati = 100% (completato)
            progressPercent = 100;
        } else {
            // Caso: 0 giorni previsti ma ci sono giorni effettuati = calcolo percentuale alta
            progressPercent = 100;
        }
        
        const isArchived = task.Stato_Task === 'Archiviato';
        const statusClass = task.Stato_Task?.toLowerCase().replace(' ', '-') || 'unknown';
        
        // Usa valori filtrati se disponibili, altrimenti i valori totali
        const ggEffettuate = task.gg_effettuate_filtrate !== undefined ? task.gg_effettuate_filtrate : (task.gg_effettuate || 0);
        const valoreGgMaturato = task.valore_gg_maturato_filtrato !== undefined ? task.valore_gg_maturato_filtrato : (task.valore_gg_maturato || 0);
        const valoreSpeseMaturo = task.valore_spese_maturato_filtrato !== undefined ? task.valore_spese_maturato_filtrato : (task.valore_spese_maturato || 0);
        const valoreTotMaturato = task.valore_tot_maturato_filtrato !== undefined ? task.valore_tot_maturato_filtrato : (task.valore_tot_maturato || 0);
        
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
                        ${task.Tipo !== 'Monitoraggio' ? `
                        <div class="progress-circle" style="background: ${this.getProgressColor(progressPercent)}">
                            ${progressPercent}%
                        </div>
                        ` : ''}
                    </div>
                    <div class="card-body" onclick="taskManager.showGiornateModal('${task.ID_TASK}')" style="cursor: pointer;">
                        <h6 class="card-title text-truncate" title="${task.Task}">${task.Task}</h6>
                        <p class="card-text text-muted small mb-2" title="${task.Desc_Task || 'Nessuna descrizione'}">
                            ${this.truncateText(task.Desc_Task || 'Nessuna descrizione', 80)}
                        </p>
                        ${task.Tipo === 'Monitoraggio' ? `
                        <div class="alert alert-info py-1 px-2 mb-2 small">
                            <i class="bi bi-info-circle me-1"></i>
                            Valore calcolato su attività commessa
                        </div>
                        ` : ''}
                        
                        ${task.Tipo === 'Monitoraggio' ? `
                        <div class="row text-center mb-2 small">
                            <div class="col-6">
                                <div class="text-muted">Prezzo/gg</div>
                                <div class="fw-bold text-secondary">€${this.formatCurrency(task.Valore_gg || 0)}</div>
                            </div>
                            <div class="col-6">
                                <div class="text-muted">Valore Calc.</div>
                                <div class="fw-bold text-success">€${this.formatCurrency(valoreTotMaturato)}</div>
                            </div>
                        </div>
                        ` : `
                        <div class="row text-center mb-2 small">
                            <div class="col-3">
                                <div class="text-muted">Previsti</div>
                                <div class="fw-bold">${task.gg_previste || 0} gg</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">Effettuati</div>
                                <div class="fw-bold text-primary">${ggEffettuate} gg</div>
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
                        `}
                        
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
        if (percent >= 100) return '#28a745'; // Verde per 100%
        return '#87CEEB'; // Azzurro chiaro per < 100%
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('it-IT');
    }
    
    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        
        // Usa sempre la formattazione completa con una cifra decimale
        return new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value);
    }

    formatCurrencyFull(amount) {
        // Versione completa per i dettagli
        return new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(amount);
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
        const filterAnno = document.getElementById('filterAnno');
        const filterMese = document.getElementById('filterMese');
        
        if (searchInput) searchInput.addEventListener('input', () => this.filterTasks());
        if (filterCommessa) filterCommessa.addEventListener('change', () => this.filterTasks());
        if (filterStato) filterStato.addEventListener('change', () => this.filterTasks());
        if (filterTipo) filterTipo.addEventListener('change', () => this.filterTasks());
        
        // Event listeners per i nuovi filtri di periodo
        if (filterAnno) {
            filterAnno.addEventListener('change', async () => {
                await this.updateCommesseBasedOnPeriod();
                this.filterTasks();
            });
        }
        
        if (filterMese) {
            filterMese.addEventListener('change', async () => {
                await this.updateCommesseBasedOnPeriod();
                this.filterTasks();
            });
        }
        
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
        
        // Setup collapse listeners per le commesse
        this.setupCollapseListeners();
        
        // Event listener per espandi/collassa tutto
        const expandCollapseAll = document.getElementById('expandCollapseAll');
        if (expandCollapseAll) {
            expandCollapseAll.addEventListener('change', () => {
                this.toggleAllCommesse(expandCollapseAll.checked);
            });
        }

        // Event listeners per modal commessa
        const commessaModal = document.getElementById('commessaModal');
        if (commessaModal) {
            commessaModal.addEventListener('shown.bs.modal', () => {
                this.loadClientiInCommessaModal();
                this.loadCollaboratoriInCommessaModal();
                this.initCommessaForm();
            });
            
            commessaModal.addEventListener('hidden.bs.modal', () => {
                this.resetCommessaForm();
            });
        }

        // Event listeners per modal modifica commessa
        const editCommessaModal = document.getElementById('editCommessaModal');
        if (editCommessaModal) {
            editCommessaModal.addEventListener('hidden.bs.modal', () => {
                this.resetEditCommessaForm();
            });
        }

        // Event listener per tipo commessa per mostrare/nascondere cliente
        const commessaTipo = document.getElementById('commessaTipo');
        if (commessaTipo) {
            commessaTipo.addEventListener('change', () => {
                this.toggleClienteField();
            });
        }

        // Event listener per tipo commessa nel modal di modifica
        const editCommessaTipo = document.getElementById('editCommessaTipo');
        if (editCommessaTipo) {
            editCommessaTipo.addEventListener('change', () => {
                this.toggleEditClienteField();
            });
        }
    }
    
    setupCollapseListeners() {
        // Usa event delegation per gestire i collapse dinamici
        document.addEventListener('shown.bs.collapse', (e) => {
            if (e.target.id.startsWith('commessa-collapse-')) {
                const iconId = `icon-${e.target.id}`;
                const icon = document.getElementById(iconId);
                if (icon) {
                    icon.classList.remove('bi-chevron-right');
                    icon.classList.add('bi-chevron-down');
                }
            }
        });
        
        document.addEventListener('hidden.bs.collapse', (e) => {
            if (e.target.id.startsWith('commessa-collapse-')) {
                const iconId = `icon-${e.target.id}`;
                const icon = document.getElementById(iconId);
                if (icon) {
                    icon.classList.remove('bi-chevron-down');
                    icon.classList.add('bi-chevron-right');
                }
            }
        });
    }
    
    toggleAllCommesse(expand) {
        // Trova tutti i collapse delle commesse
        const collapses = document.querySelectorAll('[id^="commessa-collapse-"]');
        const label = document.querySelector('label[for="expandCollapseAll"]');
        
        collapses.forEach(collapse => {
            const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
            
            if (expand) {
                bsCollapse.show();
            } else {
                bsCollapse.hide();
            }
        });
        
        // Aggiorna la label
        if (label) {
            label.textContent = expand ? 'Collassa Tutto' : 'Espandi Tutto';
        }
    }
    
    async filterTasks() {
        const searchText = document.getElementById('searchTask')?.value.toLowerCase() || '';
        const filterCommessa = document.getElementById('filterCommessa')?.value || '';
        const filterStato = document.getElementById('filterStato')?.value || '';
        const filterTipo = document.getElementById('filterTipo')?.value || '';
        const filterAnno = document.getElementById('filterAnno')?.value || '';
        const filterMese = document.getElementById('filterMese')?.value || '';
        
        try {
            // Costruisci i parametri della query
            const params = new URLSearchParams();
            params.append('resource', 'task');
            params.append('limit', '200');
            
            if (searchText) {
                params.append('search', searchText);
            }
            if (filterCommessa) {
                params.append('commessa', filterCommessa);
            }
            if (filterStato) {
                params.append('stato', filterStato);
            }
            if (filterTipo) {
                params.append('tipo', filterTipo);
            }
            
            // Gestisce filtro per periodo: anno+mese, solo anno, o nessuno
            if (filterAnno && filterMese) {
                // Anno e mese specificati
                const annoMese = `${filterAnno}-${filterMese}`;
                params.append('anno_mese', annoMese);
            } else if (filterAnno) {
                // Solo anno specificato - filtra per tutto l'anno
                params.append('anno', filterAnno);
            }
            
            // Chiama l'API con i filtri integrati
            const response = await fetch(`${this.API_BASE}?${params.toString()}`);
            const data = await response.json();
            
            if (data.success) {
                const filteredTasks = data.data.data || [];
                this.currentPage = 1; // Reset alla prima pagina
                this.renderTasks(filteredTasks);
                this.updatePagination(filteredTasks.length);
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Errore nel filtro task:', error);
            this.showAlert('Errore nell\'applicazione dei filtri', 'warning');
            
            // Fallback: usa il filtro client-side per i parametri di base
            let filteredTasks = this.allTasks.filter(task => {
                const matchesSearch = !searchText || 
                    task.Task?.toLowerCase().includes(searchText) ||
                    (task.Desc_Task && task.Desc_Task.toLowerCase().includes(searchText));
                const matchesCommessa = !filterCommessa || task.ID_COMMESSA === filterCommessa;
                const matchesStato = !filterStato || task.Stato_Task === filterStato;
                const matchesTipo = !filterTipo || task.Tipo === filterTipo;
                
                return matchesSearch && matchesCommessa && matchesStato && matchesTipo;
            });
            
            this.currentPage = 1;
            this.renderTasks(filteredTasks);
            this.updatePagination(filteredTasks.length);
        }
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
            'taskStato': task.Stato_Task || 'In corso',
            'taskGgPreviste': task.gg_previste || '',
            'taskValoreGg': task.Valore_gg || '',
            'taskSpeseComprese': task.Spese_Comprese || 'No',
            'taskValoreSpese': task.Valore_Spese_std || ''
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
            ID_COLLABORATORE: document.getElementById('taskCollaboratore').value || null,
            Tipo: document.getElementById('taskTipo').value,
            Data_Apertura_Task: document.getElementById('taskDataApertura').value,
            Stato_Task: document.getElementById('taskStato').value,
            gg_previste: parseFloat(document.getElementById('taskGgPreviste').value) || null,
            Valore_gg: parseFloat(document.getElementById('taskValoreGg').value) || null,
            Spese_Comprese: document.getElementById('taskSpeseComprese').value,
            Valore_Spese_std: parseFloat(document.getElementById('taskValoreSpese').value) || null
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
                    Stato_Task: 'Archiviato'
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
            
            // Ottieni i filtri periodo correnti
            const filterAnno = document.getElementById('filterAnno')?.value || '';
            const filterMese = document.getElementById('filterMese')?.value || '';
            
            // Costruisci URL per le giornate con filtri periodo
            let giornateUrl = `${this.API_BASE}?resource=giornate&task=${taskId}`;
            
            // Aggiungi filtri periodo se presenti
            if (filterAnno && filterMese) {
                giornateUrl += `&anno_mese=${filterAnno}-${filterMese}`;
            } else if (filterAnno) {
                giornateUrl += `&anno=${filterAnno}`;
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
            
            // Carica le giornate con filtri periodo
            let giornate = [];
            console.log('Loading filtered giornate from:', giornateUrl);
            
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
            } else {
                console.log('❌ Giornate API failed with status:', giornateResponse.status);
            }
            
            console.log('📊 Final giornate array for modal:', giornate.length, 'items');
            
            // Aggiungi info sul filtro periodo al task data per mostrarlo nel modal
            taskData.data.filtro_periodo = this.getCurrentPeriodFilter();
            
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
    
    getCurrentPeriodFilter() {
        const filterAnno = document.getElementById('filterAnno')?.value || '';
        const filterMese = document.getElementById('filterMese')?.value || '';
        
        if (filterAnno && filterMese) {
            const mesi = [
                'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
            ];
            const meseNome = mesi[parseInt(filterMese) - 1];
            return `${meseNome} ${filterAnno}`;
        } else if (filterAnno) {
            return `Anno ${filterAnno}`;
        }
        
        return null;
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
            
            // Aggiorna il titolo del modal con info sul filtro
            let titleText = `Giornate - ${task.Task || 'Task sconosciuto'}`;
            if (task.filtro_periodo) {
                titleText += ` (Filtro: ${task.filtro_periodo})`;
            }
            modalLabel.textContent = titleText;
            
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
            
            // Calcola valore maturato = valore giornate + spese totali
            const valoreMaturato = valoreGiornate + totaleSpese;
            
            console.log('📊 Totali calcolati:');
            console.log('- Giornate totali:', totaleGiornate);
            console.log('- Prezzo per giornata:', prezzoGiornata);
            console.log('- Valore giornate:', valoreGiornate);
            console.log('- Spese totali:', totaleSpese);
            console.log('- Valore maturato:', valoreMaturato);
            
            // Aggiorna le card di riepilogo
            totalGiornateEl.textContent = totaleGiornate.toFixed(2);
            totalSpeseEl.textContent = this.formatCurrency(totaleSpese);
            
            // Aggiorna il VALORE MATURATO (card verde in basso) = Valore Giornate + Spese
            if (totalValoreMaturato) {
                totalValoreMaturato.textContent = `€${this.formatCurrency(valoreMaturato)}`;
                console.log('✅ Updated Valore Maturato:', valoreMaturato);
            }
            
            // Aggiorna il Valore Giornate (card blu centrale) 
            const valoreGiornateEl = document.getElementById('valoreGiornate') || 
                                   document.querySelector('.text-success');
            if (valoreGiornateEl && valoreGiornateEl !== totalValoreMaturato) {
                valoreGiornateEl.textContent = `€${this.formatCurrency(valoreGiornate)}`;
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
                        <td class="text-end">€${this.formatCurrency(valoreGiornata)}</td>
                        <td class="text-end">€${this.formatCurrency(totaleSpese)}</td>
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
    
    // Aggiornamento delle statistiche
    updateStatistics(tasks) {
        if (!tasks || tasks.length === 0) {
            // Resetta le statistiche se non ci sono task
            document.getElementById('totalTasks').textContent = '0';
            document.getElementById('activeTasks').textContent = '0';
            document.getElementById('totalValue').textContent = '€0';
            return;
        }
        
        // Calcola i totali basandosi sui task filtrati
        const totalTasks = tasks.length;
        const activeTasks = tasks.filter(task => 
            task.Stato_Task !== 'Archiviato' && task.Stato_Task !== 'Chiuso'
        ).length;
        
        // Usa i valori filtrati se disponibili
        const totalValue = tasks.reduce((sum, task) => {
            const valore = task.valore_tot_maturato_filtrato !== undefined ? 
                task.valore_tot_maturato_filtrato : 
                (task.valore_tot_maturato || 0);
            return sum + valore;
        }, 0);
        
        // Aggiorna i display
        document.getElementById('totalTasks').textContent = totalTasks.toString();
        document.getElementById('activeTasks').textContent = activeTasks.toString();
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

    // === GESTIONE MODAL COMMESSA ===
    
    async loadClientiInCommessaModal() {
        try {
            const response = await fetch(`${this.API_BASE}?resource=clienti&limit=100`);
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('commessaCliente');
                if (select) {
                    const firstOption = select.children[0].outerHTML;
                    select.innerHTML = firstOption;
                    
                    const clienti = data.data.data || [];
                    clienti.forEach(cliente => {
                        const option = document.createElement('option');
                        option.value = cliente.ID_CLIENTE;
                        option.textContent = cliente.Cliente;
                        select.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Errore caricamento clienti per modal commessa:', error);
        }
    }

    async loadCollaboratoriInCommessaModal() {
        try {
            // Popola il select responsabile commessa
            const responsabileSelect = document.getElementById('commessaResponsabile');
            if (responsabileSelect && this.collaboratoriList.length > 0) {
                const firstOption = responsabileSelect.children[0].outerHTML;
                responsabileSelect.innerHTML = firstOption;
                
                this.collaboratoriList.forEach(collaboratore => {
                    const option = document.createElement('option');
                    option.value = collaboratore.ID_COLLABORATORE;
                    option.textContent = collaboratore.Collaboratore;
                    responsabileSelect.appendChild(option);
                });
            }

            // Popola anche il select del collaboratore per i task
            const select = document.querySelector('.task-collaboratore');
            if (select && this.collaboratoriList.length > 0) {
                const firstOption = select.children[0].outerHTML;
                select.innerHTML = firstOption;
                
                this.collaboratoriList.forEach(collaboratore => {
                    const option = document.createElement('option');
                    option.value = collaboratore.ID_COLLABORATORE;
                    option.textContent = collaboratore.Collaboratore;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Errore caricamento collaboratori per modal commessa:', error);
        }
    }

    initCommessaForm() {
        // Imposta data apertura a oggi
        const dataApertura = document.getElementById('commessaDataApertura');
        if (dataApertura) {
            dataApertura.value = new Date().toISOString().split('T')[0];
        }

        // Imposta data apertura per il primo task
        const taskDataApertura = document.querySelector('.task-data-apertura');
        if (taskDataApertura) {
            taskDataApertura.value = new Date().toISOString().split('T')[0];
        }

        // Popola i collaboratori nel primo task
        this.populateTaskCollaboratori();

        // Inizializza il contatore task
        this.taskCounter = 1;
    }

    toggleClienteField() {
        const tipoCommessa = document.getElementById('commessaTipo').value;
        const clienteGroup = document.getElementById('commessaCliente').closest('.col-md-6');
        
        if (clienteGroup) {
            if (tipoCommessa === 'Interna') {
                clienteGroup.style.display = 'none';
                document.getElementById('commessaCliente').value = '';
            } else {
                clienteGroup.style.display = 'block';
            }
        }
    }

    addTaskToCommessa() {
        this.taskCounter = this.taskCounter || 1;
        this.taskCounter++;
        
        const container = document.getElementById('tasksContainer');
        const newTaskHtml = `
            <div class="task-item border rounded p-3 mb-3" data-task-index="${this.taskCounter - 1}">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h6 class="mb-0">Task #${this.taskCounter}</h6>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeTaskFromCommessa(${this.taskCounter - 1})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">Nome Task *</label>
                        <input type="text" class="form-control task-nome" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Tipo *</label>
                        <select class="form-select task-tipo" required>
                            <option value="">Seleziona tipo</option>
                            <option value="Campo">Campo</option>
                            <option value="Ufficio">Ufficio</option>
                            <option value="Monitoraggio">Monitoraggio</option>
                            <option value="Promo">Promo</option>
                            <option value="Sviluppo">Sviluppo</option>
                            <option value="Formazione">Formazione</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Collaboratore</label>
                        <select class="form-select task-collaboratore">
                            <option value="">Nessuno specifico</option>
                        </select>
                    </div>
                </div>

                <div class="row g-3 mt-2">
                    <div class="col-md-12">
                        <label class="form-label">Descrizione</label>
                        <textarea class="form-control task-descrizione" rows="2"></textarea>
                    </div>
                </div>

                <div class="row g-3 mt-2">
                    <div class="col-md-3">
                        <label class="form-label">Data Apertura</label>
                        <input type="date" class="form-control task-data-apertura" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Giorni Previsti</label>
                        <input type="number" class="form-control task-gg-previste" step="0.5" min="0">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Valore/Giorno (€)</label>
                        <input type="number" class="form-control task-valore-gg" step="0.01" min="0">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Spese Comprese</label>
                        <select class="form-select task-spese-comprese">
                            <option value="No">No</option>
                            <option value="Sì">Sì</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', newTaskHtml);
        
        // Popola il select collaboratori per il nuovo task
        this.populateTaskCollaboratori(container.lastElementChild);
        
        // Aggiorna i pulsanti di rimozione
        this.updateRemoveButtons();
    }

    populateTaskCollaboratori(taskElement) {
        const select = taskElement ? taskElement.querySelector('.task-collaboratore') : document.querySelector('.task-collaboratore');
        if (select && this.collaboratoriList.length > 0) {
            const firstOption = select.children[0].outerHTML;
            select.innerHTML = firstOption;
            
            this.collaboratoriList.forEach(collaboratore => {
                const option = document.createElement('option');
                option.value = collaboratore.ID_COLLABORATORE;
                option.textContent = collaboratore.Collaboratore;
                select.appendChild(option);
            });
        }
    }

    removeTaskFromCommessa(taskIndex) {
        const taskItem = document.querySelector(`[data-task-index="${taskIndex}"]`);
        if (taskItem) {
            taskItem.remove();
            this.updateTaskNumbers();
            this.updateRemoveButtons();
        }
    }

    updateTaskNumbers() {
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach((item, index) => {
            const header = item.querySelector('h6');
            if (header) {
                header.textContent = `Task #${index + 1}`;
            }
            item.setAttribute('data-task-index', index);
            
            // Aggiorna il pulsante rimuovi
            const removeBtn = item.querySelector('.btn-outline-danger');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removeTaskFromCommessa(${index})`);
            }
        });
    }

    updateRemoveButtons() {
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach((item, index) => {
            const removeBtn = item.querySelector('.btn-outline-danger');
            if (removeBtn) {
                // Mostra il pulsante rimuovi solo se ci sono più di un task
                removeBtn.style.display = taskItems.length > 1 ? 'inline-block' : 'none';
            }
        });
    }

    resetCommessaForm() {
        const form = document.getElementById('commessaForm');
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }

        // Reset del container task al solo primo task
        const container = document.getElementById('tasksContainer');
        if (container) {
            const firstTask = container.querySelector('.task-item');
            container.innerHTML = '';
            if (firstTask) {
                firstTask.setAttribute('data-task-index', '0');
                firstTask.querySelector('h6').textContent = 'Task #1';
                firstTask.querySelector('.btn-outline-danger').style.display = 'none';
                container.appendChild(firstTask);
            }
        }

        this.taskCounter = 1;
    }

    resetEditCommessaForm() {
        const form = document.getElementById('editCommessaForm');
        if (form) {
            form.reset();
            form.classList.remove('was-validated');
        }
        
        // Reset statistiche
        document.getElementById('editStatsTasks').textContent = '0';
        document.getElementById('editStatsGiornate').textContent = '0';
        document.getElementById('editStatsValore').textContent = '€0';
        document.getElementById('editStatsFatturato').textContent = '€0';
    }

    async saveCommessaWithTasks() {
        const form = document.getElementById('commessaForm');
        
        // Validazione base del form
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            this.showAlert('Compila tutti i campi richiesti della commessa', 'warning');
            return;
        }

        // Raccogli dati commessa
        const commessaData = {
            Commessa: document.getElementById('commessaNome').value.trim(),
            Desc_Commessa: document.getElementById('commessaDescrizione').value.trim(),
            Tipo_Commessa: document.getElementById('commessaTipo').value,
            ID_CLIENTE: document.getElementById('commessaCliente').value || null,
            ID_COLLABORATORE: document.getElementById('commessaResponsabile').value || null,
            Data_Apertura_Commessa: document.getElementById('commessaDataApertura').value || null,
            Stato_Commessa: document.getElementById('commessaStato').value || 'In corso',
            Commissione: parseFloat(document.getElementById('commessaCommissione').value) || 0
        };

        // Validazione tipo commessa/cliente
        if (commessaData.Tipo_Commessa === 'Cliente' && !commessaData.ID_CLIENTE) {
            this.showAlert('Per le commesse di tipo "Cliente" è obbligatorio selezionare un cliente', 'warning');
            return;
        }

        // Raccogli dati task
        const taskItems = document.querySelectorAll('.task-item');
        const tasks = [];
        let hasValidationErrors = false;

        taskItems.forEach((item, index) => {
            const taskNome = item.querySelector('.task-nome').value.trim();
            const taskTipo = item.querySelector('.task-tipo').value;

            if (!taskNome || !taskTipo) {
                hasValidationErrors = true;
                this.showAlert(`Task #${index + 1}: Nome e Tipo sono obbligatori`, 'warning');
                return;
            }

            const taskData = {
                Task: taskNome,
                Desc_Task: item.querySelector('.task-descrizione').value.trim() || null,
                Tipo: taskTipo,
                ID_COLLABORATORE: item.querySelector('.task-collaboratore').value || null,
                Data_Apertura_Task: item.querySelector('.task-data-apertura').value || null,
                Stato_Task: 'In corso',
                gg_previste: parseFloat(item.querySelector('.task-gg-previste').value) || null,
                Valore_gg: parseFloat(item.querySelector('.task-valore-gg').value) || null,
                Spese_Comprese: item.querySelector('.task-spese-comprese').value || 'No',
                Valore_Spese_std: null
            };

            tasks.push(taskData);
        });

        if (hasValidationErrors) {
            return;
        }

        if (tasks.length === 0) {
            this.showAlert('È necessario definire almeno un task per la commessa', 'warning');
            return;
        }

        try {
            // Disabilita il pulsante di salvataggio per evitare doppi click
            const saveBtn = document.querySelector('#commessaModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass me-1"></i>Salvataggio...';
            }

            // Step 1: Crea la commessa
            console.log('Creating commessa:', commessaData);
            const commessaResponse = await fetch(`${this.API_BASE}?resource=commesse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commessaData)
            });

            const commessaResult = await commessaResponse.json();
            console.log('Commessa creation result:', commessaResult);

            if (!commessaResult.success) {
                throw new Error(commessaResult.error || 'Errore nella creazione della commessa');
            }

            const commessaId = commessaResult.data.ID_COMMESSA;
            console.log('Created commessa with ID:', commessaId);

            // Step 2: Crea i task associati alla commessa
            const taskPromises = tasks.map(taskData => {
                taskData.ID_COMMESSA = commessaId;
                console.log('Creating task:', taskData);
                
                return fetch(`${this.API_BASE}?resource=task`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });
            });

            const taskResponses = await Promise.all(taskPromises);
            
            // Verifica che tutti i task siano stati creati con successo
            const taskResults = await Promise.all(
                taskResponses.map(response => response.json())
            );

            const failedTasks = taskResults.filter(result => !result.success);
            
            if (failedTasks.length > 0) {
                console.error('Some tasks failed to create:', failedTasks);
                throw new Error(`Errore nella creazione di ${failedTasks.length} task`);
            }

            console.log('All tasks created successfully');

            // Successo!
            this.showAlert(
                `Commessa "${commessaData.Commessa}" creata con successo con ${tasks.length} task`, 
                'success'
            );

            // Chiudi il modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('commessaModal'));
            modal.hide();

            // Ricarica i dati
            await this.loadInitialData();

        } catch (error) {
            console.error('Errore completo nel salvataggio:', error);
            this.showAlert(`Errore nel salvataggio: ${error.message}`, 'danger');
        } finally {
            // Riabilita il pulsante di salvataggio
            const saveBtn = document.querySelector('#commessaModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>Salva Commessa e Task';
            }
        }
    }

    // === GESTIONE MODIFICA COMMESSA ===
    
    async editCommessa(commessaId) {
        try {
            console.log('Editing commessa:', commessaId);
            
            // Carica i dati della commessa
            const response = await fetch(`${this.API_BASE}?resource=commesse&id=${commessaId}`);
            const data = await response.json();
            
            if (!data.success || !data.data) {
                throw new Error('Errore nel caricamento dei dati della commessa');
            }
            
            const commessa = data.data;
            console.log('Commessa data:', commessa);
            
            // Popola il form di modifica
            document.getElementById('editCommessaId').value = commessa.ID_COMMESSA;
            document.getElementById('editCommessaNome').value = commessa.Commessa || '';
            document.getElementById('editCommessaTipo').value = commessa.Tipo_Commessa || '';
            document.getElementById('editCommessaCliente').value = commessa.ID_CLIENTE || '';
            document.getElementById('editCommessaResponsabile').value = commessa.ID_COLLABORATORE || '';
            document.getElementById('editCommessaStato').value = commessa.Stato_Commessa || '';
            document.getElementById('editCommessaDataApertura').value = commessa.Data_Apertura_Commessa || '';
            document.getElementById('editCommessaCommissione').value = commessa.Commissione || '';
            document.getElementById('editCommessaDescrizione').value = commessa.Desc_Commessa || '';
            
            // Carica le liste per i select
            await this.loadSelectsForEditModal();
            
            // Gestisci la visibilità del campo cliente
            this.toggleEditClienteField();
            
            // Carica e mostra le statistiche
            this.loadCommessaStats(commessa);
            
            // Mostra il modal
            const modal = new bootstrap.Modal(document.getElementById('editCommessaModal'));
            modal.show();
            
        } catch (error) {
            console.error('Errore nella modifica commessa:', error);
            this.showAlert(`Errore nel caricamento della commessa: ${error.message}`, 'danger');
        }
    }

    async loadSelectsForEditModal() {
        try {
            // Carica clienti
            const clientiResponse = await fetch(`${this.API_BASE}?resource=clienti&limit=100`);
            const clientiData = await clientiResponse.json();
            
            if (clientiData.success) {
                const select = document.getElementById('editCommessaCliente');
                const currentValue = select.value;
                const firstOption = select.children[0].outerHTML;
                select.innerHTML = firstOption;
                
                const clienti = clientiData.data.data || [];
                clienti.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.ID_CLIENTE;
                    option.textContent = cliente.Cliente;
                    select.appendChild(option);
                });
                
                if (currentValue) select.value = currentValue;
            }
            
            // Carica collaboratori
            const responsabileSelect = document.getElementById('editCommessaResponsabile');
            const currentResponsabile = responsabileSelect.value;
            const firstOption = responsabileSelect.children[0].outerHTML;
            responsabileSelect.innerHTML = firstOption;
            
            this.collaboratoriList.forEach(collaboratore => {
                const option = document.createElement('option');
                option.value = collaboratore.ID_COLLABORATORE;
                option.textContent = collaboratore.Collaboratore;
                responsabileSelect.appendChild(option);
            });
            
            if (currentResponsabile) responsabileSelect.value = currentResponsabile;
            
        } catch (error) {
            console.error('Errore nel caricamento delle liste per il modal di modifica:', error);
        }
    }

    toggleEditClienteField() {
        const tipoCommessa = document.getElementById('editCommessaTipo').value;
        const clienteGroup = document.getElementById('editCommessaCliente').closest('.col-md-6');
        
        if (clienteGroup) {
            if (tipoCommessa === 'Interna') {
                clienteGroup.style.display = 'none';
                document.getElementById('editCommessaCliente').value = '';
            } else {
                clienteGroup.style.display = 'block';
            }
        }
    }

    loadCommessaStats(commessa) {
        // Mostra le statistiche se disponibili
        const stats = commessa.statistics || {};
        
        document.getElementById('editStatsTasks').textContent = stats.task_totali || '0';
        document.getElementById('editStatsGiornate').textContent = (stats.giornate_lavorate || 0).toFixed(1);
        document.getElementById('editStatsValore').textContent = `€${this.formatCurrency(stats.valore_maturato || 0)}`;
        document.getElementById('editStatsFatturato').textContent = `€${this.formatCurrency(stats.fatturato_totale || 0)}`;
    }

    async saveEditCommessa() {
        const form = document.getElementById('editCommessaForm');
        
        // Validazione base del form
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            this.showAlert('Compila tutti i campi richiesti', 'warning');
            return;
        }

        // Raccogli dati commessa
        const commessaId = document.getElementById('editCommessaId').value;
        const commessaData = {
            Commessa: document.getElementById('editCommessaNome').value.trim(),
            Desc_Commessa: document.getElementById('editCommessaDescrizione').value.trim(),
            Tipo_Commessa: document.getElementById('editCommessaTipo').value,
            ID_CLIENTE: document.getElementById('editCommessaCliente').value || null,
            ID_COLLABORATORE: document.getElementById('editCommessaResponsabile').value || null,
            Data_Apertura_Commessa: document.getElementById('editCommessaDataApertura').value || null,
            Stato_Commessa: document.getElementById('editCommessaStato').value || 'In corso',
            Commissione: parseFloat(document.getElementById('editCommessaCommissione').value) || 0
        };

        // Validazione tipo commessa/cliente
        if (commessaData.Tipo_Commessa === 'Cliente' && !commessaData.ID_CLIENTE) {
            this.showAlert('Per le commesse di tipo "Cliente" è obbligatorio selezionare un cliente', 'warning');
            return;
        }

        try {
            // Disabilita il pulsante di salvataggio
            const saveBtn = document.querySelector('#editCommessaModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass me-1"></i>Salvataggio...';
            }

            console.log('Updating commessa:', commessaId, commessaData);
            
            const response = await fetch(`${this.API_BASE}?resource=commesse&id=${commessaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commessaData)
            });

            const result = await response.json();
            console.log('Update result:', result);

            if (!result.success) {
                throw new Error(result.error || 'Errore nell\'aggiornamento della commessa');
            }

            // Successo!
            this.showAlert(`Commessa "${commessaData.Commessa}" aggiornata con successo`, 'success');

            // Chiudi il modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCommessaModal'));
            modal.hide();

            // Ricarica i dati
            await this.loadInitialData();

        } catch (error) {
            console.error('Errore nel salvataggio della commessa:', error);
            this.showAlert(`Errore nel salvataggio: ${error.message}`, 'danger');
        } finally {
            // Riabilita il pulsante di salvataggio
            const saveBtn = document.querySelector('#editCommessaModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>Salva Modifiche';
            }
        }
    }

    // Funzione per salvare un nuovo cliente
    async saveCliente() {
        const form = document.getElementById('clienteForm');
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const clienteData = {
            Cliente: document.getElementById('clienteNome').value,
            Email: document.getElementById('clienteEmail').value || null,
            Telefono: document.getElementById('clienteTelefono').value || null,
            Indirizzo: document.getElementById('clienteIndirizzo').value || null
        };

        try {
            const response = await fetch(`${this.API_BASE}?resource=clienti`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clienteData)
            });

            const result = await response.json();
            if (result.success) {
                this.showAlert('Cliente creato con successo!', 'success');
                // Chiudi il modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('clienteModal'));
                modal.hide();
                // Reset form
                form.reset();
                form.classList.remove('was-validated');
                // Ricarica la lista clienti
                await this.loadClienti();
            } else {
                this.showAlert('Errore nel salvataggio del cliente: ' + (result.message || 'Errore sconosciuto'), 'danger');
            }
        } catch (error) {
            console.error('Errore salvataggio cliente:', error);
            this.showAlert('Errore di connessione durante il salvataggio del cliente', 'danger');
        }
    }

    // Funzione per salvare un nuovo collaboratore
    async saveCollaboratore() {
        const form = document.getElementById('collaboratoreForm');
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        // Validazione password
        const password = document.getElementById('collaboratorePassword').value;
        const passwordConfirm = document.getElementById('collaboratorePasswordConfirm').value;
        
        // Controllo lunghezza minima password (come da API)
        if (password.length < 6) {
            this.showAlert('La password deve essere di almeno 6 caratteri!', 'warning');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showAlert('Le password non corrispondono!', 'warning');
            return;
        }

        const collaboratoreData = {
            Collaboratore: document.getElementById('collaboratoreNome').value,
            User: document.getElementById('collaboratoreUser').value,
            Email: document.getElementById('collaboratoreEmail').value,
            Ruolo: document.getElementById('collaboratoreRuolo').value,
            PWD: password,
            PIVA: document.getElementById('collaboratorePIVA').value || null
        };

        try {
            const response = await fetch(`${this.API_BASE}?resource=collaboratori`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(collaboratoreData)
            });

            const result = await response.json();
            if (result.success) {
                this.showAlert('Collaboratore creato con successo!', 'success');
                // Chiudi il modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('collaboratoreModal'));
                modal.hide();
                // Reset form
                form.reset();
                form.classList.remove('was-validated');
                // Ricarica la lista collaboratori
                await this.loadCollaboratori();
            } else {
                this.showAlert('Errore nel salvataggio del collaboratore: ' + (result.message || 'Errore sconosciuto'), 'danger');
            }
        } catch (error) {
            console.error('Errore salvataggio collaboratore:', error);
            this.showAlert('Errore di connessione durante il salvataggio del collaboratore', 'danger');
        }
    }

    // Funzione per caricare la lista clienti
    async loadClienti() {
        try {
            const response = await fetch(`${this.API_BASE}?resource=clienti&limit=100`);
            const data = await response.json();
            
            if (data.success) {
                this.clientiList = data.data.data || [];
                // Aggiorna eventuali dropdown clienti nei form
            }
        } catch (error) {
            console.error('Errore caricamento clienti:', error);
        }
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

function addGiornata() {
    if (taskManager) {
        taskManager.addGiornata();
    }
}

function addTaskToCommessa() {
    if (taskManager) {
        taskManager.addTaskToCommessa();
    }
}

function removeTaskFromCommessa(taskIndex) {
    if (taskManager) {
        taskManager.removeTaskFromCommessa(taskIndex);
    }
}

function saveCommessaWithTasks() {
    if (taskManager) {
        taskManager.saveCommessaWithTasks();
    }
}

function saveEditCommessa() {
    if (taskManager) {
        taskManager.saveEditCommessa();
    }
}