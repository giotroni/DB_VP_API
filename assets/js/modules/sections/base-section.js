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
        this.utils = appInstance.utils;
        
        this.isLoaded = false;
        this.data = []; // Dati specifici della sezione
        this.filters = {};
    }

    async initialize() {
        this.showLoading();
        // Carica sempre i dati freschi quando si visualizza una sezione
        await this.loadData();
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
        // Aggiunge un listener generico per i bottoni con data-action all'interno della sezione
        const container = this.getContainer();
        if(container) {
            container.addEventListener('click', (e) => {
                const actionTarget = e.target.closest('[data-action]');
                if (actionTarget && container.contains(actionTarget)) {
                    if (e.defaultPrevented) return;
                    
                    const { action, id, type } = actionTarget.dataset;
                    this.handleAction(action, id, type, actionTarget, e);
                }
            });
        }
    }

    handleAction(action, id, type, targetElement, event) {
        // Gestore di azioni generico, può essere esteso
        console.warn(`Azione non gestita da BaseSection: ${action}`);
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

