// assets/js/modules/api.js - API Client corretto
class APIClient {
    constructor() {
        this.baseURL = 'API/index.php';
        this.authURL = 'API/auth.php'; // URL separato per autenticazione
    }

    // Metodo generico per chiamate API normali
    async request(resource, action, options = {}) {
        // Usa PUT per 'update' e DELETE per 'delete', altrimenti POST se ci sono dati, altrimenti GET
        const { data, params } = options;
        const method = options.method || 
                       (action === 'update' ? 'PUT' : 
                       (action === 'delete' ? 'DELETE' : 
                       (data ? 'POST' : 'GET')));
        
        let url = `${this.baseURL}?resource=${resource}`;
        
        // Se l'ID è nei parametri, costruisci un URL RESTful tipo /resource/id
        let finalParams = { ...params };
        if (finalParams && finalParams.id) {
            url += `&id=${finalParams.id}`;
            delete finalParams.id; // Rimuovi l'id dai parametri di query
        }

        const searchParams = new URLSearchParams();
        if(finalParams) {
             Object.keys(finalParams).forEach(key => {
                if (finalParams[key] !== null && finalParams[key] !== undefined) {
                    searchParams.append(key, finalParams[key]);
                }
            });
        }
       
        if (searchParams.toString()) {
            url += '&' + searchParams.toString();
        }

        const config = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            const responseText = await response.text();

            if (!response.ok) {
                 const errorData = responseText ? JSON.parse(responseText) : { message: `HTTP error! status: ${response.status}` };
                 throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            if (!responseText.trim()) {
                console.warn('Risposta API vuota');
                // Per le DELETE, una risposta vuota può essere un successo
                return { success: method === 'DELETE', message: method === 'DELETE' ? 'Eliminazione completata' : 'Risposta vuota dal server' };
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error(`Errore API ${resource}/${action}:`, error);
            // Rilancia l'errore per gestirlo a livello superiore
            return { success: false, message: error.message };
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

    // Commesse
    async getCommesse(params = {}) { return this.request('commesse', 'getAll', { params }); }
    async createCommessa(data) { return this.request('commesse', 'create', { data }); }
    async updateCommessa(id, data) { return this.request('commesse', 'update', { data, params: { id } }); }
    async deleteCommessa(id) { return this.request('commesse', 'delete', { params: { id } }); }

    // Task
    async getTasks(params = {}) { return this.request('task', 'getAll', { params }); }
    async createTask(data) { return this.request('task', 'create', { data }); }
    async updateTask(id, data) { return this.request('task', 'update', { data, params: { id } }); }
    async deleteTask(id) { return this.request('task', 'delete', { params: { id } }); }

    // Clienti
    async getClienti(params = {}) { return this.request('clienti', 'getAll', { params }); }
    
    // Collaboratori
    async getCollaboratori(params = {}) { return this.request('collaboratori', 'getAll', { params }); }

    // Tariffe
    async getTariffe(params = {}) { return this.request('tariffe', 'getAll', { params }); }

    // Fatture
    async getFatture(params = {}) { return this.request('fatture', 'getAll', { params }); }
    
    // Giornate
    async getGiornate(options = {}) {
        const { limit = 100, page = 1, ...otherParams } = options;
        return this.request('giornate', 'getAll', {
            params: { limit, page, ...otherParams }
        });
    }

    async createGiornata(data) {
        return this.request('giornate', 'create', { data });
    }

    async updateGiornata(id, data) {
        return this.request('giornate', 'update', { data, params: { id } });
    }

    async deleteGiornata(id) {
        return this.request('giornate', 'delete', { params: { id } });
    }

    // Metodo per caricare tutte le giornate paginando
    async getAllGiornate() {
        let allGiornate = [];
        let currentPage = 1;
        let totalPages = 1;

        try {
            do {
                const result = await this.getGiornate({ 
                    limit: 100, 
                    page: currentPage 
                });
                
                if (!result.success) {
                    throw new Error(result.message || 'Errore caricamento pagina giornate');
                }

                allGiornate = allGiornate.concat(result.data.data || []);
                totalPages = result.data.pagination?.pages || 1;
                currentPage++;

            } while (currentPage <= totalPages);

            return { success: true, data: { data: allGiornate } };

        } catch (error) {
            console.error('Errore durante il caricamento paginato delle giornate:', error);
            return { success: false, message: error.message };
        }
    }
}
