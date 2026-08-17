/**
 * @file giornate-section.js
 * @description Classe per la gestione della sezione "Giornate".
 */
class GiornateSection extends BaseSection {
    constructor(appInstance) {
        super('Giornate', appInstance);
        this.giornateAggregate = [];
        this.filteredGiornateAggregate = []; // NUOVO: Array per i dati filtrati
        this.mesiItaliani = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        // stato dei filtri per anno/mese/tipo
        this.activeDateFilter = { years: [], months: [] };
        this.activeTipoFilter = '';
    }

    async loadData() {
        // I dati sono già caricati in this.app.giornate, dobbiamo solo raggrupparli
        this.giornateAggregate = this.groupGiornateByMonthAndCollaboratore();
        // Inizialmente, i dati filtrati sono tutti i dati
        this.filteredGiornateAggregate = this.giornateAggregate;
        this.isLoaded = true;
    }

    /**
     * MODIFICATO: Aggiunge l'HTML per la barra dei filtri.
     */
    render() {
        this.updatePageTitle('Riepilogo Giornate', 'Visualizza, aggiungi e modifica le giornate lavorative');
    this.updateTopbarActions(`<div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="add-giornata"><i class="fas fa-plus me-2"></i>Aggiungi Giornata</button><button class="btn btn-outline-secondary" data-action="export-giornate"><i class="fas fa-file-export me-2"></i>Esporta Excel</button></div>`);
        
        const container = this.getContainer();
        
        // Prepara le opzioni per i menu a tendina dei filtri
        const collaboratoriOptions = this.app.utils.ordinaPerNome(this.app.collaboratori, 'Collaboratore').map(c => `<option value="${c.ID_COLLABORATORE}">${c.Collaboratore}</option>`).join('');
        const commesseOptions = this.app.utils.ordinaPerNome(this.app.commesse, 'Commessa')
            .map(c => `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`)
            .join('');

        // prepara le opzioni per anno e mese (riuso pattern usato altrove)
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2024; y <= currentYear + 1; y++) { const isChecked = (y === currentYear) ? 'checked' : ''; yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}" ${isChecked}>${y}</label></li>`; }
        const months = this.mesiItaliani;
        let monthOptions = months.map((month, index) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${index + 1}">${month}</label></li>`).join('');

        container.innerHTML = `
            <div id="stats-row-container"></div>
            <!-- NUOVO: Blocco filtri -->
            <div class="search-filters">
                <div class="row gy-3 align-items-end">
                    <div class="col-lg-3 col-md-6">
                        <label for="filterCollaboratore" class="form-label">Filtra per Collaboratore</label>
                        <select class="form-select" id="filterCollaboratore">
                            <option value="">Tutti i collaboratori</option>
                            ${collaboratoriOptions}
                        </select>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <label for="filterCommessa" class="form-label">Filtra per Commessa</label>
                        <select class="form-select" id="filterCommessa">
                            <option value="">Tutte le commesse</option>
                            ${commesseOptions}
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">Anno</label>
                        <div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">${currentYear}</button><ul class="dropdown-menu" id="filterAnno" aria-labelledby="filterAnnoBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnno">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${yearOptions}</ul></div>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">Mese</label>
                        <div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMese" aria-labelledby="filterMeseBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMese">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${monthOptions}</ul></div>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label for="filterTipo" class="form-label">Filtra per Tipo</label>
                        <select class="form-select" id="filterTipo">
                            <option value="">Tutti i tipi</option>
                            <option value="Campo">Campo</option>
                            <option value="Promo">Promo</option>
                            <option value="Sviluppo">Sviluppo</option>
                            <option value="Formazione">Formazione</option>
                        </select>
                    </div>
                    <!-- export button moved to topbar -->
                </div>
            </div>
            <div id="giornateContainer">
                ${this.renderGiornateAggregate(this.filteredGiornateAggregate)}
            </div>
        `;

        this.updateStats(this.app.giornate);
        // Gli eventi NON si agganciano qui: initialize() chiama render() e poi
        // bindEvents(), quindi farlo anche di qui aggancia due listener allo
        // stesso nodo. Sugli altri filtri non si notava perche' riapplicare due
        // volte lo stesso filtro da' lo stesso risultato, ma
        // Seleziona/Deseleziona ha uno stato: il primo giro spuntava tutti gli
        // anni e il secondo li toglieva, quindi il menu si svuotava proprio
        // quando si chiedeva di riempirlo.
        this.updateDateFilterFromUI();
    }
    
    /**
     * MODIFICATO: Aggiunge gli event listener per i nuovi filtri.
     * La logica di filtraggio si attiva al cambio di selezione.
     */
    bindEvents() {
        document.getElementById('filterCollaboratore')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterCommessa')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterTipo')?.addEventListener('change', (e) => { this.activeTipoFilter = e.target.value || ''; this.filterData(); });

        // gestore per i link Seleziona/Deseleziona dentro i dropdown anni/mesi
        document.querySelectorAll('[data-action="toggle-all-filter"]').forEach(link => {
            link.addEventListener('click', (ev) => {
                ev.preventDefault();
                const target = link.getAttribute('data-target-filter');
                const container = document.getElementById(target);
                if (!container) return;
                const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                this.updateDateFilterFromUI();
            });
        });

        // Delegate change events for year/month checkbox lists so manual checking updates filters
        const anniContainer = document.getElementById('filterAnno');
        if (anniContainer) {
            anniContainer.addEventListener('change', (e) => {
                if (e.target && e.target.type === 'checkbox') this.updateDateFilterFromUI();
            });
        }

        const mesiContainer = document.getElementById('filterMese');
        if (mesiContainer) {
            mesiContainer.addEventListener('change', (e) => {
                if (e.target && e.target.type === 'checkbox') this.updateDateFilterFromUI();
            });
        }

    // L'esportazione è ora gestita dal bottone nella topbar che invia l'azione 'export-giornate'
    }

    /**
     * Il filtro periodo letto dalle checkbox dei dropdown Anno/Mese.
     *
     * Si legge sempre dal DOM, mai da una copia in memoria: le checkbox sono
     * l'unico stato vero. Dopo un ricaricamento dati _restoreFilterState() le
     * rimette a posto e chiama filterData() senza passare di qui, quindi una
     * copia salvata resterebbe indietro e la pagina mostrerebbe un periodo
     * diverso da quello spuntato.
     *
     * Spuntare TUTTI gli anni non restringe niente: e' lo stesso insieme di
     * dati che si ottiene senza spuntarne nessuno, e il pulsante si legge
     * "Tutti" in entrambi i casi. Per questo un insieme completo viene
     * normalizzato a vuoto, come gia' fa Situazione Commesse e Task.
     */
    leggiFiltroPeriodo() {
        const contAnni = document.getElementById('filterAnno');
        const contMesi = document.getElementById('filterMese');
        const spuntati = (c) => c
            ? Array.from(c.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10)).filter(v => !isNaN(v))
            : [];
        const quanti = (c) => c ? c.querySelectorAll('input[type="checkbox"]').length : 0;

        const years = spuntati(contAnni);
        const months = spuntati(contMesi);
        const tutti = (sel, tot) => sel.length === 0 || (tot > 0 && sel.length === tot);
        const anniTutti = tutti(years, quanti(contAnni));
        const mesiTutti = tutti(months, quanti(contMesi));

        return {
            years: anniTutti ? [] : years,
            months: mesiTutti ? [] : months,
            attivo: !(anniTutti && mesiTutti)
        };
    }

    /**
     * Aggiorna le etichette dei pulsanti dei dropdown e riapplica il filtro.
     */
    updateDateFilterFromUI() {
        const { years, months } = this.leggiFiltroPeriodo();
        this.activeDateFilter = { years, months };

        const annoBtn = document.getElementById('filterAnnoBtn');
        if (annoBtn) {
            if (!years.length) annoBtn.textContent = 'Tutti';
            else if (years.length === 1) annoBtn.textContent = String(years[0]);
            else annoBtn.textContent = `${years.length} anni`;
        }

        const meseBtn = document.getElementById('filterMeseBtn');
        if (meseBtn) {
            if (!months.length) meseBtn.textContent = 'Tutti';
            else if (months.length === 1) meseBtn.textContent = this.mesiItaliani[months[0] - 1] || `${months[0]}`;
            else meseBtn.textContent = `${months.length} mesi`;
        }

        this.filterData();
    }

    /**
     * Esporta le giornate visualizzate (filtrate) in un CSV compatibile con Excel.
     */
    exportGiornateToCSV() {
        const data = this.filteredGiornateAggregate || this.giornateAggregate || [];

        // Flatten in righe: ogni riga corrisponde a una giornata con il nome del collaboratore
        const rows = [];
        data.forEach(mese => {
            mese.collaboratori.forEach(coll => {
                coll.giornate.forEach(g => {
                    const viaggio = parseFloat(g.Spese_Viaggi ?? g.Spese_Viaggio ?? g.spese_viaggio ?? 0) || 0;
                    const vitto = parseFloat(g.Vitto_alloggio ?? g.Vitto_Alloggio ?? g.vitto_alloggio ?? 0) || 0;
                    const altre = parseFloat(g.Altri_costi ?? g.AltriSpese ?? g.altri_costi ?? 0) || 0;
                    const fatturate = parseFloat(g.Spese_Fatturate_VP ?? g.Spese_Fatturate ?? g.spese_fatturate_vp ?? 0) || 0;
                    // Ricavo spese: quanto si addebita al cliente. Lo calcola l'API con le
                    // regole di CalcoloSpese (diaria per giornata di campo, oppure consuntivo).
                    // NON è l'esborso: quello va nella colonna 'Costo Spese'.
                    const valoreSpese = parseFloat(g.Valore_spese ?? g.valore_spese ?? 0) || 0;
                    const costoSpese = viaggio + vitto + altre;
                    const valoreGg = parseFloat(g.valore_calcolato ?? g.Valore_Calcolato ?? 0) || 0;
                    const speseRimborsabili = costoSpese - fatturate;
                    rows.push({
                        'Collaboratore': coll.collaboratore_nome,
                        'Data': this.app.utils.formatDate(g.Data),
                        // Cliente rimosso per richiesta
                        'Commessa': g.commessa_info?.Commessa || '',
                        'Task': g.task_info?.Task || '',
                        'Giorni': g.gg,
                        'Viaggio': (g.Viaggio === 'No') ? 'No' : 'Si',
                        'Spese Viaggio': parseFloat(g.Spese_Viaggi ?? g.Spese_Viaggio ?? g.spese_viaggio ?? 0) || 0,
                        'Vitto/Alloggio': parseFloat(g.Vitto_alloggio ?? g.Vitto_Alloggio ?? g.vitto_alloggio ?? 0) || 0,
                        'Altre Spese': parseFloat(g.Altri_costi ?? g.AltriSpese ?? g.altri_costi ?? 0) || 0,
                        'Spese Fatturate VP': parseFloat(g.Spese_Fatturate_VP ?? g.Spese_Fatturate ?? g.spese_fatturate_vp ?? 0) || 0,
                        'Spese Rimborsabili': speseRimborsabili,
                        'Costo gg': parseFloat(g.Costo_gg ?? g.costo_gg ?? g.CostoGg ?? 0) || 0,
                        'Costo Spese': costoSpese,
                        'Valore Spese': valoreSpese,
                        'Valore gg': valoreGg,
                        'Valore TOT': (valoreSpese + valoreGg),
                        'Note': (g.Note || '').replace(/\r?\n/g, ' ')
                    });
                });
            });
        });

        if (rows.length === 0) {
            this.ui.showToast('Nessuna giornata da esportare con i filtri attivi.', 'info');
            return;
        }

    // Costruisci CSV (punto e virgola come separatore per Excel italiano) - ordine richiesto dall'utente
    const headers = ['Collaboratore','Data','Commessa','Task','Giorni','Viaggio','Spese Viaggio','Vitto/Alloggio','Altre Spese','Spese Fatturate VP','Spese Rimborsabili','Costo gg','Costo Spese','Valore Spese','Valore gg','Valore TOT','Note'];
    const csvLines = [headers.join(';')];

        rows.forEach(r => {
            const line = headers.map(h => {
                let v = r[h] ?? '';
                // numeri con decimale con la virgola per Excel locale
                if (['Giorni','Valore Spese','Valore gg','Valore TOT','Costo gg','Costo Spese','Spese Viaggio','Vitto/Alloggio','Altre Spese','Spese Fatturate VP','Spese Rimborsabili'].includes(h)) {
                    const num = parseFloat(v);
                    v = isNaN(num) ? '' : num.toString().replace('.', ',');
                }
                // escape ; and newlines and wrap in quotes if needed
                if (typeof v === 'string' && (v.includes(';') || v.includes('\n') || v.includes('\r') || v.includes('"'))) {
                    v = '"' + v.replace(/"/g, '""') + '"';
                }
                return v;
            }).join(';');
            csvLines.push(line);
        });

        const csvContent = csvLines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const filename = `giornate_export_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.ui.showToast(`Esportazione completata: ${rows.length} righe.`, 'success');
    }

    handleAction(action, id, type, targetElement, e) {
        // Se il click avviene nell'header della card, evitiamo il bubbling per azioni specifiche
        if (targetElement && targetElement.closest && targetElement.closest('.management-card-header') && !['toggle-mese', 'edit-giornata'].includes(action)) {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        }

        switch (action) {
            case 'toggle-mese':
                this.toggleMese(id);
                break;
            case 'toggle-conferma-mese':
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                this.handleToggleConfermaMese(id);
                break;
                case 'export-giornate':
                    this.exportGiornateToCSV();
                    break;
            case 'edit-giornata':
                this.showGiornataModal(id);
                break;
            case 'add-giornata':
                this.showGiornataModal();
                break;
            case 'toggle-all-filter':
                // Gia' gestita dal listener sul link dentro il dropdown. Serve
                // comunque il caso, altrimenti finisce nel default e BaseSection
                // annuncia "azione non ancora implementata": un avviso di errore
                // a ogni Seleziona/Deseleziona, mentre il filtro funziona.
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                break;
            default:
                // Delegare al BaseSection per default
                if (typeof super.handleAction === 'function') {
                    try { super.handleAction(action, id, type, targetElement, e); } catch (err) { console.warn(err); }
                } else {
                    console.warn(`Azione non gestita in GiornateSection: ${action}`);
                }
        }
    }

    filterData() {
                const selectedCollaboratore = document.getElementById('filterCollaboratore')?.value || '';
                const selectedCommessa = document.getElementById('filterCommessa')?.value || '';

                // Parti da una copia profonda dei dati originali non filtrati
                let data = JSON.parse(JSON.stringify(this.giornateAggregate));

                // Selezione collaboratore
                if (selectedCollaboratore) {
                    data = data.map(mese => { mese.collaboratori = mese.collaboratori.filter(c => String(c.collaboratore_id) === String(selectedCollaboratore)); return mese; }).filter(m => m.collaboratori.length > 0);
                }

                // Filtro commessa: all'interno delle giornate di ogni collaboratore
                if (selectedCommessa) {
                    data = data.map(mese => {
                        mese.collaboratori.forEach(coll => {
                            coll.giornate = coll.giornate.filter(g => String(g.task_info?.ID_COMMESSA) === String(selectedCommessa));
                            // aggiorna i totali locali
                            coll.totaleGiornate = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleGiornateCampo = coll.giornate.filter(gg => gg.Tipo === 'Campo').reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleValoreCalcolato = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.valore_calcolato) || 0), 0);
                        });
                        mese.collaboratori = mese.collaboratori.filter(c => c.giornate.length > 0);
                        return mese;
                    }).filter(m => m.collaboratori.length > 0);
                }

                // Filtro tipo
                if (this.activeTipoFilter) {
                    data = data.map(mese => {
                        mese.collaboratori.forEach(coll => {
                            coll.giornate = coll.giornate.filter(g => String(g.Tipo) === String(this.activeTipoFilter));
                            coll.totaleGiornate = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleGiornateCampo = coll.giornate.filter(gg => gg.Tipo === 'Campo').reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleValoreCalcolato = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.valore_calcolato) || 0), 0);
                        });
                        mese.collaboratori = mese.collaboratori.filter(c => c.giornate.length > 0);
                        return mese;
                    }).filter(m => m.collaboratori.length > 0);
                }

                // Filtro anno/mese, riletto dalle checkbox a ogni passata
                const periodo = this.leggiFiltroPeriodo();
                this.activeDateFilter = { years: periodo.years, months: periodo.months };
                if (periodo.attivo) {
                    data = data.map(mese => {
                        // each mese contains giornate already grouped by month; but we still filter inside giornate to be safe
                        mese.collaboratori.forEach(coll => {
                            coll.giornate = coll.giornate.filter(g => {
                                const d = new Date(g.Data);
                                const y = d.getFullYear();
                                const m = d.getMonth() + 1;
                                if (periodo.years.length && !periodo.years.includes(y)) return false;
                                if (periodo.months.length && !periodo.months.includes(m)) return false;
                                return true;
                            });
                            coll.totaleGiornate = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleGiornateCampo = coll.giornate.filter(gg => gg.Tipo === 'Campo').reduce((s, gg) => s + (parseFloat(gg.gg) || 0), 0);
                            coll.totaleValoreCalcolato = coll.giornate.reduce((s, gg) => s + (parseFloat(gg.valore_calcolato) || 0), 0);
                        });
                        mese.collaboratori = mese.collaboratori.filter(c => c.giornate.length > 0);
                        return mese;
                    }).filter(m => m.collaboratori.length > 0);
                }

                this.filteredGiornateAggregate = data;

                // Aggiorna la vista con i dati filtrati
                const container = document.getElementById('giornateContainer');
                container.innerHTML = this.renderGiornateAggregate(this.filteredGiornateAggregate);

                // Aggiorna le statistiche con le sole giornate filtrate
                const giornateFiltrate = this.filteredGiornateAggregate.flatMap(m => m.collaboratori.flatMap(c => c.giornate));
                this.updateStats(giornateFiltrate);
            }
    // ========================================================================
    // SEZIONE: NUOVA LOGICA DI FILTRAGGIO
    // ========================================================================

    // ========================================================================
    // SEZIONE: RENDERING (invariata ma ora usa i dati filtrati)
    // ========================================================================

    renderGiornateAggregate(data) {
        if (!data || data.length === 0) {
            return this.ui.createEmptyState('fas fa-calendar-times', 'Nessuna Giornata Trovata', 'Nessuna giornata corrisponde ai filtri selezionati.');
        }
        return data.map(mese => this.createMeseCard(mese)).join('');
    }

    createMeseCard(mese) {
        const totaleGiornateCampoMese = mese.collaboratori.reduce((sum, coll) => sum + coll.totaleGiornateCampo, 0);
        const totaleValoreCalcolatoMese = mese.collaboratori.reduce((sum, coll) => sum + coll.totaleValoreCalcolato, 0);

        const hasUnconfirmed = mese.collaboratori.some(coll => coll.giornate.some(g => g.Confermata !== 'Si'));
        const toggleConfirmTitle = hasUnconfirmed ? 'Conferma tutte le giornate del mese' : 'Rimuovi conferma da tutte le giornate';
        const toggleConfirmIcon = hasUnconfirmed ? 'fa-check-circle' : 'fa-times-circle';

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-mese" data-id="${mese.yearMonth}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0"><i class="fas fa-calendar-alt me-2"></i>${mese.month}</h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-success">${this.app.utils.formatCurrency(totaleValoreCalcolatoMese)}</span>
                            <span class="badge bg-primary">${totaleGiornateCampoMese.toFixed(2)} giorni di campo</span>
                            <button class="btn btn-sm btn-outline-light" data-action="toggle-conferma-mese" data-id="${mese.yearMonth}" title="${toggleConfirmTitle}">
                                <i class="fas ${toggleConfirmIcon}"></i>
                            </button>
                            <button class="commessa-toggle-btn" id="toggleBtn-${mese.yearMonth}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                </div>
                <div class="collapse" id="mese-${mese.yearMonth}">
                    <div class="management-card-body p-0">
                        ${mese.collaboratori.map(c => this.createCollaboratoreGroup(c)).join('')}
                    </div>
                </div>
            </div>`;
    }

    createCollaboratoreGroup(collaboratore) {
        return `
            <div class="collaboratore-group border-bottom">
                <h6 class="bg-light p-3 mb-0 fw-bold d-flex justify-content-between align-items-center">
                    <span><i class="fas fa-user me-2"></i>${collaboratore.collaboratore_nome}</span>
                    <div>
                        <span class="badge bg-success me-2">${this.app.utils.formatCurrency(collaboratore.totaleValoreCalcolato)}</span>
                        <span class="badge bg-secondary">${collaboratore.totaleGiornateCampo.toFixed(2)} giorni di campo</span>
                    </div>
                </h6>
                <div class="table-responsive">
                    <table class="table table-hover table-sm mb-0">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Commessa</th>
                                <th>Task</th>
                                <th class="text-center">Immagini</th>
                                <th class="text-center">GG</th>
                                <th>Tipo</th>
                                <th class="text-center">Desk</th>
                                <th class="text-center">Viaggio</th>
                                <th>Note</th>
                                <th class="text-center">Confermata</th>
                                <th class="text-end">Valore Calc.</th>
                                <th class="text-end">Spese Tot.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${collaboratore.giornate.map(g => this.createGiornataRow(g)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    createGiornataRow(giornata) {
        const commessa = giornata.commessa_info?.Commessa || 'N/D';
        const task = giornata.task_info?.Task || 'N/D';
        const confermataIcon = giornata.Confermata === 'Si'
            ? '<i class="fas fa-check-circle text-success" title="Confermata"></i>'
            : '<i class="fas fa-times-circle text-muted" title="Non Confermata"></i>';

        const tipoHtml = giornata.Tipo === 'Campo'
            ? `<span class="text-success fw-bold">${giornata.Tipo}</span>`
            : giornata.Tipo;

        const deskIcon = giornata.Desk === 'Si'
            ? '<i class="fas fa-desktop text-primary" title="Sì"></i>'
            : '';

        // Si segnala solo l'eccezione: il viaggio non effettuato su una giornata
        // di campo in trasferta, l'unico caso in cui il flag cambia il ricavo.
        const viaggioIcon = (giornata.Viaggio === 'No' && giornata.Tipo === 'Campo' && giornata.Desk !== 'Si')
            ? '<i class="fas fa-ban text-warning" title="Viaggio non addebitato al cliente"></i>'
            : '';

        // Show a small thumbnail (first image) or an icon if images exist
        let immaginiCell = '';
        try {
            if (giornata.has_images || (giornata.images && giornata.images.length)) {
                // If images array available, use first image; otherwise show icon badge
                const thumbUrl = (giornata.images && giornata.images[0] && giornata.images[0].url) ? giornata.images[0].url : null;
                if (thumbUrl) {
                    immaginiCell = `<td class="text-center"><a href="${thumbUrl}" target="_blank" title="Apri immagine"><img src="${thumbUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px"/></a></td>`;
                } else {
                    immaginiCell = `<td class="text-center"><i class="fas fa-image text-primary" title="Immagini disponibili"></i></td>`;
                }
            } else {
                immaginiCell = `<td class="text-center text-muted"><i class="fas fa-image" title="Nessuna immagine"></i></td>`;
            }
        } catch (e) {
            immaginiCell = `<td class="text-center text-muted"><i class="fas fa-image" title="Nessuna immagine"></i></td>`;
        }

        return `
            <tr data-action="edit-giornata" data-id="${giornata.ID_GIORNATA}" style="cursor: pointer;">
                <td>${this.app.utils.formatDate(giornata.Data)}</td>
                <td>${commessa}</td>
                <td>${task}</td>
                ${immaginiCell}
                <td class="text-center"><span class="badge bg-primary">${giornata.gg}</span></td>
                <td>${tipoHtml}</td>
                <td class="text-center">${deskIcon}</td>
                <td class="text-center">${viaggioIcon}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${giornata.Note || ''}">${giornata.Note || '-'}</td>
                <td class="text-center">${confermataIcon}</td>
                <td class="text-end fw-bold">${this.app.utils.formatCurrency(giornata.valore_calcolato)}</td>
                <td class="text-end text-danger fw-bold">${this.app.utils.formatCurrency(giornata.spese_totali)}</td>
            </tr>
        `;
    }

    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE
    // ========================================================================
    
    toggleMese(meseId) {
        const collapseElement = document.getElementById(`mese-${meseId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${meseId}`);
        if (!collapseElement || !toggleBtn) return;
        
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        bsCollapse.toggle();

        const onShown = () => this.updateToggleButton(toggleBtn, true);
        const onHidden = () => this.updateToggleButton(toggleBtn, false);

        collapseElement.addEventListener('shown.bs.collapse', onShown, { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', onHidden, { once: true });

        this.updateToggleButton(toggleBtn, collapseElement.classList.contains('show'));
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
    }
    
    // ========================================================================
    // SEZIONE: MODALI E FORM
    // ========================================================================

    showGiornataModal(giornataId = null) {
        const giornata = giornataId ? this.app.giornate.find(g => g.ID_GIORNATA === giornataId) : null;
        const modalTitle = giornataId ? 'Modifica Giornata' : 'Aggiungi Nuova Giornata';
        const modalId = `giornataModal_${giornataId || 'new'}`;
        const modalBody = this.getGiornataFormHTML(giornata);
        
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">${giornataId ? 'Salva Modifiche' : 'Crea Giornata'}</button>` }
        ];

        if(giornataId) {
            const deleteButton = {
                html: `<button type="button" class="btn btn-danger me-auto">Elimina</button>`,
                selector: `.btn-danger`,
                handler: () => this.handleDeleteGiornata(giornataId)
            };
            modalActions.unshift(deleteButton);
        }

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addGiornataFormListeners(modalId);
    }

    getGiornataFormHTML(giornataParam = {}) {
        const giornata = giornataParam || {};

        const formId = `giornataModal_${giornata.ID_GIORNATA || 'new'}_form`;
        const collaboratoriOptions = this.app.utils.ordinaPerNome(this.app.collaboratori, 'Collaboratore').map(c => `<option value="${c.ID_COLLABORATORE}" ${giornata.ID_COLLABORATORE === c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        
        const currentCommessaId = giornata.task_info?.ID_COMMESSA;
        const isEditMode = !!currentCommessaId;

        const commesseOptions = this.app.utils.ordinaPerNome(this.app.commesse, 'Commessa')
            .filter(c => c.Stato_Commessa === 'In corso')
            .map(c => `<option value="${c.ID_COMMESSA}" ${currentCommessaId === c.ID_COMMESSA ? 'selected' : ''}>${c.Commessa}</option>`)
            .join('');

        const taskOptions = isEditMode ? this.app.utils.ordinaPerNome(this.app.tasks, 'Task')
            .filter(t => t.ID_COMMESSA === currentCommessaId && t.Stato_Task === 'In corso')
            .map(t => `<option value="${t.ID_TASK}" ${giornata.ID_TASK === t.ID_TASK ? 'selected' : ''}>${t.Task}</option>`)
            .join('') : '';

        const oggi = new Date().toISOString().split('T')[0];
        const dataValue = giornata.Data ? giornata.Data.split('T')[0] : oggi;

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="Data" class="form-label">Data</label>
                        <input type="date" class="form-control" id="Data" name="Data" value="${dataValue}" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="gg" class="form-label">Frazione Giornata (es. 0.5, 1)</label>
                        <input type="number" class="form-control" id="gg" name="gg" min="0" max="1" step="0.5" value="${giornata.gg || '1'}" required>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12 mb-3">
                        <label for="ID_COLLABORATORE" class="form-label">Collaboratore</label>
                        <select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE" required>
                            <option value="">Seleziona...</option>
                            ${collaboratoriOptions}
                        </select>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="ID_COMMESSA_FORM" class="form-label">Commessa</label>
                        <select class="form-select" id="ID_COMMESSA_FORM" name="ID_COMMESSA_FORM" required>
                            <option value="">Seleziona una commessa...</option>
                            ${commesseOptions}
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="ID_TASK" class="form-label">Task</label>
                        <select class="form-select" id="ID_TASK" name="ID_TASK" required ${!isEditMode ? 'disabled' : ''}>
                            <option value="">${isEditMode ? 'Seleziona un task...' : 'Seleziona prima una commessa...'}</option>
                            ${taskOptions}
                        </select>
                    </div>
                </div>
                 <div class="row">
                    <div class="col-md-4 mb-3">
                        <label for="Tipo" class="form-label">Tipo Attività</label>
                        <select class="form-select" id="Tipo" name="Tipo">
                            <option value="Campo" ${giornata.Tipo === 'Campo' ? 'selected' : ''}>Campo</option>
                            <option value="Promo" ${giornata.Tipo === 'Promo' ? 'selected' : ''}>Promo</option>
                            <option value="Sviluppo" ${giornata.Tipo === 'Sviluppo' ? 'selected' : ''}>Sviluppo</option>
                            <option value="Formazione" ${giornata.Tipo === 'Formazione' ? 'selected' : ''}>Formazione</option>
                        </select>
                    </div>
                     <div class="col-md-4 mb-3">
                        <label class="form-label">Desk</label>
                        <div class="d-flex align-items-center">
                            <div class="form-check form-switch me-2">
                                <input class="form-check-input" type="checkbox" id="Desk_toggle" name="Desk" ${giornata.Desk === 'Si' ? 'checked' : ''}>
                                <label class="form-check-label" for="Desk_toggle" id="Desk_toggle_label">${giornata.Desk === 'Si' ? 'Sì' : 'No'}</label>
                            </div>
                        </div>
                    </div>
                     <div class="col-md-4 mb-3">
                        <label class="form-label">Viaggio</label>
                        <div class="d-flex align-items-center">
                            <div class="form-check form-switch me-2">
                                <input class="form-check-input" type="checkbox" id="Viaggio_toggle" name="Viaggio" ${giornata.Viaggio === 'No' ? '' : 'checked'}>
                                <label class="form-check-label" for="Viaggio_toggle" id="Viaggio_toggle_label">${giornata.Viaggio === 'No' ? 'No' : 'Sì'}</label>
                            </div>
                        </div>
                        <div class="form-text">Togliere se il consulente si è fermato in loco: il viaggio non viene addebitato al cliente.</div>
                    </div>
                        <div class="col-md-4 mb-3">
                            <label class="form-label">Confermata</label>
                            <div class="d-flex align-items-center">
                                <div class="form-check form-switch me-2">
                                    <input class="form-check-input" type="checkbox" id="Confermata_toggle" name="Confermata" ${giornata.Confermata === 'Si' ? 'checked' : ''}>
                                    <label class="form-check-label" for="Confermata_toggle" id="Confermata_toggle_label">${giornata.Confermata === 'Si' ? 'Sì' : 'No'}</label>
                                </div>
                            </div>
                        </div>
                </div>
                <hr>
                <h5>Spese e Costi (Opzionale)</h5>
                 <div class="row">
                    <div class="col-md-3 mb-3">
                        <label for="Spese_Viaggi" class="form-label">Spese Viaggio (€)</label>
                        <input type="number" class="form-control" id="Spese_Viaggi" name="Spese_Viaggi" min="0" step="0.01" value="${giornata.Spese_Viaggi || ''}">
                    </div>
                     <div class="col-md-3 mb-3">
                        <label for="Vitto_alloggio" class="form-label">Vitto e Alloggio (€)</label>
                        <input type="number" class="form-control" id="Vitto_alloggio" name="Vitto_alloggio" min="0" step="0.01" value="${giornata.Vitto_alloggio || ''}">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="Altri_costi" class="form-label">Altri Costi (€)</label>
                        <input type="number" class="form-control" id="Altri_costi" name="Altri_costi" min="0" step="0.01" value="${giornata.Altri_costi || ''}">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="Spese_Fatturate_VP" class="form-label">Spese Fatturate V&P (€)</label>
                        <input type="number" class="form-control" id="Spese_Fatturate_VP" name="Spese_Fatturate_VP" min="0" step="0.01" value="${giornata.Spese_Fatturate_VP || ''}">
                    </div>
                </div>
                <div class="mb-3">
                    <label for="Note" class="form-label">Note</label>
                    <textarea class="form-control" id="Note" name="Note" rows="3">${giornata.Note || ''}</textarea>
                </div>
                <!-- Images preview (if editing an existing giornata, thumbnails will be loaded) -->
                <div class="mb-3">
                    <label class="form-label">Immagini</label>
                    <div id="giornataImagesPreview" class="d-flex gap-2 align-items-start" style="flex-wrap:wrap"></div>
                </div>
            </form>
        `;
    }
    
    addGiornataFormListeners(modalId) {
        const formId = `giornataModal_${modalId.split('_').pop()}_form`;
        const form = document.getElementById(formId);
        if (!form) return;

        const commessaSelect = form.querySelector('#ID_COMMESSA_FORM');
        const taskSelect = form.querySelector('#ID_TASK');

        commessaSelect.addEventListener('change', (e) => {
            const selectedCommessaId = e.target.value;
            
            taskSelect.innerHTML = '<option value="">Seleziona prima una commessa...</option>';
            taskSelect.disabled = true;

            if (selectedCommessaId) {
                const filteredTasks = this.app.utils.ordinaPerNome(this.app.tasks, 'Task').filter(
                    t => t.ID_COMMESSA === selectedCommessaId && t.Stato_Task === 'In corso'
                );

                if (filteredTasks.length > 0) {
                    taskSelect.innerHTML = '<option value="">Seleziona un task...</option>';
                    filteredTasks.forEach(task => {
                        const option = document.createElement('option');
                        option.value = task.ID_TASK;
                        option.textContent = task.Task;
                        taskSelect.appendChild(option);
                    });
                    taskSelect.disabled = false;
                } else {
                    taskSelect.innerHTML = '<option value="">Nessun task attivo per questa commessa</option>';
                }
            }
        });

        const giornataId = formId.includes('new') ? null : modalId.split('_').pop();
        // Aggancio submit del form
        form.addEventListener('submit', (e) => this.handleGiornataFormSubmit(e, giornataId));

        // If editing an existing giornata, load images and render thumbnails into the modal
        if (giornataId) {
            // Use the API client helper we added
            (async () => {
                try {
                    const res = await this.api.listImages(giornataId);
                    if (res && res.success) {
                        const container = document.getElementById('giornataImagesPreview');
                        if (container) {
                            container.innerHTML = '';
                            (res.images || []).forEach(img => {
                                const a = document.createElement('a');
                                a.href = img.url;
                                a.target = '_blank';
                                a.title = 'Apri immagine';
                                a.style.display = 'inline-block';

                                const imageEl = document.createElement('img');
                                imageEl.src = img.url;
                                imageEl.style.width = '60px';
                                imageEl.style.height = '60px';
                                imageEl.style.objectFit = 'cover';
                                imageEl.style.borderRadius = '6px';
                                imageEl.style.border = '1px solid #e9e9e9';

                                a.appendChild(imageEl);
                                container.appendChild(a);
                            });
                        }
                    }
                } catch (err) {
                    console.warn('Errore caricamento immagini per modal:', err);
                }
            })();
        }

        // Listener per il toggle Confermata: aggiorna l'etichetta per migliorare la UX
        const confermataToggle = form.querySelector('#Confermata_toggle');
        const confermataLabel = form.querySelector('#Confermata_toggle_label');
        if (confermataToggle && confermataLabel) {
            const updateLabel = () => { confermataLabel.textContent = confermataToggle.checked ? 'Sì' : 'No'; };
            confermataToggle.addEventListener('change', updateLabel);
            updateLabel();
        }

        // Listener per il toggle Desk: aggiorna l'etichetta
        const deskToggle = form.querySelector('#Desk_toggle');
        const deskLabel = form.querySelector('#Desk_toggle_label');
        if (deskToggle && deskLabel) {
            const updateDeskLabel = () => { deskLabel.textContent = deskToggle.checked ? 'Sì' : 'No'; };
            deskToggle.addEventListener('change', updateDeskLabel);
            updateDeskLabel();
        }

        // Listener per il toggle Viaggio. Il flag conta solo sulle giornate di
        // campo in trasferta: sulle altre non c'è viaggio da addebitare, quindi
        // lo si disabilita invece di lasciarlo modificabile a vuoto.
        const viaggioToggle = form.querySelector('#Viaggio_toggle');
        const viaggioLabel = form.querySelector('#Viaggio_toggle_label');
        const tipoSelect = form.querySelector('#Tipo');
        if (viaggioToggle && viaggioLabel) {
            const updateViaggio = () => {
                const inTrasferta = (!tipoSelect || tipoSelect.value === 'Campo') && !(deskToggle && deskToggle.checked);
                viaggioToggle.disabled = !inTrasferta;
                viaggioLabel.textContent = !inTrasferta
                    ? 'Non applicabile'
                    : (viaggioToggle.checked ? 'Sì' : 'No');
            };
            viaggioToggle.addEventListener('change', updateViaggio);
            deskToggle?.addEventListener('change', updateViaggio);
            tipoSelect?.addEventListener('change', updateViaggio);
            updateViaggio();
        }
    }

    async handleGiornataFormSubmit(event, giornataId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        // Convert FormData to object
        const data = Object.fromEntries(formData.entries());

        // Il toggle checkbox produce un valore 'on' quando checked nella FormData;
        // leggiamo lo stato reale del checkbox e forziamo 'Si'/'No' per compatibilità col backend
        const confermataEl = form.querySelector('#Confermata_toggle');
        if (confermataEl) {
            data.Confermata = confermataEl.checked ? 'Si' : 'No';
        } else if (data.Confermata === 'on') {
            data.Confermata = 'Si';
        }

        // Gestione del toggle Desk: converti in 'Si'/'No'
        const deskEl = form.querySelector('#Desk_toggle');
        if (deskEl) {
            data.Desk = deskEl.checked ? 'Si' : 'No';
        } else if (data.Desk === 'on') {
            data.Desk = 'Si';
        }

        // Stesso trattamento per il flag Viaggio, che però parte acceso.
        const viaggioEl = form.querySelector('#Viaggio_toggle');
        if (viaggioEl) {
            data.Viaggio = viaggioEl.checked ? 'Si' : 'No';
        } else if (data.Viaggio === 'on') {
            data.Viaggio = 'Si';
        }


        // Se siamo in modalità modifica, alcuni campi possono essere "disabled" nel form
        // (es. il select #ID_TASK) e quindi non vengono inviati nella FormData.
        // Per evitare che il backend riceva FK mancanti (causa di errori SQL),
        // preserviamo i valori originali presenti in this.app.giornate quando mancano nel payload.
        if (giornataId) {
            const original = this.app.giornate.find(g => String(g.ID_GIORNATA) === String(giornataId));
            if (original) {
                // ID_TASK è una FK critica: se non è stato inviato nel form, ripristiniamo il valore originale
                if ((data.ID_TASK === undefined || data.ID_TASK === '') && original.ID_TASK) {
                    data.ID_TASK = original.ID_TASK;
                }
                // Anche ID_COLLABORATORE e Data sono importanti per il record: preserviamoli se mancanti
                if ((data.ID_COLLABORATORE === undefined || data.ID_COLLABORATORE === '') && original.ID_COLLABORATORE) {
                    data.ID_COLLABORATORE = original.ID_COLLABORATORE;
                }
                if ((data.Data === undefined || data.Data === '') && original.Data) {
                    data.Data = original.Data.split('T')[0] || original.Data;
                }
            }
        }

        // Rimuoviamo il campo temporaneo della commessa nel form prima di inviare
        delete data.ID_COMMESSA_FORM;

        ['Spese_Viaggi', 'Vitto_alloggio', 'Altri_costi', 'Spese_Fatturate_VP'].forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const result = giornataId
                ? await this.api.updateGiornata(giornataId, data)
                : await this.api.createGiornata(data);
            
            if (result.success) {
                this.ui.showToast(`Giornata ${giornataId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else {
                throw new Error(result.message || 'Errore nel salvataggio della giornata.');
            }
        } catch (error) {
            this.ui.showToast(error.message, 'error');
        }
    }

    async handleDeleteGiornata(giornataId) {
        if (confirm(`Sei sicuro di voler eliminare questa giornata? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteGiornata(giornataId);
                if (result.success) {
                    this.ui.showToast('Giornata eliminata con successo!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById(`giornataModal_${giornataId}`))?.hide();
                    await this.app.loadInitialData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                this.ui.showToast(error.message, 'error');
            }
        }
    }

    async handleToggleConfermaMese(yearMonth) {
        // Prendi solo le giornate visibili per il mese corrente (rispettando i filtri)
        const meseObj = (this.filteredGiornateAggregate || []).find(m => m.yearMonth === yearMonth);
        const giornateDelMese = meseObj ? meseObj.collaboratori.flatMap(c => c.giornate) : [];

        if (!meseObj || giornateDelMese.length === 0) {
            this.ui.showToast('Nessuna giornata visibile da aggiornare per questo mese (controlla i filtri).', 'info');
            return;
        }

        const targetState = giornateDelMese.some(g => g.Confermata !== 'Si') ? 'Si' : 'No';
        const actionText = targetState === 'Si' ? 'confermare' : 'rimuovere la conferma da';

        if (confirm(`Sei sicuro di voler ${actionText} ${giornateDelMese.length} giornate visibili per questo mese?`)) {
            this.ui.showToast('Aggiornamento in corso...', 'info');

            const updatePromises = giornateDelMese.map(giornata => 
                this.api.updateGiornata(giornata.ID_GIORNATA, { Confermata: targetState })
            );

            try {
                const results = await Promise.all(updatePromises);
                
                const successCount = results.filter(r => r.success).length;
                const errorCount = results.length - successCount;

                if (errorCount > 0) {
                    this.ui.showToast(`${successCount} giornate aggiornate, ${errorCount} fallite.`, 'warning');
                } else {
                    this.ui.showToast(`${successCount} giornate aggiornate con successo!`, 'success');
                }

                // Ricarica i dati iniziali per riflettere i cambiamenti
                await this.app.loadInitialData();

            } catch (error) {
                this.ui.showToast(`Si è verificato un errore durante l'aggiornamento: ${error.message}`, 'error');
            }
        }
    }

    // ========================================================================
    // SEZIONE: UTILITÀ E STATISTICHE
    // ========================================================================

    /**
     * MODIFICATO: Accetta un array di giornate per calcolare le statistiche
     * in modo dinamico in base ai filtri.
     */
    updateStats(giornate) {
        const totalGiornate = giornate.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
        const totalSpese = giornate.reduce((sum, g) => sum + (parseFloat(g.spese_totali) || 0), 0);
        const collaboratoriUnici = [...new Set(giornate.map(g => g.ID_COLLABORATORE))].length;
        
        const giornateCampo = giornate.filter(g => g.Tipo === 'Campo');
        const totalGiornateCampo = giornateCampo.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
        const totalValoreCalcolato = giornate.reduce((sum, g) => sum + (parseFloat(g.valore_calcolato) || 0), 0);

        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-calendar-check', totalGiornate.toFixed(2), 'Giornate Totali')}
                    ${this.ui.createStatsCard('fas fa-tractor', totalGiornateCampo.toFixed(2), 'Giornate di Campo')}
                    ${this.ui.createStatsCard('fas fa-euro-sign', this.app.utils.formatCurrency(totalValoreCalcolato), 'Valore Calcolato')}
                    ${this.ui.createStatsCard('fas fa-receipt', this.app.utils.formatCurrency(totalSpese), 'Spese Totali')}
                    ${this.ui.createStatsCard('fas fa-users', collaboratoriUnici, 'Collaboratori Attivi')}
                </div>
            `;
        }
    }

    groupGiornateByMonthAndCollaboratore() {
        const grouped = {};

        const giornateOrdinate = [...this.app.giornate].sort((a, b) => new Date(b.Data) - new Date(a.Data));

        giornateOrdinate.forEach(g => {
            const data = new Date(g.Data);
            const year = data.getFullYear();
            const month = data.getMonth();
            const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
            const monthName = `${this.mesiItaliani[month]} ${year}`;

            if (!grouped[yearMonth]) {
                grouped[yearMonth] = {
                    month: monthName,
                    yearMonth: yearMonth,
                    collaboratori: {}
                };
            }

            const collabId = g.ID_COLLABORATORE;
            if (!grouped[yearMonth].collaboratori[collabId]) {
                const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === collabId);
                grouped[yearMonth].collaboratori[collabId] = {
                    collaboratore_id: collabId,
                    collaboratore_nome: collaboratore ? collaboratore.Collaboratore : 'Sconosciuto',
                    giornate: [],
                    totaleGiornate: 0,
                    totaleGiornateCampo: 0,
                    totaleValoreCalcolato: 0
                };
            }
            
            grouped[yearMonth].collaboratori[collabId].giornate.push(g);
            grouped[yearMonth].collaboratori[collabId].totaleGiornate += parseFloat(g.gg) || 0;
            if (g.Tipo === 'Campo') {
                grouped[yearMonth].collaboratori[collabId].totaleGiornateCampo += parseFloat(g.gg) || 0;
            }
            grouped[yearMonth].collaboratori[collabId].totaleValoreCalcolato += parseFloat(g.valore_calcolato) || 0;
        });

        return Object.values(grouped).map(mese => {
            mese.collaboratori = Object.values(mese.collaboratori)
                .sort((a, b) => a.collaboratore_nome.localeCompare(b.collaboratore_nome));
            return mese;
        });
    }
}

