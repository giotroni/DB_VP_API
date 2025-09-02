/**
 * @file giornate-section.js
 * @description Classe per la gestione della sezione "Giornate".
 */
class GiornateSection extends BaseSection {
    constructor(appInstance) {
        super('Giornate', appInstance);
        this.giornateAggregate = [];
        this.mesiItaliani = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    }

    async loadData() {
        // I dati sono già caricati in this.app.giornate, dobbiamo solo raggrupparli
        this.giornateAggregate = this.groupGiornateByMonthAndCollaboratore();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Riepilogo Giornate', 'Visualizza, aggiungi e modifica le giornate lavorative');
        this.updateTopbarActions(`<button class="btn btn-vp-primary" data-action="add-giornata"><i class="fas fa-plus me-2"></i>Aggiungi Giornata</button>`);
        
        const container = this.getContainer();
        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <!-- Qui possono essere aggiunti filtri se necessario -->
                 <p class="text-muted mb-0">Riepilogo delle giornate registrate, raggruppate per mese e collaboratore.</p>
            </div>
            <div id="giornateContainer">
                ${this.renderGiornateAggregate(this.giornateAggregate)}
            </div>
        `;

        this.updateStats(this.app.giornate);
        this.bindEvents();
    }
    
    bindEvents() {
        // Aggiungi qui event listener specifici per la sezione se necessario
    }

    handleAction(action, id, type, targetElement, e) {
        switch (action) {
            case 'add-giornata':
                this.showGiornataModal();
                break;
            case 'edit-giornata':
                this.showGiornataModal(id);
                break;
            case 'toggle-mese':
                this.toggleMese(id);
                break;
            default:
                console.warn(`Azione non gestita: ${action}`);
        }
    }
    
    // ========================================================================
    // SEZIONE: RENDERING
    // ========================================================================

    renderGiornateAggregate(data) {
        if (!data || data.length === 0) {
            return this.ui.createEmptyState('fas fa-calendar-times', 'Nessuna Giornata Trovata', 'Non sono state ancora registrate giornate.');
        }
        return data.map(mese => this.createMeseCard(mese)).join('');
    }

    createMeseCard(mese) {
        const totaleGiornateMese = mese.collaboratori.reduce((sum, coll) => sum + coll.totaleGiornate, 0);

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-mese" data-id="${mese.yearMonth}">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="management-card-title mb-0"><i class="fas fa-calendar-alt me-2"></i>${mese.month}</h5>
                        <div>
                            <span class="badge bg-primary me-2">${totaleGiornateMese.toFixed(2)} giorni totali</span>
                            <button class="commessa-toggle-btn" id="toggleBtn-${mese.yearMonth}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                </div>
                <div class="collapse" id="mese-${mese.yearMonth}">
                    <div class="management-card-body p-0">
                        ${mese.collaboratori.map(c => this.createCollaboratoreGroup(c)).join('')}
                    </div>
                </div>
            </div>`;
    }

    createCollaboratoreGroup(collaboratore) {
        return `
            <div class="collaboratore-group border-bottom">
                <h6 class="bg-light p-3 mb-0 fw-bold"><i class="fas fa-user me-2"></i>${collaboratore.collaboratore_nome} <span class="badge bg-secondary float-end">${collaboratore.totaleGiornate.toFixed(2)} giorni</span></h6>
                <div class="table-responsive">
                    <table class="table table-hover table-sm mb-0">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Cliente</th>
                                <th>Commessa</th>
                                <th>Task</th>
                                <th class="text-center">GG</th>
                                <th>Tipo</th>
                                <th>Note</th>
                                <th class="text-end">Spese Tot.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${collaboratore.giornate.map(g => this.createGiornataRow(g)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    createGiornataRow(giornata) {
        const cliente = giornata.cliente_info?.Cliente || 'N/D';
        const commessa = giornata.commessa_info?.Commessa || 'N/D';
        const task = giornata.task_info?.Task || 'N/D';

        return `
            <tr data-action="edit-giornata" data-id="${giornata.ID_GIORNATA}" style="cursor: pointer;">
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${cliente}</td>
                <td>${commessa}</td>
                <td>${task}</td>
                <td class="text-center"><span class="badge bg-success">${giornata.gg}</span></td>
                <td>${giornata.Tipo} ${giornata.Desk === 'Si' ? '(Desk)' : ''}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${giornata.Note || ''}">${giornata.Note || '-'}</td>
                <td class="text-end text-danger fw-bold">${this.app.utils.formatCurrency(giornata.spese_totali)}</td>
            </tr>
        `;
    }

    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE
    // ========================================================================
    
    toggleMese(meseId) {
        const collapseElement = document.getElementById(`mese-${meseId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${meseId}`);
        if (!collapseElement || !toggleBtn) return;
        
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        bsCollapse.toggle();

        const onShown = () => this.updateToggleButton(toggleBtn, true);
        const onHidden = () => this.updateToggleButton(toggleBtn, false);

        collapseElement.addEventListener('shown.bs.collapse', onShown, { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', onHidden, { once: true });

        this.updateToggleButton(toggleBtn, collapseElement.classList.contains('show'));
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
    // SEZIONE: MODALI E FORM
    // ========================================================================

    showGiornataModal(giornataId = null) {
        const giornata = giornataId ? this.app.giornate.find(g => g.ID_GIORNATA === giornataId) : null;
        const modalTitle = giornataId ? 'Modifica Giornata' : 'Aggiungi Nuova Giornata';
        const modalId = `giornataModal_${giornataId || 'new'}`;
        const modalBody = this.getGiornataFormHTML(giornata);
        
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">${giornataId ? 'Salva Modifiche' : 'Crea Giornata'}</button>` }
        ];

        if(giornataId) {
            const deleteButton = {
                html: `<button type="button" class="btn btn-danger me-auto">Elimina</button>`,
                selector: `.btn-danger`,
                handler: () => this.handleDeleteGiornata(giornataId)
            };
            modalActions.unshift(deleteButton);
        }

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addGiornataFormListeners(`${modalId}_form`);
    }

    getGiornataFormHTML(giornata = {}) {
        const formId = `giornataModal_${giornata.ID_GIORNATA || 'new'}_form`;
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}" ${giornata.ID_COLLABORATORE === c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        
        const taskOptions = this.app.tasks
            .filter(t => t.Stato_Task === 'In corso')
            .map(t => {
                const commessa = this.app.commesse.find(c => c.ID_COMMESSA === t.ID_COMMESSA);
                return `<option value="${t.ID_TASK}" ${giornata.ID_TASK === t.ID_TASK ? 'selected' : ''}>${commessa?.Commessa || 'N/D'} - ${t.Task}</option>`
            }).join('');

        const oggi = new Date().toISOString().split('T')[0];
        const dataValue = giornata.Data ? giornata.Data.split('T')[0] : oggi;

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="Data" class="form-label">Data</label>
                        <input type="date" class="form-control" id="Data" name="Data" value="${dataValue}" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="gg" class="form-label">Frazione Giornata (es. 0.5, 1)</label>
                        <input type="number" class="form-control" id="gg" name="gg" min="0" max="1" step="0.5" value="${giornata.gg || '1'}" required>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="ID_COLLABORATORE" class="form-label">Collaboratore</label>
                        <select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE" required>
                            <option value="">Seleziona...</option>
                            ${collaboratoriOptions}
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="ID_TASK" class="form-label">Task</label>
                        <select class="form-select" id="ID_TASK" name="ID_TASK" required>
                            <option value="">Seleziona...</option>
                            ${taskOptions}
                        </select>
                    </div>
                </div>
                 <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="Tipo" class="form-label">Tipo Attività</label>
                        <select class="form-select" id="Tipo" name="Tipo">
                            <option value="Campo" ${giornata.Tipo === 'Campo' ? 'selected' : ''}>Campo</option>
                            <option value="Promo" ${giornata.Tipo === 'Promo' ? 'selected' : ''}>Promo</option>
                            <option value="Sviluppo" ${giornata.Tipo === 'Sviluppo' ? 'selected' : ''}>Sviluppo</option>
                            <option value="Formazione" ${giornata.Tipo === 'Formazione' ? 'selected' : ''}>Formazione</option>
                        </select>
                    </div>
                     <div class="col-md-6 mb-3">
                        <label for="Desk" class="form-label">Da Scrivania (Desk)</label>
                        <select class="form-select" id="Desk" name="Desk">
                            <option value="No" ${giornata.Desk === 'No' ? 'selected' : ''}>No</option>
                            <option value="Si" ${giornata.Desk === 'Si' ? 'selected' : ''}>Sì</option>
                        </select>
                    </div>
                </div>
                <hr>
                <h5>Spese e Costi (Opzionale)</h5>
                 <div class="row">
                    <div class="col-md-4 mb-3">
                        <label for="Spese_Viaggi" class="form-label">Spese Viaggio (€)</label>
                        <input type="number" class="form-control" id="Spese_Viaggi" name="Spese_Viaggi" min="0" step="0.01" value="${giornata.Spese_Viaggi || ''}">
                    </div>
                     <div class="col-md-4 mb-3">
                        <label for="Vitto_alloggio" class="form-label">Vitto e Alloggio (€)</label>
                        <input type="number" class="form-control" id="Vitto_alloggio" name="Vitto_alloggio" min="0" step="0.01" value="${giornata.Vitto_alloggio || ''}">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="Altri_costi" class="form-label">Altri Costi (€)</label>
                        <input type="number" class="form-control" id="Altri_costi" name="Altri_costi" min="0" step="0.01" value="${giornata.Altri_costi || ''}">
                    </div>
                </div>
                <div class="mb-3">
                    <label for="Note" class="form-label">Note</label>
                    <textarea class="form-control" id="Note" name="Note" rows="3">${giornata.Note || ''}</textarea>
                </div>
            </form>
        `;
    }
    
    addGiornataFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const giornataId = form.id.includes('giornataModal_') && !form.id.includes('new') 
            ? form.id.split('_')[1] 
            : null;

        form.addEventListener('submit', (e) => this.handleGiornataFormSubmit(e, giornataId));
    }

    async handleGiornataFormSubmit(event, giornataId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Converte i campi numerici vuoti in null per il backend
        ['Spese_Viaggi', 'Vitto_alloggio', 'Altri_costi'].forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const result = giornataId
                ? await this.api.updateGiornata(giornataId, data)
                : await this.api.createGiornata(data);
            
            if (result.success) {
                this.ui.showToast(`Giornata ${giornataId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData(); // Ricarica tutto per aggiornare le viste
            } else {
                throw new Error(result.message || 'Errore nel salvataggio della giornata.');
            }
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        }
    }

    async handleDeleteGiornata(giornataId) {
        if (confirm(`Sei sicuro di voler eliminare questa giornata? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteGiornata(giornataId);
                if (result.success) {
                    this.ui.showToast('Giornata eliminata con successo!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById(`giornataModal_${giornataId}`))?.hide();
                    await this.app.loadInitialData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                this.ui.showToast(error.message, 'error');
            }
        }
    }


    // ========================================================================
    // SEZIONE: UTILITÀ E STATISTICHE
    // ========================================================================

    updateStats(giornate) {
        const totalGiornate = giornate.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
        const totalSpese = giornate.reduce((sum, g) => sum + (parseFloat(g.spese_totali) || 0), 0);
        const collaboratoriUnici = [...new Set(giornate.map(g => g.ID_COLLABORATORE))].length;

        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate.toFixed(2), 'Giornate Totali')}
                    ${this.ui.createStatsCard('fas fa-receipt', this.app.utils.formatCurrency(totalSpese), 'Spese Totali')}
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriUnici, 'Collaboratori Attivi')}
                </div>
            `;
        }
    }

    groupGiornateByMonthAndCollaboratore() {
        const grouped = {};

        // Ordina le giornate dalla più recente alla meno recente
        const giornateOrdinate = [...this.app.giornate].sort((a, b) => new Date(b.Data) - new Date(a.Data));

        giornateOrdinate.forEach(g => {
            const data = new Date(g.Data);
            const year = data.getFullYear();
            const month = data.getMonth();
            const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
            const monthName = `${this.mesiItaliani[month]} ${year}`;

            if (!grouped[yearMonth]) {
                grouped[yearMonth] = {
                    month: monthName,
                    yearMonth: yearMonth,
                    collaboratori: {}
                };
            }

            const collabId = g.ID_COLLABORATORE;
            if (!grouped[yearMonth].collaboratori[collabId]) {
                const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === collabId);
                grouped[yearMonth].collaboratori[collabId] = {
                    collaboratore_id: collabId,
                    collaboratore_nome: collaboratore ? collaboratore.Collaboratore : 'Sconosciuto',
                    giornate: [],
                    totaleGiornate: 0
                };
            }
            
            grouped[yearMonth].collaboratori[collabId].giornate.push(g);
            grouped[yearMonth].collaboratori[collabId].totaleGiornate += parseFloat(g.gg) || 0;
        });

        // Converte l'oggetto in un array e ordina i collaboratori
        return Object.values(grouped).map(mese => {
            mese.collaboratori = Object.values(mese.collaboratori)
                .sort((a, b) => a.collaboratore_nome.localeCompare(b.collaboratore_nome));
            return mese;
        });
    }
}
