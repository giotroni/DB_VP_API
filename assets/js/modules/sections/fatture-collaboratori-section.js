/**
 * @file fatture-collaboratori-section.js
 * @description Sezione per la gestione delle fatture passive dei collaboratori
 */
class FattureCollaboratoriSection extends BaseSection {
    constructor(appInstance) {
        super('Fatture Collaboratori', appInstance);
        this.fatturePerCollaboratore = new Map();
        this.activeDateFilter = null;
    }

    async loadData() {
        // Raggruppa le fatture passive per collaboratore
        this.fatturePerCollaboratore = this.groupFattureByCollaboratore();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Fatture Collaboratori', 'Visualizza, modifica e inserisci le fatture passive dei collaboratori');
        this.updateTopbarActions(`<div class="d-flex gap-2"><button class="btn btn-outline-success" data-action="export-fatture-coll" title="Esporta in Excel"><i class="fas fa-file-excel me-2"></i>Esporta Excel</button><button class="btn btn-vp-primary" data-action="add-fattura-coll"><i class="fas fa-plus me-2"></i>Nuova Fattura Collaboratore</button></div>`);

        const container = this.getContainer();
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2024; y <= currentYear + 1; y++) { yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}">${y}</label></li>`; }
        const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        let monthOptions = months.map((m,i) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${i+1}">${m}</label></li>`).join('');

        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3">
                    <div class="col-lg-3 col-md-6"><label class="form-label">Cerca</label><input type="text" class="form-control" id="searchFattureColl" placeholder="Descrizione, id..."></div>
                    <div class="col-lg-3 col-md-6"><label class="form-label">Collaboratore</label><select class="form-select" id="filterCollaboratore"><option value="">Tutti</option>${this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`).join('')}</select></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Stato</label><select class="form-select" id="filterStatoColl"><option value="">Tutti</option><option value="Ricevuta">Ricevuta</option><option value="Pagata">Pagata</option><option value="Annullata">Annullata</option></select></div>
                    <div class="col-lg-1 col-md-3"><label class="form-label">Anno</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoCollBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterAnnoColl" aria-labelledby="filterAnnoCollBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnnoColl">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${yearOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-3"><label class="form-label">Mese</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseCollBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMeseColl" aria-labelledby="filterMeseCollBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMeseColl">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${monthOptions}</ul></div></div>
                    <div class="col-lg-1 col-md-6"><label class="form-label">&nbsp;</label><div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="filterColl" title="Applica Filtri"><i class="fas fa-search"></i></button><button class="btn btn-outline-primary" data-action="toggle-all-fatture-coll" id="toggleAllCollBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button></div></div>
                </div>
            </div>
            <div id="fattureCollaboratoriContainer">${this.renderFattureCards(this.fatturePerCollaboratore)}</div>`;

        this.updateStats(this.fatturePerCollaboratore);
        this.bindEvents();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchFattureColl');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => this.filterData(), 300); });
        }
        document.getElementById('filterCollaboratore')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterStatoColl')?.addEventListener('change', () => this.filterData());

        const setupMulti = (filterId, btnId) => {
            const container = document.getElementById(filterId);
            const btn = document.getElementById(btnId);
            if (!container || !btn) return;
            container.addEventListener('change', () => {
                const checked = container.querySelectorAll('input:checked');
                if (checked.length === 0) btn.textContent = 'Tutti';
                else if (checked.length === 1) btn.textContent = checked[0].parentElement.textContent.trim();
                else btn.textContent = `${checked.length} selezionati`;
                this.filterData();
            });
        };
        setupMulti('filterAnnoColl','filterAnnoCollBtn');
        setupMulti('filterMeseColl','filterMeseCollBtn');
    }

    handleAction(action, id, type, targetElement, e) {
        if (action === 'toggle-all-filter') { e.preventDefault(); }
        switch(action) {
            case 'add-fattura-coll': this.showNewFatturaModal(); break;
            case 'edit-fattura-coll': this.showEditFatturaModal(id); break;
            case 'view-fattura-coll': this.showFatturaDetailsModal(id); break;
            case 'filterColl': this.filterData(); break;
            case 'toggle-all-fatture-coll': this.toggleAllFatture(); break;
            case 'export-fatture-coll': this.exportFattureToExcel(); break;
            case 'toggle-all-filter':
                const targetId = targetElement.dataset.targetFilter;
                this.toggleAllCheckboxes(targetId);
                break;
            default: console.warn('Azione non gestita:', action);
        }
    }

    renderFattureCards(fatture) {
        if (!fatture || fatture.length === 0) {
            return this.ui.createEmptyState('fas fa-file-invoice', 'Nessuna Fattura Trovata', 'Non ci sono fatture che corrispondono ai filtri di ricerca attuali.');
        }
        return fatture.map(c => this.createFattureCard(c)).join('');
    }

    createFattureCard(collData) {
        const total = collData.fatture.length;
        const totalValue = collData.fatture.reduce((s,f) => s + (parseFloat(f.Importo_Totale)||0), 0);
        const totalPaid = collData.fatture.reduce((s,f) => s + (parseFloat(f.Netto_pagare)||0), 0);
        const paidCount = collData.fatture.filter(f => f.Stato === 'Pagata').length;
        const paidBadgeClass = totalPaid < totalValue ? 'bg-danger text-light' : 'bg-success';

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-fattura-coll" data-id="${collData.ID_COLLABORATORE}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-user me-2"></i>${collData.collaboratore_nome}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-dark" title="Valore Totale">${this.app.utils.formatCurrency(totalValue)}</span>
                            <span class="badge bg-primary">${total} Fatture</span>
                            <span class="badge ${paidBadgeClass}" title="Valore Pagato">${this.app.utils.formatCurrency(totalPaid)}</span>
                            <span class="badge bg-success text-light" title="Fatture Pagate">${paidCount} Pagate</span>
                            <button class="fattura-toggle-btn" id="toggleBtnColl-${collData.ID_COLLABORATORE}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small"><i class="fas fa-id-badge me-1"></i> Email: ${collData.collaboratore_email || 'N/D'}</div>
                </div>
                <div class="collapse" id="fatture-coll-${collData.ID_COLLABORATORE}">
                    <div class="management-card-body"><div class="row">${collData.fatture.length>0?collData.fatture.map(f=>this.createFatturaRow(f)).join(''):'<p class="text-muted">Nessuna fattura per questo collaboratore.</p>'}</div></div>
                </div>
            </div>`;
    }

    createFatturaRow(f) {
        const pagamentoDateText = f.Data_Pagamento ? this.app.utils.formatDate(f.Data_Pagamento) : 'N/D';
        return `
            <div class="col-12 mb-3">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="card-title mb-0 fw-bold"><i class="fas fa-file-invoice me-2"></i> ${f.ID_FATTURA}</h6>
                            <span class="status-badge ${f.Stato==='Pagata'?'bg-success':'bg-secondary'}"><i class="fas fa-circle"></i> ${f.Stato || 'Ricevuta'}</span>
                        </div>
                        <div class="row mt-3 small text-muted">
                            <div class="col-md-3"><i class="fas fa-calendar-alt me-1"></i> Data: ${this.app.utils.formatDate(f.Data)}</div>
                            <div class="col-md-3"><i class="fas fa-money-bill-wave me-1"></i> Totale: <strong>${this.app.utils.formatCurrency(f.Importo_Totale)}</strong></div>
                            <div class="col-md-3"><i class="fas fa-percentage me-1"></i> Ritenuta: ${this.app.utils.formatCurrency(f.Ritenuta_Acconto)}</div>
                            <div class="col-md-3"><i class="fas fa-hand-holding-usd me-1"></i> Netto pagare: <strong>${this.app.utils.formatCurrency(f.Netto_pagare)}</strong></div>
                        </div>
                        <div class="row small text-muted mt-2">
                            <div class="col-md-6"><i class="fas fa-sticky-note me-1"></i> ${f.Descrizione || ''}</div>
                            <div class="col-md-6"><i class="fas fa-calendar-check me-1"></i> Data Pagamento: <strong>${pagamentoDateText}</strong></div>
                        </div>
                        <div class="action-buttons d-flex justify-content-end gap-2 mt-3">
                            <button class="btn btn-outline-secondary btn-sm" data-action="view-fattura-coll" data-id="${f.ID_FATTURA}" title="Visualizza dettagli"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-primary btn-sm" data-action="edit-fattura-coll" data-id="${f.ID_FATTURA}" title="Modifica"><i class="fas fa-edit"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    toggleAllCheckboxes(targetId) {
        const container = document.getElementById(targetId);
        if (!container) return;
        const checkboxes = container.querySelectorAll('li label input[type="checkbox"]');
        if (checkboxes.length === 0) return;
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        container.dispatchEvent(new Event('change'));
    }

    toggleFattura(collId, forceState = null) {
        const collapse = document.getElementById(`fatture-coll-${collId}`);
        const toggleBtn = document.getElementById(`toggleBtnColl-${collId}`);
        if (!collapse || !toggleBtn) return;
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapse);
        if (forceState === true) bsCollapse.show(); else if (forceState === false) bsCollapse.hide(); else bsCollapse.toggle();
    }

    toggleAllFatture() {
        const all = document.querySelectorAll('#fattureCollaboratoriContainer .collapse');
        const anyCollapsed = Array.from(all).some(el => !el.classList.contains('show'));
        all.forEach(el => {
            const id = el.id.replace('fatture-coll-','');
            this.toggleFattura(id, anyCollapsed);
        });
        const btn = document.getElementById('toggleAllCollBtn');
        btn.innerHTML = anyCollapsed ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
    }

    filterData() {
        const search = document.getElementById('searchFattureColl')?.value.toLowerCase() || '';
        const collFilter = document.getElementById('filterCollaboratore')?.value || '';
        const stato = document.getElementById('filterStatoColl')?.value || '';
        const selectedYears = Array.from(document.querySelectorAll('#filterAnnoColl input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMeseColl input:checked')).map(el => parseInt(el.value));
        this.activeDateFilter = (selectedYears.length>0 || selectedMonths.length>0) ? { years: selectedYears, months: selectedMonths } : null;

        const allData = this.groupFattureByCollaboratore();
        let filtered = [];

        allData.forEach(coll => {
            const filteredF = coll.fatture.filter(f => {
                const matchSearch = !search || ((f.Descrizione||'').toLowerCase().includes(search)) || (f.ID_FATTURA||'').toLowerCase().includes(search);
                const matchColl = !collFilter || String(coll.ID_COLLABORATORE) === String(collFilter);
                const matchStato = !stato || f.Stato === stato;
                const matchDate = !this.activeDateFilter || (f.Data && (() => {
                    const d = new Date(f.Data);
                    const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(d.getFullYear());
                    const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(d.getMonth()+1);
                    return yearMatch && monthMatch;
                })());
                return matchSearch && matchColl && matchStato && matchDate;
            });
            if (filteredF.length>0) filtered.push({ ...coll, fatture: filteredF });
        });

        document.getElementById('fattureCollaboratoriContainer').innerHTML = this.renderFattureCards(filtered);
        this.updateStats(filtered);
    }

    // Modali di creazione/modifica - semplificati
    showNewFatturaModal() {
        const modalId = 'newFatturaCollModal';
        const modalBody = this.getFatturaFormHTML();
        const actions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea</button>` }
        ];
        this.ui.createModal(modalId, 'Crea Fattura Collaboratore', modalBody, actions, { size: 'modal-lg' });
        this.addFormListeners(`${modalId}_form`);
    }

    showEditFatturaModal(id) {
        const fatt = this.app.fatture_collaboratori.find(f => f.ID_FATTURA === id);
        if (!fatt) { this.ui.showToast('Fattura non trovata','error'); return; }
        const modalId = `editFatturaColl_${id}`;
        const body = this.getFatturaFormHTML(fatt);
        const actions = [
            { html: `<button type="button" class="btn btn-danger me-auto" ${fatt.Stato==='Pagata'?'disabled':''}>Elimina</button>`, selector: '.btn-danger', handler: ()=> this.handleDeleteFattura(id) },
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva</button>` }
        ];
        this.ui.createModal(modalId, `Modifica Fattura ${fatt.ID_FATTURA}`, body, actions, { size: 'modal-lg' });
        this.addFormListeners(`${modalId}_form`);
    }

    showFatturaDetailsModal(id) {
        const fatt = this.app.fatture_collaboratori.find(f => f.ID_FATTURA === id);
        if (!fatt) { this.ui.showToast('Fattura non trovata','error'); return; }
        const body = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-6">
                        <h5>Dettagli Fattura</h5>
                        <ul class="list-unstyled">
                            <li><strong>ID:</strong> ${fatt.ID_FATTURA}</li>
                            <li><strong>Data:</strong> ${this.app.utils.formatDate(fatt.Data)}</li>
                            <li><strong>Collaboratore:</strong> ${fatt.collaboratore_nome || 'N/D'}</li>
                            <li><strong>Descrizione:</strong> ${fatt.Descrizione || 'N/D'}</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h5>Importi</h5>
                        <ul class="list-unstyled">
                            <li><strong>Netto:</strong> ${this.app.utils.formatCurrency(fatt.Importo_netto)}</li>
                            <li><strong>IVA:</strong> ${this.app.utils.formatCurrency(fatt.Importo_IVA)}</li>
                            <li><strong>Totale:</strong> ${this.app.utils.formatCurrency(fatt.Importo_Totale)}</li>
                            <li><strong>Ritenuta:</strong> ${this.app.utils.formatCurrency(fatt.Ritenuta_Acconto)}</li>
                            <li><strong>Netto pagare:</strong> ${this.app.utils.formatCurrency(fatt.Netto_pagare)}</li>
                            <li><strong>Data Pagamento:</strong> ${fatt.Data_Pagamento?this.app.utils.formatDate(fatt.Data_Pagamento):'N/D'}</li>
                        </ul>
                    </div>
                </div>
            </div>`;
        this.ui.createModal(`fattCollDetails_${id}`, `Dettagli Fattura ${id}`, body, [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }], { size: 'modal-lg' });
    }

    addFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const isEdit = formId.startsWith('editFatturaColl');
        form.addEventListener('submit', (e) => this.handleFormSubmit(e, isEdit ? formId.split('_')[1] : null));
    }

    async handleFormSubmit(e, id=null) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const data = Object.fromEntries(fd.entries());
        for (const k in data) if (data[k]==='') data[k] = null;

        try {
            const result = id ? await this.app.api.updateFatturaCollaboratore(id, data) : await this.app.api.createFatturaCollaboratore(data);
            if (result.success) {
                this.ui.showToast('Fattura salvata', 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else throw new Error(result.message || 'Errore salvataggio');
        } catch (err) { this.ui.showToast(err.message, 'error'); }
    }

    async handleDeleteFattura(id) {
        if (!confirm('Eliminare fattura?')) return;
        try {
            const res = await this.app.api.deleteFatturaCollaboratore(id);
            if (res.success) { this.ui.showToast('Fattura eliminata','success'); await this.app.loadInitialData(); } else throw new Error(res.message);
        } catch (err) { this.ui.showToast(err.message,'error'); }
    }

    getFatturaFormHTML(f = {}) {
        const formId = f.ID_FATTURA ? `editFatturaColl_${f.ID_FATTURA}_form` : 'newFatturaCollModal_form';
        const collOptions = this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}" ${f.ID_COLLABORATORE==c.ID_COLLABORATORE?'selected':''}>${c.Collaboratore}</option>`).join('');
        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-4 mb-3"><label class="form-label">ID Fattura</label><input class="form-control" name="ID_FATTURA" value="${f.ID_FATTURA||''}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Data</label><input type="date" class="form-control" name="Data" value="${f.Data||''}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Collaboratore</label><select class="form-select" name="ID_COLLABORATORE">${collOptions}</select></div>
                </div>
                <div class="mb-3"><label class="form-label">Descrizione</label><input class="form-control" name="Descrizione" value="${f.Descrizione||''}"></div>
                <div class="row">
                    <div class="col-md-3 mb-3"><label class="form-label">Importo netto</label><input type="number" step="0.01" class="form-control" name="Importo_netto" value="${f.Importo_netto||0}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">Importo IVA</label><input type="number" step="0.01" class="form-control" name="Importo_IVA" value="${f.Importo_IVA||0}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">Importo Totale</label><input type="number" step="0.01" class="form-control" name="Importo_Totale" value="${f.Importo_Totale||0}"></div>
                    <div class="col-md-3 mb-3"><label class="form-label">Ritenuta Acconto</label><input type="number" step="0.01" class="form-control" name="Ritenuta_Acconto" value="${f.Ritenuta_Acconto||0}"></div>
                </div>
                <div class="row">
                    <div class="col-md-4 mb-3"><label class="form-label">Netto pagare</label><input type="number" step="0.01" class="form-control" name="Netto_pagare" value="${f.Netto_pagare||0}"></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Stato</label><select class="form-select" name="Stato"><option ${f.Stato==='Ricevuta'?'selected':''}>Ricevuta</option><option ${f.Stato==='Pagata'?'selected':''}>Pagata</option><option ${f.Stato==='Annullata'?'selected':''}>Annullata</option></select></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Data Pagamento</label><input type="date" class="form-control" name="Data_Pagamento" value="${f.Data_Pagamento||''}"></div>
                </div>
            </form>`;
    }

    groupFattureByCollaboratore() {
        const map = new Map();
        this.app.collaboratori.forEach(c => map.set(c.ID_COLLABORATORE, { ID_COLLABORATORE: c.ID_COLLABORATORE, collaboratore_nome: c.Collaboratore || '', collaboratore_email: c.Email || '', fatture: [] }));
        this.app.fatture_collaboratori.forEach(f => {
            const id = f.ID_COLLABORATORE;
            if (map.has(id)) map.get(id).fatture.push(f);
        });
        let arr = Array.from(map.values());
        arr.forEach(c => c.fatture.sort((a,b)=> new Date(b.Data) - new Date(a.Data)));
        arr = arr.filter(c => c.fatture && c.fatture.length>0);
        return arr.sort((a,b) => (a.collaboratore_nome||'').localeCompare(b.collaboratore_nome||''));
    }

    updateStats(data) {
        const count = data.reduce((s,c)=> s + c.fatture.length,0);
        const totale = data.reduce((s,c)=> s + c.fatture.reduce((ss,f)=> ss + (parseFloat(f.Importo_Totale)||0),0),0);
        const daPagare = data.reduce((s,c)=> s + c.fatture.reduce((ss,f)=> ss + (f.Stato==='Pagata' ? (parseFloat(f.Netto_pagare)||0) : 0),0),0);
        const nonPagate = data.reduce((s,c)=> s + c.fatture.filter(f=>f.Stato!=='Pagata').length,0);
        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-file-invoice', count, 'Totale Fatture')}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totale), 'Totale (gross)')}
                    ${this.ui.createStatsCard('fas fa-piggy-bank', this.app.utils.formatCurrency(daPagare), 'Totale Pagato')}
                    ${this.ui.createStatsCard('fas fa-times-circle', nonPagate, 'Fatture Non Pagate')}
                </div>
            `;
        }
    }

    exportFattureToExcel() {
        // Semplice export CSV delle fatture correnti
        const allData = this.groupFattureByCollaboratore();
        let rows = [];
        allData.forEach(coll => coll.fatture.forEach(f => rows.push({ ID: f.ID_FATTURA, Collaboratore: coll.collaboratore_nome, Data: f.Data, Totale: f.Importo_Totale, Netto_pagare: f.Netto_pagare, Stato: f.Stato })));
        if (rows.length===0) { this.ui.showToast('Nessuna fattura da esportare','info'); return; }
        const headers = ['ID','Collaboratore','Data','Totale','Netto_pagare','Stato'];
        const csv = [headers.join(';')].concat(rows.map(r=>headers.map(h=>`"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(';'))).join('\n');
        const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `fatture_coll_export_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        this.ui.showToast('Esportazione completata','success');
    }
}

// Registrazione automatica opzionale: il file viene incluso da management.html e istanziato in ManagementApp
