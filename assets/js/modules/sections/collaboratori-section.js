// ============================================================================
// 4. assets/js/modules/sections/collaboratori-section.js - PRIORITÀ MEDIA
// ============================================================================
class CollaboratoriSection extends BaseSection {
    constructor(apiClient, uiComponents) {
        super('Collaboratori', apiClient, uiComponents);
    }

    async loadData() {
        try {
            const result = await this.api.getCollaboratori();
            if (result.success) {
                this.data = result.data.data || [];
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Errore caricamento collaboratori:', error);
            this.ui.showToast('Errore nel caricamento dei collaboratori', 'error');
        }
    }

    render() {
        this.updatePageTitle('Gestione Collaboratori', 'Visualizza e gestisci i collaboratori');
        
        const container = this.getContainer();
        
        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-users', this.data.length, 'Collaboratori Totali')}
                ${this.ui.createStatsCard('fas fa-user-check', this.getActiveCollaboratori(), 'Collaboratori Attivi')}
                ${this.ui.createStatsCard('fas fa-tasks', this.getTaskAssegnati(), 'Task Assegnati')}
            </div>

            <div class="management-card">
                <div class="management-card-header">
                    <h5 class="management-card-title">
                        <i class="fas fa-users me-2"></i>
                        Elenco Collaboratori
                    </h5>
                </div>
                <div class="management-card-body">
                    ${this.renderCollaboratoriTable()}
                </div>
            </div>
        `;
    }

    renderCollaboratoriTable() {
        if (this.data.length === 0) {
            return this.ui.createEmptyState(
                'fas fa-users',
                'Nessun collaboratore trovato',
                'Non ci sono collaboratori registrati nel sistema'
            );
        }

        return `
            <div class="table-responsive">
                <table class="table management-table">
                    <thead>
                        <tr>
                            <th>Collaboratore</th>
                            <th>Email</th>
                            <th>Ruolo</th>
                            <th>Commesse</th>
                            <th>Task Monitoraggio</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.map(collaboratore => this.renderCollaboratoreRow(collaboratore)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderCollaboratoreRow(collaboratore) {
        return `
            <tr>
                <td><strong>${collaboratore.Collaboratore}</strong></td>
                <td>${collaboratore.email || '-'}</td>
                <td><span class="badge bg-primary">${collaboratore.ruolo || 'Collaboratore'}</span></td>
                <td><span class="badge bg-success">${this.getCommesseResponsabile(collaboratore.ID_COLLABORATORE)}</span></td>
                <td><span class="badge bg-warning">${this.getTaskMonitoraggio(collaboratore.ID_COLLABORATORE)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" onclick="collaboratoriSection.viewCollaboratore('${collaboratore.ID_COLLABORATORE}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action edit" onclick="collaboratoriSection.editCollaboratore('${collaboratore.ID_COLLABORATORE}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getActiveCollaboratori() {
        return this.data.filter(c => c.stato !== 'Inattivo').length;
    }

    getCommesseResponsabile(collaboratoreId) {
        return window.app?.commesse?.filter(c => c.ID_COLLABORATORE == collaboratoreId).length || 0;
    }

    getTaskMonitoraggio(collaboratoreId) {
        return window.app?.tasks?.filter(t => 
            t.ID_COLLABORATORE == collaboratoreId && t.Tipo === 'Monitoraggio'
        ).length || 0;
    }

    getTaskAssegnati() {
        return window.app?.tasks?.filter(t => 
            t.ID_COLLABORATORE && t.Tipo === 'Monitoraggio'
        ).length || 0;
    }

    showNewCollaboratoreModal() {
        this.ui.showToast('Funzione nuovo collaboratore in sviluppo', 'info');
    }

    viewCollaboratore(id) {
        this.ui.showToast(`Visualizzazione collaboratore ${id} in sviluppo`, 'info');
    }

    editCollaboratore(id) {
        this.ui.showToast(`Modifica collaboratore ${id} in sviluppo`, 'info');
    }
}

window.CollaboratoriSection = CollaboratoriSection;