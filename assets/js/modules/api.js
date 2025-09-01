// assets/js/modules/api.js - API Client corretto
class APIClient {
    constructor() {
        this.baseURL = 'API/index.php';
        this.authURL = 'API/auth.php'; // URL separato per autenticazione
    }

    // Metodo generico per chiamate API normali
    async request(resource, action, options = {}) {
        const { method = 'GET', data, params } = options;
        
        let url = `${this.baseURL}?resource=${resource}&action=${action}`;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    searchParams.append(key, params[key]);
                }
            });
            if (searchParams.toString()) {
                url += '&' + searchParams.toString();
            }
        }

        const config = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorBody = await response.json().catch(() => null);
                const errorMessage = errorBody?.errors?.join(', ') || errorBody?.error || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const responseText = await response.text();
            
            if (!responseText.trim()) {
                return { success: true, message: 'Operazione completata con successo.', data: null };
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error(`Errore API ${resource}/${action}:`, error);
            throw error;
        }
    }


    // Metodo specifico per chiamate di autenticazione
    async authRequest(action, data = {}) {
        const config = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, ...data })
        };

        try {
            const response = await fetch(this.authURL, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            
            if (!responseText.trim()) {
                console.warn('Risposta auth vuota');
                return { success: false, message: 'Risposta vuota dal server' };
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error(`Errore Auth ${action}:`, error);
            throw error;
        }
    }

    // Metodi di autenticazione - usano authRequest invece di request
    async login(email, password) {
        return this.authRequest('login', { email, password });
    }

    async logout() {
        return this.authRequest('logout');
    }

    async checkAuth() {
        return this.authRequest('check_auth');
    }

    async changePassword(currentPassword, newPassword) {
        return this.authRequest('change_password', { 
            current_password: currentPassword, 
            new_password: newPassword 
        });
    }

    async resetPassword(email) {
        return this.authRequest('reset_password', { email });
    }

    // Commesse - usano request normale
    async getCommesse() {
        return this.request('commesse', 'getAll');
    }

    async createCommessa(data) {
        return this.request('commesse', 'create', {
            method: 'POST',
            data
        });
    }

    async updateCommessa(id, data) {
        return this.request('commesse', 'update', {
            method: 'PUT',
            data,
            params: { id }
        });
    }

    async deleteCommessa(id) {
        return this.request('commesse', 'delete', {
            method: 'DELETE',
            params: { id }
        });
    }

    // Task
    async getTasks(options = {}) {
        const { limit = 100, page } = options;
        const params = { limit };
        if (page) params.page = page;
        
        return this.request('task', 'getAll', { params });
    }

    async createTask(data) {
        return this.request('task', 'create', {
            method: 'POST',
            data
        });
    }

    async updateTask(id, data) {
        return this.request('task', 'update', {
            method: 'PUT',
            data,
            params: { id }
        });
    }

    async deleteTask(id) {
        return this.request('task', 'delete', {
            method: 'DELETE',
            params: { id }
        });
    }

    // Giornate
    async getGiornate(options = {}) {
        const { limit = 100, page = 1 } = options;
        return this.request('giornate', 'getAll', {
            params: { limit, page }
        });
    }

    // Metodo per caricare tutte le giornate paginando
    async getAllGiornate() {
        let allGiornate = [];
        let currentPage = 1;
        let totalPages = 1;
        do {
            const result = await this.request('giornate', 'getAll', { params: { limit: 200, page: currentPage } });
            if (!result.success) throw new Error(result.message);
            allGiornate = allGiornate.concat(result.data.data || []);
            totalPages = result.data.pagination?.pages || 1;
            currentPage++;
        } while (currentPage <= totalPages);
        return { success: true, data: { data: allGiornate } };
    }

    async createGiornata(data) {
        return this.request('giornate', 'create', {
            method: 'POST',
            data
        });
    }

    async updateGiornata(id, data) {
        return this.request('giornate', 'update', {
            method: 'PUT',
            data,
            params: { id }
        });
    }

    async updateGiornateConfirmation(ids, status) {
        return this.request('giornate', 'batchUpdateConfirmation', {
            method: 'POST',
            data: {
                ids: ids,
                confermata: status
            }
        });
    }

    /**
     * NUOVO: Metodo per eliminare una giornata.
     * @param {string} id L'ID della giornata da eliminare.
     */
    async deleteGiornata(id) {
        return this.request('giornate', 'delete', {
            method: 'DELETE',
            params: { id }
        });
    }
    // Clienti
    async getClienti() {
        return this.request('clienti', 'getAll');
    }

    // Collaboratori
    async getCollaboratori() {
        return this.request('collaboratori', 'getAll');
    }

    // Tariffe
    async getTariffe() {
        return this.request('tariffe', 'getAll');
    }

    // Fatture
    async getFatture() {
        return this.request('fatture', 'getAll');
    }
}

// Esporta per uso globale
window.APIClient = APIClient;