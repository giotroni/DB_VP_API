/**
 * @file giornate-section.js
 * @description Classe per la gestione della sezione "Giornate".
 */
class GiornateSection extends BaseSection {
    constructor(appInstance) {
        super('Giornate', appInstance);
        this.giornateAggregate = [];
        this.filteredGiornateAggregate = []; // NUOVO: Array per i dati filtrati
        this.mesiItaliani = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    }

    async loadData() {
        // I dati sono già caricati in this.app.giornate, dobbiamo solo raggrupparli
        this.giornateAggregate = this.groupGiornateByMonthAndCollaboratore();
        // Inizialmente, i dati filtrati sono tutti i dati
        this.filteredGiornateAggregate = this.giornateAggregate;
        this.isLoaded = true;
    }

    /**
     * MODIFICATO: Aggiunge l'HTML per la barra dei filtri.
     */
    render() {
        this.updatePageTitle('Riepilogo Giornate', 'Visualizza, aggiungi e modifica le giornate lavorative');
        this.updateTopbarActions(`<button class="btn btn-vp-primary" data-action="add-giornata"><i class="fas fa-plus me-2"></i>Aggiungi Giornata</button>`);
        
        const container = this.getContainer();
        
        // Prepara le opzioni per i menu a tendina dei filtri
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`).join('');
        const commesseOptions = this.app.commesse.map(c => `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`).join('');

        container.innerHTML = `
            <div id="stats-row-container"></div>
            <!-- NUOVO: Blocco filtri -->
            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-4 col-md-6">
                        <label for="filterCollaboratore" class="form-label">Filtra per Collaboratore</label>
                        <select class="form-select" id="filterCollaboratore">
                            <option value="">Tutti i collaboratori</option>
                            ${collaboratoriOptions}
                        </select>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <label for="filterCommessa" class="form-label">Filtra per Commessa</label>
                        <select class="form-select" id="filterCommessa">
                            <option value="">Tutte le commesse</option>
                            ${commesseOptions}
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-12">
                         <p class="text-muted small mb-0 mt-3">I filtri vengono applicati automaticamente.</p>
                    </div>
                </div>
            </div>
            <div id="giornateContainer">
                ${this.renderGiornateAggregate(this.filteredGiornateAggregate)}
            </div>
        `;

        this.updateStats(this.app.giornate);
        this.bindEvents();
    }
    
    /**
     * MODIFICATO: Aggiunge gli event listener per i nuovi filtri.
     * La logica di filtraggio si attiva al cambio di selezione.
     */
    bindEvents() {
        document.getElementById('filterCollaboratore')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterCommessa')?.addEventListener('change', () => this.filterData());
    }

    handleAction(action, id, type, targetElement, e) {
        if (action === 'toggle-conferma-mese') {
            e.stopPropagation();
        }
        
        switch (action) {
            case 'add-giornata': this.showGiornataModal(); break;
            case 'edit-giornata': this.showGiornataModal(id); break;
            case 'toggle-mese': this.toggleMese(id); break;
            case 'toggle-conferma-mese': this.handleToggleConfermaMese(id); break;
            default: console.warn(`Azione non gestita: ${action}`);
        }
    }
    
    // ========================================================================
    // SEZIONE: NUOVA LOGICA DI FILTRAGGIO
    // ========================================================================
    
    /**
     * NUOVA FUNZIONE: Filtra i dati delle giornate in base ai valori
     * selezionati nei menù a tendina e aggiorna la vista.
     */
    filterData() {
        const selectedCollaboratore = document.getElementById('filterCollaboratore').value;
        const selectedCommessa = document.getElementById('filterCommessa').value;

        // Parti da una copia profonda dei dati originali non filtrati
        let data = JSON.parse(JSON.stringify(this.giornateAggregate));

        // Applica i filtri se almeno uno è stato selezionato
        if (selectedCollaboratore || selectedCommessa) {
            data = data.map(mese => {
                // 1. Filtra i collaboratori (se il filtro è attivo)
                if (selectedCollaboratore) {
                    mese.collaboratori = mese.collaboratori.filter(c => c.collaboratore_id === selectedCollaboratore);
                }

                // 2. Filtra le giornate per commessa all'interno di ogni collaboratore rimasto
                if (selectedCommessa) {
                    mese.collaboratori.forEach(collaboratore => {
                        // CORREZIONE: Il riferimento corretto all'ID commessa è dentro 'task_info'
                        collaboratore.giornate = collaboratore.giornate.filter(g => g.task_info?.ID_COMMESSA === selectedCommessa);
                    });
                }
                
                // 3. Pulisci: rimuovi i collaboratori che non hanno più giornate dopo il filtro per commessa
                mese.collaboratori = mese.collaboratori.filter(c => c.giornate.length > 0);

                return mese;
            }).filter(mese => mese.collaboratori.length > 0); // 4. Pulisci: rimuovi i mesi che non hanno più collaboratori
        }

        this.filteredGiornateAggregate = data;
        
        // Aggiorna la vista con i dati filtrati
        const container = document.getElementById('giornateContainer');
        container.innerHTML = this.renderGiornateAggregate(this.filteredGiornateAggregate);
        
        // Aggiorna le statistiche con le sole giornate filtrate
        const giornateFiltrate = this.filteredGiornateAggregate.flatMap(m => m.collaboratori.flatMap(c => c.giornate));
        this.updateStats(giornateFiltrate);
    }

    // ========================================================================
    // SEZIONE: RENDERING (invariata ma ora usa i dati filtrati)
    // ========================================================================

    renderGiornateAggregate(data) {
        if (!data || data.length === 0) {
            return this.ui.createEmptyState('fas fa-calendar-times', 'Nessuna Giornata Trovata', 'Nessuna giornata corrisponde ai filtri selezionati.');
        }
        return data.map(mese => this.createMeseCard(mese)).join('');
    }

    createMeseCard(mese) {
        const totaleGiornateCampoMese = mese.collaboratori.reduce((sum, coll) => sum + coll.totaleGiornateCampo, 0);
        const totaleValoreCalcolatoMese = mese.collaboratori.reduce((sum, coll) => sum + coll.totaleValoreCalcolato, 0);

        const hasUnconfirmed = mese.collaboratori.some(coll => coll.giornate.some(g => g.Confermata !== 'Si'));
        const toggleConfirmTitle = hasUnconfirmed ? 'Conferma tutte le giornate del mese' : 'Rimuovi conferma da tutte le giornate';
        const toggleConfirmIcon = hasUnconfirmed ? 'fa-check-circle' : 'fa-times-circle';

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-mese" data-id="${mese.yearMonth}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0"><i class="fas fa-calendar-alt me-2"></i>${mese.month}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-success">${this.app.utils.formatCurrency(totaleValoreCalcolatoMese)}</span>
                            <span class="badge bg-primary">${totaleGiornateCampoMese.toFixed(2)} giorni di campo</span>
                            <button class="btn btn-sm btn-outline-light" data-action="toggle-conferma-mese" data-id="${mese.yearMonth}" title="${toggleConfirmTitle}">
                                <i class="fas ${toggleConfirmIcon}"></i>
                            </button>
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
                <h6 class="bg-light p-3 mb-0 fw-bold d-flex justify-content-between align-items-center">
                    <span><i class="fas fa-user me-2"></i>${collaboratore.collaboratore_nome}</span>
                    <div>
                        <span class="badge bg-success me-2">${this.app.utils.formatCurrency(collaboratore.totaleValoreCalcolato)}</span>
                        <span class="badge bg-secondary">${collaboratore.totaleGiornateCampo.toFixed(2)} giorni di campo</span>
                    </div>
                </h6>
                <div class="table-responsive">
                    <table class="table table-hover table-sm mb-0">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Commessa</th>
                                <th>Task</th>
                                <th class="text-center">GG</th>
                                <th>Tipo</th>
                                <th class="text-center">Desk</th>
                                <th>Note</th>
                                <th class="text-center">Confermata</th>
                                <th class="text-end">Valore Calc.</th>
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
        const commessa = giornata.commessa_info?.Commessa || 'N/D';
        const task = giornata.task_info?.Task || 'N/D';
        const confermataIcon = giornata.Confermata === 'Si'
            ? '<i class="fas fa-check-circle text-success" title="Confermata"></i>'
            : '<i class="fas fa-times-circle text-muted" title="Non Confermata"></i>';

        const tipoHtml = giornata.Tipo === 'Campo'
            ? `<span class="text-success fw-bold">${giornata.Tipo}</span>`
            : giornata.Tipo;

        const deskIcon = giornata.Desk === 'Si'
            ? '<i class="fas fa-desktop text-primary" title="Sì"></i>'
            : '';

        return `
            <tr data-action="edit-giornata" data-id="${giornata.ID_GIORNATA}" style="cursor: pointer;">
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${commessa}</td>
                <td>${task}</td>
                <td class="text-center"><span class="badge bg-primary">${giornata.gg}</span></td>
                <td>${tipoHtml}</td>
                <td class="text-center">${deskIcon}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${giornata.Note || ''}">${giornata.Note || '-'}</td>
                <td class="text-center">${confermataIcon}</td>
                <td class="text-end fw-bold">${this.app.utils.formatCurrency(giornata.valore_calcolato)}</td>
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
        this.addGiornataFormListeners(modalId);
    }

    getGiornataFormHTML(giornataParam = {}) {
        const giornata = giornataParam || {};

        const formId = `giornataModal_${giornata.ID_GIORNATA || 'new'}_form`;
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}" ${giornata.ID_COLLABORATORE === c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        
        const currentCommessaId = giornata.task_info?.ID_COMMESSA;
        const isEditMode = !!currentCommessaId;

        const commesseOptions = this.app.commesse
            .filter(c => c.Stato_Commessa === 'In corso')
            .map(c => `<option value="${c.ID_COMMESSA}" ${currentCommessaId === c.ID_COMMESSA ? 'selected' : ''}>${c.Commessa}</option>`)
            .join('');

        const taskOptions = isEditMode ? this.app.tasks
            .filter(t => t.ID_COMMESSA === currentCommessaId && t.Stato_Task === 'In corso')
            .map(t => `<option value="${t.ID_TASK}" ${giornata.ID_TASK === t.ID_TASK ? 'selected' : ''}>${t.Task}</option>`)
            .join('') : '';

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
                    <div class="col-md-12 mb-3">
                        <label for="ID_COLLABORATORE" class="form-label">Collaboratore</label>
                        <select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE" required>
                            <option value="">Seleziona...</option>
                            ${collaboratoriOptions}
                        </select>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="ID_COMMESSA_FORM" class="form-label">Commessa</label>
                        <select class="form-select" id="ID_COMMESSA_FORM" name="ID_COMMESSA_FORM" required>
                            <option value="">Seleziona una commessa...</option>
                            ${commesseOptions}
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="ID_TASK" class="form-label">Task</label>
                        <select class="form-select" id="ID_TASK" name="ID_TASK" required ${!isEditMode ? 'disabled' : ''}>
                            <option value="">${isEditMode ? 'Seleziona un task...' : 'Seleziona prima una commessa...'}</option>
                            ${taskOptions}
                        </select>
                    </div>
                </div>
                 <div class="row">
                    <div class="col-md-4 mb-3">
                        <label for="Tipo" class="form-label">Tipo Attività</label>
                        <select class="form-select" id="Tipo" name="Tipo">
                            <option value="Campo" ${giornata.Tipo === 'Campo' ? 'selected' : ''}>Campo</option>
                            <option value="Promo" ${giornata.Tipo === 'Promo' ? 'selected' : ''}>Promo</option>
                            <option value="Sviluppo" ${giornata.Tipo === 'Sviluppo' ? 'selected' : ''}>Sviluppo</option>
                            <option value="Formazione" ${giornata.Tipo === 'Formazione' ? 'selected' : ''}>Formazione</option>
                        </select>
                    </div>
                     <div class="col-md-4 mb-3">
                        <label for="Desk" class="form-label">Da Scrivania (Desk)</label>
                        <select class="form-select" id="Desk" name="Desk">
                            <option value="No" ${giornata.Desk === 'No' || !giornata.Desk ? 'selected' : ''}>No</option>
                            <option value="Si" ${giornata.Desk === 'Si' ? 'selected' : ''}>Sì</option>
                        </select>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="Confermata" class="form-label">Confermata</label>
                        <select class="form-select" id="Confermata" name="Confermata">
                            <option value="No" ${giornata.Confermata === 'No' || !giornata.Confermata ? 'selected' : ''}>No</option>
                            <option value="Si" ${giornata.Confermata === 'Si' ? 'selected' : ''}>Sì</option>
                        </select>
                    </div>
                </div>
                <hr>
                <h5>Spese e Costi (Opzionale)</h5>
                 <div class="row">
                    <div class="col-md-3 mb-3">
                        <label for="Spese_Viaggi" class="form-label">Spese Viaggio (€)</label>
                        <input type="number" class="form-control" id="Spese_Viaggi" name="Spese_Viaggi" min="0" step="0.01" value="${giornata.Spese_Viaggi || ''}">
                    </div>
                     <div class="col-md-3 mb-3">
                        <label for="Vitto_alloggio" class="form-label">Vitto e Alloggio (€)</label>
                        <input type="number" class="form-control" id="Vitto_alloggio" name="Vitto_alloggio" min="0" step="0.01" value="${giornata.Vitto_alloggio || ''}">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="Altri_costi" class="form-label">Altri Costi (€)</label>
                        <input type="number" class="form-control" id="Altri_costi" name="Altri_costi" min="0" step="0.01" value="${giornata.Altri_costi || ''}">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="Spese_Fatturate_VP" class="form-label">Spese Fatturate V&P (€)</label>
                        <input type="number" class="form-control" id="Spese_Fatturate_VP" name="Spese_Fatturate_VP" min="0" step="0.01" value="${giornata.Spese_Fatturate_VP || ''}">
                    </div>
                </div>
                <div class="mb-3">
                    <label for="Note" class="form-label">Note</label>
                    <textarea class="form-control" id="Note" name="Note" rows="3">${giornata.Note || ''}</textarea>
                </div>
            </form>
        `;
    }
    
    addGiornataFormListeners(modalId) {
        const formId = `giornataModal_${modalId.split('_').pop()}_form`;
        const form = document.getElementById(formId);
        if (!form) return;

        const commessaSelect = form.querySelector('#ID_COMMESSA_FORM');
        const taskSelect = form.querySelector('#ID_TASK');

        commessaSelect.addEventListener('change', (e) => {
            const selectedCommessaId = e.target.value;
            
            taskSelect.innerHTML = '<option value="">Seleziona prima una commessa...</option>';
            taskSelect.disabled = true;

            if (selectedCommessaId) {
                const filteredTasks = this.app.tasks.filter(
                    t => t.ID_COMMESSA === selectedCommessaId && t.Stato_Task === 'In corso'
                );

                if (filteredTasks.length > 0) {
                    taskSelect.innerHTML = '<option value="">Seleziona un task...</option>';
                    filteredTasks.forEach(task => {
                        const option = document.createElement('option');
                        option.value = task.ID_TASK;
                        option.textContent = task.Task;
                        taskSelect.appendChild(option);
                    });
                    taskSelect.disabled = false;
                } else {
                    taskSelect.innerHTML = '<option value="">Nessun task attivo per questa commessa</option>';
                }
            }
        });

        const giornataId = formId.includes('new') ? null : modalId.split('_').pop();
        form.addEventListener('submit', (e) => this.handleGiornataFormSubmit(e, giornataId));
    }

    async handleGiornataFormSubmit(event, giornataId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        delete data.ID_COMMESSA_FORM;

        ['Spese_Viaggi', 'Vitto_alloggio', 'Altri_costi', 'Spese_Fatturate_VP'].forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const result = giornataId
                ? await this.api.updateGiornata(giornataId, data)
                : await this.api.createGiornata(data);
            
            if (result.success) {
                this.ui.showToast(`Giornata ${giornataId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
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

    async handleToggleConfermaMese(yearMonth) {
        const giornateDelMese = this.app.giornate.filter(g => {
            const dataGiornata = g.Data.substring(0, 7);
            return dataGiornata === yearMonth;
        });

        if (giornateDelMese.length === 0) {
            this.ui.showToast('Nessuna giornata da aggiornare per questo mese.', 'info');
            return;
        }

        const targetState = giornateDelMese.some(g => g.Confermata !== 'Si') ? 'Si' : 'No';
        const actionText = targetState === 'Si' ? 'confermare' : 'rimuovere la conferma da';

        if (confirm(`Sei sicuro di voler ${actionText} ${giornateDelMese.length} giornate per questo mese?`)) {
            this.ui.showToast('Aggiornamento in corso...', 'info');

            const updatePromises = giornateDelMese.map(giornata => 
                this.api.updateGiornata(giornata.ID_GIORNATA, { Confermata: targetState })
            );

            try {
                const results = await Promise.all(updatePromises);
                
                const successCount = results.filter(r => r.success).length;
                const errorCount = results.length - successCount;

                if (errorCount > 0) {
                    this.ui.showToast(`${successCount} giornate aggiornate, ${errorCount} fallite.`, 'warning');
                } else {
                    this.ui.showToast(`${successCount} giornate aggiornate con successo!`, 'success');
                }

                await this.app.loadInitialData();

            } catch (error) {
                this.ui.showToast(`Si è verificato un errore durante l'aggiornamento: ${error.message}`, 'error');
            }
        }
    }

    // ========================================================================
    // SEZIONE: UTILITÀ E STATISTICHE
    // ========================================================================

    /**
     * MODIFICATO: Accetta un array di giornate per calcolare le statistiche
     * in modo dinamico in base ai filtri.
     */
    updateStats(giornate) {
        const totalGiornate = giornate.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
        const totalSpese = giornate.reduce((sum, g) => sum + (parseFloat(g.spese_totali) || 0), 0);
        const collaboratoriUnici = [...new Set(giornate.map(g => g.ID_COLLABORATORE))].length;
        
        const giornateCampo = giornate.filter(g => g.Tipo === 'Campo');
        const totalGiornateCampo = giornateCampo.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
        const totalValoreCalcolato = giornate.reduce((sum, g) => sum + (parseFloat(g.valore_calcolato) || 0), 0);

        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate.toFixed(2), 'Giornate Totali')}
                    ${this.ui.createStatsCard('fas fa-tractor', totalGiornateCampo.toFixed(2), 'Giornate di Campo')}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totalValoreCalcolato), 'Valore Calcolato')}
                    ${this.ui.createStatsCard('fas fa-receipt', this.app.utils.formatCurrency(totalSpese), 'Spese Totali')}
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriUnici, 'Collaboratori Attivi')}
                </div>
            `;
        }
    }

    groupGiornateByMonthAndCollaboratore() {
        const grouped = {};

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
                    totaleGiornate: 0,
                    totaleGiornateCampo: 0,
                    totaleValoreCalcolato: 0
                };
            }
            
            grouped[yearMonth].collaboratori[collabId].giornate.push(g);
            grouped[yearMonth].collaboratori[collabId].totaleGiornate += parseFloat(g.gg) || 0;
            if (g.Tipo === 'Campo') {
                grouped[yearMonth].collaboratori[collabId].totaleGiornateCampo += parseFloat(g.gg) || 0;
            }
            grouped[yearMonth].collaboratori[collabId].totaleValoreCalcolato += parseFloat(g.valore_calcolato) || 0;
        });

        return Object.values(grouped).map(mese => {
            mese.collaboratori = Object.values(mese.collaboratori)
                .sort((a, b) => a.collaboratore_nome.localeCompare(b.collaboratore_nome));
            return mese;
        });
    }
}

