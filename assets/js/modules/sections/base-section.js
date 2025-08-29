// assets/js/modules/sections/base-section.js
class BaseSection {
    constructor(name, appInstance) {
        if (!appInstance) {
            throw new Error("L'istanza dell'applicazione è richiesta per inizializzare una sezione.");
        }
        this.name = name;
        this.app = appInstance; // Riferimento all'istanza di ManagementApp
        this.api = appInstance.api;
        this.ui = appInstance.ui;
        
        this.isLoaded = false;
        this.data = []; // Dati specifici della sezione
        this.filters = {};
    }

    async initialize() {
        this.showLoading();
        if (!this.isLoaded) {
            await this.loadData();
            this.isLoaded = true;
        }
        this.render();
        this.bindEvents();
    }

    async loadData() {
        // Da implementare nelle sottoclassi
        console.warn(`Metodo loadData non implementato per ${this.name}`);
    }

    render() {
        // Da implementare nelle sottoclassi
        throw new Error(`Metodo render deve essere implementato in ${this.constructor.name}`);
    }
    
    bindEvents() {
        // Opzionale, da implementare nelle sottoclassi se necessario per eventi specifici
    }

    handleAction(action, id, type, targetElement) {
        // Gestore di azioni generico, può essere esteso
        console.log(`Azione '${action}' gestita da BaseSection per l'elemento`, { id, type, targetElement });
        this.ui.showToast(`Azione '${action}' non ancora implementata.`, 'info');
    }

    getContainer() {
        return document.getElementById('contentArea');
    }

    showLoading() {
        this.getContainer().innerHTML = this.ui.createLoadingState(`Caricamento ${this.name}...`);
    }

    updatePageTitle(title, subtitle) {
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;
    }

    updateTopbarActions(html = '') {
        document.getElementById('topbarActions').innerHTML = html;
    }
}