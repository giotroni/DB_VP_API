/**
 * @file statistiche-section.js
 * @description Classe per la gestione della sezione "Statistiche".
 */
class StatisticheSection extends BaseSection {
    constructor(appInstance) {
        super('Statistiche', appInstance);
    }

    // I dati verranno caricati qui in futuro
    async loadData() {
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Statistiche', 'Visualizza e gestisci le statistiche');
        this.updateTopbarActions(''); // Nessuna azione per ora

        const container = this.getContainer();
        container.innerHTML = this.ui.createEmptyState(
            'fas fa-chart-bar',
            'Sezione in Sviluppo',
            'La gestione delle statistiche sarà disponibile nelle prossime versioni.'
        );
    }
}