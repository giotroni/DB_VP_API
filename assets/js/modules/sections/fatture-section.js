/**
 * @file Fatture-Section.js
 * @description Classe per la gestione della sezione "Fatture".
 */
class FattureSection extends BaseSection {
    constructor(appInstance) {
        super('Fatture', appInstance);
    }

    // I dati verranno caricati qui in futuro
    async loadData() {
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Fatture', 'Visualizza e gestisci le fatture');
        this.updateTopbarActions(''); // Nessuna azione per ora

        const container = this.getContainer();
        container.innerHTML = this.ui.createEmptyState(
            'fas fa-file-invoice',
            'Sezione in Sviluppo',
            'La gestione delle fatture sarà disponibile nelle prossime versioni.'
        );
    }
}