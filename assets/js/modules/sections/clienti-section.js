// ============================================================================
// 3. assets/js/modules/sections/clienti-section.js - PRIORITÀ MEDIA
// ============================================================================
class ClientiSection extends BaseSection {
    constructor(apiClient, uiComponents) {
        super('Clienti', apiClient, uiComponents);
    }

    async loadData() {
        try {
            const result = await this.api.getClienti();
            if (result.success) {
                this.data = result.data.data || [];
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Errore caricamento clienti:', error);
            this.ui.showToast('Errore nel caricamento dei clienti', 'error');
        }
    }

    render() {
        this.updatePageTitle('Gestione Clienti', 'Visualizza e gestisci i clienti');
        this.updateTopbarActions(`
            <div class="d-flex gap-2">
                <button class="btn btn-vp-primary" data-action="add-cliente">
                    <i class="fas fa-plus me-2"></i>Nuovo Cliente
                </button>
                <button class="btn btn-outline-secondary" data-action="export-clienti">
                    <i class="fas fa-file-export me-2"></i>Esporta Excel
                </button>
            </div>
        `);
        
        const container = this.getContainer();
        // Il periodo lo decide l'applicazione, non la sezione: è uno solo e si
        // ritrova cambiando pagina. Vedi ManagementApp.getPeriodo().
        const yearOptions = this.app.opzioniAnno();
        const monthOptions = this.app.opzioniMese();

        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-building', this.data.length, 'Clienti Totali')}
                ${this.ui.createStatsCard('fas fa-handshake', this.getActiveClients(), 'Clienti Attivi')}
                <div id="statValoreTotaleWrapper">${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(this.getTotaleClienti()), 'Valore Totale')}</div>
            </div>

            <div class="search-filters">
                <div class="row gy-2 align-items-end">
                    <div class="col-lg-4 col-md-6">
                        <label class="form-label">Cerca cliente</label>
                        <input type="text" class="form-control" id="searchClienti"
                               placeholder="Nome, ragione sociale, città..." value="${this.filters.search || ''}">
                    </div>
                    <div class="col-lg-1 col-md-3">
                        <label class="form-label">Anno</label>
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoClientiBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">${this.app.etichettaAnno()}</button>
                            <ul class="dropdown-menu" id="filterAnnoClienti" aria-labelledby="filterAnnoClientiBtn">
                                <li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnnoClienti">Seleziona/Deseleziona</a></li>
                                <li><hr class="dropdown-divider"></li>
                                ${yearOptions}
                            </ul>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3">
                        <label class="form-label">Mese</label>
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseClientiBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">${this.app.etichettaMese()}</button>
                            <ul class="dropdown-menu" id="filterMeseClienti" aria-labelledby="filterMeseClientiBtn">
                                <li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMeseClienti">Seleziona/Deseleziona</a></li>
                                <li><hr class="dropdown-divider"></li>
                                ${monthOptions}
                            </ul>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <label class="form-label">&nbsp;</label>
                        <div class="form-check mt-1">
                            <input class="form-check-input" type="checkbox" id="filterSoloAttivi" ${this.filters.soloAttivi ? 'checked' : ''}>
                            <label class="form-check-label" for="filterSoloAttivi">Solo con commesse attive</label>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-2">
                        <label class="form-label">&nbsp;</label>
                        <button class="btn btn-vp-primary w-100" data-action="filter-clienti">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-building me-2"></i>
                        Elenco Clienti
                    </h5>
                </div>
                <div class="management-card-body">
                    ${this.renderClientiTable()}
                </div>
            </div>
        `;
    }

    renderClientiTable() {
        const filteredData = this.getFilteredData();
        
        if (filteredData.length === 0) {
            return this.ui.createEmptyState(
                'fas fa-building',
                'Nessun cliente trovato',
                'Non ci sono clienti che corrispondono ai filtri selezionati',
                {
                    class: 'btn btn-vp-primary',
                    text: '<i class="fas fa-plus me-1"></i>Aggiungi Cliente'
                }
            );
        }

        return `
            <div class="table-responsive">
                <table class="table management-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Ragione Sociale</th>
                            <th class="text-end">Maturato (€)</th>
                            <th>Commesse</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(cliente => this.renderClienteRow(cliente)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderClienteRow(cliente) {
        const maturato = this.getMaturato(cliente.ID_CLIENTE);
        return `
            <tr>
                <td><strong>${cliente.Cliente}</strong></td>
                <td>${cliente.Ragione_Sociale || '-'}</td>
                <td class="text-end fw-bold ${maturato > 0 ? 'text-success' : 'text-muted'}">${this.app.utils.formatCurrency(maturato)}</td>
                <td><span class="badge bg-primary">${this.getCommesseCount(cliente.ID_CLIENTE)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" data-action="view-cliente" data-id="${cliente.ID_CLIENTE}" title="Visualizza">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action edit" data-action="edit-cliente" data-id="${cliente.ID_CLIENTE}" title="Modifica">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getMaturato(clienteId) {
        const allCommesse = this.app.commesse || [];
        const giornate = this.app.giornate || [];
        const tasks = this.app.tasks || [];

        const selectedYears = Array.from(document.querySelectorAll('#filterAnnoClienti input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMeseClienti input:checked')).map(el => parseInt(el.value));

        const inDateRange = (dataStr) => {
            if (selectedYears.length === 0 && selectedMonths.length === 0) return true;
            const d = new Date(dataStr);
            if (selectedYears.length > 0 && !selectedYears.includes(d.getFullYear())) return false;
            if (selectedMonths.length > 0 && !selectedMonths.includes(d.getMonth() + 1)) return false;
            return true;
        };

        // Commesse di questo cliente
        const commesseCliente = allCommesse.filter(c => String(c.ID_CLIENTE) === String(clienteId));

        let totaleMaturato = 0;

        commesseCliente.forEach(commessa => {
            // Task della commessa
            const taskCommessa = tasks.filter(t => t.ID_COMMESSA === commessa.ID_COMMESSA);

            // --- Valore Campo: sum valore_calcolato giornate Campo nel periodo ---
            let sommaValoreCampo = 0;
            // --- Valore Spese: sum Valore_spese giornate nel periodo ---
            let sommaSpese = 0;

            taskCommessa.forEach(task => {
                const giornateTask = giornate.filter(g =>
                    (String(g.ID_TASK) === String(task.ID_TASK)) && inDateRange(g.Data)
                );
                if (task.Tipo === 'Campo') {
                    sommaValoreCampo += giornateTask.reduce((s, g) =>
                        s + (parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0), 0);
                }
                // Spese su tutte le giornate (già filtrate per tipo Campo in PHP: Valore_spese > 0 solo per Campo non-Desk)
                sommaSpese += giornateTask.reduce((s, g) =>
                    s + (parseFloat(g.Valore_spese ?? g.valore_spese ?? 0) || 0), 0);
            });

            // --- Valore Coordinamento (Monitoraggio): % del valore Campo della commessa ---
            let sommaMonitoraggio = 0;
            taskCommessa.forEach(task => {
                if (task.Tipo === 'Monitoraggio') {
                    const perc = parseFloat(task.Valore_gg) || 0;
                    if (perc > 0) sommaMonitoraggio += sommaValoreCampo * perc;
                }
            });

            totaleMaturato += sommaValoreCampo + sommaMonitoraggio + sommaSpese;
        });

        return totaleMaturato;
    }

    bindEvents() {
        const searchInput = document.getElementById('searchClienti');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.filterClienti(), 300);
            });
        }
        const setupMultiSelectFilter = (filterId, buttonId) => {
            const filterContainer = document.getElementById(filterId);
            const filterButton = document.getElementById(buttonId);
            if (!filterContainer || !filterButton) return;
            filterContainer.addEventListener('change', () => {
                const checked = filterContainer.querySelectorAll('input:checked');
                if (checked.length === 0) { filterButton.textContent = 'Tutti'; }
                else if (checked.length === 1) { filterButton.textContent = checked[0].parentElement.textContent.trim(); }
                else { filterButton.textContent = `${checked.length} selezionati`; }
                // Anno e mese valgono per tutta l'applicazione: la scelta si
                // ricorda qui, e le altre sezioni la ritrovano già fatta.
                this.app.salvaPeriodoDalDOM();
                this.filterClienti();
            });
        };
        setupMultiSelectFilter('filterAnnoClienti', 'filterAnnoClientiBtn');
        setupMultiSelectFilter('filterMeseClienti', 'filterMeseClientiBtn');
        // Applica filtro anno corrente inizialmente
        this.filterClienti();
    }

    handleAction(action, id, type, targetElement) {
        switch(action) {
            case 'add-cliente':
                this.showNewClientModal();
                break;
            case 'edit-cliente':
                this.editClient(id);
                break;
            case 'view-cliente':
                this.viewClient(id);
                break;
            case 'export-clienti':
                this.exportClientiToExcel();
                break;
            case 'filter-clienti':
                this.filterClienti();
                break;
            case 'toggle-all-filter': {
                const targetId = targetElement?.dataset?.targetFilter;
                if (targetId) {
                    const checkboxes = document.querySelectorAll(`#${targetId} input[type="checkbox"]`);
                    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                    checkboxes.forEach(cb => { cb.checked = !allChecked; });
                    // aggiorna label pulsante
                    const btn = document.getElementById(targetId + 'Btn');
                    if (btn) btn.textContent = allChecked ? 'Tutti' : `${checkboxes.length} selezionati`;
                    this.app.salvaPeriodoDalDOM();
                    this.filterClienti();
                }
                break;
            }
            default:
                console.warn(`Azione non gestita: ${action}`);
                break;
        }
    }

    exportClientiToExcel() {
        const data = this.getFilteredData();
        if (data.length === 0) {
            this.ui.showToast('Nessun cliente da esportare.', 'warning');
            return;
        }

        const headers = ['ID_CLIENTE', 'Cliente', 'Ragione_Sociale', 'Tipo_Cliente', 'Email', 'Telefono', 'P_IVA', 'Indirizzo', 'Citta', 'Stato'];
        const csvContent = [
            headers.join(';'),
            ...data.map(c => headers.map(h => `"${(c[h] || '').toString().replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `clienti_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    getFilteredData() {
        let filtered = [...this.data];

        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filtered = filtered.filter(cliente =>
                (cliente.Cliente || '').toLowerCase().includes(search) ||
                (cliente.Ragione_Sociale || '').toLowerCase().includes(search) ||
                (cliente.Citta || '').toLowerCase().includes(search)
            );
        }

        if (this.filters.soloAttivi) {
            const commesse = this.app?.commesse || window.app?.commesse || [];
            const clientiAttivi = new Set(
                commesse
                    .filter(c => c.Stato_Commessa === 'In corso')
                    .map(c => String(c.ID_CLIENTE))
            );
            filtered = filtered.filter(c => clientiAttivi.has(String(c.ID_CLIENTE)));
        }

        return filtered;
    }

    filterClienti() {
        this.filters.search = document.getElementById('searchClienti')?.value || '';
        this.filters.soloAttivi = document.getElementById('filterSoloAttivi')?.checked || false;
        const tbody = document.querySelector('.management-card-body');
        if (tbody) tbody.innerHTML = this.renderClientiTable();
        // Aggiorna il badge del valore totale in base ai filtri attivi
        const wrapper = document.getElementById('statValoreTotaleWrapper');
        if (wrapper) wrapper.innerHTML = this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(this.getTotaleClienti()), 'Valore Totale');
    }

    getTotaleClienti() {
        // Somma il maturato di tutti i clienti attualmente visibili (filtro soloAttivi + ricerca)
        return this.getFilteredData().reduce((sum, cliente) => sum + this.getMaturato(cliente.ID_CLIENTE), 0);
    }

    getActiveClients() {
        // Conta i clienti che hanno almeno una commessa attualmente "In corso"
        const commesse = this.app?.commesse || window.app?.commesse || [];
        const clientiConCommessaAttiva = new Set(
            commesse
                .filter(c => c.Stato_Commessa === 'In corso')
                .map(c => String(c.ID_CLIENTE))
        );
        return this.data.filter(c => clientiConCommessaAttiva.has(String(c.ID_CLIENTE))).length;
    }

    getCommesseCount(clienteId) {
        return window.app?.commesse?.filter(c => c.ID_CLIENTE == clienteId).length || 0;
    }

    getCommessePerCliente() {
        if (this.data.length === 0) return 0;
        const totalCommesse = this.data.reduce((sum, cliente) => 
            sum + this.getCommesseCount(cliente.ID_CLIENTE), 0);
        return (totalCommesse / this.data.length).toFixed(1);
    }

    getClienteFormHTML(cliente = {}) {
        return `
            <form id="clienteForm">
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Nome Cliente <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" name="Cliente" value="${cliente.Cliente || ''}" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Ragione Sociale</label>
                        <input type="text" class="form-control" name="Ragione_Sociale" value="${cliente.Ragione_Sociale || ''}">
                    </div>
                    <div class="col-md-8 mb-3">
                        <label class="form-label">Indirizzo</label>
                        <input type="text" class="form-control" name="Indirizzo" value="${cliente.Indirizzo || ''}">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">CAP</label>
                        <input type="text" class="form-control" name="CAP" maxlength="5" placeholder="12345" value="${cliente.CAP || ''}">
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Città</label>
                        <input type="text" class="form-control" name="Citta" value="${cliente.Citta || ''}">
                    </div>
                    <div class="col-md-2 mb-3">
                        <label class="form-label">Provincia</label>
                        <input type="text" class="form-control" name="Provincia" maxlength="2" placeholder="MI" value="${cliente.Provincia || ''}">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Partita IVA</label>
                        <input type="text" class="form-control" name="P_IVA" maxlength="11" placeholder="12345678901" value="${cliente.P_IVA || ''}">
                    </div>
                </div>
            </form>`;
    }

    showNewClientModal() {
        const modalId = 'newClienteModal';
        const modalBody = this.getClienteFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: '<button type="submit" form="clienteForm" class="btn btn-vp-primary">Crea Cliente</button>' }
        ];
        this.ui.createModal(modalId, 'Nuovo Cliente', modalBody, modalActions, { size: 'modal-lg' });
        document.getElementById('clienteForm')?.addEventListener('submit', (e) => this.handleClienteFormSubmit(e, null));
    }

    viewClient(id) {
        const cliente = this.data.find(c => c.ID_CLIENTE === id);
        if (!cliente) return;
        const commesse = this.app.commesse?.filter(c => c.ID_CLIENTE === id) || [];
        const body = `
            <dl class="row">
                <dt class="col-sm-4">ID</dt><dd class="col-sm-8">${cliente.ID_CLIENTE}</dd>
                <dt class="col-sm-4">Cliente</dt><dd class="col-sm-8">${cliente.Cliente}</dd>
                <dt class="col-sm-4">Ragione Sociale</dt><dd class="col-sm-8">${cliente.Ragione_Sociale || '-'}</dd>
                <dt class="col-sm-4">Indirizzo</dt><dd class="col-sm-8">${[cliente.Indirizzo, cliente.CAP, cliente.Citta, cliente.Provincia].filter(Boolean).join(', ') || '-'}</dd>
                <dt class="col-sm-4">P. IVA</dt><dd class="col-sm-8">${cliente.P_IVA || '-'}</dd>
                <dt class="col-sm-4">Commesse</dt><dd class="col-sm-8">${commesse.length} (${commesse.filter(c => c.Stato_Commessa === 'In corso').length} attive)</dd>
            </dl>`;
        this.ui.createModal(`viewClienteModal_${id}`, `Cliente: ${cliente.Cliente}`, body,
            [{ html: `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>` }]);
    }

    editClient(id) {
        const cliente = this.data.find(c => c.ID_CLIENTE === id);
        if (!cliente) return;
        const modalId = `editClienteModal_${id}`;
        const modalBody = this.getClienteFormHTML(cliente);
        const commesseCount = this.getCommesseCount(id);
        const canDelete = commesseCount === 0;
        const modalActions = [
            { html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled title="Elimina prima le commesse associate"' : ''} id="deleteClienteBtn_${id}">Elimina</button>` },
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: '<button type="submit" form="clienteForm" class="btn btn-vp-primary">Salva Modifiche</button>' }
        ];
        this.ui.createModal(modalId, `Modifica Cliente: ${cliente.Cliente}`, modalBody, modalActions, { size: 'modal-lg' });
        document.getElementById('clienteForm')?.addEventListener('submit', (e) => this.handleClienteFormSubmit(e, id));
        if (canDelete) {
            document.getElementById(`deleteClienteBtn_${id}`)?.addEventListener('click', () => this.handleDeleteCliente(id));
        }
    }

    async handleClienteFormSubmit(event, clienteId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        for (const key in data) { if (data[key] === '') delete data[key]; }
        try {
            const result = clienteId
                ? await this.api.updateCliente(clienteId, data)
                : await this.api.createCliente(data);
            if (result.success) {
                this.ui.showToast(`Cliente ${clienteId ? 'aggiornato' : 'creato'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else {
                throw new Error(result.error || result.message || 'Errore nel salvataggio');
            }
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        }
    }

    async handleDeleteCliente(id) {
        const cliente = this.data.find(c => c.ID_CLIENTE === id);
        if (!cliente) return;
        if (!confirm(`Eliminare definitivamente il cliente "${cliente.Cliente}"?`)) return;
        try {
            const result = await this.api.deleteCliente(id);
            if (result.success) {
                this.ui.showToast('Cliente eliminato!', 'success');
                const modalEl = document.getElementById(`editClienteModal_${id}`);
                if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
                await this.app.loadInitialData();
            } else {
                throw new Error(result.error || result.message || 'Errore eliminazione');
            }
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        }
    }
}

window.ClientiSection = ClientiSection;