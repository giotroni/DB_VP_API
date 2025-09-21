/**
 * @file collaboratori-section.js
 * @description Classe per la gestione della sezione "Collaboratori".
 */
class CollaboratoriSection extends BaseSection {
    constructor(appInstance) {
        super('Collaboratori', appInstance);
        this.collaboratoriConGiornate = [];
    }

    // Return date displayed as dd/mm/yy (or empty string if invalid)
    formatDateShort(dateString) {
        if (!dateString) return '';
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return '';
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            return `${dd}/${mm}/${yy}`;
        } catch (e) {
            return '';
        }
    }

    async loadData() {
        this.collaboratoriConGiornate = this.groupGiornateByCollaboratore();
        this.isLoaded = true;
    }

    render() {
        this.updatePageTitle('Gestione Collaboratori', 'Anagrafica, giornate e costi del personale');
    this.updateTopbarActions(`<div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="add-collaboratore"><i class="fas fa-user-plus me-2"></i>Nuovo Collaboratore</button><button class="btn btn-outline-secondary" data-action="export-collaboratori"><i class="fas fa-file-export me-2"></i>Esporta Excel</button></div>`);
        
        const container = this.getContainer();
        // prepara le opzioni per anno e mese (riuso lo stesso pattern usato altrove)
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2024; y <= currentYear + 1; y++) { yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}">${y}</label></li>`; }
        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        let monthOptions = months.map((month, index) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${index + 1}">${month}</label></li>`).join('');

        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-4 col-md-6">
                        <label for="filterCollaboratore" class="form-label">Filtra per Collaboratore</label>
                        <select class="form-select" id="filterCollaboratore">
                            <option value="">Tutti i collaboratori</option>
                            ${Array.isArray(this.app.collaboratori) ? this.app.collaboratori.map(c => `<option value="${c.ID_COLLABORATORE}">${this.app.utils.escapeHtml(c.Collaboratore)}</option>`).join('') : ''}
                        </select>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <label for="filterRuolo" class="form-label">Filtra per Ruolo</label>
                        <select class="form-select" id="filterRuolo">
                            <option value="">Tutti i ruoli</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="User">User</option>
                        </select>
                    </div>
                    <div class="col-lg-1 col-md-3"><label class="form-label">Anno</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterAnno" aria-labelledby="filterAnnoBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnno">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${yearOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-3"><label class="form-label">Mese</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMese" aria-labelledby="filterMeseBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMese">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${monthOptions}</ul></div></div>
                </div>
            </div>
            <div id="collaboratoriContainer">
                ${this.renderCollaboratoriCards(this.collaboratoriConGiornate)}
            </div>
        `;

        // salva l'ultima lista mostrata (inizialmente tutte le collaboratori raggruppati)
        this.lastFilteredCollaboratori = this.collaboratoriConGiornate;
        this.updateStats(this.collaboratoriConGiornate);
        this.bindEvents();
    }

    bindEvents() {
        const filterCollaboratore = document.getElementById('filterCollaboratore');
        const filterRuolo = document.getElementById('filterRuolo');

        filterCollaboratore?.addEventListener('change', () => this.filterData());
        filterRuolo?.addEventListener('change', () => this.filterData());

        // setup per i filtri Anno/Mese (multi-select dropdown) - comportamenti simili a commesse-task-section
        const setupMultiSelectFilter = (filterId, buttonId) => {
            const filterContainer = document.getElementById(filterId);
            const filterButton = document.getElementById(buttonId);
            if (!filterContainer || !filterButton) return;
            filterContainer.addEventListener('change', () => {
                const checked = filterContainer.querySelectorAll('input:checked');
                if (checked.length === 0) { filterButton.textContent = 'Tutti'; } 
                else if (checked.length === 1) { filterButton.textContent = checked[0].parentElement.textContent.trim(); } 
                else { filterButton.textContent = `${checked.length} selezionati`; }
                this.filterData();
            });
        };
        setupMultiSelectFilter('filterAnno', 'filterAnnoBtn');
        setupMultiSelectFilter('filterMese', 'filterMeseBtn');
        // Gestore per i link "Seleziona/Deseleziona" interni ai dropdown
        ['filterAnno','filterMese'].forEach(filterId => {
            const container = document.getElementById(filterId);
            if (!container) return;
            container.addEventListener('click', (ev) => {
                const anchor = ev.target.closest('[data-action="toggle-all-filter"]');
                if (!anchor) return;
                ev.preventDefault();
                const inputs = container.querySelectorAll('input[type="checkbox"]');
                if (inputs.length === 0) return;
                const allChecked = Array.from(inputs).every(cb => cb.checked);
                inputs.forEach(cb => cb.checked = !allChecked);
                container.dispatchEvent(new Event('change'));
            });
        });
    }
    
    handleAction(action, id) {
        switch (action) {
            case 'add-collaboratore':
                this.showNewCollaboratoreModal();
                break;
            case 'export-collaboratori':
                this.exportCollaboratoriToExcel();
                break;
            case 'edit-collaboratore':
                this.showEditCollaboratoreModal(id);
                break;
            case 'toggle-collaboratore':
                this.toggleCollaboratore(id);
                break;
            default:
                console.warn(`Azione non gestita: ${action}`);
        }
    }

    // Esporta i collaboratori attualmente visualizzati (filtrati) in CSV compatibile Excel
    exportCollaboratoriToExcel() {
    // Usa l'ultima vista filtrata se presente, altrimenti usa la lista completa raggruppata
    const data = Array.isArray(this.lastFilteredCollaboratori) ? this.lastFilteredCollaboratori : (Array.isArray(this.collaboratoriConGiornate) ? this.collaboratoriConGiornate : this.groupGiornateByCollaboratore());

        // Costruiamo una rappresentazione semplice: una riga per collaboratore e alcune colonne chiave
        const headers = ['ID_COLLABORATORE','Collaboratore','Email','User','Ruolo','Commesse_Assegnate','Totale_Giornate','Giornate_Campo','Rimborso_Attivita','Valore_Monitoraggio','Accounting'];

        const rows = (Array.isArray(data) ? data : []).map(coll => {
            const giornateTot = coll.giornate.length;
            const giornateCampo = coll.giornate.reduce((s,g) => s + ((g.Tipo === 'Campo') ? (parseFloat(g.gg) || 0) : 0), 0);
            const rimborso = coll.giornate.reduce((s,g) => s + (g.costo_calcolato || 0), 0);
            const monitor = this.computeMonitoraggioTotalForCollaboratore(coll) || 0;
            const accounting = this.computeAccountingTotalForCollaboratore(coll) || 0;
            return [coll.ID_COLLABORATORE, coll.Collaboratore, coll.Email || '', coll.User || '', coll.Ruolo || '', coll.statistics?.commesse_assegnate || 0, giornateTot, giornateCampo, rimborso, monitor, accounting];
        });

        const csvLines = [headers.join(';')];
        rows.forEach(r => {
            csvLines.push(r.map(v => typeof v === 'number' ? v.toString().replace('.', ',') : `"${(v||'').toString().replace(/"/g,'""')}"`).join(';'));
        });

        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collaboratori_export_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.ui.showToast('Esportazione avviata.', 'success');
    }

    // ========================================================================
    // MODALI: Collaboratore
    // ========================================================================

    showNewCollaboratoreModal() {
        const modalTitle = 'Crea Nuovo Collaboratore';
        const modalId = 'newCollaboratoreModal';
        const modalBody = this.getCollaboratoreFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Collaboratore</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCollaboratoreFormListeners(`${modalId}_form`);
    }

    showEditCollaboratoreModal(collaboratoreId) {
        const coll = this.app.collaboratori.find(c => c.ID_COLLABORATORE === collaboratoreId);
        if (!coll) { this.ui.showToast('Collaboratore non trovato.', 'error'); return; }
        const modalTitle = `Modifica Collaboratore: ${coll.Collaboratore}`;
        const modalId = `editCollaboratoreModal_${collaboratoreId}`;
        const modalBody = this.getCollaboratoreFormHTML(coll);
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" data-collaboratore-id="${collaboratoreId}" title="Elimina collaboratore">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteCollaboratore(collaboratoreId)
        };
        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCollaboratoreFormListeners(`${modalId}_form`);
    }

    // Elimina collaboratore: consentita solo se non ci sono tariffe collegate
    async handleDeleteCollaboratore(collaboratoreId) {
        // Verifica tariffe locali (se presenti nella app)
        const relatedTariffe = Array.isArray(this.app.tariffe) ? this.app.tariffe.filter(t => String(t.ID_COLLABORATORE) === String(collaboratoreId)) : [];
        if (relatedTariffe.length > 0) {
            this.ui.showToast('Impossibile eliminare: esistono tariffe collegate a questo collaboratore. Elimina prima le tariffe.', 'error');
            return;
        }

        // Mostra modal di conferma forte (digita ELIMINA)
        const modalId = `confirmDeleteCollaboratore_${collaboratoreId}`;
        const modalHtml = `
            <div class="modal-body">
                <p>Sei sicuro di voler eliminare il collaboratore <strong>${collaboratoreId}</strong>? Questa operazione è irreversibile.</p>
                <p>Per confermare, digita <strong>ELIMINA</strong> nella casella sottostante.</p>
                <input type="text" id="confirmInputColl_${collaboratoreId}" class="form-control mb-2" placeholder="Digita ELIMINA per confermare">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" id="confirmBtnColl_${collaboratoreId}" class="btn btn-danger" disabled>Elimina</button>
            </div>
        `;
        this.ui.createModal(modalId, 'Conferma Eliminazione Collaboratore', modalHtml, [], { size: 'modal-sm' });

        const input = document.getElementById(`confirmInputColl_${collaboratoreId}`);
        const btn = document.getElementById(`confirmBtnColl_${collaboratoreId}`);
        input?.addEventListener('input', () => {
            btn.disabled = input.value.trim().toUpperCase() !== 'ELIMINA';
        });
        btn?.addEventListener('click', async () => {
            try {
                if (!(this.api && typeof this.api.deleteCollaboratore === 'function')) {
                    this.ui.showToast('Operazione non eseguita: endpoint API deleteCollaboratore non disponibile.', 'error');
                    return;
                }
                const res = await this.api.deleteCollaboratore(collaboratoreId);
                if (!res || !res.success) throw new Error(res?.message || 'Errore nella cancellazione del collaboratore');
                this.ui.showToast('Collaboratore eliminato', 'success');
                bootstrap.Modal.getInstance(document.getElementById(modalId))?.hide();
                // Chiudi anche il modal di edit se aperto
                const editModal = document.getElementById(`editCollaboratoreModal_${collaboratoreId}`);
                if (editModal) bootstrap.Modal.getInstance(editModal)?.hide();
                await this.app.loadInitialData();
            } catch (err) {
                this.ui.showToast(err.message, 'error');
            }
        });
    }

    getCollaboratoreFormHTML(collaboratore = {}) {
        const formId = collaboratore.ID_COLLABORATORE ? `editCollaboratoreModal_${collaboratore.ID_COLLABORATORE}_form` : 'newCollaboratoreModal_form';
        const ruoloOptions = ['Admin', 'Manager', 'User'];
        const ruoliHtml = ruoloOptions.map(r => `<option value="${r}" ${(collaboratore.Ruolo === r) ? 'selected' : ''}>${r}</option>`).join('');
        // Costruisci tabella tariffe basandoci su this.app.tariffe
        const allTariffe = Array.isArray(this.app.tariffe) ? this.app.tariffe.filter(t => String(t.ID_COLLABORATORE) === String(collaboratore.ID_COLLABORATORE)) : [];
        const tariffeStandard = allTariffe.filter(t => !t.ID_COMMESSA || t.ID_COMMESSA === null || t.ID_COMMESSA === '');
        const tariffePerCommessa = allTariffe.filter(t => t.ID_COMMESSA && t.ID_COMMESSA !== null && t.ID_COMMESSA !== '');

        const commessaNameById = (id) => {
            const c = this.app.commesse?.find(cm => String(cm.ID_COMMESSA) === String(id));
            return c ? c.Commessa : id;
        };

        // Unify standard and per-commessa tariffs into a single combined dataset
        const unifiedTariffe = [];
        // Add standard (Commessa = 'Standard')
        tariffeStandard.forEach(t => {
            unifiedTariffe.push({
                ID_TARIFFA: t.ID_TARIFFA || '',
                Dal: t.Dal || t.Data_Inizio_Validita || '',
                Commessa: 'Standard',
                Tariffa_gg: parseFloat(t.Tariffa_gg) || 0,
                Spese_comprese: t.Spese_comprese || ''
            });
        });
        // Add per-commessa (resolve commessa name)
        tariffePerCommessa.forEach(t => {
            unifiedTariffe.push({
                ID_TARIFFA: t.ID_TARIFFA || '',
                Dal: t.Dal || t.Data_Inizio_Validita || '',
                Commessa: commessaNameById(t.ID_COMMESSA),
                Tariffa_gg: parseFloat(t.Tariffa_gg) || 0,
                Spese_comprese: t.Spese_comprese || ''
            });
        });

        // If none, show a single empty-row message
        const unifiedRows = unifiedTariffe.length > 0 ? unifiedTariffe.map(t => {
            const speseBadge = (String(t.Spese_comprese).trim().toLowerCase() === 'si')
                ? `<span class="badge bg-success text-white">Si</span>`
                : `<span class="badge bg-secondary text-white">No</span>`;
            return `
            <tr data-id="${t.ID_TARIFFA}" data-collaboratore="${collaboratore.ID_COLLABORATORE}">
                <td class="tariffa-dal-cell" data-dal="${t.Dal || ''}">${this.formatDateShort(t.Dal)}</td>
                <td class="tariffa-commessa-cell">${t.Commessa}</td>
                <td class="tariffa-val-cell text-end">${this.app.utils.formatCurrency(t.Tariffa_gg)}</td>
                <td class="tariffa-spese-cell">${speseBadge}</td>
                <td class="text-center tariffa-actions-cell">
                    <button type="button" class="btn btn-sm btn-outline-primary tariffa-edit" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger tariffa-delete" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `}).join('') : `<tr><td colspan="5" class="text-muted">Nessuna tariffa configurata per questo collaboratore</td></tr>`;

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-12 mb-3"><label for="Collaboratore" class="form-label">Nome e Cognome</label><input type="text" class="form-control" id="Collaboratore" name="Collaboratore" value="${collaboratore.Collaboratore || ''}" required></div>
                    <div class="col-md-6 mb-3"><label for="User" class="form-label">User</label><input type="text" class="form-control" id="User" name="User" value="${collaboratore.User || ''}"></div>
                    <div class="col-md-6 mb-3"><label for="Email" class="form-label">Email</label><input type="email" class="form-control" id="Email" name="Email" value="${collaboratore.Email || ''}"></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Ruolo" class="form-label">Ruolo</label><select class="form-select" id="Ruolo" name="Ruolo">${ruoliHtml}</select></div>
                    <div class="col-md-6 mb-3"><label for="PIVA" class="form-label">Partita IVA <small class="text-muted">(facoltativa)</small></label><input type="text" class="form-control" id="PIVA" name="PIVA" value="${collaboratore.PIVA || ''}"></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Password" class="form-label">Password <small class="text-muted">(facoltativa: lascia vuoto per non inviare)</small></label><input type="password" class="form-control" id="Password" name="PWD" value=""></div>
                    <div class="col-md-6 mb-3 align-self-end"><div class="form-text text-muted">Password e Partita IVA sono facoltativi: se lasci vuoti, non verranno inviati al server (la password esistente non verrà sovrascritta durante la modifica).</div></div>
                </div>

                <hr>
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Tariffe</h6>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="addTariffaBtn_${collaboratore.ID_COLLABORATORE}">Aggiungi Tariffa</button>
                </div>
                <div class="row">
                    <div class="col-12 mb-3">
                        <div class="table-responsive">
                            <table class="table table-sm table-striped table-bordered">
                                <thead class="table-light"><tr><th>Dal</th><th>Commessa</th><th class="text-end">Tariffa/gg</th><th>Spese Incluse</th></tr></thead>
                                <tbody>
                                    ${unifiedRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    addCollaboratoreFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const collId = form.id.includes('editCollaboratoreModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleCollaboratoreFormSubmit(e, collId));

        // Event delegation for tariff actions (edit/delete) inside this form's modal
        form.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.tariffa-edit');
            const deleteBtn = e.target.closest('.tariffa-delete');
            if (editBtn) {
                const row = editBtn.closest('tr');
                this.startEditTariffaRow(row);
            } else if (deleteBtn) {
                const row = deleteBtn.closest('tr');
                this.confirmDeleteTariffa(row);
            }
        });

        // Add tariffa button (if present)
        const addBtn = document.getElementById(`addTariffaBtn_${collId}`);
        if (addBtn) {
            addBtn.addEventListener('click', () => this.insertEmptyTariffaRow(collId));
        }
    }

    // Insert an empty editable row at the top of the tariffs table for the collaborator
    insertEmptyTariffaRow(collaboratoreId) {
        const modalForm = document.getElementById(`editCollaboratoreModal_${collaboratoreId}_form`);
        if (!modalForm) return;
        const tbody = modalForm.querySelector('tbody');
        if (!tbody) return;

        // Create a new temporary row with empty fields
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', '');
        tr.setAttribute('data-collaboratore', collaboratoreId);
        tr.classList.add('editing');

        tr.innerHTML = `
            <td class="tariffa-dal-cell"><input type="date" class="form-control form-control-sm tariffa-edit-dal" value=""></td>
            <td class="tariffa-commessa-cell">
                <select class="form-select form-select-sm tariffa-edit-commessa"><option value="">Standard</option>$
            </td>
            <td class="tariffa-val-cell text-end"><input type="number" step="0.01" class="form-control form-control-sm tariffa-edit-val" value="0"></td>
            <td class="tariffa-spese-cell">
                <select class="form-select form-select-sm tariffa-edit-spese"><option value="Si">Si</option><option value="No" selected>No</option></select>
            </td>
            <td class="text-center tariffa-actions-cell">
                <button type="button" class="btn btn-sm btn-success tariffa-save me-1"><i class="fas fa-check"></i></button>
                <button type="button" class="btn btn-sm btn-secondary tariffa-cancel"><i class="fas fa-times"></i></button>
            </td>
        `;

        // Populate commessa select options
        const select = tr.querySelector('.tariffa-edit-commessa');
        if (this.app && Array.isArray(this.app.commesse)) {
            this.app.commesse.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.ID_COMMESSA;
                opt.textContent = c.Commessa;
                select.appendChild(opt);
            });
        }

        // Attach handlers to save/cancel
        tr.querySelector('.tariffa-save').addEventListener('click', async () => {
            await this.createTariffaFromRow(tr);
        });
        tr.querySelector('.tariffa-cancel').addEventListener('click', () => tr.remove());

        // Insert at top
        tbody.prepend(tr);
    }

    async createTariffaFromRow(row) {
        const collId = row.getAttribute('data-collaboratore');
        const dal = row.querySelector('.tariffa-edit-dal')?.value || null;
        const idCommessa = row.querySelector('.tariffa-edit-commessa')?.value || null;
        const tariffa = parseFloat(row.querySelector('.tariffa-edit-val')?.value || '0') || 0;
        const spese = row.querySelector('.tariffa-edit-spese')?.value || 'No';

        // Build payload for create
        const payload = {
            ID_COLLABORATORE: collId,
            Dal: dal,
            ID_COMMESSA: idCommessa || null,
            Tariffa_gg: tariffa,
            Spese_comprese: spese
        };

        if (!(this.api && typeof this.api.createTariffa === 'function')) {
            this.ui.showToast('Endpoint API per creare tariffa non disponibile.', 'error');
            return;
        }

        try {
            const res = await this.api.createTariffa(payload);
            if (!res || !res.success) throw new Error(res?.message || 'Errore creazione tariffa');
            this.ui.showToast('Tariffa creata', 'success');
            await this.app.loadInitialData();
            // Re-open modal to refresh rows
            this.showEditCollaboratoreModal(collId);
        } catch (err) {
            this.ui.showToast(err.message, 'error');
        }
    }

    // Inline edit: replace cells with inputs and show save/cancel
    startEditTariffaRow(row) {
        if (!row) return;
        // Prevent multiple editors
        if (row.classList.contains('editing')) return;
        row.classList.add('editing');

        const dalCell = row.querySelector('.tariffa-dal-cell');
        const commessaCell = row.querySelector('.tariffa-commessa-cell');
        const valCell = row.querySelector('.tariffa-val-cell');
        const speseCell = row.querySelector('.tariffa-spese-cell');
        const actionsCell = row.querySelector('.tariffa-actions-cell');

        const dalVal = dalCell.textContent.trim();
        const commessaVal = commessaCell.textContent.trim();
        const valVal = valCell.textContent.trim().replace(/[€\s\.]/g, '').replace(',', '.');
        const speseVal = speseCell.textContent.trim();

    // dalVal may be a display string; prefer ISO stored in data-dal for the input value
    let isoDal = dalCell.getAttribute('data-dal') || dalVal;
    // helper: if isoDal is in display format dd/mm/yy or dd/mm/yyyy convert to ISO yyyy-mm-dd
    const normalizeToISO = (s) => {
        if (!s) return '';
        // already ISO?
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!m) return s;
        let [ , dd, mm, yy ] = m;
        if (yy.length === 2) {
            // assume 20xx for two-digit years
            yy = '20' + yy;
        }
        dd = String(Number(dd)).padStart(2, '0');
        mm = String(Number(mm)).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };
    isoDal = normalizeToISO(isoDal);
    dalCell.innerHTML = `<input type="date" class="form-control form-control-sm tariffa-edit-dal" value="${isoDal}">`;
        // Build a select for commessa: include a 'Standard' option (empty value) + existing commesse
        let commessaSelect = `<select class="form-select form-select-sm tariffa-edit-commessa">`;
        commessaSelect += `<option value="">Standard</option>`;
        if (this.app && Array.isArray(this.app.commesse)) {
            this.app.commesse.forEach(c => {
                const selected = (String(c.Commessa).trim() === String(commessaVal).trim() || String(c.ID_COMMESSA) === String(commessaVal)) ? 'selected' : '';
                commessaSelect += `<option value="${c.ID_COMMESSA}" ${selected}>${this.app.utils.escapeHtml(c.Commessa)}</option>`;
            });
        }
        commessaSelect += `</select>`;
        commessaCell.innerHTML = commessaSelect;
        valCell.innerHTML = `<input type="number" step="0.01" class="form-control form-control-sm tariffa-edit-val" value="${valVal}">`;
        // store original values on the row so save can fall back if only one field changed
    row.dataset.origDal = isoDal || '';
        row.dataset.origCommessa = commessaVal || '';
        row.dataset.origVal = valVal || '';
        row.dataset.origSpese = speseVal || '';

        // Spese incluse should be a select between 'Si' and 'No'
        const speseSelect = `
            <select class="form-select form-select-sm tariffa-edit-spese">
                <option value="Si" ${speseVal === 'Si' ? 'selected' : ''}>Si</option>
                <option value="No" ${speseVal !== 'Si' ? 'selected' : ''}>No</option>
            </select>
        `;
        speseCell.innerHTML = speseSelect;

        actionsCell.innerHTML = `
            <button type="button" class="btn btn-sm btn-success tariffa-save me-1"><i class="fas fa-check"></i></button>
            <button type="button" class="btn btn-sm btn-secondary tariffa-cancel"><i class="fas fa-times"></i></button>
        `;

        // wire save/cancel
        actionsCell.querySelector('.tariffa-save').addEventListener('click', () => this.saveEditedTariffaRow(row));
        actionsCell.querySelector('.tariffa-cancel').addEventListener('click', () => this.cancelEditTariffaRow(row));
    }

    cancelEditTariffaRow(row) {
        if (!row) return;
        row.classList.remove('editing');
        // Re-render modal to restore original state (simpler than reconstructing row)
        const collId = row.getAttribute('data-collaboratore');
        const modalForm = document.getElementById(`editCollaboratoreModal_${collId}_form`);
        if (modalForm) {
            // Close and re-open modal content by reloading app data and re-creating modal
            // Simpler: re-create modal content from current collaborator data
            const coll = this.app.collaboratori.find(c => String(c.ID_COLLABORATORE) === String(collId));
            if (coll) {
                const modal = modalForm.closest('.modal');
                if (modal) {
                    const body = modal.querySelector('.modal-body');
                    if (body) body.innerHTML = this.getCollaboratoreFormHTML(coll);
                }
            }
        }
    }

    async saveEditedTariffaRow(row) {
        const id = row.getAttribute('data-id');
        const collId = row.getAttribute('data-collaboratore');
        // Read inputs defensively so editing only one field (e.g. Spese) won't clear others
        const dalInput = row.querySelector('.tariffa-edit-dal');
        const dal = dalInput ? dalInput.value : '';
        const commessaInput = row.querySelector('.tariffa-edit-commessa');
        const commessa = commessaInput ? commessaInput.value : '';
        const valInput = row.querySelector('.tariffa-edit-val');
        const valRaw = valInput ? String(valInput.value).trim() : '';
        const val = valRaw !== '' ? (parseFloat(valRaw.replace(',', '.')) || 0) : null;
        const speseInput = row.querySelector('.tariffa-edit-spese');
        const spese = speseInput ? speseInput.value : '';

        // Resolve commessa to ID_COMMESSA; if user didn't change it use original displayed value
        let idCommessa = null;
        const effectiveCommessa = (commessa !== '') ? commessa : (row.dataset.origCommessa || '');
        if (effectiveCommessa) {
            const commessaTrim = String(effectiveCommessa).trim();
            const commessaLower = commessaTrim.toLowerCase();
            if (commessaTrim === '' || commessaLower === 'null' || commessaLower === 'generale' || commessaLower.startsWith('stand')) {
                idCommessa = null;
            } else {
                const found = (this.app && Array.isArray(this.app.commesse))
                    ? this.app.commesse.find(c => String(c.ID_COMMESSA) === commessaTrim || String(c.Commessa).trim() === commessaTrim)
                    : null;
                idCommessa = found ? found.ID_COMMESSA : null;
            }
        }

        // Fallback to original values if inputs left blank
        const finalDal = dal || row.dataset.origDal || null;
        const parsedOrigVal = parseFloat(String(row.dataset.origVal || '0').replace(',', '.')) || 0;
        const finalVal = (val !== null) ? val : parsedOrigVal;
        const finalSpese = (spese && String(spese).trim() !== '') ? spese : (row.dataset.origSpese || 'No');

        const payload = {
            ID_TARIFFA: id,
            ID_COLLABORATORE: collId,
            Dal: finalDal || null,
            ID_COMMESSA: idCommessa || null,
            Tariffa_gg: finalVal,
            Spese_comprese: finalSpese
        };

        // Ensure API method exists; otherwise alert the user that changes won't be persisted
        if (!(this.api && typeof this.api.updateTariffa === 'function')) {
            this.ui.showToast('Operazione non eseguita: endpoint API updateTariffa non disponibile.', 'error');
            return;
        }

        try {
            const res = await this.api.updateTariffa(id, payload);
            if (!res || !res.success) throw new Error(res?.message || 'Errore nell aggiornamento della tariffa');
            this.ui.showToast('Tariffa aggiornata', 'success');
            // Refresh modal content to show updated values
            await this.app.loadInitialData();
            const modal = document.getElementById(`editCollaboratoreModal_${collId}`);
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                bsModal.hide();
                // reopen
                this.showEditCollaboratoreModal(collId);
            }
        } catch (err) {
            this.ui.showToast(err.message, 'error');
        }
    }

    // Confirm delete with strong confirmation (type 'ELIMINA')
    confirmDeleteTariffa(row) {
        if (!row) return;
        const id = row.getAttribute('data-id');
        const collId = row.getAttribute('data-collaboratore');
        const modalId = `confirmDeleteTariffa_${id}`;
        const modalHtml = `
            <div class="modal-body">
                <p>Sei sicuro di voler eliminare la tariffa <strong>${id}</strong>?</p>
                <p>Questa operazione è irreversibile. Per confermare, digita <strong>ELIMINA</strong> nella casella sottostante.</p>
                <input type="text" id="confirmInput_${id}" class="form-control mb-2" placeholder="Digita ELIMINA per confermare">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" id="confirmBtn_${id}" class="btn btn-danger" disabled>Elimina</button>
            </div>
        `;
        this.ui.createModal(modalId, 'Conferma Eliminazione', modalHtml, [], { size: 'modal-sm' });

        // Wire up input listener
        const input = document.getElementById(`confirmInput_${id}`);
        const btn = document.getElementById(`confirmBtn_${id}`);
        input?.addEventListener('input', () => {
            btn.disabled = input.value.trim().toUpperCase() !== 'ELIMINA';
        });
        btn?.addEventListener('click', async () => {
            try {
                if (!(this.api && typeof this.api.deleteTariffa === 'function')) {
                    this.ui.showToast('Operazione non eseguita: endpoint API deleteTariffa non disponibile.', 'error');
                    return;
                }
                const res = await this.api.deleteTariffa(id);
                if (!res || !res.success) throw new Error(res?.message || 'Errore nella cancellazione');
                this.ui.showToast('Tariffa eliminata', 'success');
                bootstrap.Modal.getInstance(document.getElementById(modalId))?.hide();
                await this.app.loadInitialData();
                // Re-open collaborator edit modal if it was open
                const editModal = document.getElementById(`editCollaboratoreModal_${collId}`);
                if (editModal) this.showEditCollaboratoreModal(collId);
            } catch (err) {
                this.ui.showToast(err.message, 'error');
            }
        });
    }

    async handleCollaboratoreFormSubmit(event, collaboratoreId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        // Normalizza campi vuoti: converti stringhe vuote in null
        for (const k in data) { if (data[k] === '') data[k] = null; }
        // Se è un update, rimuovi i campi nulli per evitare di sovrascrivere valori nel backend
        if (collaboratoreId) {
            Object.keys(data).forEach(k => { if (data[k] === null) delete data[k]; });
        } else {
            // Creazione: non inviare PWD o PIVA se vuoti (sono facoltativi)
            ['PWD', 'PIVA'].forEach(k => { if (data[k] === null) delete data[k]; });
        }
        try {
            const result = collaboratoreId
                ? await this.api.updateCollaboratore(collaboratoreId, data)
                : await this.api.createCollaboratore(data);
            if (result.success) {
                this.ui.showToast(`Collaboratore ${collaboratoreId ? 'aggiornato' : 'creato'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio del collaboratore.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    renderCollaboratoriCards(collaboratori) {
        if (!collaboratori || collaboratori.length === 0) {
            return this.ui.createEmptyState('fas fa-users-slash', 'Nessun Collaboratore Trovato', 'Non ci sono collaboratori che corrispondono ai filtri di ricerca.');
        }
        return collaboratori.map(c => this.createCollaboratoreCard(c)).join('');
    }

    createCollaboratoreCard(collaboratore) {
        const stats = collaboratore.statistics || {};

        const totalGiornateCampo = collaboratore.giornate
            .filter(g => g.Tipo === 'Campo')
            .reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);

        const totalCosto = collaboratore.giornate.reduce((sum, g) => sum + (g.costo_calcolato || 0), 0);

        // Calcolo del valore di Accounting per questo collaboratore (totale e suddiviso per mese)
        // Implementiamo una funzione che per ogni commessa di cui il collaboratore è responsabile
        // somma i valori maturati delle giornate (rispettando il filtro di periodo se presente) e moltiplica per la commissione.
        const computeAccountingByMonth = () => {
            const resultByMonth = {}; // { 'YYYY-MM': value }
            const byCommessa = {}; // { commessaId: { name, total, byMonth: { 'YYYY-MM': value } } }
            let total = 0;
            const commesse = Array.isArray(this.app.commesse) ? this.app.commesse : [];
            const tasks = Array.isArray(this.app.tasks) ? this.app.tasks : [];
            const giornateAll = Array.isArray(this.app.giornate) ? this.app.giornate : [];

            commesse.forEach(commessa => {
                if (String(commessa.ID_COLLABORATORE) !== String(collaboratore.ID_COLLABORATORE)) return;
                const commissione = parseFloat(commessa.Commissione) || 0;
                const commId = String(commessa.ID_COMMESSA || '');
                if (!byCommessa[commId]) byCommessa[commId] = { name: commessa.Commessa || commId, total: 0, byMonth: {} };

                const tasksOfCommessa = tasks.filter(t => String(t.ID_COMMESSA) === String(commessa.ID_COMMESSA) && t.Tipo === 'Campo');
                tasksOfCommessa.forEach(task => {
                    const allGiornate = giornateAll.filter(g => String(g.ID_TASK) === String(task.ID_TASK));
                    const giornateConsiderate = this.activeDateFilter
                        ? allGiornate.filter(g => {
                            const d = new Date(g.Data);
                            const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(d.getFullYear());
                            const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(d.getMonth() + 1);
                            return yearMatch && monthMatch;
                        })
                        : allGiornate;

                    giornateConsiderate.forEach(g => {
                        const valore = parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0;
                        const contrib = valore * commissione;
                        const monthKey = (g.Data || '').substring(0,7) || '0000-00';

                        if (!resultByMonth[monthKey]) resultByMonth[monthKey] = 0;
                        resultByMonth[monthKey] += contrib;

                        if (!byCommessa[commId].byMonth[monthKey]) byCommessa[commId].byMonth[monthKey] = 0;
                        byCommessa[commId].byMonth[monthKey] += contrib;

                        byCommessa[commId].total += contrib;
                        total += contrib;
                    });
                });
            });
            return { total, byMonth: resultByMonth, byCommessa };
        };

        const accounting = computeAccountingByMonth();
        const accountingValue = accounting.total;

    // Valore Monitoraggio per i task assegnati a questo collaboratore
    const monitoraggioValue = this.computeMonitoraggioTotalForCollaboratore(collaboratore);

    const accordionId = `accordion-${collaboratore.ID_COLLABORATORE}`;
    // breakdown Monitoraggio per UI (totale + per mese + per commessa)
    const monitoraggioStruct = this.computeMonitoraggioByMonthForCollaboratore(collaboratore);
    const hasMonitorTasks = Array.isArray(this.app.tasks) && this.app.tasks.some(t => t.Tipo === 'Monitoraggio' && String(t.ID_COLLABORATORE) === String(collaboratore.ID_COLLABORATORE));

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-user-circle me-2"></i>${collaboratore.Collaboratore}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary" title="Ruolo"><i class="fas fa-shield-alt me-1"></i>${collaboratore.Ruolo}</span>
                            <span class="badge bg-info text-dark" title="Commesse Assegnate"><i class="fas fa-briefcase me-1"></i>${stats.commesse_assegnate || 0}</span>
                            <span class="badge bg-success" title="Totale Giornate di Campo"><i class="fas fa-tractor me-1"></i>${totalGiornateCampo.toFixed(1)}</span>
                            ${typeof stats.tariffa_standard !== 'undefined' ? `<span class="badge bg-warning text-dark" title="Tariffa standard attuale"><i class="fas fa-money-bill-wave me-1"></i>${this.app.utils.formatCurrency(stats.tariffa_standard)}</span>` : ''}
                            <span class="badge bg-danger" title="RImborso Totale">${this.app.utils.formatCurrency(totalCosto)}</span>
                            ${monitoraggioValue > 0 ? `<span class="badge bg-info text-dark" title="Valore Monitoraggio"><i class="fas fa-bell me-1"></i>${this.app.utils.formatCurrency(monitoraggioValue)}</span>` : ''}
                            ${accountingValue > 0 ? `<span class="badge bg-secondary text-dark" title="Accounting"><i class="fas fa-file-invoice-dollar me-1"></i>${this.app.utils.formatCurrency(accountingValue)}</span>` : ''}
                            <button class="btn btn-sm btn-outline-light" data-action="edit-collaboratore" data-id="${collaboratore.ID_COLLABORATORE}" title="Modifica Collaboratore"><i class="fas fa-pencil-alt"></i></button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${collaboratore.ID_COLLABORATORE}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                        <div class="mt-2 text-light small">
                        <i class="fas fa-envelope me-1"></i> ${collaboratore.Email} |
                        <i class="fas fa-user me-1"></i> User: ${collaboratore.User}
                    </div>
                </div>
                
                <div class="collapse" id="collaboratore-${collaboratore.ID_COLLABORATORE}">
                    <div class="accordion" id="${accordionId}">

                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-giornate-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-calendar-alt me-2"></i> Riepilogo Giornate
                                </button>
                            </h2>
                            <div id="collapse-giornate-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body p-0">
                                    <div class="management-card-body">
                                        ${this.renderGiornateByMonth(collaboratore.giornateByMonth)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        ${hasMonitorTasks ? `
                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-monitoraggio-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-bell me-2"></i> Monitoraggio
                                </button>
                            </h2>
                            <div id="collapse-monitoraggio-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
                                    <div class="row">
                                        <div class="col-12 mb-2">
                                            <dl class="row">
                                                <dt class="col-sm-4">Valore Monitoraggio</dt>
                                                <dd class="col-sm-8"><strong>${this.app.utils.formatCurrency(monitoraggioStruct.total || 0)}</strong></dd>
                                            </dl>
                                        </div>
                                        <div class="col-12">
                                            <h6 class="small text-muted">Dettaglio mensile</h6>
                                            ${Object.keys(monitoraggioStruct.byMonth || {}).length === 0 ? '<p class="text-muted small">Nessun valore di monitoraggio per il periodo selezionato.</p>' : `
                                                <div class="table-responsive">
                                                    <table class="table table-sm table-striped">
                                                        <thead class="table-light"><tr><th>Mese</th><th class="text-end">Monitoraggio</th></tr></thead>
                                                        <tbody>
                                                            ${Object.keys(monitoraggioStruct.byMonth).sort().reverse().map(mk => {
                                                                const parts = mk.split('-');
                                                                const label = (mk === '0000-00') ? mk : new Date(parts[0], parts[1]-1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
                                                                const collapseId = `mon-${collaboratore.ID_COLLABORATORE}-${mk.replace('-', '_')}`;
                                                                // build per-commessa rows for this month
                                                                const commessaRows = Object.keys(monitoraggioStruct.byCommessa || {}).map(cid => {
                                                                    const comm = monitoraggioStruct.byCommessa[cid];
                                                                    const val = (comm && comm.byMonth && comm.byMonth[mk]) ? comm.byMonth[mk] : 0;
                                                                    return val > 0 ? `<tr><td>${this.app.utils.escapeHtml(comm.name)}</td><td class="text-end">${this.app.utils.formatCurrency(val)}</td></tr>` : '';
                                                                }).filter(r => r && r.trim() !== '').join('');

                                                                const detailRow = commessaRows.length ? `<tr class="collapse" id="${collapseId}"><td colspan="2"><div class="table-responsive"><table class="table table-sm table-borderless mb-0"><tbody>${commessaRows}</tbody></table></div></td></tr>` : '';

                                                                return `<tr><td><button class="btn btn-sm btn-outline-secondary me-2" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false"><i class="fas fa-chevron-down"></i></button>${label.charAt(0).toUpperCase() + label.slice(1)}</td><td class="text-end"><strong>${this.app.utils.formatCurrency(monitoraggioStruct.byMonth[mk])}</strong></td></tr>${detailRow}`;
                                                            }).join('')}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}

                        ${stats.commesse_assegnate && Number(stats.commesse_assegnate) > 0 ? `<div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-accounting-${collaboratore.ID_COLLABORATORE}" aria-expanded="false">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> Accounting
                                </button>
                            </h2>
                            <div id="collapse-accounting-${collaboratore.ID_COLLABORATORE}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
                                    <div class="row">
                                        <div class="col-12 mb-2">
                                            <dl class="row">
                                                <dt class="col-sm-4">Accounting (Responsabile Commessa)</dt>
                                                <dd class="col-sm-8"><strong>${this.app.utils.formatCurrency(accountingValue)}</strong></dd>
                                            </dl>
                                        </div>
                                        <div class="col-12">
                                            <h6 class="small text-muted">Dettaglio mensile</h6>
                                            ${Object.keys(accounting.byMonth).length === 0 ? '<p class="text-muted small">Nessun valore di accounting per il periodo selezionato.</p>' : `
                                                <div class="table-responsive">
                                                    <table class="table table-sm table-striped">
                                                        <thead class="table-light"><tr><th>Mese</th><th class="text-end">Accounting</th></tr></thead>
                                                        <tbody>
                                                            ${Object.keys(accounting.byMonth).sort().reverse().map(mk => {
                                                                const parts = mk.split('-');
                                                                const label = (mk === '0000-00') ? mk : new Date(parts[0], parts[1]-1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
                                                                const collapseId = `acc-${collaboratore.ID_COLLABORATORE}-${mk.replace('-', '_')}`;
                                                                // build per-commessa rows for this month
                                                                const commessaRows = Object.keys(accounting.byCommessa || {}).map(cid => {
                                                                    const comm = accounting.byCommessa[cid];
                                                                    const val = (comm && comm.byMonth && comm.byMonth[mk]) ? comm.byMonth[mk] : 0;
                                                                    return val > 0 ? `<tr><td>${this.app.utils.escapeHtml(comm.name)}</td><td class="text-end">${this.app.utils.formatCurrency(val)}</td></tr>` : '';
                                                                }).filter(r => r && r.trim() !== '').join('');

                                                                const detailRow = commessaRows.length ? `<tr class="collapse" id="${collapseId}"><td colspan="2"><div class="table-responsive"><table class="table table-sm table-borderless mb-0"><tbody>${commessaRows}</tbody></table></div></td></tr>` : '';

                                                                return `<tr><td><button class="btn btn-sm btn-outline-secondary me-2" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false"><i class="fas fa-chevron-down"></i></button>${label.charAt(0).toUpperCase() + label.slice(1)}</td><td class="text-end"><strong>${this.app.utils.formatCurrency(accounting.byMonth[mk])}</strong></td></tr>${detailRow}`;
                                                            }).join('')}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>` : ''}

                    </div>
                </div>
            </div>`;
    }

    renderGiornateByMonth(giornateByMonth) {
        const months = Object.keys(giornateByMonth).sort().reverse();
        if (months.length === 0) {
            return '<p class="text-muted">Nessuna giornata registrata per questo collaboratore.</p>';
        }
        return months.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const giornate = giornateByMonth[monthKey];
            const totalCostoMese = giornate.reduce((sum, g) => sum + (g.costo_calcolato || 0), 0);

            // id univoco per collapse: include monthKey (YYYY-MM) e un prefisso
            const collapseId = `giornate-${monthKey.replace('-', '_')}`;

            return `
                <div class="mb-4">
                    <h6 class="mb-2 d-flex justify-content-between align-items-center">
                        <button class="btn btn-sm btn-outline-secondary me-2" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}"><i class="fas fa-chevron-down"></i></button>
                        <span class="flex-grow-1"><i class="fas fa-calendar-alt me-2"></i>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                        <span class="fw-bold">RImborso Totale Mese: ${this.app.utils.formatCurrency(totalCostoMese)}</span>
                    </h6>
                    <div class="collapse" id="${collapseId}">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover table-bordered">
                                <thead class="table-light">
                                    <tr>
                                        <th>Data</th>
                                        <th>Commessa</th>
                                        <th>Task</th>
                                        <th>gg</th>
                                        <th>Tipo</th>
                                        <th class="text-end">Costo Gg (€)</th>
                                        <th class="text-end">Costo Spese (€)</th>
                                        <th class="text-end">RImborso Totale (€)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${giornate.map(g => this.renderGiornataRow(g)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderGiornataRow(giornata) {
        const task = this.app.tasks.find(t => String(t.ID_TASK) === String(giornata.ID_TASK));
        const commessa = task ? this.app.commesse.find(c => c.ID_COMMESSA === task.ID_COMMESSA) : null;
        
        // Estrae i singoli costi e calcola il totale
        const costoGg = parseFloat(giornata.Costo_gg) || 0;
        const costoSpese = parseFloat(giornata.Costo_Spese) || 0;
        const costoTotale = costoGg + costoSpese;

        return `
            <tr>
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${commessa ? commessa.Commessa : 'N/D'}</td>
                <td>${task ? task.Task : 'N/D'}</td>
                <td><span class="badge bg-primary">${giornata.gg}g</span></td>
                <td>${giornata.Tipo}</td>
                <td class="text-end text-success">${this.app.utils.formatCurrency(costoGg)}</td>
                <td class="text-end text-danger">${this.app.utils.formatCurrency(costoSpese)}</td>
                <td class="text-end fw-bold">${this.app.utils.formatCurrency(costoTotale)}</td>
            </tr>
        `;
    }

    filterData() {
        const filterCollaboratoreVal = document.getElementById('filterCollaboratore')?.value || '';
        const selectedRuolo = document.getElementById('filterRuolo')?.value || '';

        const selectedYears = Array.from(document.querySelectorAll('#filterAnno input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMese input:checked')).map(el => parseInt(el.value));

        this.activeDateFilter = (selectedYears.length > 0 || selectedMonths.length > 0) ? { years: selectedYears, months: selectedMonths } : null;

        let filteredData = this.collaboratoriConGiornate
            .filter(c => {
                const matchCollaboratore = !filterCollaboratoreVal || String(c.ID_COLLABORATORE) === String(filterCollaboratoreVal);
                const matchRuolo = !selectedRuolo || c.Ruolo === selectedRuolo;
                return matchCollaboratore && matchRuolo;
            });

        // Se è attivo un filtro di data, applichiamo il filtro alle giornate per collaboratore
        if (this.activeDateFilter) {
            filteredData = filteredData.map(c => {
                const giornateNelPeriodo = c.giornate.filter(g => {
                    const dataGiornata = new Date(g.Data);
                    const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(dataGiornata.getFullYear());
                    const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(dataGiornata.getMonth() + 1);
                    return yearMatch && monthMatch;
                });
                // Manteniamo anche la mappa giornateByMonth aggiornata per l'interfaccia
                const giornateByMonth = giornateNelPeriodo.reduce((acc, g) => {
                    const monthKey = g.Data.substring(0,7);
                    if (!acc[monthKey]) acc[monthKey] = [];
                    acc[monthKey].push(g);
                    return acc;
                }, {});
                return { ...c, giornate: giornateNelPeriodo, giornateByMonth };
            }).filter(c => c.giornate.length > 0);
        }

        document.getElementById('collaboratoriContainer').innerHTML = this.renderCollaboratoriCards(filteredData);
        // memorizza l'ultima vista filtrata per l'export
        this.lastFilteredCollaboratori = filteredData;
        this.updateStats(filteredData);
    }
    
    toggleCollaboratore(collaboratoreId, forceState = null) {
        const collapseElement = document.getElementById(`collaboratore-${collaboratoreId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${collaboratoreId}`);
        if (!collapseElement || !toggleBtn) return;

        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        if (forceState === true) bsCollapse.show();
        else if (forceState === false) bsCollapse.hide();
        else bsCollapse.toggle();

        collapseElement.addEventListener('shown.bs.collapse', () => this.updateToggleButton(toggleBtn, true), { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', () => this.updateToggleButton(toggleBtn, false), { once: true });
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
    }

    groupGiornateByCollaboratore() {
        return this.app.collaboratori.map(collaboratore => {
            const giornate = this.app.giornate
                .filter(g => g.ID_COLLABORATORE === collaboratore.ID_COLLABORATORE)
                .map(g => ({
                    ...g,
                    costo_calcolato: this.calculateGiornataCost(g)
                }))
                .sort((a, b) => new Date(b.Data) - new Date(a.Data));

            const giornateByMonth = giornate.reduce((acc, g) => {
                const monthKey = g.Data.substring(0, 7); // "YYYY-MM"
                if (!acc[monthKey]) {
                    acc[monthKey] = [];
                }
                acc[monthKey].push(g);
                return acc;
            }, {});

            return {
                ...collaboratore,
                giornate,
                giornateByMonth
            };
        }).sort((a, b) => a.Collaboratore.localeCompare(b.Collaboratore));
    }
    
    calculateGiornataCost(giornata) {
        if (giornata.Tipo !== 'Campo') return 0;
        
        // Usa i costi pre-calcolati dall'API se disponibili
        if (typeof giornata.Costo_gg !== 'undefined' && typeof giornata.Costo_Spese !== 'undefined') {
            return (parseFloat(giornata.Costo_gg) || 0) + (parseFloat(giornata.Costo_Spese) || 0);
        }

        // Fallback nel caso i campi non siano presenti (logica precedente)
        const tariffa = this.findTariffa(giornata.ID_COLLABORATORE, giornata.Data);
        const tariffaGiornaliera = tariffa ? parseFloat(tariffa.Tariffa_gg) : 0;
        const giorniLavorati = parseFloat(giornata.gg) || 0;
        const valoreSpese = parseFloat(giornata.Valore_spese) || 0;
        return (tariffaGiornaliera * giorniLavorati) + valoreSpese;
    }

    findTariffa(collaboratoreId, data) {
        const dataGiornata = new Date(data);
        const tariffeValide = this.app.tariffe
            .filter(t => t.ID_COLLABORATORE === collaboratoreId && new Date(t.Data_Inizio_Validita) <= dataGiornata)
            .sort((a, b) => new Date(b.Data_Inizio_Validita) - new Date(a.Data_Inizio_Validita));
        return tariffeValide.length > 0 ? tariffeValide[0] : null;
    }

    // Calcola il valore di Accounting totale per un singolo collaboratore rispettando i filtri attivi
    computeAccountingTotalForCollaboratore(collaboratore) {
        const commesse = Array.isArray(this.app.commesse) ? this.app.commesse : [];
        const tasks = Array.isArray(this.app.tasks) ? this.app.tasks : [];
        const giornateAll = Array.isArray(this.app.giornate) ? this.app.giornate : [];
        let total = 0;

        commesse.forEach(commessa => {
            if (String(commessa.ID_COLLABORATORE) !== String(collaboratore.ID_COLLABORATORE)) return;
            const commissione = parseFloat(commessa.Commissione) || 0;
            const tasksOfCommessa = tasks.filter(t => String(t.ID_COMMESSA) === String(commessa.ID_COMMESSA) && t.Tipo === 'Campo');
            tasksOfCommessa.forEach(task => {
                const allGiornate = giornateAll.filter(g => String(g.ID_TASK) === String(task.ID_TASK));
                const giornateConsiderate = this.activeDateFilter
                    ? allGiornate.filter(g => {
                        const d = new Date(g.Data);
                        const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(d.getFullYear());
                        const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(d.getMonth() + 1);
                        return yearMatch && monthMatch;
                    })
                    : allGiornate;

                giornateConsiderate.forEach(g => {
                    const valore = parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0;
                    total += (valore * commissione);
                });
            });
        });

        return total;
    }

    // Calcola il valore totale di Monitoraggio per un collaboratore
    // Regole:
    // - Per ogni task di tipo 'Monitoraggio' assegnato al collaboratore (task.ID_COLLABORATORE)
    //   calcolare: somma dei valori maturati delle giornate (di tutti i collaboratori) per i task
    //   della stessa commessa * Valore_gg (tariffa indicata nel task di tipo Monitoraggio)
    // - Rispetta i filtri di data attivi (this.activeDateFilter) quando presenti
    computeMonitoraggioTotalForCollaboratore(collaboratore) {
        const tasks = Array.isArray(this.app.tasks) ? this.app.tasks : [];
        const giornateAll = Array.isArray(this.app.giornate) ? this.app.giornate : [];
        let total = 0;

        // Trova i task di tipo Monitoraggio assegnati a questo collaboratore
        const monitorTasks = tasks.filter(t => t.Tipo === 'Monitoraggio' && String(t.ID_COLLABORATORE) === String(collaboratore.ID_COLLABORATORE));
        if (monitorTasks.length === 0) return 0;

        monitorTasks.forEach(mtask => {
            const tariffa = parseFloat(mtask.Valore_gg) || 0;
            if (tariffa <= 0) return;

            // Prendi tutte le giornate associate alla commessa del task (non solo quelle del collaboratore)
            const commessaId = mtask.ID_COMMESSA;
            if (!commessaId) return;

            // Trova tutti i task della commessa
            const tasksOfCommessa = tasks.filter(t => String(t.ID_COMMESSA) === String(commessaId) && t.Tipo === 'Campo');

            // Somma i valori maturati (valore_calcolato / Valore_calcolato) di tutte le giornate dei task della commessa
            let sommaValoreCampo = 0;
            tasksOfCommessa.forEach(t => {
                const giornate = giornateAll.filter(g => String(g.ID_TASK) === String(t.ID_TASK));
                const giornateConsiderate = this.activeDateFilter
                    ? giornate.filter(g => {
                        const d = new Date(g.Data);
                        const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(d.getFullYear());
                        const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(d.getMonth() + 1);
                        return yearMatch && monthMatch;
                    })
                    : giornate;

                giornateConsiderate.forEach(g => {
                    const valore = parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0;
                    sommaValoreCampo += valore;
                });
            });

            total += sommaValoreCampo * tariffa;
        });

        return total;
    }

    // Ritorna struttura dettagliata del Monitoraggio per collaboratore:
    // { total, byMonth: { 'YYYY-MM': value }, byCommessa: { commessaId: { name, total, byMonth: { 'YYYY-MM': value } } } }
    computeMonitoraggioByMonthForCollaboratore(collaboratore) {
        const tasks = Array.isArray(this.app.tasks) ? this.app.tasks : [];
        const giornateAll = Array.isArray(this.app.giornate) ? this.app.giornate : [];
        const commesse = Array.isArray(this.app.commesse) ? this.app.commesse : [];

        const result = { total: 0, byMonth: {}, byCommessa: {} };

        // tasks di monitoraggio assegnati al collaboratore
        const monitorTasks = tasks.filter(t => t.Tipo === 'Monitoraggio' && String(t.ID_COLLABORATORE) === String(collaboratore.ID_COLLABORATORE));
        if (monitorTasks.length === 0) return result;

        monitorTasks.forEach(mtask => {
            const tariffa = parseFloat(mtask.Valore_gg) || 0;
            if (tariffa <= 0) return;
            const commId = String(mtask.ID_COMMESSA || '');
            const commObj = commesse.find(c => String(c.ID_COMMESSA) === commId) || { Commessa: commId };

            // assicura struttura per la commessa
            if (!result.byCommessa[commId]) result.byCommessa[commId] = { name: commObj.Commessa || commId, total: 0, byMonth: {} };

            // prendi tutti i task di tipo 'Campo' della commessa
            const tasksOfCommessa = tasks.filter(t => String(t.ID_COMMESSA) === commId && t.Tipo === 'Campo');

            // somma valori dalle giornate di questi task rispettando filtri
            let sommaValoreCampo = 0;
            tasksOfCommessa.forEach(t => {
                const giornate = giornateAll.filter(g => String(g.ID_TASK) === String(t.ID_TASK));
                const giornateConsiderate = this.activeDateFilter
                    ? giornate.filter(g => {
                        const d = new Date(g.Data);
                        const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(d.getFullYear());
                        const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(d.getMonth() + 1);
                        return yearMatch && monthMatch;
                    })
                    : giornate;

                giornateConsiderate.forEach(g => {
                    const valore = parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0;
                    sommaValoreCampo += valore;
                    const monthKey = (g.Data || '').substring(0,7) || '0000-00';
                    // accumula a livello commessa per mese
                    if (!result.byCommessa[commId].byMonth[monthKey]) result.byCommessa[commId].byMonth[monthKey] = 0;
                    result.byCommessa[commId].byMonth[monthKey] += valore * tariffa;
                    // accumula a livello globale per mese
                    if (!result.byMonth[monthKey]) result.byMonth[monthKey] = 0;
                    result.byMonth[monthKey] += valore * tariffa;
                    // aggiungi al totale commessa e globale
                    result.byCommessa[commId].total += valore * tariffa;
                    result.total += valore * tariffa;
                });
            });
        });

        return result;
    }
    
    updateStats(data) {
        const collaboratoriCount = data.length;
        const totalGiornate = data.reduce((sum, c) => sum + c.giornate.length, 0);
        // Nuova statistica: giornate di campo (somma dei gg delle giornate Tipo 'Campo')
        const giornateCampoCount = data.reduce((sumC, c) => {
            return sumC + c.giornate.reduce((s, g) => s + ((g.Tipo === 'Campo') ? (parseFloat(g.gg) || 0) : 0), 0);
        }, 0);
        const totalCosto = data.reduce((sum, c) => {
            return sum + c.giornate.reduce((s, g) => s + (g.costo_calcolato || 0), 0);
        }, 0);
        
        // aggregate accounting total for displayed collaborators
        const totalAccounting = data.reduce((sum, c) => {
            try {
                // use helper to compute accounting respecting current filters
                const val = this.computeAccountingTotalForCollaboratore(c) || 0;
                return sum + val;
            } catch (e) { return sum; }
        }, 0);

        // Nuova statistica: valore totale Monitoraggio per i collaboratori mostrati
        const totalMonitoraggio = data.reduce((sum, c) => {
            try { return sum + (this.computeMonitoraggioTotalForCollaboratore(c) || 0); } catch (e) { return sum; }
        }, 0);

        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriCount, 'Collaboratori Visualizzati')}
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate, "Totale Giornate Registrate")}
                    ${this.ui.createStatsCard('fas fa-tractor', giornateCampoCount.toFixed(1), 'Giornate di Campo')}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totalCosto), 'Rimborso attività')}
                    ${this.ui.createStatsCard('fas fa-bell', this.app.utils.formatCurrency(totalMonitoraggio), 'Valore Monitoraggio')}
                    ${this.ui.createStatsCard('fas fa-file-invoice-dollar', this.app.utils.formatCurrency(totalAccounting), 'Accounting')}
                </div>
            `;
        }
    }
}