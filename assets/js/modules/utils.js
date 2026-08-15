// ============================================================================
// 5. assets/js/modules/utils.js - PRIORITÀ BASSA
// ============================================================================
class Utils {
    static formatDate(dateString) {
        if (!dateString) return '-';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('it-IT');
        } catch (error) {
            return dateString;
        }
    }

    static formatCurrency(amount) {
        const n = parseFloat(amount);
        const valore = isNaN(n) ? 0 : n;

        // useGrouping: 'always' e' necessario: la locale italiana ha
        // minimumGroupingDigits = 2, quindi per impostazione predefinita NON
        // separa le migliaia sui numeri di quattro cifre (1550,00 invece di
        // 1.550,00) mentre le separa da cinque in su. Il risultato era una
        // pagina con due formati diversi affiancati.
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            useGrouping: 'always'
        }).format(valore);
    }

    static debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    static generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Le anagrafiche arrivano dall'API nell'ordine del database (per ID o per
    // data di apertura): in un menu a tendina serve invece l'ordine alfabetico.
    // localeCompare con sensitivity 'base' ignora maiuscole e accenti, numeric
    // mette CR 2 prima di CR 10.
    static ordinaPerNome(lista, campo) {
        return (lista || []).slice().sort((a, b) =>
            String(a?.[campo] ?? '').localeCompare(String(b?.[campo] ?? ''), 'it', { sensitivity: 'base', numeric: true })
        );
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.Utils = Utils;