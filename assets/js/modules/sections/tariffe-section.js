/**
 * @file tariffe-section.js
 * @description Classe per la gestione della sezione "Tariffe".
 */
class TariffeSection extends BaseSection {
    constructor(appInstance) {
        super('Tariffe', appInstance);
    }

    // I dati verranno caricati qui in futuro
    async loadData() {
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Tariffe', 'Visualizza e gestisci le tariffe');
        this.updateTopbarActions(''); // Nessuna azione per ora

        const container = this.getContainer();
        container.innerHTML = this.ui.createEmptyState(
            'fas fa-euro-sign',
            'Sezione in Sviluppo',
            'La gestione delle tariffe sarà disponibile nelle prossime versioni.'
        );
    }
}