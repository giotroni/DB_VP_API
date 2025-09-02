/**
 * @file collaboratori-section.js
 * @description Classe per la gestione della sezione "Collaboratori".
 */
class CollaboratoriSection extends BaseSection {
    constructor(appInstance) {
        super('Collaboratori', appInstance);
        this.collaboratoriConGiornate = [];
    }

    async loadData() {
        this.collaboratoriConGiornate = this.groupGiornateByCollaboratore();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Collaboratori', 'Anagrafica, giornate e costi del personale');
        this.updateTopbarActions(`<button class="btn btn-vp-primary" data-action="add-collaboratore"><i class="fas fa-user-plus me-2"></i>Nuovo Collaboratore</button>`);
        
        const container = this.getContainer();
        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-4 col-md-6">
                        <label for="searchCollaboratori" class="form-label">Cerca collaboratore</label>
                        <input type="text" class="form-control" id="searchCollaboratori" placeholder="Nome, email, utente...">
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <label for="filterRuolo" class="form-label">Filtra per Ruolo</label>
                        <select class="form-select" id="filterRuolo">
                            <option value="">Tutti i ruoli</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="User">User</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="collaboratoriContainer">
                ${this.renderCollaboratoriCards(this.collaboratoriConGiornate)}
            </div>
        `;

        this.updateStats(this.collaboratoriConGiornate);
        this.bindEvents();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchCollaboratori');
        const filterRuolo = document.getElementById('filterRuolo');

        let debounceTimeout;
        searchInput?.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => this.filterData(), 300);
        });

        filterRuolo?.addEventListener('change', () => this.filterData());
    }
    
    handleAction(action, id) {
        switch (action) {
            case 'add-collaboratore':
                // this.showNewCollaboratoreModal();
                this.ui.showToast('Funzione non ancora implementata.', 'info');
                break;
            case 'edit-collaboratore':
                // this.showEditCollaboratoreModal(id);
                 this.ui.showToast('Funzione non ancora implementata.', 'info');
                break;
            case 'toggle-collaboratore':
                this.toggleCollaboratore(id);
                break;
            default:
                console.warn(`Azione non gestita: ${action}`);
        }
    }

    renderCollaboratoriCards(collaboratori) {
        if (!collaboratori || collaboratori.length === 0) {
            return this.ui.createEmptyState('fas fa-users-slash', 'Nessun Collaboratore Trovato', 'Non ci sono collaboratori che corrispondono ai filtri di ricerca.');
        }
        return collaboratori.map(c => this.createCollaboratoreCard(c)).join('');
    }

    createCollaboratoreCard(collaboratore) {
        const stats = collaboratore.statistics || {};

        const totalGiornateCampo = collaboratore.giornate
            .filter(g => g.Tipo === 'Campo')
            .reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);

        const totalCosto = collaboratore.giornate.reduce((sum, g) => sum + (g.costo_calcolato || 0), 0);

        const accordionId = `accordion-${collaboratore.ID_COLLABORATORE}`;

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-user-circle me-2"></i>${collaboratore.Collaboratore}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary" title="Ruolo"><i class="fas fa-shield-alt me-1"></i>${collaboratore.Ruolo}</span>
                            <span class="badge bg-info text-dark" title="Commesse Assegnate"><i class="fas fa-briefcase me-1"></i>${stats.commesse_assegnate || 0}</span>
                            <span class="badge bg-success" title="Totale Giornate di Campo"><i class="fas fa-tractor me-1"></i>${totalGiornateCampo.toFixed(1)}</span>
                            <span class="badge bg-danger" title="Costo Totale">${this.app.utils.formatCurrency(totalCosto)}</span>
                            <button class="btn btn-sm btn-outline-light" data-action="edit-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}" title="Modifica Collaboratore"><i class="fas fa-pencil-alt"></i></button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${collaboratore.ID_COLLABORATORE}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="mt-2 text-light small">
                        <i class="fas fa-envelope me-1"></i> ${collaboratore.Email} |
                        <i class="fas fa-user me-1"></i> User: ${collaboratore.User}
                    </div>
                </div>
                
                <div class="collapse" id="collaboratore-${collaboratore.ID_COLLABORATORE}">
                    <div class="accordion" id="${accordionId}">

                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-giornate-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-calendar-alt me-2"></i> Riepilogo Giornate
                                </button>
                            </h2>
                            <div id="collapse-giornate-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body p-0">
                                    <div class="management-card-body">
                                        ${this.renderGiornateByMonth(collaboratore.giornateByMonth)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-monitoraggio-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-chart-line me-2"></i> Monitoraggio
                                </button>
                            </h2>
                            <div id="collapse-monitoraggio-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
                                    <p class="text-muted fst-italic">Sezione in fase di sviluppo.</p>
                                </div>
                            </div>
                        </div>

                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-accounting-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> Accounting
                                </button>
                            </h2>
                            <div id="collapse-accounting-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
                                    <p class="text-muted fst-italic">Sezione in fase di sviluppo.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
    }

    renderGiornateByMonth(giornateByMonth) {
        const months = Object.keys(giornateByMonth).sort().reverse();
        if (months.length === 0) {
            return '<p class="text-muted">Nessuna giornata registrata per questo collaboratore.</p>';
        }

        return months.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const giornate = giornateByMonth[monthKey];
            
            const totalCostoMese = giornate.reduce((sum, g) => sum + (g.costo_calcolato || 0), 0);

            return `
                <div class="mb-4">
                    <h6 class="mb-2 d-flex justify-content-between">
                        <span><i class="fas fa-calendar-alt me-2"></i>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                        <span class="fw-bold">Costo Totale Mese: ${this.app.utils.formatCurrency(totalCostoMese)}</span>
                    </h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover table-bordered">
                            <thead class="table-light">
                                <tr>
                                    <th>Data</th>
                                    <th>Commessa</th>
                                    <th>Task</th>
                                    <th>gg</th>
                                    <th>Tipo</th>
                                    <th class="text-end">Costo Gg (€)</th>
                                    <th class="text-end">Costo Spese (€)</th>
                                    <th class="text-end">Costo Totale (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${giornate.map(g => this.renderGiornataRow(g)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderGiornataRow(giornata) {
        const task = this.app.tasks.find(t => String(t.ID_TASK) === String(giornata.ID_TASK));
        const commessa = task ? this.app.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA) : null;
        
        // Estrae i singoli costi e calcola il totale
        const costoGg = parseFloat(giornata.Costo_gg) || 0;
        const costoSpese = parseFloat(giornata.Costo_Spese) || 0;
        const costoTotale = costoGg + costoSpese;

        return `
            <tr>
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${commessa ? commessa.Commessa : 'N/D'}</td>
                <td>${task ? task.Task : 'N/D'}</td>
                <td><span class="badge bg-primary">${giornata.gg}g</span></td>
                <td>${giornata.Tipo}</td>
                <td class="text-end text-success">${this.app.utils.formatCurrency(costoGg)}</td>
                <td class="text-end text-danger">${this.app.utils.formatCurrency(costoSpese)}</td>
                <td class="text-end fw-bold">${this.app.utils.formatCurrency(costoTotale)}</td>
            </tr>
        `;
    }

    filterData() {
        const searchText = document.getElementById('searchCollaboratori')?.value.toLowerCase() || '';
        const selectedRuolo = document.getElementById('filterRuolo')?.value || '';

        const filteredData = this.collaboratoriConGiornate.filter(c => {
            const matchSearch = !searchText ||
                (c.Collaboratore || '').toLowerCase().includes(searchText) ||
                (c.Email || '').toLowerCase().includes(searchText) ||
                (c.User || '').toLowerCase().includes(searchText);
            
            const matchRuolo = !selectedRuolo || c.Ruolo === selectedRuolo;

            return matchSearch && matchRuolo;
        });

        document.getElementById('collaboratoriContainer').innerHTML = this.renderCollaboratoriCards(filteredData);
        this.updateStats(filteredData);
    }
    
    toggleCollaboratore(collaboratoreId, forceState = null) {
        const collapseElement = document.getElementById(`collaboratore-${collaboratoreId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${collaboratoreId}`);
        if (!collapseElement || !toggleBtn) return;

        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        if (forceState === true) bsCollapse.show();
        else if (forceState === false) bsCollapse.hide();
        else bsCollapse.toggle();

        collapseElement.addEventListener('shown.bs.collapse', () => this.updateToggleButton(toggleBtn, true), { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', () => this.updateToggleButton(toggleBtn, false), { once: true });
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
    }

    groupGiornateByCollaboratore() {
        return this.app.collaboratori.map(collaboratore => {
            const giornate = this.app.giornate
                .filter(g => g.ID_COLLABORATORE === collaboratore.ID_COLLABORATORE)
                .map(g => ({
                    ...g,
                    costo_calcolato: this.calculateGiornataCost(g)
                }))
                .sort((a, b) => new Date(b.Data) - new Date(a.Data));

            const giornateByMonth = giornate.reduce((acc, g) => {
                const monthKey = g.Data.substring(0, 7); // "YYYY-MM"
                if (!acc[monthKey]) {
                    acc[monthKey] = [];
                }
                acc[monthKey].push(g);
                return acc;
            }, {});

            return {
                ...collaboratore,
                giornate,
                giornateByMonth
            };
        }).sort((a, b) => a.Collaboratore.localeCompare(b.Collaboratore));
    }
    
    calculateGiornataCost(giornata) {
        if (giornata.Tipo !== 'Campo') return 0;
        
        // Usa i costi pre-calcolati dall'API se disponibili
        if (typeof giornata.Costo_gg !== 'undefined' && typeof giornata.Costo_Spese !== 'undefined') {
            return (parseFloat(giornata.Costo_gg) || 0) + (parseFloat(giornata.Costo_Spese) || 0);
        }

        // Fallback nel caso i campi non siano presenti (logica precedente)
        const tariffa = this.findTariffa(giornata.ID_COLLABORATORE, giornata.Data);
        const tariffaGiornaliera = tariffa ? parseFloat(tariffa.Tariffa_gg) : 0;
        const giorniLavorati = parseFloat(giornata.gg) || 0;
        const valoreSpese = parseFloat(giornata.Valore_spese) || 0;
        return (tariffaGiornaliera * giorniLavorati) + valoreSpese;
    }

    findTariffa(collaboratoreId, data) {
        const dataGiornata = new Date(data);
        const tariffeValide = this.app.tariffe
            .filter(t => t.ID_COLLABORATORE === collaboratoreId && new Date(t.Data_Inizio_Validita) <= dataGiornata)
            .sort((a, b) => new Date(b.Data_Inizio_Validita) - new Date(a.Data_Inizio_Validita));
        return tariffeValide.length > 0 ? tariffeValide[0] : null;
    }
    
    updateStats(data) {
        const collaboratoriCount = data.length;
        const totalGiornate = data.reduce((sum, c) => sum + c.giornate.length, 0);
        const totalCosto = data.reduce((sum, c) => {
            return sum + c.giornate.reduce((s, g) => s + (g.costo_calcolato || 0), 0);
        }, 0);
        
        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriCount, 'Collaboratori Visualizzati')}
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate, "Totale Giornate Registrate")}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totalCosto), 'Costo Totale Stimato')}
                </div>
            `;
        }
    }
}