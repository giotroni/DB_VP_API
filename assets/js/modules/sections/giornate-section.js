/**
 * @file giornate-section.js
 * @description Classe per la gestione della sezione "Giornate".
 */
class GiornateSection extends BaseSection {
    constructor(appInstance) {
        super('Giornate', appInstance);
        this.giornateCompletate = []; // Conterrà i dati originali arricchiti
        this.filteredGiornate = [];   // Conterrà i dati filtrati correnti
    }

    async loadData() {
        const sortedGiornate = this.app.giornate.sort((a, b) => new Date(b.Data) - new Date(a.Data));
        this.giornateCompletate = sortedGiornate.map(giornata => {
            const task = this.app.tasks.find(t => t.ID_TASK === giornata.ID_TASK);
            const commessa = task ? this.app.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA) : null;
            const cliente = commessa ? this.app.clienti.find(cl => cl.ID_CLIENTE === commessa.ID_CLIENTE) : null;
            const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === giornata.ID_COLLABORATORE);
            return {
                ...giornata,
                ID_COMMESSA: commessa?.ID_COMMESSA || null,
                taskNome: task?.Task || 'N/D',
                commessaNome: commessa?.Commessa || 'N/D',
                clienteNome: cliente?.Cliente || 'N/D',
                collaboratoreNome: collaboratore?.Collaboratore || 'N/D'
            };
        });
        this.filteredGiornate = this.giornateCompletate;
    }

    render() {
        this.updatePageTitle('Gestione Giornate', 'Visualizza, aggiungi e modifica le giornate di lavoro');
        this.updateTopbarActions(`<button class="btn btn-vp-primary" data-action="add-giornata"><i class="fas fa-plus me-2"></i>Aggiungi Giornata</button>`);
        const container = this.getContainer();
        const collaboratoriOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`).join('');
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2023; y <= currentYear + 1; y++) { yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}">${y}</label></li>`; }
        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        let monthOptions = months.map((month, index) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${index + 1}">${month}</label></li>`).join('');
        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3">
                    <div class="col-lg-3 col-md-6"><label class="form-label">Cerca</label><input type="text" class="form-control" id="searchGiornate" placeholder="Task, commessa, cliente..."></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Collaboratore</label><select class="form-select" id="filterCollaboratore"><option value="">Tutti</option>${collaboratoriOptions}</select></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Stato</label><select class="form-select" id="filterConfermata"><option value="">Tutti</option><option value="Si">Confermate</option><option value="No">Da Confermare</option></select></div>
                    <div class="col-lg-1 col-md-3"><label class="form-label">Anno</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterAnno" aria-labelledby="filterAnnoBtn">${yearOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-3"><label class="form-label">Mese</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMese" aria-labelledby="filterMeseBtn">${monthOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">&nbsp;</label><div class="d-flex gap-2"><button class="btn btn-outline-secondary" data-action="reset-filters" title="Resetta Filtri"><i class="fas fa-undo"></i></button><button class="btn btn-outline-primary" data-action="toggle-all-months" id="toggleAllMonthsBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button></div></div>
                </div>
            </div>
            <div id="giornateContainer"></div>
        `;
        this.renderContent();
    }

    renderContent() {
        this.updateStats(this.filteredGiornate);
        const container = document.getElementById('giornateContainer');
        if (this.filteredGiornate.length === 0) {
            container.innerHTML = this.ui.createEmptyState('fas fa-calendar-times', 'Nessuna Giornata Trovata', 'Nessuna giornata corrisponde ai filtri impostati.', { class: 'btn btn-outline-primary', text: 'Resetta Filtri', 'data-action': 'reset-filters' });
            return;
        }
        const groupedData = this.groupGiornate(this.filteredGiornate);
        container.innerHTML = this.renderGroupedList(groupedData);
    }

    bindEvents() {
        super.bindEvents();
        document.getElementById('searchGiornate')?.addEventListener('input', this.utils.debounce(() => this.filterData(), 300));
        document.getElementById('filterCollaboratore')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterConfermata')?.addEventListener('change', () => this.filterData());
        const setupMultiSelect = (filterId, buttonId) => {
             const container = document.getElementById(filterId);
             const button = document.getElementById(buttonId);
             if (container && button) {
                 container.addEventListener('change', () => {
                    const checked = container.querySelectorAll('input:checked');
                    button.textContent = checked.length === 0 ? 'Tutti' : `${checked.length} selezionati`;
                    this.filterData();
                });
             }
        };
        setupMultiSelect('filterAnno', 'filterAnnoBtn');
        setupMultiSelect('filterMese', 'filterMeseBtn');
    }

    handleAction(action, id, type, target, event) {
        if (event && ['confirm-month', 'unconfirm-month'].includes(action)) event.stopPropagation();
        switch(action) {
            case 'add-giornata': this.showGiornataModal(); break;
            case 'edit-giornata': this.showGiornataModal(id); break;
            case 'reset-filters': this.resetFilters(); break;
            case 'toggle-month': this.toggleMonth(id); break;
            case 'toggle-all-months': this.toggleAllMonths(); break;
            case 'confirm-month': this.updateMonthConfirmation(id, 'Si'); break;
            case 'unconfirm-month': this.updateMonthConfirmation(id, 'No'); break;
            default: super.handleAction(action, id, type, target, event);
        }
    }
    
    filterData() {
        const searchText = document.getElementById('searchGiornate')?.value.toLowerCase() || '';
        const selectedCollab = document.getElementById('filterCollaboratore')?.value || '';
        const selectedStatus = document.getElementById('filterConfermata')?.value || '';
        const selectedYears = Array.from(document.querySelectorAll('#filterAnno input:checked')).map(cb => cb.value);
        const selectedMonths = Array.from(document.querySelectorAll('#filterMese input:checked')).map(cb => cb.value);
        this.filteredGiornate = this.giornateCompletate.filter(g => {
            const dataGiornata = new Date(g.Data);
            const matchSearch = !searchText || g.taskNome.toLowerCase().includes(searchText) || g.commessaNome.toLowerCase().includes(searchText) || g.clienteNome.toLowerCase().includes(searchText);
            const matchCollab = !selectedCollab || g.ID_COLLABORATORE == selectedCollab;
            const matchStatus = !selectedStatus || (g.Confermata === 'Si' ? 'Si' : 'No') === selectedStatus;
            const matchYear = selectedYears.length === 0 || selectedYears.includes(String(dataGiornata.getFullYear()));
            const matchMonth = selectedMonths.length === 0 || selectedMonths.includes(String(dataGiornata.getMonth() + 1));
            return matchSearch && matchCollab && matchStatus && matchYear && matchMonth;
        });
        this.renderContent();
    }
    
    resetFilters() {
        document.getElementById('searchGiornate').value = '';
        document.getElementById('filterCollaboratore').value = '';
        document.getElementById('filterConfermata').value = '';
        document.querySelectorAll('#filterAnno input:checked, #filterMese input:checked').forEach(cb => cb.checked = false);
        document.getElementById('filterAnnoBtn').textContent = 'Tutti';
        document.getElementById('filterMeseBtn').textContent = 'Tutti';
        this.filterData();
    }
    
    updateStats(giornate) {
        const container = document.getElementById('stats-row-container');
        if (!container) return;
        const totaleGiornate = giornate.reduce((sum, g) => sum + parseFloat(g.gg || 0), 0);
        const valoreLavori = giornate.reduce((sum, g) => sum + parseFloat(g.valore_calcolato || 0), 0);
        const valoreSpese = giornate.reduce((sum, g) => sum + parseFloat(g.Valore_spese || 0), 0);
        const daConfermare = giornate.filter(g => g.Confermata !== 'Si').length;
        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-calendar-check', totaleGiornate.toFixed(1), "Totale Giornate")}
                ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(valoreLavori), 'Valore Lavori')}
                ${this.ui.createStatsCard('fas fa-receipt', this.app.utils.formatCurrency(valoreSpese), 'Valore Spese')}
                ${this.ui.createStatsCard('fas fa-hourglass-half', daConfermare, 'Giornate da Confermare')}
            </div>
        `;
    }

    groupGiornate(giornate) {
        return giornate.reduce((acc, giornata) => {
            const data = new Date(giornata.Data);
            const meseAnno = data.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const meseAnnoKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[meseAnnoKey]) {
                acc[meseAnnoKey] = { display: meseAnno.charAt(0).toUpperCase() + meseAnno.slice(1), collaboratori: {} };
            }
            const collabId = giornata.ID_COLLABORATORE;
            if (!acc[meseAnnoKey].collaboratori[collabId]) {
                acc[meseAnnoKey].collaboratori[collabId] = { nome: giornata.collaboratoreNome, giornate: [] };
            }
            acc[meseAnnoKey].collaboratori[collabId].giornate.push(giornata);
            return acc;
        }, {});
    }

    renderGroupedList(groupedData) {
        let html = '';
        const sortedMonths = Object.keys(groupedData).sort().reverse();
        for (const meseKey of sortedMonths) {
            const mese = groupedData[meseKey];
            html += `
                <div class="month-group mb-4">
                    <div class="management-card-header mb-3" data-action="toggle-month" data-id="${meseKey}">
                        <div class="d-flex justify-content-between align-items-center w-100">
                            <h5 class="management-card-title mb-0"><i class="fas fa-calendar-alt me-2"></i>${mese.display}</h5>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-light" data-action="confirm-month" data-id="${meseKey}" title="Conferma tutte"><i class="fas fa-check-double"></i></button>
                                <button class="btn btn-sm btn-outline-light" data-action="unconfirm-month" data-id="${meseKey}" title="Rendi non confermate"><i class="fas fa-times"></i></button>
                                <button class="month-toggle-btn" id="toggleBtn-${meseKey}"><i class="fas fa-chevron-down"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="collapse" id="month-${meseKey}">`;
            const sortedCollaboratori = Object.values(mese.collaboratori).sort((a,b) => a.nome.localeCompare(b.nome));
            for (const collaboratore of sortedCollaboratori) {
                html += `<div class="consultant-group mb-4">
                            <h5 class="consultant-title"><i class="fas fa-user me-2"></i>${collaboratore.nome}</h5>
                            <div class="giornate-list">
                                ${collaboratore.giornate.map(g => this.createGiornataCard(g)).join('')}
                            </div>
                         </div>`;
            }
            html += `   </div></div>`;
        }
        return html;
    }
    
    toggleMonth(monthKey, forceState = null) {
        const collapseElement = document.getElementById(`month-${monthKey}`);
        const toggleBtn = document.getElementById(`toggleBtn-${monthKey}`);
        if (!collapseElement || !toggleBtn) return;
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        const isShown = collapseElement.classList.contains('show');
        if (forceState === true || (forceState === null && !isShown)) bsCollapse.show();
        else bsCollapse.hide();
        const onAction = () => {
            const isNowShown = collapseElement.classList.contains('show');
            toggleBtn.classList.toggle('expanded', isNowShown);
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-chevron-down', !isNowShown);
                icon.classList.toggle('fa-chevron-up', isNowShown);
            }
        };
        collapseElement.addEventListener('shown.bs.collapse', onAction, { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', onAction, { once: true });
        onAction();
    }
    
    toggleAllMonths() {
        const allCollapses = document.querySelectorAll('#giornateContainer .collapse');
        if (allCollapses.length === 0) return;
        const shouldExpand = Array.from(allCollapses).some(el => !el.classList.contains('show'));
        allCollapses.forEach(el => this.toggleMonth(el.id.replace('month-', ''), shouldExpand));
        const toggleAllBtn = document.getElementById('toggleAllMonthsBtn');
        if(toggleAllBtn) {
            toggleAllBtn.innerHTML = shouldExpand ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
            toggleAllBtn.title = shouldExpand ? 'Comprimi tutto' : 'Espandi tutto';
        }
    }

    async updateMonthConfirmation(monthKey, newState) {
        const actionText = newState === 'Si' ? 'confermare' : 'rendere non confermate';
        const giornateIdsToUpdate = this.filteredGiornate
            .filter(g => {
                const data = new Date(g.Data);
                const gKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                return gKey === monthKey && (g.Confermata || 'No') !== newState;
            })
            .map(g => g.ID_GIORNATA);
        if (giornateIdsToUpdate.length === 0) {
            this.ui.showToast(`Tutte le giornate del mese sono già nello stato desiderato.`, 'info');
            return;
        }
        const confirmed = await this.ui.showConfirmModal('Conferma Azione Massiva', `Sei sicuro di voler ${actionText} ${giornateIdsToUpdate.length} giornate?`);
        if (confirmed) {
            try {
                const result = await this.api.updateGiornateConfirmation(giornateIdsToUpdate, newState);
                if (result.success) {
                    this.ui.showToast(`${result.data.updated_rows || 0} giornate aggiornate!`, 'success');
                    await this.app.refreshData();
                } else throw new Error(result.message);
            } catch (error) {
                this.ui.showToast(`Errore: ${error.message}`, 'error');
            }
        }
    }

    createGiornataCard(giornata) {
        const dataFormatted = new Date(giornata.Data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const confermataBadge = giornata.Confermata === 'Si'
            ? `<span class="badge bg-success-soft text-success" title="Confermata"><i class="fas fa-check"></i></span>`
            : `<span class="badge bg-warning-soft text-warning" title="Da Confermare"><i class="fas fa-hourglass-half"></i></span>`;
        return `
            <div class="giornata-card" data-action="edit-giornata" data-id="${giornata.ID_GIORNATA}">
                <div class="giornata-card-header">
                    <span class="giornata-date"><i class="fas fa-calendar-day me-2"></i>${dataFormatted}</span>
                    <div class="d-flex align-items-center gap-2">
                        ${confermataBadge}
                        <span class="badge bg-primary">${giornata.gg} gg</span>
                    </div>
                </div>
                <div class="giornata-card-body">
                    <p class="giornata-task fw-bold mb-1">${giornata.taskNome}</p>
                    <p class="giornata-commessa text-muted small"><i class="fas fa-briefcase me-2"></i>${giornata.commessaNome}</p>
                    <p class="giornata-cliente text-muted small"><i class="fas fa-building me-2"></i>${giornata.clienteNome}</p>
                    ${giornata.Note ? `<p class="giornata-notes small mt-2"><em><i class="fas fa-sticky-note me-2"></i>${giornata.Note}</em></p>` : ''}
                </div>
                <div class="giornata-card-footer">
                    <span>${this.app.utils.formatCurrency(giornata.valore_calcolato)}</span>
                    <span class="text-danger">${this.app.utils.formatCurrency(giornata.Valore_spese)}</span>
                </div>
            </div>
        `;
    }

    showGiornataModal(giornataId = null) {
        const isEdit = giornataId !== null;
        const giornata = isEdit ? this.giornateCompletate.find(g => g.ID_GIORNATA == giornataId) : {};
        if (isEdit && !giornata) {
            this.ui.showToast('Giornata non trovata.', 'error');
            return;
        }
        const modalTitle = isEdit ? 'Modifica Giornata' : 'Aggiungi Nuova Giornata';
        const modalId = `giornataModal_${giornataId || 'new'}`;
        const modalBody = this.getGiornataFormHTML(giornata);
        const modalActions = [];
        if (isEdit) {
            modalActions.push({
                html: `<button type="button" class="btn btn-danger me-auto">Elimina</button>`,
                selector: '.btn-danger',
                handler: () => this.handleDeleteGiornata(giornataId)
            });
        }
        modalActions.push(
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">${isEdit ? 'Salva Modifiche' : 'Crea Giornata'}</button>` }
        );
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        const form = document.getElementById(`${modalId}_form`);
        form.addEventListener('submit', (e) => this.handleGiornataFormSubmit(e, giornataId));
        const commessaSelect = form.querySelector('#ID_COMMESSA');
        const taskSelect = form.querySelector('#ID_TASK');
        commessaSelect.addEventListener('change', (e) => {
            const commessaId = e.target.value;
            const tasksFiltrati = this.app.tasks.filter(t => t.ID_COMMESSA === commessaId && t.Stato_Task === 'In corso');
            taskSelect.innerHTML = '<option value="">Seleziona Task...</option>';
            tasksFiltrati.forEach(task => taskSelect.innerHTML += `<option value="${task.ID_TASK}">${task.Task}</option>`);
            taskSelect.disabled = !commessaId;
        });
        if(isEdit && giornata.ID_COMMESSA) {
            commessaSelect.dispatchEvent(new Event('change'));
            taskSelect.value = giornata.ID_TASK;
        }
    }

    async handleGiornataFormSubmit(event, giornataId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const giornataData = Object.fromEntries(formData.entries());
        giornataData.Confermata = form.querySelector('#Confermata').checked ? 'Si' : 'No';
        giornataData.Desk = form.querySelector('#Desk').checked ? 'Si' : 'No';
        try {
            const result = giornataId
                ? await this.api.updateGiornata(giornataId, giornataData)
                : await this.api.createGiornata(giornataData);
            if (result.success) {
                this.ui.showToast(`Giornata ${giornataId ? 'aggiornata' : 'creata'}!`, 'success');
                const modal = bootstrap.Modal.getInstance(form.closest('.modal'));
                if (modal) modal.hide();
                await this.app.refreshData();
            } else throw new Error(result.errors?.join(', ') || result.message);
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        }
    }

    async handleDeleteGiornata(giornataId) {
        if (!giornataId) return;
        const confirmed = await this.ui.showConfirmModal('Conferma Eliminazione', 'Sei sicuro di voler eliminare questa giornata?');
        if (confirmed) {
            try {
                const result = await this.api.deleteGiornata(giornataId);
                if (result.success) {
                    this.ui.showToast('Giornata eliminata!', 'success');
                    const modalEl = document.getElementById(`giornataModal_${giornataId}`);
                    if(modalEl) {
                       const modal = bootstrap.Modal.getInstance(modalEl);
                       if (modal) modal.hide();
                    }
                    await this.app.refreshData();
                } else throw new Error(result.message);
            } catch (error) {
                this.ui.showToast(error.message, 'error');
            }
        }
    }

    getGiornataFormHTML(giornata = {}) {
        const formId = `giornataModal_${giornata.ID_GIORNATA || 'new'}_form`;
        const today = new Date().toISOString().split('T')[0];
        const collaboratoriOptions = this.app.collaboratori.sort((a,b) => a.Collaboratore.localeCompare(b.Collaboratore)).map(c => `<option value="${c.ID_COLLABORATORE}" ${giornata.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        const commesseOptions = this.app.commesse.filter(c => c.Stato_Commessa === 'In corso').sort((a,b) => a.Commessa.localeCompare(b.Commessa)).map(c => `<option value="${c.ID_COMMESSA}" ${giornata.ID_COMMESSA == c.ID_COMMESSA ? 'selected' : ''}>${c.Commessa}</option>`).join('');
        const tipiGiornata = ['Campo', 'Promo', 'Sviluppo', 'Formazione'];
        const tipiOptions = tipiGiornata.map(t => `<option value="${t}" ${giornata.Tipo === t ? 'selected' : ''}>${t}</option>`).join('');
        const isConfermata = giornata.Confermata === 'Si';
        const isDesk = giornata.Desk === 'Si';
        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Data" class="form-label">Data</label><input type="date" class="form-control" id="Data" name="Data" value="${giornata.Data ? giornata.Data.split(' ')[0] : today}" required></div>
                    <div class="col-md-6 mb-3"><label for="ID_COLLABORATORE" class="form-label">Collaboratore</label><select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE" required><option value="">Seleziona...</option>${collaboratoriOptions}</select></div>
                </div>
                 <div class="row">
                    <div class="col-md-6 mb-3"><label for="ID_COMMESSA" class="form-label">Commessa</label><select class="form-select" id="ID_COMMESSA" name="ID_COMMESSA" required><option value="">Seleziona Commessa...</option>${commesseOptions}</select></div>
                    <div class="col-md-6 mb-3"><label for="ID_TASK" class="form-label">Task</label><select class="form-select" id="ID_TASK" name="ID_TASK" required disabled><option value="">Seleziona prima la commessa...</option></select></div>
                </div>
                <div class="row align-items-end">
                    <div class="col-md-4 mb-3"><label for="gg" class="form-label">Giornate (es. 1 o 0.5)</label><input type="number" step="0.5" class="form-control" id="gg" name="gg" value="${giornata.gg || '1.0'}" required></div>
                     <div class="col-md-4 mb-3"><label for="Tipo" class="form-label">Tipo Attività</label><select class="form-select" id="Tipo" name="Tipo" required>${tipiOptions}</select></div>
                    <div class="col-md-4 mb-3 d-flex align-items-center justify-content-center"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="Desk" name="Desk" value="Si" ${isDesk ? 'checked' : ''}><label class="form-check-label" for="Desk">Da Desk</label></div></div>
                </div>
                <hr><h5>Spese</h5>
                <div class="row">
                     <div class="col-md-4 mb-3"><label for="Spese_Viaggi" class="form-label">Spese Viaggio (€)</label><input type="number" step="0.01" class="form-control" id="Spese_Viaggi" name="Spese_Viaggi" value="${giornata.Spese_Viaggi || '0'}"></div>
                    <div class="col-md-4 mb-3"><label for="Vitto_alloggio" class="form-label">Vitto/Alloggio (€)</label><input type="number" step="0.01" class="form-control" id="Vitto_alloggio" name="Vitto_alloggio" value="${giornata.Vitto_alloggio || '0'}"></div>
                    <div class="col-md-4 mb-3"><label for="Altri_costi" class="form-label">Altre Spese (€)</label><input type="number" step="0.01" class="form-control" id="Altri_costi" name="Altri_costi" value="${giornata.Altri_costi || '0'}"></div>
                </div>
                <div class="row">
                    <div class="col-md-4 mb-3"><label for="Spese_Fatturate_VP" class="form-label">Spese Fatturate VP (€)</label><input type="number" step="0.01" class="form-control" id="Spese_Fatturate_VP" name="Spese_Fatturate_VP" value="${giornata.Spese_Fatturate_VP || '0'}"></div>
                </div>
                <div class="mb-3"><label for="Note" class="form-label">Note</label><textarea class="form-control" id="Note" name="Note" rows="2">${giornata.Note || ''}</textarea></div>
                <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="Confermata" name="Confermata" value="Si" ${isConfermata ? 'checked' : ''}><label class="form-check-label" for="Confermata">Giornata Confermata</label></div>
            </form>
        `;
    }
}

