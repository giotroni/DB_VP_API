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
        
        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-building', this.data.length, 'Clienti Totali')}
                ${this.ui.createStatsCard('fas fa-handshake', this.getActiveClients(), 'Clienti Attivi')}
                ${this.ui.createStatsCard('fas fa-chart-line', this.getCommessePerCliente(), 'Media Commesse')}
            </div>

            <div class="search-filters">
                <div class="row">
                    <div class="col-md-10">
                        <label class="form-label">Cerca cliente</label>
                        <input type="text" class="form-control" id="searchClienti" 
                               placeholder="Nome, email, telefono..." value="${this.filters.search || ''}">
                    </div>
                    <div class="col-md-2">
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
                            <th>Città</th>
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
        return `
            <tr>
                <td><strong>${cliente.Cliente}</strong></td>
                <td>${cliente.Ragione_Sociale || '-'}</td>
                <td>${cliente.Citta || '-'}</td>
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

    bindEvents() {
        // Bind search input with debounce
        const searchInput = document.getElementById('searchClienti');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.filterClienti(), 300);
            });
        }
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
                (cliente.Email || '').toLowerCase().includes(search) ||
                (cliente.Telefono || '').toLowerCase().includes(search)
            );
        }

        return filtered;
    }

    filterClienti() {
        this.applyFilters({
            search: document.getElementById('searchClienti')?.value || ''
        });
    }

    getActiveClients() {
        return this.data.filter(c => c.Stato !== 'Inattivo').length;
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