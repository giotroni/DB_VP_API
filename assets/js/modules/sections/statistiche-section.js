/**
 * @file statistiche-section.js
 * @description Sezione "Statistiche": registro delle attività sul database e
 * dei log applicativi, in ordine di data decrescente.
 *
 * La sezione è riservata al ruolo Admin. Il controllo vero sta nell'API
 * (AttivitaAPI risponde 403 a chiunque altro): qui si evita solo di mostrare
 * una schermata che non caricherebbe.
 *
 * Gli eventi sono ricostruiti dalle colonne Data_Creazione / Data_Modifica delle
 * tabelle, non da un audit log: le cancellazioni non compaiono e di ogni record
 * si vede solo l'ultima modifica. Il limite è scritto anche a schermo.
 */
class StatisticheSection extends BaseSection {
    constructor(appInstance) {
        super('Statistiche', appInstance);
        this.giorni = 7;
        this.attivita = null;
        this.errore = null;
        this.filtri = { ricerca: '', area: '', tipo: '' };
    }

    isAdmin() {
        return this.app.currentUser?.ruolo === 'Admin';
    }

    async loadData() {
        this.errore = null;
        this.attivita = null;

        if (!this.isAdmin()) {
            this.errore = 'Sezione riservata agli amministratori.';
            this.isLoaded = true;
            return;
        }

        const result = await this.app.api.getAttivita({ giorni: this.giorni });
        if (result.success) {
            this.attivita = result.data;
        } else {
            this.errore = result.message || 'Impossibile caricare il registro attività.';
        }
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Statistiche', 'Registro delle attività sul database e dei log');

        const container = this.getContainer();

        if (this.errore) {
            this.updateTopbarActions('');
            container.innerHTML = this.ui.createEmptyState('fas fa-lock', 'Registro non disponibile', this.errore);
            return;
        }

        this.updateTopbarActions(`
            <div class="d-flex gap-2">
                <button class="btn btn-outline-success" data-action="export-attivita" title="Esporta il registro in Excel">
                    <i class="fas fa-file-excel me-2"></i>Esporta Excel
                </button>
                <button class="btn btn-vp-primary" data-action="ricarica-attivita" title="Ricarica il registro">
                    <i class="fas fa-sync-alt me-2"></i>Aggiorna
                </button>
            </div>`);

        const r = this.attivita.riepilogo;
        const periodo = this.attivita.periodo;

        container.innerHTML = `
            <div class="stats-row">
                ${this.ui.createStatsCard('fas fa-database', r.eventi_totali, `Eventi (${periodo.giorni} gg)`)}
                ${this.ui.createStatsCard('fas fa-plus-circle', r.creazioni, 'Inserimenti')}
                ${this.ui.createStatsCard('fas fa-pen', r.modifiche, 'Modifiche')}
                ${this.ui.createStatsCard('fas fa-users', r.utenti_attivi, 'Utenti attivi')}
                ${this.ui.createStatsCard('fas fa-triangle-exclamation', r.errori_log, 'Errori nei log')}
            </div>

            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-3 col-md-6">
                        <label class="form-label">Cerca</label>
                        <input type="text" class="form-control" id="cercaAttivita" placeholder="Descrizione, utente, ID...">
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">Origine</label>
                        <select class="form-select" id="filtroArea">
                            <option value="">Tutte</option>
                            <option value="Management">Management</option>
                            <option value="Consuntivazione">Consuntivazione</option>
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">Tipo</label>
                        <select class="form-select" id="filtroTipo">
                            <option value="">Tutti</option>
                            <option value="creazione">Inserimenti</option>
                            <option value="modifica">Modifiche</option>
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">Periodo</label>
                        <select class="form-select" id="filtroGiorni">
                            <option value="1" ${this.giorni === 1 ? 'selected' : ''}>Ultime 24 ore</option>
                            <option value="7" ${this.giorni === 7 ? 'selected' : ''}>Ultima settimana</option>
                            <option value="30" ${this.giorni === 30 ? 'selected' : ''}>Ultimo mese</option>
                            <option value="90" ${this.giorni === 90 ? 'selected' : ''}>Ultimi 3 mesi</option>
                        </select>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="small text-muted">
                            Dal ${this.formatDateTime(periodo.dal)} a oggi.
                            ${r.troncato ? '<span class="text-warning d-block"><i class="fas fa-triangle-exclamation me-1"></i>Elenco troncato ai 500 eventi più recenti.</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>

            ${this.renderRipartizione(r)}

            <div class="management-card mb-4">
                <div class="management-card-header">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0"><i class="fas fa-clock-rotate-left me-2"></i>Modifiche al database</h5>
                        <span class="badge bg-primary" id="contatoreEventi">${this.attivita.eventi.length} eventi</span>
                    </div>
                </div>
                <div class="management-card-body p-0">
                    <div class="table-responsive" id="tabellaEventi">${this.renderTabellaEventi(this.attivita.eventi)}</div>
                </div>
            </div>

            <div class="management-card mb-4">
                <div class="management-card-header">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0"><i class="fas fa-file-lines me-2"></i>Log applicativi</h5>
                        <span class="badge bg-primary">${this.attivita.log.length} righe</span>
                    </div>
                </div>
                <div class="management-card-body p-0">
                    <div class="table-responsive">${this.renderTabellaLog(this.attivita.log)}</div>
                </div>
            </div>

            <p class="text-muted small">
                <i class="fas fa-circle-info me-1"></i>
                Il registro è ricostruito dalle date di creazione e ultima modifica dei record:
                le eliminazioni non lasciano traccia e di ogni record si vede solo l'ultima modifica.
            </p>`;

        // bindEvents() lo chiama initialize() subito dopo render(): farlo anche
        // qui aggancerebbe due volte il cambio periodo, e ricaricherebbe due volte.
    }

    renderRipartizione(r) {
        const entita = Object.entries(r.per_entita || {});
        const utenti = Object.entries(r.per_utente || {});
        if (entita.length === 0 && utenti.length === 0) return '';

        const badge = (etichetta, valore, classe) =>
            `<span class="badge ${classe} me-2 mb-2">${this.escape(etichetta)}: ${valore}</span>`;

        return `
            <div class="row mb-3">
                <div class="col-md-6 mb-2">
                    <div class="small text-muted mb-1">Per tipo di dato</div>
                    ${entita.map(([k, v]) => badge(k, v, 'bg-dark')).join('')}
                </div>
                <div class="col-md-6 mb-2">
                    <div class="small text-muted mb-1">Per utente</div>
                    ${utenti.map(([k, v]) => badge(k, v, 'bg-secondary')).join('')}
                </div>
            </div>`;
    }

    renderTabellaEventi(eventi) {
        if (!eventi || eventi.length === 0) {
            return `<p class="text-muted p-3 mb-0">Nessuna modifica al database nel periodo selezionato.</p>`;
        }

        const righe = eventi.map(e => `
            <tr>
                <td class="text-nowrap small">${this.formatDateTime(e.data_ora)}</td>
                <td>${this.badgeTipo(e.tipo)}</td>
                <td><span class="badge bg-dark">${this.escape(e.entita)}</span></td>
                <td class="small">${this.escape(e.descrizione || e.id_record)}</td>
                <td class="small text-muted text-nowrap">${this.escape(e.id_record)}</td>
                <td class="small">${this.escape(e.utente)}</td>
                <td class="small text-muted">${this.escape(e.area)}</td>
            </tr>`).join('');

        return `
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Data e ora</th><th>Azione</th><th>Tipo</th>
                        <th>Descrizione</th><th>ID</th><th>Utente</th><th>Origine</th>
                    </tr>
                </thead>
                <tbody>${righe}</tbody>
            </table>`;
    }

    renderTabellaLog(log) {
        if (!log || log.length === 0) {
            return `<p class="text-muted p-3 mb-0">Nessuna riga di log nel periodo selezionato.</p>`;
        }

        const classeLivello = { errore: 'bg-danger', avviso: 'bg-warning text-dark', info: 'bg-secondary' };
        const righe = log.map(r => `
            <tr>
                <td class="text-nowrap small">${this.formatDateTime(r.data_ora)}</td>
                <td><span class="badge ${classeLivello[r.livello] || 'bg-secondary'}">${this.escape(r.livello)}</span></td>
                <td class="small text-muted text-nowrap">${this.escape(r.file)}</td>
                <td class="small"><code class="text-body">${this.escape(r.messaggio)}</code></td>
            </tr>`).join('');

        return `
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr><th>Data e ora</th><th>Livello</th><th>File</th><th>Messaggio</th></tr>
                </thead>
                <tbody>${righe}</tbody>
            </table>`;
    }

    bindEvents() {
        const cerca = document.getElementById('cercaAttivita');
        if (cerca) {
            let timeout;
            cerca.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.filtri.ricerca = cerca.value.toLowerCase();
                    this.applicaFiltri();
                }, 300);
            });
        }

        document.getElementById('filtroArea')?.addEventListener('change', (e) => {
            this.filtri.area = e.target.value;
            this.applicaFiltri();
        });

        document.getElementById('filtroTipo')?.addEventListener('change', (e) => {
            this.filtri.tipo = e.target.value;
            this.applicaFiltri();
        });

        // Il periodo cambia i dati, non la loro presentazione: si ricarica.
        document.getElementById('filtroGiorni')?.addEventListener('change', async (e) => {
            this.giorni = parseInt(e.target.value, 10) || 7;
            await this.initialize();
        });
    }

    handleAction(action) {
        switch (action) {
            case 'ricarica-attivita': this.initialize(); break;
            case 'export-attivita': this.esportaCSV(); break;
            default: console.warn(`Azione non gestita: ${action}`);
        }
    }

    eventiFiltrati() {
        const { ricerca, area, tipo } = this.filtri;
        return (this.attivita?.eventi || []).filter(e => {
            if (area && e.area !== area) return false;
            if (tipo && e.tipo !== tipo) return false;
            if (!ricerca) return true;
            return [e.descrizione, e.utente, e.id_record, e.entita]
                .some(v => (v || '').toString().toLowerCase().includes(ricerca));
        });
    }

    applicaFiltri() {
        const eventi = this.eventiFiltrati();
        const tabella = document.getElementById('tabellaEventi');
        if (tabella) tabella.innerHTML = this.renderTabellaEventi(eventi);
        const contatore = document.getElementById('contatoreEventi');
        if (contatore) contatore.textContent = `${eventi.length} eventi`;
    }

    esportaCSV() {
        const eventi = this.eventiFiltrati();
        if (eventi.length === 0) {
            this.ui.showToast('Nessun evento da esportare con i filtri attivi.', 'info');
            return;
        }

        const intestazioni = ['Data e ora', 'Azione', 'Tipo', 'Descrizione', 'ID', 'Utente', 'Origine', 'Tabella'];
        const righe = eventi.map(e => [
            e.data_ora, e.tipo, e.entita, e.descrizione, e.id_record, e.utente, e.area, e.tabella
        ]);

        const csv = '﻿' + [intestazioni, ...righe]
            .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attivita_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.ui.showToast('Esportazione completata.', 'success');
    }

    badgeTipo(tipo) {
        return tipo === 'creazione'
            ? '<span class="badge bg-success"><i class="fas fa-plus me-1"></i>Inserito</span>'
            : '<span class="badge bg-info text-dark"><i class="fas fa-pen me-1"></i>Modificato</span>';
    }

    formatDateTime(valore) {
        if (!valore) return 'N/D';
        // Le date arrivano come 'YYYY-MM-DD HH:MM:SS': Safari non le parsa senza la T.
        const d = new Date(String(valore).replace(' ', 'T'));
        if (isNaN(d)) return valore;
        return d.toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    escape(testo) {
        return this.app.utils.escapeHtml(String(testo ?? ''));
    }
}
