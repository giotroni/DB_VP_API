/**
 * @file FattureSection.js
 * @description Classe per la gestione della sezione "Fatture".
 * NOTE: Aggiornamento 2025-09-07 - Raggruppamenti header ora vengono effettuati
 * usando il campo `Cliente` come etichetta principale (fallback a `Ragione_Sociale`).
 */
class FattureSection extends BaseSection {
    constructor(appInstance) {
        super('Fatture', appInstance);
        this.fatturePerCliente = new Map();
        this.activeDateFilter = null;
    }

    async loadData() {
        this.fatturePerCliente = this.groupFattureByClient();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Fatture', 'Visualizza e gestisci le fatture emesse');
    this.updateTopbarActions(`<div class="d-flex gap-2"><button class="btn btn-outline-success" data-action="export-fatture" title="Esporta elenco fatture in Excel"><i class="fas fa-file-excel me-2"></i>Esporta Excel</button><button class="btn btn-vp-primary" data-action="add-fattura"><i class="fas fa-plus me-2"></i>Nuova Fattura</button></div>`);
        const container = this.getContainer();
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2024; y <= currentYear + 1; y++) { yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}">${y}</label></li>`; }
        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        let monthOptions = months.map((month, index) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${index + 1}">${month}</label></li>`).join('');
        
        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3">
                    <div class="col-lg-3 col-md-6"><label class="form-label">Cerca</label><input type="text" class="form-control" id="searchFatture" placeholder="Numero, cliente..."></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Cliente</label><select class="form-select" id="filterCliente"><option value="">Tutti</option>${this.app.clienti.map(c => `<option value="${c.ID_CLIENTE}">${c.Cliente}</option>`).join('')}</select></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Stato Pagamento</label><select class="form-select" id="filterStatoPagamento"><option value="">Tutti</option><option value="pagata">Pagata</option><option value="non_pagata">Non pagata</option><option value="scaduta">Scaduta</option><option value="in_scadenza">In scadenza</option><option value="parzialmente_pagata">Parzialmente pagata</option></select></div>
                    <div class="col-lg-1 col-md-3"><label class="form-label">Anno</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterAnno" aria-labelledby="filterAnnoBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnno">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${yearOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-3"><label class="form-label">Mese</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMese" aria-labelledby="filterMeseBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMese">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${monthOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">&nbsp;</label><div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="filter" title="Applica Filtri"><i class="fas fa-search"></i></button><button class="btn btn-outline-primary" data-action="toggle-all-fatture" id="toggleAllBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button></div></div>
                </div>
            </div>
            <div id="fattureContainer">${this.renderFattureCards(this.fatturePerCliente)}</div>`;
        this.updateStats(this.fatturePerCliente);
        this.bindEvents();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchFatture');
        if (searchInput) {
            let debounceTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => this.filterData(), 300);
            });
        }
        document.getElementById('filterCliente')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterStatoPagamento')?.addEventListener('change', () => this.filterData());
        
        const setupMultiSelectFilter = (filterId, buttonId) => {
            const filterContainer = document.getElementById(filterId);
            const filterButton = document.getElementById(buttonId);
            if (!filterContainer || !filterButton) return;
            filterContainer.addEventListener('change', () => {
                const checked = filterContainer.querySelectorAll('input:checked');
                if (checked.length === 0) { filterButton.textContent = 'Tutti'; } 
                else if (checked.length === 1) { filterButton.textContent = checked[0].parentElement.textContent.trim(); } 
                else { filterButton.textContent = `${checked.length} selezionati`; }
                this.filterData();
            });
        };
        setupMultiSelectFilter('filterAnno', 'filterAnnoBtn');
        setupMultiSelectFilter('filterMese', 'filterMeseBtn');
    }

    handleAction(action, id, type, targetElement, e) {
        if (targetElement.closest('.management-card-header') && !['toggle-fattura', 'edit-fattura'].includes(action)) {
            e.stopPropagation();
        }
        if (action === 'toggle-all-filter') {
            e.preventDefault();
        }
        switch (action) {
            case 'add-fattura': this.showNewFatturaModal(); break;
            case 'edit-fattura': this.showEditFatturaModal(id); break;
            case 'view-fattura': this.showFatturaDetailsModal(id); break;
            case 'toggle-fattura': this.toggleFattura(id); break;
            case 'filter': this.filterData(); break;
            case 'toggle-all-fatture': this.toggleAllFatture(); break;
            case 'export-fatture': this.exportFattureToExcel(); break;
            case 'toggle-all-filter':
                const targetId = targetElement.dataset.targetFilter;
                this.toggleAllCheckboxes(targetId);
                break;
            default: console.warn(`Azione non gestita: ${action}`);
        }
    }

    // ========================================================================
    // SEZIONE: RENDERING DEI COMPONENTI
    // ========================================================================
    
    renderFattureCards(fatture) {
        if (!fatture || fatture.length === 0) {
            return this.ui.createEmptyState('fas fa-file-invoice', 'Nessuna Fattura Trovata', 'Non ci sono fatture che corrispondono ai filtri di ricerca attuali.');
        }
        return fatture.map(c => this.createFattureCard(c)).join('');
    }

    createFattureCard(clientData) {
        const totalFatture = clientData.fatture.length;
        const totalValue = clientData.fatture.reduce((sum, f) => sum + (parseFloat(f.Fatturato_TOT) || 0), 0);
        
        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-fattura" data-id="${clientData.ID_CLIENTE}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-building me-2"></i>${clientData.cliente_nome}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-dark" title="Valore Totale">${this.app.utils.formatCurrency(totalValue)}</span>
                            <span class="badge bg-primary">${totalFatture} Fatture</span>
                            <button class="fattura-toggle-btn" id="toggleBtn-${clientData.ID_CLIENTE}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small">
                        <i class="fas fa-id-badge me-1"></i> Ragione Sociale: ${clientData.ragione_sociale || clientData.cliente_nome || 'N/D'}
                    </div>
                </div>
                <div class="collapse" id="fatture-${clientData.ID_CLIENTE}">
                    <div class="management-card-body"><div class="row">${clientData.fatture.length > 0 ? clientData.fatture.map(fattura => this.createFatturaRow(fattura)).join('') : '<p class="text-muted">Nessuna fattura associata a questo cliente.</p>'}</div></div>
                </div>
            </div>`;
    }

    createFatturaRow(fattura) {
        const statoClass = this.getStatoClass(fattura.stato_pagamento);
        const scadenzaText = fattura.Scadenza_Pagamento ? this.app.utils.formatDate(fattura.Scadenza_Pagamento) : 'N/D';
        const statoText = this.getStatoText(fattura.stato_pagamento, fattura.giorni_scadenza);
        // Nome commessa se disponibile
        const nomeCommessa = fattura.commessa_info?.Commessa || '';
        
        return `
            <div class="col-12 mb-3">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="card-title mb-0 fw-bold"><i class="fas fa-file-invoice me-2"></i>${fattura.TIPO}: ${fattura.NR}</h6>
                            <span class="status-badge ${statoClass}"><i class="fas fa-circle"></i> ${statoText}</span>
                        </div>
                        <div class="row mt-3 small text-muted">
                            <div class="col-md-3"><i class="fas fa-calendar-alt me-1"></i> Data: ${this.app.utils.formatDate(fattura.Data)}</div>
                            <div class="col-md-3"><i class="fas fa-calendar-times me-1"></i> Scadenza: ${scadenzaText}</div>
                            <div class="col-md-3"><i class="fas fa-briefcase me-1"></i> Commessa: ${nomeCommessa || 'N/D'}</div>
                            <div class="col-md-3"><i class="fas fa-money-bill-wave me-1"></i> Totale: <strong>${this.app.utils.formatCurrency(fattura.Fatturato_TOT)}</strong></div>
                        </div>
                        <div class="row small text-muted mt-2">
                            <div class="col-md-3"><i class="fas fa-piggy-bank me-1"></i> Pagato: <strong>${this.app.utils.formatCurrency(fattura.Valore_Pagato)}</strong> (${fattura.percentuale_pagata || 0}%)</div>
                        </div>
                        <div class="action-buttons d-flex justify-content-end gap-2 mt-3">
                            <button class="btn btn-outline-secondary btn-sm" data-action="view-fattura" data-id="${fattura.ID_FATTURA}" title="Visualizza dettagli"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-primary btn-sm" data-action="edit-fattura" data-id="${fattura.ID_FATTURA}" title="Modifica fattura"><i class="fas fa-edit"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    
    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE E FILTRI
    // ========================================================================
    
    toggleAllCheckboxes(targetId) {
        const container = document.getElementById(targetId);
        if (!container) return;

        const checkboxes = container.querySelectorAll('li label input[type="checkbox"]');
        if (checkboxes.length === 0) return;

        const allAreChecked = Array.from(checkboxes).every(cb => cb.checked);
        const newState = !allAreChecked;

        checkboxes.forEach(cb => {
            cb.checked = newState;
        });
        container.dispatchEvent(new Event('change'));
    }

    toggleFattura(clientId, forceState = null) {
        const collapseElement = document.getElementById(`fatture-${clientId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${clientId}`);
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

    toggleAllFatture() {
        const allCollapses = document.querySelectorAll('#fattureContainer .collapse');
        const isAnyCollapsed = Array.from(allCollapses).some(el => !el.classList.contains('show'));
        allCollapses.forEach(el => {
            const id = el.id.replace('fatture-', '');
            this.toggleFattura(id, isAnyCollapsed);
        });
        const toggleAllBtn = document.getElementById('toggleAllBtn');
        toggleAllBtn.innerHTML = isAnyCollapsed ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
        toggleAllBtn.title = isAnyCollapsed ? 'Comprimi tutto' : 'Espandi tutto';
    }

    filterData() {
        const searchText = document.getElementById('searchFatture')?.value.toLowerCase() || '';
        const selectedCliente = document.getElementById('filterCliente')?.value || '';
        const selectedStato = document.getElementById('filterStatoPagamento')?.value || '';
        const selectedYears = Array.from(document.querySelectorAll('#filterAnno input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMese input:checked')).map(el => parseInt(el.value));

        this.activeDateFilter = (selectedYears.length > 0 || selectedMonths.length > 0) ? { years: selectedYears, months: selectedMonths } : null;

        // Ricomponi i dati originali raggruppati per cliente (solo clienti con fatture)
        const allData = this.groupFattureByClient();
        let filteredData = [];

        // Per ogni cliente, applica i filtri alle singole fatture e includi il cliente
        // solo se ha almeno una fattura che soddisfa i filtri.
        allData.forEach(client => {
            const fattureFiltrate = client.fatture.filter(fattura => {
                const matchSearch = !searchText ||
                    (fattura.NR || '').toLowerCase().includes(searchText) ||
                    (fattura.cliente_info?.Cliente || client.cliente_nome || '').toLowerCase().includes(searchText);

                const matchStato = !selectedStato || fattura.stato_pagamento === selectedStato;

                const matchDate = !this.activeDateFilter || (fattura.Data && (() => {
                    const fatturaDate = new Date(fattura.Data);
                    const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(fatturaDate.getFullYear());
                    const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(fatturaDate.getMonth() + 1);
                    return yearMatch && monthMatch;
                })());

                const matchClienteFilter = !selectedCliente || String(client.ID_CLIENTE) === String(selectedCliente);

                return matchSearch && matchStato && matchDate && matchClienteFilter;
            });

            if (fattureFiltrate.length > 0) {
                // Clona l'oggetto cliente e sostituisci l'array delle fatture con quelle filtrate
                filteredData.push({ ...client, fatture: fattureFiltrate });
            }
        });

        // Render e stats solo per i clienti con fatture
        document.getElementById('fattureContainer').innerHTML = this.renderFattureCards(filteredData);
        this.updateStats(filteredData);
    }
    
    // ========================================================================
    // SEZIONE: GESTIONE MODALI
    // ========================================================================

    showNewFatturaModal() {
        const modalTitle = 'Crea Nuova Fattura';
        const modalId = 'newFatturaModal';
        const modalBody = this.getFatturaFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Fattura</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addFatturaFormListeners(`${modalId}_form`);
    }

    showEditFatturaModal(fatturaId) {
        const fattura = this.app.fatture.find(f => f.ID_FATTURA === fatturaId);
        if (!fattura) { this.ui.showToast('Fattura non trovata.', 'error'); return; }

        const modalTitle = `Modifica Fattura: ${fattura.NR}`;
        const modalId = `editFatturaModal_${fatturaId}`;
        const modalBody = this.getFatturaFormHTML(fattura);
        
        const canDelete = !fattura.Data_Pagamento;
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? 'Impossibile eliminare: fattura già pagata' : 'Elimina fattura'}">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteFattura(fatturaId)
        };
        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addFatturaFormListeners(`${modalId}_form`);
    }
    
    showFatturaDetailsModal(fatturaId) {
        const fattura = this.app.fatture.find(f => f.ID_FATTURA === fatturaId);
        if (!fattura) { this.ui.showToast('Fattura non trovata.', 'error'); return; }
        
        const commessaInfo = fattura.commessa_info ? `<li><i class="fas fa-briefcase me-2"></i><strong>Commessa:</strong> ${fattura.commessa_info.Commessa}</li>` : '';
        const statoFattura = this.getStatoText(fattura.stato_pagamento, fattura.giorni_scadenza);
        
        const modalBody = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-6">
                        <h5>Dettagli Fattura</h5>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-hashtag me-2"></i><strong>Numero:</strong> ${fattura.NR}</li>
                            <li><i class="fas fa-calendar-day me-2"></i><strong>Data:</strong> ${this.app.utils.formatDate(fattura.Data)}</li>
                            <li><i class="fas fa-building me-2"></i><strong>Cliente:</strong> ${fattura.cliente_info?.Ragione_Sociale || 'N/D'}</li>
                            ${commessaInfo}
                            <li><i class="fas fa-tag me-2"></i><strong>Tipo:</strong> ${fattura.TIPO}</li>
                            <li><i class="fas fa-info-circle me-2"></i><strong>Stato:</strong> <span class="badge ${this.getStatoClass(fattura.stato_pagamento)}">${statoFattura}</span></li>
                            <li><i class="fas fa-sticky-note me-2"></i><strong>Note:</strong> ${fattura.Note || 'N/D'}</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h5>Dettagli Pagamento</h5>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-hand-holding-usd me-2"></i><strong>Totale Fattura:</strong> ${this.app.utils.formatCurrency(fattura.Fatturato_TOT)}</li>
                            <li><i class="fas fa-piggy-bank me-2"></i><strong>Valore Pagato:</strong> ${this.app.utils.formatCurrency(fattura.Valore_Pagato)}</li>
                            <li><i class="fas fa-percentage me-2"></i><strong>Percentuale Pagata:</strong> ${fattura.percentuale_pagata || 0}%</li>
                            <li><i class="fas fa-calendar-check me-2"></i><strong>Scadenza:</strong> ${this.app.utils.formatDate(fattura.Scadenza_Pagamento)}</li>
                            <li><i class="fas fa-calendar-check me-2"></i><strong>Data Pagamento:</strong> ${this.app.utils.formatDate(fattura.Data_Pagamento)}</li>
                            <li><i class="fas fa-clock me-2"></i><strong>Tempi di Pagamento:</strong> ${fattura.Tempi_Pagamento || 'N/D'} giorni</li>
                        </ul>
                    </div>
                </div>
            </div>`;
        
        const modalActions = [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }];
        this.ui.createModal(`fatturaDetailsModal_${fatturaId}`, `Dettagli Fattura: ${fattura.NR}`, modalBody, modalActions, { size: 'modal-lg' });
    }

    // ========================================================================
    // SEZIONE: GESTIONE FORM E SALVATAGGI
    // ========================================================================

    addFatturaFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const fatturaId = form.id.includes('editFatturaModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleFatturaFormSubmit(e, fatturaId));
    }
    
    async handleFatturaFormSubmit(event, fatturaId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const fatturaData = Object.fromEntries(formData.entries());
        for (const key in fatturaData) {
            if (fatturaData[key] === '') { fatturaData[key] = null; }
        }
        try {
            const result = fatturaId
                ? await this.app.api.updateFattura(fatturaId, fatturaData)
                : await this.app.api.createFattura(fatturaData);
            if (result.success) {
                this.ui.showToast(`Fattura ${fatturaId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio della fattura.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    // ========================================================================
    // SEZIONE: AZIONI DI ELIMINAZIONE
    // ========================================================================

    async handleDeleteFattura(fatturaId) {
        const fattura = this.app.fatture.find(f => f.ID_FATTURA === fatturaId);
        if (!fattura) return;
        if (fattura.Data_Pagamento) {
            this.ui.showToast('Impossibile eliminare: fattura già pagata.', 'error');
            return;
        }
        if (confirm(`Sei sicuro di voler eliminare la fattura "${fattura.NR}"? L'azione è irreversibile.`)) {
            try {
                const result = await this.app.api.deleteFattura(fatturaId);
                if (result.success) {
                    this.ui.showToast('Fattura eliminata!', 'success');
                    const modalElement = document.getElementById(`editFatturaModal_${fatturaId}`);
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
    
    updateStats(data) {
        const fattureCount = data.reduce((sum, c) => sum + c.fatture.length, 0);
        const fatturatoTotale = data.reduce((sum, c) => sum + c.fatture.reduce((fSum, f) => fSum + (parseFloat(f.Fatturato_TOT) || 0), 0), 0);
        const incassatoTotale = data.reduce((sum, c) => sum + c.fatture.reduce((fSum, f) => fSum + (parseFloat(f.Valore_Pagato) || 0), 0), 0);
    // Rimosso conteggio 'in_scadenza' su richiesta: rimaniamo con scadute e altri riepiloghi
    const scadute = data.reduce((sum, c) => sum + c.fatture.filter(f => f.stato_pagamento === 'scaduta').length, 0);
        
        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-file-invoice', fattureCount, 'Totale Fatture')}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(fatturatoTotale), 'Fatturato Totale')}
                    ${this.ui.createStatsCard('fas fa-piggy-bank', this.app.utils.formatCurrency(incassatoTotale), 'Totale Incassato')}
                    ${this.ui.createStatsCard('fas fa-exclamation-triangle', scadute, 'Fatture Scadute')}
                </div>
            `;
        }
    }

    // Esporta l'elenco delle fatture visibili in Excel (CSV) rispettando i filtri attivi
    exportFattureToExcel() {
        // Ricava i dati correnti applicando gli stessi filtri (ma senza modificare il DOM)
        const searchText = document.getElementById('searchFatture')?.value.toLowerCase() || '';
        const selectedCliente = document.getElementById('filterCliente')?.value || '';
        const selectedStato = document.getElementById('filterStatoPagamento')?.value || '';
        const selectedYears = Array.from(document.querySelectorAll('#filterAnno input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMese input:checked')).map(el => parseInt(el.value));

        const activeDateFilter = (selectedYears.length > 0 || selectedMonths.length > 0) ? { years: selectedYears, months: selectedMonths } : null;

        const allData = this.groupFattureByClient();
        let rows = [];

        allData.forEach(client => {
            const fattureFiltrate = client.fatture.filter(fattura => {
                const matchSearch = !searchText ||
                    (fattura.NR || '').toLowerCase().includes(searchText) ||
                    (fattura.cliente_info?.Cliente || client.cliente_nome || '').toLowerCase().includes(searchText);

                const matchStato = !selectedStato || fattura.stato_pagamento === selectedStato;

                const matchDate = !activeDateFilter || (fattura.Data && (() => {
                    const fatturaDate = new Date(fattura.Data);
                    const yearMatch = activeDateFilter.years.length === 0 || activeDateFilter.years.includes(fatturaDate.getFullYear());
                    const monthMatch = activeDateFilter.months.length === 0 || activeDateFilter.months.includes(fatturaDate.getMonth() + 1);
                    return yearMatch && monthMatch;
                })());

                const matchClienteFilter = !selectedCliente || String(client.ID_CLIENTE) === String(selectedCliente);

                return matchSearch && matchStato && matchDate && matchClienteFilter;
            });

            fattureFiltrate.forEach(f => {
                rows.push({
                    NR: f.NR || '',
                    Tipo: f.TIPO || '',
                    Cliente: f.cliente_info?.Cliente || client.cliente_nome || '',
                    Commessa: f.commessa_info?.Commessa || '',
                    Data: f.Data || '',
                    Totale: f.Fatturato_TOT || '',
                    Scadenza: f.Scadenza_Pagamento || '',
                    Data_Pagamento: f.Data_Pagamento || '',
                    Valore_Pagato: f.Valore_Pagato || '',
                    Note: f.Note || ''
                });
            });
        });

        if (rows.length === 0) {
            this.ui.showToast('Nessuna fattura da esportare con i filtri attivi.', 'info');
            return;
        }

        // Ordina per Data emissione (decrescente)
        rows.sort((a, b) => new Date(b.Data) - new Date(a.Data));

        // Costruisci CSV (separatore ';' per compatibilità Excel IT)
    const headers = ['Numero Fattura','Tipo documento','Cliente','Commessa','Data emissione','Importo totale','Scadenza','Data Pagamento','Importo pagato','Note'];
        const csvLines = [headers.join(';')];

        const formatNumber = (n) => {
            if (n === null || n === undefined || n === '') return '';
            const num = typeof n === 'number' ? n : parseFloat(String(n).replace(',', '.'));
            if (isNaN(num)) return '';
            // usa la virgola come separatore decimale e punto per migliaia (locale IT)
            return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        rows.forEach(r => {
            const lineArr = [
                r.NR,
                r.Tipo,
                r.Cliente,
                r.Commessa,
                r.Data,
                formatNumber(r.Totale),
                r.Scadenza,
                r.Data_Pagamento,
                formatNumber(r.Valore_Pagato),
                r.Note
            ];
            const line = lineArr.map(v => typeof v === 'string' ? v.replace(/"/g, '""') : v).map(v => `"${v}"`).join(';');
            csvLines.push(line);
        });

        const csvContent = '\uFEFF' + csvLines.join('\n'); // BOM per Excel
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fatture_export_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.ui.showToast('Esportazione completata.', 'success');
    }

    getFatturaFormHTML(fattura = {}) {
        const formId = fattura.ID_FATTURA ? `editFatturaModal_${fattura.ID_FATTURA}_form` : 'newFatturaModal_form';
        const clientiOptions = this.app.clienti.map(c => `<option value="${c.ID_CLIENTE}" ${fattura.ID_CLIENTE == c.ID_CLIENTE ? 'selected' : ''}>${c.Ragione_Sociale || c.Cliente}</option>`).join('');
        const commesseOptions = this.app.commesse.map(c => `<option value="${c.ID_COMMESSA}" ${fattura.ID_COMMESSA == c.ID_COMMESSA ? 'selected' : ''}>${c.Commessa}</option>`).join('');
        const tipi = ['Fattura', 'Nota_Accredito'];
        const tipiOptions = tipi.map(t => `<option value="${t}" ${(fattura.TIPO || 'Fattura') === t ? 'selected' : ''}>${t}</option>`).join('');

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="NR" class="form-label">Numero</label><input type="text" class="form-control" id="NR" name="NR" value="${fattura.NR || ''}" required></div>
                    <div class="col-md-6 mb-3"><label for="Data" class="form-label">Data</label><input type="date" class="form-control" id="Data" name="Data" value="${fattura.Data || ''}" required></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="ID_CLIENTE" class="form-label">Cliente</label><select class="form-select" id="ID_CLIENTE" name="ID_CLIENTE" required><option value="">Seleziona cliente...</option>${clientiOptions}</select></div>
                    <div class="col-md-6 mb-3"><label for="ID_COMMESSA" class="form-label">Commessa (opzionale)</label><select class="form-select" id="ID_COMMESSA" name="ID_COMMESSA"><option value="">Nessuna commessa</option>${commesseOptions}</select></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="TIPO" class="form-label">Tipo</label><select class="form-select" id="TIPO" name="TIPO" required>${tipiOptions}</select></div>
                    <div class="col-md-6 mb-3"><label for="Riferimento_Ordine" class="form-label">Riferimento Ordine</label><input type="text" class="form-control" id="Riferimento_Ordine" name="Riferimento_Ordine" value="${fattura.Riferimento_Ordine || ''}"></div>
                </div>
                <hr>
                <h5>Dettagli Economici e Pagamento</h5>
                <div class="row">
                    <div class="col-md-4 mb-3"><label for="Fatturato_gg" class="form-label">Importo Giornate (€)</label><input type="number" step="0.01" class="form-control" id="Fatturato_gg" name="Fatturato_gg" value="${fattura.Fatturato_gg || '0'}"></div>
                    <div class="col-md-4 mb-3"><label for="Fatturato_Spese" class="form-label">Importo Spese (€)</label><input type="number" step="0.01" class="form-control" id="Fatturato_Spese" name="Fatturato_Spese" value="${fattura.Fatturato_Spese || '0'}"></div>
                    <div class="col-md-4 mb-3"><label for="Fatturato_TOT" class="form-label">Totale Fattura (€)</label><input type="number" step="0.01" class="form-control" id="Fatturato_TOT" name="Fatturato_TOT" value="${fattura.Fatturato_TOT || '0'}"></div>
                </div>
                <div class="row">
                    <div class="col-md-4 mb-3"><label for="Valore_Pagato" class="form-label">Valore Pagato (€)</label><input type="number" step="0.01" class="form-control" id="Valore_Pagato" name="Valore_Pagato" value="${fattura.Valore_Pagato || '0'}"></div>
                    <div class="col-md-4 mb-3"><label for="Tempi_Pagamento" class="form-label">Tempi di Pagamento (gg)</label><input type="number" step="1" class="form-control" id="Tempi_Pagamento" name="Tempi_Pagamento" value="${fattura.Tempi_Pagamento || ''}"></div>
                    <div class="col-md-4 mb-3"><label for="Scadenza_Pagamento" class="form-label">Scadenza</label><input type="date" class="form-control" id="Scadenza_Pagamento" name="Scadenza_Pagamento" value="${fattura.Scadenza_Pagamento || ''}"></div>
                </div>
                <div class="mb-3"><label for="Data_Pagamento" class="form-label">Data Pagamento</label><input type="date" class="form-control" id="Data_Pagamento" name="Data_Pagamento" value="${fattura.Data_Pagamento || ''}"></div>
                <div class="mb-3"><label for="Note" class="form-label">Note</label><textarea class="form-control" id="Note" name="Note" rows="2">${fattura.Note || ''}</textarea></div>
            </form>
        `;
    }

    groupFattureByClient() {
        const fattureMap = new Map();
        
        // Prima, mappa tutti i clienti in modo da includere anche quelli senza fatture
        this.app.clienti.forEach(cliente => {
            // Usare il campo 'Cliente' come etichetta principale per i raggruppamenti
            // (fallback a Ragione_Sociale se Cliente non è presente)
            const displayName = cliente.Cliente || cliente.Ragione_Sociale || '';
            fattureMap.set(cliente.ID_CLIENTE, { 
                ID_CLIENTE: cliente.ID_CLIENTE, 
                cliente_nome: displayName, 
                ragione_sociale: cliente.Ragione_Sociale || '',
                contatto: cliente.Contatto || 'N/D',
                citta: cliente.Citta || 'N/D',
                fatture: [] 
            });
        });
        
        this.app.fatture.forEach(fattura => {
            const clienteId = fattura.ID_CLIENTE;
            if (fattureMap.has(clienteId)) {
                fattureMap.get(clienteId).fatture.push(fattura);
            }
        });
        
        // Raggruppa in array e rimuovi i clienti senza fatture
        let fattureGrouped = Array.from(fattureMap.values());

        // Ordina le fatture di ogni cliente
        fattureGrouped.forEach(client => {
            client.fatture.sort((a, b) => new Date(b.Data) - new Date(a.Data));
        });

        // Mantieni solo i clienti che hanno almeno una fattura
        fattureGrouped = fattureGrouped.filter(c => c.fatture && c.fatture.length > 0);

        // Ordina i clienti per nome
        return fattureGrouped.sort((a, b) => (a.cliente_nome || '').localeCompare(b.cliente_nome || ''));
    }

    getStatoClass(stato) {
        switch (stato) {
            case 'pagata': return 'bg-success';
            case 'parzialmente_pagata': return 'bg-warning text-dark';
            case 'scaduta': return 'bg-danger';
            case 'in_scadenza': return 'bg-info text-dark';
            default: return 'bg-secondary';
        }
    }

    getStatoText(stato, giorniScadenza) {
        switch (stato) {
            case 'pagata': return 'Pagata';
            case 'parzialmente_pagata': return 'Parzialmente Pagata';
            case 'scaduta': return `Scaduta da ${Math.abs(giorniScadenza)} gg`;
            case 'in_scadenza': return `In Scadenza in ${giorniScadenza} gg`;
            default: return 'Non Pagata';
        }
    }
}