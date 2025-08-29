// ============================================================================
// 2. assets/js/modules/sections/base-section.js - PRIORITÀ ALTA
// ============================================================================
class BaseSection {
    constructor(name, apiClient, uiComponents) {
        this.name = name;
        this.api = apiClient;
        this.ui = uiComponents;
        this.data = [];
        this.isLoaded = false;
        this.currentPage = 1;
        this.totalPages = 1;
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
        throw new Error(`loadData must be implemented in ${this.constructor.name}`);
    }

    render() {
        throw new Error(`render must be implemented in ${this.constructor.name}`);
    }

    bindEvents() {
        // Override in subclasses if needed
    }

    getContainer() {
        return document.getElementById('contentArea');
    }

    showLoading() {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = this.ui.createLoadingState(`Caricamento ${this.name}...`);
        }
    }

    updatePageTitle(title, subtitle) {
        const titleEl = document.getElementById('pageTitle');
        const subtitleEl = document.getElementById('pageSubtitle');
        
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
    }

    applyFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        this.render();
    }

    clearFilters() {
        this.filters = {};
        this.render();
    }
}

window.BaseSection = BaseSection;