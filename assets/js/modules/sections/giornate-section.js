/**
 * @file giornate-section.js
 * @description Classe per la gestione della sezione "Giornate".
 */
class GiornateSection extends BaseSection {
    constructor(appInstance) {
        super('Giornate', appInstance);
    }

    // I dati verranno caricati qui in futuro
    async loadData() {
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Giornate', 'Visualizza e gestisci le giornate');
        this.updateTopbarActions(''); // Nessuna azione per ora

        const container = this.getContainer();
        container.innerHTML = this.ui.createEmptyState(
            'fas fa-calendar-alt',
            'Sezione in Sviluppo',
            'La gestione delle giornate sarà disponibile nelle prossime versioni.'
        );
    }
}