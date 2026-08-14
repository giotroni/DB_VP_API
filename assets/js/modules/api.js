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
                 // MODIFICATO: Cerca la chiave 'error' prima di 'message' per compatibilità con il backend
                 throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
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

    // MODIFICATO: Rinominato da resetPassword a forgotPassword per coerenza
    async forgotPassword(email) {
        // L'azione 'reset_password' è quella corretta che il backend si aspetta
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
    async createCliente(data) { return this.request('clienti', 'create', { data }); }
    async updateCliente(id, data) { return this.request('clienti', 'update', { data, params: { id } }); }
    async deleteCliente(id) { return this.request('clienti', 'delete', { params: { id } }); }
    
    // Collaboratori
    async getCollaboratori(params = {}) { return this.request('collaboratori', 'getAll', { params }); }
    async createCollaboratore(data) { return this.request('collaboratori', 'create', { data }); }
    async updateCollaboratore(id, data) { return this.request('collaboratori', 'update', { data, params: { id } }); }
    async deleteCollaboratore(id) { return this.request('collaboratori', 'delete', { params: { id } }); }

    // Visibilità Commesse per utenti 'User'
    async getCommesseVisibilita(collaboratoreId) {
        return this.request('commesse_visibilita', 'getAll', { params: { collaboratore_id: collaboratoreId } });
    }
    async setCommesseVisibilita(collaboratoreId, commesseIds) {
        return this.request('commesse_visibilita', 'set', { data: { ID_COLLABORATORE: collaboratoreId, commesse_ids: commesseIds } });
    }

    // Tariffe
    async getTariffe(params = {}) { return this.request('tariffe', 'getAll', { params }); }
    async createTariffa(data) { return this.request('tariffe', 'create', { data }); }
    async updateTariffa(id, data) { return this.request('tariffe', 'update', { data, params: { id } }); }
    async deleteTariffa(id) { return this.request('tariffe', 'delete', { params: { id } }); }

    // Fatture
    async getFatture(params = {}) { return this.request('fatture', 'getAll', { params }); }
    async createFattura(data) { return this.request('fatture', 'create', { data }); }
    async updateFattura(id, data) { return this.request('fatture', 'update', { data, params: { id } }); }
    async deleteFattura(id) { return this.request('fatture', 'delete', { params: { id } }); }
    
    // Fatture Collaboratori (fatture passive)
    async getFattureCollaboratori(params = {}) { return this.request('fatture_collaboratori', 'getAll', { params }); }
    async createFatturaCollaboratore(data) { return this.request('fatture_collaboratori', 'create', { data }); }
    async updateFatturaCollaboratore(id, data) { return this.request('fatture_collaboratori', 'update', { data, params: { id } }); }
    async deleteFatturaCollaboratore(id) { return this.request('fatture_collaboratori', 'delete', { params: { id } }); }
    async getTotalePagatoCollaboratore(params = {}) { return this.request('fatture_collaboratori', 'summary', { params }); }

    // Registro attività (sezione Statistiche) - solo Admin
    async getAttivita(params = {}) { return this.request('attivita', 'getAll', { params }); }
    
    // Giornate
    async getGiornate(options = {}) {
        const { limit = 1000, page = 1, ...otherParams } = options;
        return this.request('giornate', 'getAll', {
            params: { limit, page, ...otherParams }
        });
    }

    // Convenience wrapper to list images for a giornata (used by the UI)
    async listImages(idGiornata) {
        try {
            const response = await fetch('API/ConsuntivazioneAPI.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_images', id_giornata: idGiornata })
            });
            const result = await response.json();
            return result;
        } catch (err) {
            console.error('Errore listImages API:', err);
            return { success: false, message: err.message };
        }
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
                    limit: 1000, 
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