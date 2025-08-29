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
        
        const container = this.getContainer();
        
        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-building', this.data.length, 'Clienti Totali')}
                ${this.ui.createStatsCard('fas fa-handshake', this.getActiveClients(), 'Clienti Attivi')}
                ${this.ui.createStatsCard('fas fa-chart-line', this.getCommessePerCliente(), 'Media Commesse')}
            </div>

            <div class="search-filters">
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Cerca cliente</label>
                        <input type="text" class="form-control" id="searchClienti" 
                               placeholder="Nome, email, telefono..." value="${this.filters.search || ''}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Tipo Cliente</label>
                        <select class="form-select" id="filterTipoCliente">
                            <option value="">Tutti i tipi</option>
                            <option value="Standard" ${this.filters.tipo === 'Standard' ? 'selected' : ''}>Standard</option>
                            <option value="Premium" ${this.filters.tipo === 'Premium' ? 'selected' : ''}>Premium</option>
                            <option value="Enterprise" ${this.filters.tipo === 'Enterprise' ? 'selected' : ''}>Enterprise</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">&nbsp;</label>
                        <button class="btn btn-vp-primary w-100" onclick="clientiSection.filterClienti()">
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
                            <th>Tipo</th>
                            <th>Email</th>
                            <th>Telefono</th>
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
                <td><span class="badge bg-info">${cliente.Tipo_Cliente || 'Standard'}</span></td>
                <td>${cliente.Email || '-'}</td>
                <td>${cliente.Telefono || '-'}</td>
                <td><span class="badge bg-primary">${this.getCommesseCount(cliente.ID_CLIENTE)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" onclick="clientiSection.viewClient('${cliente.ID_CLIENTE}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action edit" onclick="clientiSection.editClient('${cliente.ID_CLIENTE}')">
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

        if (this.filters.tipo) {
            filtered = filtered.filter(cliente => cliente.Tipo_Cliente === this.filters.tipo);
        }

        return filtered;
    }

    filterClienti() {
        this.applyFilters({
            search: document.getElementById('searchClienti')?.value || '',
            tipo: document.getElementById('filterTipoCliente')?.value || ''
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

    showNewClientModal() {
        // Implementation for new client modal
        this.ui.showToast('Funzione nuovo cliente in sviluppo', 'info');
    }

    viewClient(id) {
        this.ui.showToast(`Visualizzazione cliente ${id} in sviluppo`, 'info');
    }

    editClient(id) {
        this.ui.showToast(`Modifica cliente ${id} in sviluppo`, 'info');
    }
}

window.ClientiSection = ClientiSection;