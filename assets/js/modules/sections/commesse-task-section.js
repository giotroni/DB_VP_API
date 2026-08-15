/**
 * @file commesse-task-section.js
 * @description Classe per la gestione della sezione "Commesse & Task".
 * @version 3.3 - Aggiunta opzione Seleziona/Deseleziona tutto ai filtri
 */
class CommesseTaskSection extends BaseSection {
    constructor(appInstance) {
        super('Commesse & Task', appInstance);
        this.commesseConTask = [];
        this.activeDateFilter = null;
    }

    async loadData() {
        this.commesseConTask = this.groupTasksByCommessa();
        this.isLoaded = true;
    }

    render() {
        const isUserRole = this.app.currentUser?.ruolo === 'User';
        this.updatePageTitle('Situazione Commesse e Task', 'Visualizza e gestisci commesse e task');
        this.updateTopbarActions(isUserRole ? '' : `<div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="add-commessa"><i class="fas fa-plus me-2"></i>Nuova Commessa</button><button class="btn btn-outline-secondary" data-action="export-commesse"><i class="fas fa-file-export me-2"></i>Esporta Excel</button></div>`);
        const container = this.getContainer();
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = 2024; y <= currentYear + 1; y++) { 
            const isChecked = (y === currentYear) ? 'checked' : '';
            yearOptions += `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${y}" ${isChecked}>${y}</label></li>`; 
        }
        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        let monthOptions = months.map((month, index) => `<li><label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="${index + 1}">${month}</label></li>`).join('');
        // Ordina le commesse alfabeticamente per il menu a tendina dei filtri
        const commesseOptionsSorted = this.app.utils.ordinaPerNome(this.app.commesse, 'Commessa');

        container.innerHTML = `
            <div id="stats-row-container"></div>
            <div class="search-filters">
                <div class="row gy-3">
                    <div class="col-lg-3 col-md-6"><label class="form-label">Cerca</label><input type="text" class="form-control" id="searchCommesseTask" placeholder="Nome, codice, cliente..."></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Commessa</label><select class="form-select" id="filterCommesse"><option value="">Tutte</option>${commesseOptionsSorted.map(c => `<option value="${c.ID_COMMESSA}">${c.Commessa}</option>`).join('')}</select></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">Stato</label><select class="form-select" id="filterStatoCommesse"><option value="">Tutti</option><option value="In corso" selected>In corso</option><option value="Chiusa">Chiusa</option><option value="Sospesa">Sospesa</option></select></div>
                    <div class="col-lg-1 col-md-3"><label class="form-label">Anno</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterAnnoBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">${currentYear}</button><ul class="dropdown-menu" id="filterAnno" aria-labelledby="filterAnnoBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterAnno">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${yearOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-3"><label class="form-label">Mese</label><div class="dropdown"><button class="btn btn-outline-secondary dropdown-toggle w-100" type="button" id="filterMeseBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Tutti</button><ul class="dropdown-menu" id="filterMese" aria-labelledby="filterMeseBtn"><li><a class="dropdown-item fw-bold" href="#" data-action="toggle-all-filter" data-target-filter="filterMese">Seleziona/Deseleziona</a></li><li><hr class="dropdown-divider"></li>${monthOptions}</ul></div></div>
                    <div class="col-lg-2 col-md-6"><label class="form-label">&nbsp;</label><div class="d-flex gap-2"><button class="btn btn-vp-primary" data-action="filter" title="Applica Filtri"><i class="fas fa-search"></i></button><button class="btn btn-outline-primary" data-action="toggle-all-commesse" id="toggleAllBtn" title="Espandi/Comprimi tutto"><i class="fas fa-expand-arrows-alt"></i></button></div></div>
                </div>
            </div>
            <div id="commesseTaskContainer">${this.renderCommesseCards(this.commesseConTask)}</div>`;
        // salva l'ultima lista mostrata (inizialmente tutte le commesse raggruppate)
        this.lastFilteredData = this.commesseConTask;
        this.updateStats(this.commesseConTask);
        this.bindEvents();
        // Applica i filtri iniziali (incluso l'anno corrente)
        this.filterData();
        // Inizializza tooltip per i componenti renderizzati
        this.initTooltips();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchCommesseTask');
        if (searchInput) {
            let debounceTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => this.filterData(), 300);
            });
        }
        document.getElementById('filterCommesse')?.addEventListener('change', () => this.filterData());
        document.getElementById('filterStatoCommesse')?.addEventListener('change', () => this.filterData());
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
    }

    handleAction(action, id, type, targetElement, e) { // MODIFICATO: Accetta 'e'
        if (targetElement.closest('.management-card-header') && !['toggle-commessa', 'edit-commessa'].includes(action)) {
            e.stopPropagation(); // Ora usa l'oggetto 'e' passato
        }
        if (action === 'toggle-all-filter') {
            e.preventDefault();
        }
        switch (action) {
            case 'add-commessa': this.showNewCommessaModal(); break;
            case 'edit-commessa': this.showEditCommessaModal(id); break;
            case 'add-task': this.showNewTaskModal(id); break;
            case 'edit-task': this.showEditTaskModal(id); break;
            case 'view-task': this.showTaskDetailsModal(id); break;
            case 'toggle-commessa': this.toggleCommessa(id); break;
            case 'view-giornate': this.showGiornateModal(id); break;
            case 'filter': this.filterData(); break;
            case 'toggle-all-commesse': this.toggleAllCommesse(); break;
            case 'toggle-all-filter':
                const targetId = targetElement.dataset.targetFilter;
                this.toggleAllCheckboxes(targetId);
                break;
            case 'export-commesse':
                this.exportCommesseToExcel();
                break;
            default: console.warn(`Azione non gestita: ${action}`);
        }
    }
    
    // ========================================================================
    // SEZIONE: RENDERING DEI COMPONENTI
    // ========================================================================
    
    renderCommesseCards(commesse) {
        if (!commesse || commesse.length === 0) {
            return this.ui.createEmptyState('fas fa-folder-open', 'Nessuna Commessa Trovata', 'Non ci sono commesse che corrispondono ai filtri di ricerca attuali.');
        }
        return commesse.map(c => this.createCommessaCard(c)).join('');
    }

    createCommessaCard(commessa) {
        //console.log('Creazione card per commessa:', commessa);
        const totalTasks = commessa.tasks.length;
        const activeTasks = commessa.tasks.filter(t => t.Stato_Task === 'In corso').length;

        const totalGiornate = commessa.tasks.reduce((sum, task) => {
            // CORREZIONE: Considera solo i task di tipo 'Campo' per il calcolo delle giornate
            if (task.Tipo !== 'Campo') {
                return sum;
            }
            
            // Se il task ha la proprietà gg_effettuate (impostata dal filterData), usala
            if (task.hasOwnProperty('gg_effettuate')) {
                return sum + (parseFloat(task.gg_effettuate) || 0);
            }
            
            // Altrimenti calcola dalle giornate complete (quando non ci sono filtri attivi)
            const giornateCampo = (task.giornate || [])
                .filter(g => g.Tipo === 'Campo')
                .reduce((gSum, g) => {
                    return gSum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0);
                }, 0);
            
            return sum + giornateCampo;
        }, 0);

        // Calcolo Valore Totale, Lavori, Spese e Costo Accounting
        const sommaValoreCampo = commessa.tasks.reduce((sum, task) => (task.Tipo === 'Campo' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
        const sommaValoreMonitoraggio = commessa.tasks.reduce((sum, task) => (task.Tipo === 'Monitoraggio' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
        const valoreComplessivoLavori = sommaValoreCampo + sommaValoreMonitoraggio;
        const valoreComplessivoSpese = commessa.tasks.reduce((sum, task) => sum + (parseFloat(task.valore_spese_maturato) || 0), 0);
        const valoreTotale = valoreComplessivoLavori + valoreComplessivoSpese;
        // Costo Accounting: somma dei Valore_gg dei task di tipo 'Campo' moltiplicata per la Commissione della commessa
        const commissioneCommessa = parseFloat(commessa.Commissione) || 0;
        const costoAccounting = sommaValoreCampo * commissioneCommessa;

        // ======= Calcolo di "costo_totale_attività" =======
        // 1) Per i task di tipo 'Campo' sommiamo per ogni giornata: Costo_gg + esborso spese.
        //    L'esborso è spese_totali (viaggi + vitto/alloggio + altri costi), non
        //    Valore_spese che è il prezzo di vendita: usare quello rendeva il margine
        //    delle spese nullo per costruzione. Vedi docs/REGOLE-SPESE.md.
        const costoCampoDalleGiornate = commessa.tasks
            .filter(t => t.Tipo === 'Campo')
            .reduce((accTask, task) => {
                const giornate = task.giornate || [];
                const costoPerTask = giornate.reduce((accGg, g) => {
                    const costoGg = parseFloat(g.Costo_gg ?? g.costo_gg ?? 0) || 0;
                    const costoSpese = parseFloat(g.spese_totali ?? g.Spese_Totali ?? 0) || 0;
                    return accGg + costoGg + costoSpese;
                }, 0);
                return accTask + costoPerTask;
            }, 0);

        // 2) Per i task di tipo 'Monitoraggio' aggiungiamo il valore maturato:
        //    sommaValoreCampo (calcolato dalle proprietà task.valore_gg_maturato o dalle giornate) * Valore_gg (percentuale)
        const sommaValoreCampoMaturato = commessa.tasks.reduce((sum, task) => {
            if (task.Tipo !== 'Campo') return sum;
            // preferiamo usare task.valore_gg_maturato se presente, altrimenti ricaviamo dalle giornate
            if (typeof task.valore_gg_maturato !== 'undefined' && task.valore_gg_maturato !== null) {
                return sum + (parseFloat(task.valore_gg_maturato) || 0);
            }
            const fromGiornate = (task.giornate || []).reduce((s, g) => s + (parseFloat(g.valore_calcolato ?? g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0), 0);
            return sum + fromGiornate;
        }, 0);

        const costoMonitoraggio = commessa.tasks.reduce((acc, task) => {
            if (task.Tipo === 'Monitoraggio') {
                return acc + (parseFloat(task.valore_gg_maturato) || 0);
            }
            return acc;
        }, 0);

        const costo_totale_attivita = costoCampoDalleGiornate + costoMonitoraggio;
        
        // Calcolo marginalità come percentuale
        const margineAssoluto = (valoreTotale || 0) - (costo_totale_attivita || 0) - (costoAccounting || 0);
        const marginalitaPercentuale = valoreTotale > 0 ? ((margineAssoluto / valoreTotale) * 100) : 0;
        
        // Calcolo giorni previsti totali per i task di tipo 'Campo'
        const totalGgPreviste = commessa.tasks.reduce((sum, task) => {
            if (task.Tipo === 'Campo') {
                return sum + (parseFloat(task.gg_previste) || 0);
            }
            return sum;
        }, 0);
        
        const isUser = this.app.currentUser?.ruolo === 'User';

        return `
            <div class="management-card mb-4">
                <div class="management-card-header" data-action="toggle-commessa" data-id="${commessa.ID_COMMESSA}">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="management-card-title mb-0 me-2"><i class="fas fa-briefcase me-2"></i>${commessa.Commessa}${commessa.Stato_Commessa === 'Chiusa' ? ' <span class="badge bg-secondary ms-2">CHIUSA</span>' : ''}</h5>
                        <div class="d-flex align-items-center gap-2">
                            ${!isUser ? `
                            <span class="badge bg-dark" title="Valore TOTALE">${this.app.utils.formatCurrency(valoreTotale)}</span>
                            <span class="badge bg-warning text-dark" title="Valore Lavori">${this.app.utils.formatCurrency(valoreComplessivoLavori)}</span>
                            <span class="badge bg-danger" title="Valore Spese">${this.app.utils.formatCurrency(valoreComplessivoSpese)}</span>
                            <span class="badge bg-secondary text-dark" title="Costo totale attività">${this.app.utils.formatCurrency(costo_totale_attivita)}</span>
                            <span class="badge ${marginalitaPercentuale >= 0 ? 'bg-info text-dark' : 'bg-danger text-white'}" title="Marginalità Commessa: ${this.app.utils.formatCurrency(margineAssoluto)}">${marginalitaPercentuale.toFixed(1)}%</span>
                            ` : ''}
                            <span class="badge bg-success" title="Giorni effettuati/previsti (Campo)">${totalGiornate.toFixed(1)}${totalGgPreviste > 0 ? ` su ${totalGgPreviste.toFixed(1)}` : ''} gg</span>
                            ${!isUser ? `
                            <button class="btn btn-sm btn-outline-light" data-action="edit-commessa" data-id="${commessa.ID_COMMESSA}" title="Modifica Commessa"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn btn-vp-primary btn-sm" data-action="add-task" data-id="${commessa.ID_COMMESSA}" title="Aggiungi nuovo task"><i class="fas fa-plus me-1"></i>Nuovo Task</button>
                            ` : ''}
                            <button class="commessa-toggle-btn" id="toggleBtn-${commessa.ID_COMMESSA}"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                        <div class="mt-2 text-light small">
                        <i class="fas fa-building me-1"></i> ${commessa.Tipo_Commessa === 'Interna' ? 'Interna' : `Cliente: ${commessa.cliente_nome}`} |
                        <i class="fas fa-user me-1"></i> Responsabile: ${commessa.responsabile_nome}${!isUser ? ` | <i class="fas fa-coins me-1"></i> Costo Accounting: ${this.app.utils.formatCurrency(costoAccounting)}` : ''} |
                        <i class="fas fa-tasks me-1"></i> Task attivi: ${activeTasks}
                    </div>
                </div>
                <div class="collapse" id="commessa-${commessa.ID_COMMESSA}">
                    <div class="management-card-body"><div class="row">${commessa.tasks.length > 0 ? commessa.tasks.map(task => this.createTaskCard(task, commessa)).join('') : '<p class="text-muted">Nessun task associato a questa commessa.</p>'}</div></div>
                </div>
            </div>`;
    }
    
    createTaskCard(task, commessa) {
        const isUser = this.app.currentUser?.ruolo === 'User';

        if (task.Tipo === 'Monitoraggio') {
            const valoreCalcolato = parseFloat(task.valore_gg_maturato) || 0;
            const collaboratore = this.app.collaboratori.find(c => c.ID_COLLABORATORE === task.ID_COLLABORATORE);
            const nomeCollaboratore = collaboratore ? collaboratore.Collaboratore : 'Non assegnato';
            const dataApertura = task.Data_Apertura_Task ? new Date(task.Data_Apertura_Task).toLocaleDateString('it-IT') : '—';
            const dataChiusuraHtml = task.Data_Fine
                ? `<div class="mt-1"><small class="text-muted"><i class="fas fa-calendar-times me-1"></i>Chiuso il ${new Date(task.Data_Fine).toLocaleDateString('it-IT')}</small></div>`
                : '';
            return `
            <div class="col-lg-6 col-xl-4 mb-3">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column">
                    <div class="card-header bg-light border-0"><div class="d-flex justify-content-between align-items-start"><h6 class="card-title mb-0 fw-bold">${task.Task}</h6><span class="status-badge ${task.Stato_Task === 'In corso' ? 'active' : 'inactive'}"><i class="fas fa-circle"></i> ${task.Stato_Task}</span></div><small class="text-muted d-block"><i class="fas fa-tag me-1"></i>${task.Tipo}</small><small class="text-muted d-block mt-1"><i class="fas fa-calendar-plus me-1"></i>Aperto il ${dataApertura}</small>${dataChiusuraHtml}</div>
                    <div class="card-body d-flex flex-column justify-content-center"><p class="card-text text-muted small mb-4">${task.Desc_Task || ''}</p><div class="d-flex justify-content-around align-items-center text-center mt-auto"><div><small class="text-muted d-block mb-1">Assegnato a</small><div class="fw-bold fs-6"><i class="fas fa-user me-2 text-primary"></i>${nomeCollaboratore}</div></div>${!isUser ? `<div><small class="text-muted d-block mb-1">Valore Monitoraggio</small><div class="fw-bold fs-4 text-info">${this.app.utils.formatCurrency(valoreCalcolato)}</div></div>` : ''}</div></div>
                    <div class="card-footer bg-transparent border-0"><div class="action-buttons d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary btn-sm" data-action="view-task" data-id="${task.ID_TASK}" title="Visualizza dettagli"><i class="fas fa-eye"></i></button>${!isUser ? `<button class="btn btn-outline-primary btn-sm" data-action="edit-task" data-id="${task.ID_TASK}" title="Modifica task"><i class="fas fa-edit"></i></button>` : ''}</div></div>
                </div>
            </div>`;
        }

        // Calcoli aggiuntivi richiesti: totale giornate di tipo 'Campo', totale Vitto/Alloggio + Altre spese, totale Spese A/R (viaggi)
        const giornateArray = task.giornate || [];
        const totaleGgCampo = giornateArray.reduce((sum, g) => sum + ((g.Tipo === 'Campo') ? (parseFloat(g.gg) || 0) : 0), 0);
        const totaleVittoAlloggioEAltre = giornateArray.reduce((sum, g) => {
            const vitto = parseFloat(g.Vitto_alloggio ?? g.Vitto_Alloggio ?? g.vitto_alloggio ?? 0) || 0;
            const altri = parseFloat(g.Altri_costi ?? g.altri_costi ?? g.Altri_Costi ?? 0) || 0;
            return sum + vitto + altri;
        }, 0);
        const totaleSpeseAR = giornateArray.reduce((sum, g) => {
            const speseViaggi = parseFloat(g.Spese_Viaggi ?? g.Spese_viaggi ?? g.spese_viaggi ?? g.SpeseViaggi ?? 0) || 0;
            return sum + speseViaggi;
        }, 0);

        const giornateHtml = task.giornate.length > 0
            ? `<button class="btn btn-outline-primary btn-sm w-100 mt-3" data-action="view-giornate" data-id="${task.ID_TASK}"><i class="fas fa-calendar-alt me-1"></i> Visualizza ${task.giornate.length} Date</button>`
            : `<p class="text-muted text-center small mt-3 mb-0"><i class="fas fa-calendar-times me-1"></i> Nessuna giornata registrata</p>`;

        const valoreGgContent = `<div class="fw-bold text-success">${this.app.utils.formatCurrency(task.valore_gg_maturato || 0)}</div><small class="text-muted">Valore gg</small>`;
        const valoreSpeseContent = `<div class="fw-bold text-danger">${this.app.utils.formatCurrency(task.valore_spese_maturato || 0)}</div><small class="text-muted">Val. Spese</small>`;
        //console.log('Tariffa giornaliera per task:', task);
        const tariffaGg = parseFloat(task.Valore_gg ?? 0) || 0;
        const tariffaGgContent = `<div class="fw-bold text-secondary">${this.app.utils.formatCurrency(tariffaGg)}</div><small class="text-muted">Tariffa gg</small>`;
        
        // Calcolo giorni effettuati vs previsti
        const ggPreviste = parseFloat(task.gg_previste) || 0;
        const progressoGgContent = ggPreviste > 0 
            ? `<div class="fw-bold text-primary" data-bs-toggle="tooltip" title="Giorni effettuati su giorni previsti per questo task">${totaleGgCampo.toFixed(1)} su ${ggPreviste.toFixed(1)}</div><small class="text-muted">Progresso gg</small>`
            : `<div class="fw-bold text-primary" data-bs-toggle="tooltip" title="Giorni effettuati (nessun limite previsto)">${totaleGgCampo.toFixed(1)}</div><small class="text-muted">Tot. gg (Campo)</small>`;

        // Task Campo attivo su commessa cliente senza prezzo: le giornate che ci
        // vengono consuntivate producono costo ma ricavo zero. Va corretto.
        const senzaValore = !isUser && this.verificaValoreGgTaskCampo({
            Tipo: task.Tipo, Stato_Task: task.Stato_Task,
            Valore_gg: task.Valore_gg, ID_COMMESSA: task.ID_COMMESSA
        }) !== null;
        const avvisoValoreHtml = senzaValore
            ? `<div class="alert alert-warning py-2 px-2 mb-2 small" data-bs-toggle="tooltip" title="Le giornate consuntivate su questo task risultano a ricavo zero finché non viene indicato il Valore Giorno."><i class="fas fa-exclamation-triangle me-1"></i><strong>Valore Giorno mancante</strong></div>`
            : '';

        return `
            <div class="col-lg-6 col-xl-4 mb-3">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column${senzaValore ? ' border-warning border' : ''}">
                    <div class="card-header bg-light border-0"><div class="d-flex justify-content-between align-items-start"><h6 class="card-title mb-0 fw-bold">${task.Task}</h6><span class="status-badge ${task.Stato_Task === 'In corso' ? 'active' : 'inactive'}"><i class="fas fa-circle"></i> ${task.Stato_Task}</span></div><small class="text-muted d-block"><i class="fas fa-tag me-1"></i>${task.Tipo || 'Campo'}</small></div>
                    <div class="card-body">
                        ${avvisoValoreHtml}
                        <p class="card-text text-muted small">${task.Desc_Task || ''}</p>
                        <div class="row text-center">
                            ${isUser ? `
                            <div class="col-12">${progressoGgContent}</div>
                            ` : `
                            <div class="col-4">${progressoGgContent}</div>
                            <div class="col-4"><div data-bs-toggle="tooltip" title="Tariffa giornaliera applicata al task">${tariffaGgContent}</div></div>
                            <div class="col-4"><div data-bs-toggle="tooltip" title="Valore maturato dai giorni di lavoro">${valoreGgContent}</div></div>
                            `}
                        </div>
                        ${!isUser ? (() => {
                            const parts = [];
                            if ((totaleSpeseAR || 0) > 0) {
                                parts.push(`<div class="col-4"><div class="fw-bold text-info" data-bs-toggle="tooltip" title="Esborso reale per viaggi andata/ritorno (A/R)"><i class="fas fa-plane me-1"></i>${this.app.utils.formatCurrency(totaleSpeseAR)}</div><small class="text-muted">Costo Spese A/R</small></div>`);
                            }
                            if ((totaleVittoAlloggioEAltre || 0) > 0) {
                                parts.push(`<div class="col-4"><div class="fw-bold text-danger" data-bs-toggle="tooltip" title="Esborso reale per vitto/alloggio e altre spese delle giornate">${this.app.utils.formatCurrency(totaleVittoAlloggioEAltre)}</div><small class="text-muted">Costo Vitto/Alloggio + Altre</small></div>`);
                            }
                            if ((task.valore_spese_maturato || 0) > 0) {
                                parts.push(`<div class="col-4"><div class="fw-bold text-danger" data-bs-toggle="tooltip" title="Spese addebitate al cliente: diaria per giornata di campo, oppure spese effettive se il task e' a consuntivo">${this.app.utils.formatCurrency(task.valore_spese_maturato || 0)}</div><small class="text-muted">Val. Spese</small></div>`);
                            }
                            return parts.length > 0 ? `<div class="row text-center mt-2">${parts.join('')}</div>` : '';
                        })() : ''}
                        ${giornateHtml}
                    </div>
                    <div class="card-footer bg-transparent border-0 mt-auto"><div class="action-buttons d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary btn-sm" data-action="view-task" data-id="${task.ID_TASK}" title="Visualizza dettagli"><i class="fas fa-eye"></i></button>${!isUser ? `<button class="btn btn-outline-primary btn-sm" data-action="edit-task" data-id="${task.ID_TASK}" title="Modifica task"><i class="fas fa-edit"></i></button>` : ''}</div></div>
                </div>
            </div>`;
    }

    // ========================================================================
    // SEZIONE: LOGICA DI INTERAZIONE E FILTRI
    // ========================================================================
    
    /**
     * NUOVO: Metodo per gestire la selezione/deselezione di tutte le checkbox in un filtro.
     * @param {string} targetId L'ID del contenitore (ul) del filtro.
     */
    toggleAllCheckboxes(targetId) {
        const container = document.getElementById(targetId);
        if (!container) return;

        const checkboxes = container.querySelectorAll('li label input[type="checkbox"]');
        if (checkboxes.length === 0) return;

        const allAreChecked = Array.from(checkboxes).every(cb => cb.checked);
        const newState = !allAreChecked;

        checkboxes.forEach(cb => {
            cb.checked = newState;
        });

        // Simula un evento 'change' per attivare l'aggiornamento dell'interfaccia e dei dati
        container.dispatchEvent(new Event('change'));
    }

    toggleCommessa(commessaId, forceState = null) {
        const collapseElement = document.getElementById(`commessa-${commessaId}`);
        const toggleBtn = document.getElementById(`toggleBtn-${commessaId}`);
        if (!collapseElement || !toggleBtn) return;
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        if (forceState === true) { bsCollapse.show(); } 
        else if (forceState === false) { bsCollapse.hide(); } 
        else { bsCollapse.toggle(); }
        const onShown = () => this.updateToggleButton(toggleBtn, true);
        const onHidden = () => this.updateToggleButton(toggleBtn, false);
        collapseElement.addEventListener('shown.bs.collapse', onShown, { once: true });
        collapseElement.addEventListener('hidden.bs.collapse', onHidden, { once: true });
        this.updateToggleButton(toggleBtn, collapseElement.classList.contains('show'));
    }

    updateToggleButton(btn, isShown) {
        if (!btn) return;
        btn.classList.toggle('expanded', isShown);
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', !isShown);
            icon.classList.toggle('fa-chevron-up', isShown);
        }
    }

    toggleAllCommesse() {
        const allCollapses = document.querySelectorAll('#commesseTaskContainer .collapse');
        const isAnyCollapsed = Array.from(allCollapses).some(el => !el.classList.contains('show'));
        allCollapses.forEach(el => {
            const id = el.id.replace('commessa-', '');
            this.toggleCommessa(id, isAnyCollapsed);
        });
        const toggleAllBtn = document.getElementById('toggleAllBtn');
        toggleAllBtn.innerHTML = isAnyCollapsed ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
        toggleAllBtn.title = isAnyCollapsed ? 'Comprimi tutto' : 'Espandi tutto';
    }



    // Inizializza i tooltip Bootstrap all'interno del contenitore dei task/commesse
    initTooltips() {
        try {
            const container = document.getElementById('commesseTaskContainer');
            if (!container) return;
            const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(el => {
                try { new bootstrap.Tooltip(el); } catch (e) { /* ignore individual tooltip init errors */ }
            });
        } catch (err) {
            console.debug('[initTooltips] failed to init tooltips', err);
        }
    }
    
    filterData() {
        const searchText = document.getElementById('searchCommesseTask')?.value.toLowerCase() || '';
        const selectedCommessa = document.getElementById('filterCommesse')?.value || '';
        const selectedStato = document.getElementById('filterStatoCommesse')?.value || '';
        const selectedYears = Array.from(document.querySelectorAll('#filterAnno input:checked')).map(el => parseInt(el.value));
        const selectedMonths = Array.from(document.querySelectorAll('#filterMese input:checked')).map(el => parseInt(el.value));

        this.activeDateFilter = (selectedYears.length > 0 || selectedMonths.length > 0) ? { years: selectedYears, months: selectedMonths } : null;

        const allData = this.groupTasksByCommessa();
        let filteredData = allData;

        if (searchText || selectedCommessa || selectedStato) {
            filteredData = allData.filter(commessa => {
                const matchCommessaId = !selectedCommessa || commessa.ID_COMMESSA == selectedCommessa;
                const matchStato = !selectedStato || commessa.Stato_Commessa === selectedStato;
                const matchSearch = !searchText ||
                    (commessa.Commessa || '').toLowerCase().includes(searchText) ||
                    (commessa.cliente_nome || '').toLowerCase().includes(searchText) ||
                    commessa.tasks.some(task => (task.Task || '').toLowerCase().includes(searchText));
                return matchCommessaId && matchStato && matchSearch;
            });
        }

        if (this.activeDateFilter) {
            const finalData = [];

            // Helper: filtra giornate nel periodo selezionato
            const isGiornataNelPeriodo = (g) => {
                const d = new Date(g.Data);
                const yearMatch = selectedYears.length === 0 || selectedYears.includes(d.getFullYear());
                const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(d.getMonth() + 1);
                return yearMatch && monthMatch;
            };

            filteredData.forEach(commessa => {
                const activeTasksInPeriod = [];

                // Raccoglie tutte le giornate Campo nel periodo selezionato per la commessa
                const tutteGiornateCampoNelPeriodo = [];
                commessa.tasks.forEach(t => {
                    if (t.Tipo === 'Monitoraggio') return;
                    (t.giornate || []).filter(isGiornataNelPeriodo).filter(g => g.Tipo === 'Campo').forEach(g => {
                        tutteGiornateCampoNelPeriodo.push(g);
                    });
                });

                // Calcola il valore Monitoraggio per uno specifico task,
                // filtrando le giornate Campo sia per il periodo selezionato
                // sia per l'intervallo di validità del task (Data_Apertura_Task → Data_Fine)
                const calcolaValoreMonitoraggioNelPeriodo = (monTask) => {
                    const tariffa = parseFloat(monTask.Valore_gg) || 0;
                    if (tariffa <= 0) return 0;
                    const dataApertura = monTask.Data_Apertura_Task ? monTask.Data_Apertura_Task.substring(0, 10) : null;
                    const dataFine = monTask.Data_Fine ? monTask.Data_Fine.substring(0, 10) : null;
                    const somma = tutteGiornateCampoNelPeriodo
                        .filter(g => {
                            const dataG = (g.Data || '').substring(0, 10);
                            if (dataApertura && dataG < dataApertura) return false;
                            if (dataFine && dataG > dataFine) return false;
                            return true;
                        })
                        .reduce((sum, g) => sum + (parseFloat(g.valore_calcolato) || 0), 0);
                    return somma * tariffa;
                };

                commessa.tasks.forEach(task => {
                    const giornateNelPeriodo = task.giornate?.filter(isGiornataNelPeriodo) || [];

                    if (giornateNelPeriodo.length > 0) {
                        const giornateCampoNelPeriodo = giornateNelPeriodo.filter(g => g.Tipo === 'Campo');

                        const gg_effettuate = giornateCampoNelPeriodo.reduce((sum, g) => {
                            const gg = parseFloat(g.gg) || 0;
                            return sum + gg;
                        }, 0);

                        const valore_gg_maturato = task.Tipo === 'Monitoraggio'
                            ? calcolaValoreMonitoraggioNelPeriodo(task)
                            : giornateCampoNelPeriodo.reduce((sum, g) => sum + (parseFloat(g.valore_calcolato) || 0), 0);
                        const valore_spese_maturato = giornateNelPeriodo.reduce((sum, g) => sum + (parseFloat(g.Valore_spese) || 0), 0);

                        activeTasksInPeriod.push({
                            ...task,
                            giornate: giornateNelPeriodo,
                            gg_effettuate,
                            valore_gg_maturato,
                            valore_spese_maturato,
                        });
                    } else if (!task.giornate || task.giornate.length === 0) {
                        // Task senza giornate (es. appena creato): verifica Data_Apertura_Task
                        const dataApertura = task.Data_Apertura_Task ? new Date(task.Data_Apertura_Task) : null;
                        const yearMatch = selectedYears.length === 0 || (dataApertura && selectedYears.includes(dataApertura.getFullYear()));
                        const monthMatch = selectedMonths.length === 0 || (dataApertura && selectedMonths.includes(dataApertura.getMonth() + 1));
                        if (yearMatch && monthMatch) {
                            activeTasksInPeriod.push({
                                ...task,
                                giornate: [],
                                gg_effettuate: 0,
                                valore_gg_maturato: task.Tipo === 'Monitoraggio'
                                    ? calcolaValoreMonitoraggioNelPeriodo(task)
                                    : 0,
                                valore_spese_maturato: 0
                            });
                        }
                    }
                });

                if (activeTasksInPeriod.length > 0) {
                    const tasksToShow = [...activeTasksInPeriod];
                    // Aggiungi task Monitoraggio non ancora presenti, ricalcolando il valore sul periodo
                    commessa.tasks.forEach(task => {
                        if (task.Tipo === 'Monitoraggio' && !tasksToShow.some(t => t.ID_TASK === task.ID_TASK)) {
                            tasksToShow.push({
                                ...task,
                                valore_gg_maturato: calcolaValoreMonitoraggioNelPeriodo(task),
                            });
                        }
                    });

                    finalData.push({ ...commessa, tasks: tasksToShow });
                }
            });
            filteredData = finalData;
        }

        document.getElementById('commesseTaskContainer').innerHTML = this.renderCommesseCards(filteredData);
        // tieni traccia dei dati correnti mostrati per l'export
        this.lastFilteredData = filteredData;
        this.updateStats(filteredData);
        // inizializza tooltip sui nuovi elementi
        this.initTooltips();
    }

    // ========================================================================
    // SEZIONE: GESTIONE MODALI
    // ========================================================================

    showNewCommessaModal() {
        const modalTitle = 'Crea Nuova Commessa';
        const modalId = 'newCommessaModal';
        const modalBody = this.getCommessaFormHTML();
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Commessa</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCommessaFormListeners(`${modalId}_form`);
    }

    showEditCommessaModal(commessaId) {
        const commessa = this.commesseConTask.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) { this.ui.showToast('Commessa non trovata.', 'error'); return; }

        const modalTitle = `Modifica Commessa: ${commessa.Commessa}`;
        const modalId = `editCommessaModal_${commessaId}`;
        const modalBody = this.getCommessaFormHTML(commessa);
        
        const canDelete = commessa.tasks.length === 0;
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? 'Elimina prima i task associati' : 'Elimina commessa'}">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteCommessa(commessaId)
        };
        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addCommessaFormListeners(`${modalId}_form`);
    }

    showNewTaskModal(commessaId) {
        const commessa = this.app.commesse.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) return;
        const modalTitle = `Nuovo Task per: ${commessa.Commessa}`;
        const defaultTaskData = {
            ID_COMMESSA: commessaId, Tipo: 'Campo', Stato_Task: 'In corso',
            Data_Apertura_Task: new Date().toISOString().split('T')[0],
            Spese_Comprese_Viaggi: 'No', Spese_Comprese_Vitto_Alloggio: 'No'
        };
        const modalBody = this.getTaskFormHTML(defaultTaskData);
        const modalId = `newTaskModal_${commessaId}`;
        const modalActions = [
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Crea Task</button>` }
        ];
        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addTaskFormListeners(`${modalId}_form`);
    }

    showEditTaskModal(taskId) {
        const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
        if (!task) { this.ui.showToast('Task non trovato.', 'error'); return; }

        const modalTitle = `Modifica Task: ${task.Task}`;
        const modalBody = this.getTaskFormHTML(task);
        const modalId = `editTaskModal_${taskId}`;

        const canDelete = task.giornate.length === 0;
        const deleteButton = {
            html: `<button type="button" class="btn btn-danger me-auto" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? 'Elimina prima le giornate associate' : 'Elimina task'}">Elimina</button>`,
            selector: `.btn-danger`,
            handler: () => this.handleDeleteTask(taskId)
        };

        const modalActions = [
            deleteButton,
            { html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>' },
            { html: `<button type="submit" form="${modalId}_form" class="btn btn-primary">Salva Modifiche</button>` }
        ];

        this.ui.createModal(modalId, modalTitle, modalBody, modalActions, { size: 'modal-lg' });
        this.addTaskFormListeners(`${modalId}_form`);
    }
    

    /**
     * MODIFICATO: Mostra i dettagli del task con un layout personalizzato in base al tipo.
     * @param {string} taskId L'ID del task da visualizzare.
     */

    showTaskDetailsModal(taskId) {
            // MODIFICATO: Cerca il task nella struttura dati corretta e completa.
            const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
            console.log('Dettagli Task:', task);
            if (!task) {
                this.ui.showToast('Task non trovato.', 'error');
                return;
            }

            // Se è attivo un filtro data, usa le giornate filtrate per i calcoli, altrimenti tutte
            let giornateDaConsiderare = task.giornate;
            if (this.activeDateFilter) {
                giornateDaConsiderare = task.giornate.filter(g => {
                    const dataGiornata = new Date(g.Data);
                    const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(dataGiornata.getFullYear());
                    const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(dataGiornata.getMonth() + 1);
                    return yearMatch && monthMatch;
                });
            }
            
            // Ricalcola i totali in base alle giornate considerate
            const gg_effettuate = giornateDaConsiderare.reduce((sum, g) => sum + (parseFloat(g.gg) || 0), 0);
            const valore_gg_maturato = giornateDaConsiderare.reduce((sum, g) => sum + (parseFloat(g.valore_calcolato) || 0), 0);
            //const valore_spese_maturato = giornateDaConsiderare.reduce((sum, g) => sum + (parseFloat(g.spese_totali) || 0), 0);
            const valore_spese_maturato = giornateDaConsiderare.reduce((sum, g) => sum + (parseFloat(g.Valore_spese) || 0), 0);
            const commessa = this.commesseConTask.find(c => c.ID_COMMESSA === task.ID_COMMESSA);
            let modalBody = '';
            const modalTitle = `Dettagli Task: ${task.Task}`;

            const baseDetails = `
                <dl class="row">
                    <dt class="col-sm-4">ID Task</dt><dd class="col-sm-8">${task.ID_TASK}</dd>
                    <dt class="col-sm-4">Commessa</dt><dd class="col-sm-8">${task.commessa_nome || 'N/D'}</dd>
                    <dt class="col-sm-4">Cliente</dt><dd class="col-sm-8">${task.cliente_nome || 'N/D'}</dd>
                    <dt class="col-sm-4">Stato</dt><dd class="col-sm-8"><span class="badge ${task.Stato_Task === 'In corso' ? 'bg-success' : 'bg-secondary'}">${task.Stato_Task}</span></dd>
                    <dt class="col-sm-4">Data Apertura</dt><dd class="col-sm-8">${new Date(task.Data_Apertura_Task).toLocaleDateString('it-IT')}</dd>
                    ${task.Data_Inizio ? `<dt class="col-sm-4">Data Inizio</dt><dd class="col-sm-8">${new Date(task.Data_Inizio).toLocaleDateString('it-IT')}</dd>` : ''}
                    ${task.Data_Fine ? `<dt class="col-sm-4">Data Chiusura</dt><dd class="col-sm-8">${new Date(task.Data_Fine).toLocaleDateString('it-IT')}</dd>` : ''}
                </dl>
            `;

            const isUser = this.app.currentUser?.ruolo === 'User';

            switch (task.Tipo) {
                case 'Monitoraggio': {
                    if (isUser) {
                        modalBody = baseDetails;
                    } else {
                        const tariffaPercentuale = (parseFloat(task.Valore_gg) * 100).toFixed(0) + '%';
                        const valoreCalcolato = parseFloat(task.valore_gg_maturato) || 0;
                        modalBody = `${baseDetails}<hr><h5>Dettagli Economici</h5><dl class="row"><dt class="col-sm-4">Tariffa Monitoraggio</dt><dd class="col-sm-8">${tariffaPercentuale}</dd><dt class="col-sm-4">Valore Monitoraggio</dt><dd class="col-sm-8"><strong>${this.app.utils.formatCurrency(valoreCalcolato)}</strong></dd></dl>`;
                    }
                    break;
                }
                case 'Campo': {
                    const giornateSection = `<hr><h5>Dettagli Giornate</h5><dl class="row"><dt class="col-sm-4">Giorni Previsti</dt><dd class="col-sm-8">${task.gg_previste || 'Non specificato'}</dd><dt class="col-sm-4">Giorni Effettuati</dt><dd class="col-sm-8">${gg_effettuate.toFixed(1)}</dd></dl>`;
                    if (isUser) {
                        modalBody = `${baseDetails}${giornateSection}`;
                    } else {
                        modalBody = `${baseDetails}<hr><h5>Dettagli Economici</h5><dl class="row"><dt class="col-sm-4">Valore Giorno (€)</dt><dd class="col-sm-8">${this.app.utils.formatCurrency(task.Valore_gg)}</dd><dt class="col-sm-4">Valore Maturato (€)</dt><dd class="col-sm-8"><strong>${this.app.utils.formatCurrency(valore_gg_maturato)}</strong></dd><dt class="col-sm-4">Viaggi</dt><dd class="col-sm-8">${this.descrizioneRegimeSpese(task.Spese_Comprese_Viaggi, task.Valore_Spese_std_Viaggi)}</dd><dt class="col-sm-4">Vitto/Alloggio + Altre</dt><dd class="col-sm-8">${this.descrizioneRegimeSpese(task.Spese_Comprese_Vitto_Alloggio, task.Valore_Spese_std_Vitto_Alloggio)}</dd><dt class="col-sm-4">Spese Maturate (€)</dt><dd class="col-sm-8"><strong>${this.app.utils.formatCurrency(valore_spese_maturato)}</strong></dd></dl>${giornateSection}`;
                    }
                    break;
                }
                case 'Promo': case 'Sviluppo': case 'Formazione': {
                    modalBody = `${baseDetails}<hr><h5>Dettagli Giornate</h5><dl class="row"><dt class="col-sm-4">Giorni Previsti</dt><dd class="col-sm-8">${task.gg_previste || 'Non specificato'}</dd><dt class="col-sm-4">Giorni Effettuati</dt><dd class="col-sm-8">${gg_effettuate.toFixed(1)}</dd></dl>`;
                    break;
                }
                default:
                    modalBody = `${baseDetails}`;
                    break;
            }

            const finalHtml = `<div class="container-fluid">${modalBody}</div>`;
            const modalActions = [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }];
            this.ui.createModal(`taskDetailsModal_${taskId}`, modalTitle, finalHtml, modalActions, { size: 'modal-lg' });
    }

    showGiornateModal(taskId) {
            // MODIFICATO: Cerca il task nella struttura dati corretta e completa.
            const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
            
            if (!task) {
                this.ui.showToast('Task non trovato.', 'error');
                return;
            }

            let giornateTask = task.giornate;

            // Applica i filtri di data attivi alla lista delle giornate
            if (this.activeDateFilter) {
                giornateTask = giornateTask.filter(g => {
                    const dataGiornata = new Date(g.Data);
                    const yearMatch = this.activeDateFilter.years.length === 0 || this.activeDateFilter.years.includes(dataGiornata.getFullYear());
                    const monthMatch = this.activeDateFilter.months.length === 0 || this.activeDateFilter.months.includes(dataGiornata.getMonth() + 1);
                    return yearMatch && monthMatch;
                });
            }

            const modalTitle = `<i class="fas fa-calendar-day me-2"></i>Giornate - ${task.Task}`;

            const isUser = this.app.currentUser?.ruolo === 'User';

            const modalBody = giornateTask.length === 0
                ? '<p class="text-muted">Nessuna giornata registrata per questo task nel periodo selezionato.</p>'
                : (() => {
                    // Esborso reale della giornata, spaccato nelle due voci che
                    // interessano: viaggi A/R da una parte, vitto/alloggio e altro
                    // dall'altra. Non e' il prezzo addebitato al cliente, che sta
                    // nella colonna Valore Spese.
                    const costoViaggiGiornata = (g) => parseFloat(g.Spese_Viaggi ?? g.Spese_viaggi ?? g.spese_viaggi ?? 0) || 0;
                    const costoVittoAltreGiornata = (g) => (parseFloat(g.Vitto_alloggio ?? g.Vitto_Alloggio ?? g.vitto_alloggio ?? 0) || 0)
                        + (parseFloat(g.Altri_costi ?? g.altri_costi ?? g.Altri_Costi ?? 0) || 0);

                    const totals = giornateTask.reduce((acc, g) => {
                        const gg = parseFloat(g.gg) || 0;
                        const valore = parseFloat(g.valore_calcolato ?? g.Valore_calcolato ?? 0) || 0;
                        const valoreSpese = parseFloat(g.Valore_spese ?? g.valore_spese ?? 0) || 0;
                        acc.num_gg += (g.Tipo === 'Campo' ? gg : 0);
                        acc.valore_tot += valore;
                        acc.costo_viaggi += costoViaggiGiornata(g);
                        acc.costo_vitto_altre += costoVittoAltreGiornata(g);
                        acc.valore_spese += valoreSpese;
                        return acc;
                    }, { num_gg: 0, valore_tot: 0, costo_viaggi: 0, costo_vitto_altre: 0, valore_spese: 0 });

                    return `<div class="table-responsive">
                        <table class="table table-sm table-hover">
                            <thead><tr><th>Data</th><th>Collaboratore</th><th>gg</th><th>Tipo</th><th>Note</th>${!isUser ? '<th class="text-end">Costo Viaggi (€)</th><th class="text-end">Costo Vitto/Alloggio + Altre (€)</th><th class="text-end">Valore Spese (€)</th><th class="text-end">Valore gg (€)</th>' : ''}</tr></thead>
                            <tbody>
                                ${giornateTask.map(g => {
                                    const collab = this.app.collaboratori.find(c => c.ID_COLLABORATORE === g.ID_COLLABORATORE);
                                    const valoreGiornata = this.app.utils.formatCurrency(g.valore_calcolato || g.Valore_calcolato || 0);
                                    const costoViaggi = this.app.utils.formatCurrency(costoViaggiGiornata(g));
                                    const costoVittoAltre = this.app.utils.formatCurrency(costoVittoAltreGiornata(g));
                                    const valoreSpese = this.app.utils.formatCurrency(g.Valore_spese || g.valore_spese || 0);
                                    return `<tr>
                                        <td>${new Date(g.Data).toLocaleDateString('it-IT')}</td>
                                        <td>${collab?.Collaboratore || 'N/A'}</td>
                                        <td><span class="badge bg-primary">${g.gg}g</span></td>
                                        <td>${g.Tipo}</td>
                                        <td>${g.Note || '-'}</td>
                                        ${!isUser ? `<td class="text-end fw-bold">${costoViaggi}</td><td class="text-end fw-bold">${costoVittoAltre}</td><td class="text-end fw-bold text-danger">${valoreSpese}</td><td class="text-end fw-bold">${valoreGiornata}</td>` : ''}
                                    </tr>`;
                                }).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="table-active">
                                    <td colspan="2" class="text-start"><strong>Riepilogo</strong></td>
                                    <td class="text-end"><strong>${totals.num_gg.toFixed(1)}</strong></td>
                                    <td></td>
                                    <td></td>
                                    ${!isUser ? `<td class="text-end"><strong>${this.app.utils.formatCurrency(totals.costo_viaggi)}</strong></td><td class="text-end"><strong>${this.app.utils.formatCurrency(totals.costo_vitto_altre)}</strong></td><td class="text-end"><strong>${this.app.utils.formatCurrency(totals.valore_spese)}</strong></td><td class="text-end"><strong>${this.app.utils.formatCurrency(totals.valore_tot)}</strong></td>` : ''}
                                </tr>
                            </tfoot>
                        </table>
                    </div>`;
                })();

            const modalActions = [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }];
            this.ui.createModal(`giornateModal_${taskId}`, modalTitle, modalBody, modalActions, { size: 'modal-xl' });
    }
        
    // ========================================================================
    // SEZIONE: GESTIONE FORM E SALVATAGGI
    // ========================================================================

    addCommessaFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const commessaId = form.id.includes('editCommessaModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleCommessaFormSubmit(e, commessaId));
        const tipoSelect = form.querySelector('#Tipo_Commessa');
        const clienteContainer = form.querySelector('#clienteFieldContainer');
        const responsabileContainer = form.querySelector('#responsabileFieldContainer');
        const commissioneContainer = form.querySelector('#commissioneFieldContainer');
        const toggleCommessaFields = () => {
            const isCliente = tipoSelect.value === 'Cliente';
            clienteContainer.style.display = isCliente ? 'block' : 'none';
            responsabileContainer.style.display = isCliente ? 'block' : 'none';
            commissioneContainer.style.display = isCliente ? 'block' : 'none';
            form.querySelector('#ID_CLIENTE').required = isCliente;
            form.querySelector('#ID_COLLABORATORE').required = isCliente;
            form.querySelector('#Commissione').required = isCliente;
        };
        tipoSelect?.addEventListener('change', toggleCommessaFields);
        toggleCommessaFields();

        const statoSelect = form.querySelector('#Stato_Commessa');
        const avviso = form.querySelector('#avvisoChiusuraTask');
        const statoIniziale = statoSelect?.value;
        const toggleAvvisoChiusura = () => {
            if (!avviso || !statoSelect) return;
            const aperti = parseInt(avviso.dataset.taskAperti, 10) || 0;
            const chiude = ['Chiusa', 'Archiviata'].includes(statoSelect.value) && statoSelect.value !== statoIniziale;
            avviso.classList.toggle('d-none', !(chiude && aperti > 0));
            if (chiude && aperti > 0) {
                const archivia = statoSelect.value === 'Archiviata';
                avviso.textContent = aperti === 1
                    ? `Al salvataggio verrà ${archivia ? 'archiviato' : 'chiuso'} anche il task ancora aperto di questa commessa.`
                    : `Al salvataggio verranno ${archivia ? 'archiviati' : 'chiusi'} anche i ${aperti} task ancora aperti di questa commessa.`;
            }
        };
        statoSelect?.addEventListener('change', toggleAvvisoChiusura);
        toggleAvvisoChiusura();
    }

    async handleCommessaFormSubmit(event, commessaId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const commessaData = Object.fromEntries(formData.entries());

        // Client-side validation: se la commessa è di tipo 'Cliente' richiediamo un responsabile valido
        if (commessaData.Tipo_Commessa === 'Cliente') {
            const coll = commessaData.ID_COLLABORATORE;
            if (!coll || coll === '') {
                this.ui.showToast('Seleziona un responsabile per la commessa (Responsabile).', 'error');
                const field = form.querySelector('#ID_COLLABORATORE');
                if (field) field.focus();
                return;
            }
        }

        if (commessaData.Tipo_Commessa === 'Interna') {
            commessaData.ID_CLIENTE = null;
            commessaData.ID_COLLABORATORE = null;
            commessaData.Commissione = null;
        }
        // Do not generate ID_COMMESSA on the client: let the server assign a unique ID
        // (client-side generation previously could produce duplicates / collisions)
        if (!commessaId) {
            // ensure we don't send an empty or placeholder ID
            delete commessaData.ID_COMMESSA;
        }

        // Debug: log payload sent to server to help diagnose constraint errors
        try { console.debug('Commessa payload:', commessaData); } catch (e) { /* ignore */ }

        try {
            const result = commessaId
                ? await this.api.updateCommessa(commessaId, commessaData)
                : await this.api.createCommessa(commessaData);
            if (result.success) {
                this.ui.showToast(`Commessa ${commessaId ? 'aggiornata' : 'creata'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio della commessa.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    addTaskFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const taskId = form.id.includes('editTaskModal') ? form.id.split('_')[1] : null;
        form.addEventListener('submit', (e) => this.handleTaskFormSubmit(e, taskId));
        const tipoSelect = form.querySelector('#Tipo');
        const assegnatoContainer = form.querySelector('#assegnatoAContainer');
        const speseViaggiSelect = form.querySelector('#Spese_Comprese_Viaggi');
        const speseViaggiContainer = form.querySelector('#valoreSpeseViaggiContainer');
        const speseVittoSelect = form.querySelector('#Spese_Comprese_Vitto_Alloggio');
        const speseVittoContainer = form.querySelector('#valoreSpeseVittoContainer');
        const statoSelect = form.querySelector('#Stato_Task');
        const dataFineInput = form.querySelector('#Data_Fine');
        const toggleAssegnato = () => { assegnatoContainer.style.display = tipoSelect.value === 'Monitoraggio' ? 'block' : 'none'; };
        // La diaria ha senso solo se la categoria NON è già compresa nel valore giornata.
        const toggleSpeseViaggi = () => { speseViaggiContainer.style.display = speseViaggiSelect.value === 'No' ? 'block' : 'none'; };
        const toggleSpeseVitto = () => { speseVittoContainer.style.display = speseVittoSelect.value === 'No' ? 'block' : 'none'; };
        // Quando lo stato diventa Chiuso/Archiviato, imposta Data_Fine a oggi se vuota
        const handleStatoChange = () => {
            if ((statoSelect.value === 'Chiuso' || statoSelect.value === 'Archiviato') && dataFineInput && !dataFineInput.value) {
                dataFineInput.value = new Date().toISOString().split('T')[0];
            }
        };
        // Quando Data_Fine viene impostata ad una data passata o odierna, chiudi il task
        const handleDataFineChange = () => {
            if (dataFineInput && dataFineInput.value && statoSelect) {
                const oggi = new Date().toISOString().split('T')[0];
                if (dataFineInput.value <= oggi) {
                    statoSelect.value = 'Chiuso';
                }
            }
        };
        // Warning: task Monitoraggio attivo già presente sulla stessa commessa
        const commessaSelect = form.querySelector('#ID_COMMESSA');
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert alert-warning py-2 mt-2 mb-0 d-none';
        warningDiv.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i><strong>Attenzione:</strong> esiste già un task Monitoraggio attivo per questa commessa. Chiudi il task Monitoraggio attivo prima di crearne uno nuovo.';
        tipoSelect?.closest('.col-md-6, .mb-3')?.appendChild(warningDiv);

        const checkMonitoraggioAttivo = () => {
            if (tipoSelect?.value !== 'Monitoraggio') {
                warningDiv.classList.add('d-none');
                return;
            }
            const commessaId = commessaSelect?.value;
            const commessaConTask = this.commesseConTask?.find(c => c.ID_COMMESSA === commessaId);
            const hasActive = commessaConTask?.tasks.some(t =>
                t.Tipo === 'Monitoraggio' &&
                !['Chiuso', 'Archiviato'].includes(t.Stato_Task) &&
                t.ID_TASK !== taskId
            );
            warningDiv.classList.toggle('d-none', !hasActive);
        };

        // Avviso: task Campo attivo su commessa cliente senza Valore Giorno
        const valoreGgInput = form.querySelector('#Valore_gg');
        const valoreWarning = document.createElement('div');
        valoreWarning.className = 'alert alert-warning py-2 mt-2 mb-0 d-none';
        valoreWarning.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i><strong>Valore Giorno obbligatorio:</strong> '
            + 'è un task Campo su una commessa cliente. Senza prezzo le giornate consuntivate risulterebbero a ricavo zero. '
            + 'In alternativa metti il task in stato "Sospeso".';
        valoreGgInput?.closest('.col-md-4, .mb-3')?.appendChild(valoreWarning);

        const checkValoreGg = () => {
            if (!valoreGgInput) return;
            const errore = this.verificaValoreGgTaskCampo({
                Tipo: tipoSelect?.value,
                Stato_Task: statoSelect?.value,
                Valore_gg: valoreGgInput.value,
                ID_COMMESSA: commessaSelect?.value
            });
            valoreWarning.classList.toggle('d-none', !errore);
            valoreGgInput.classList.toggle('is-invalid', !!errore);
        };

        tipoSelect?.addEventListener('change', toggleAssegnato);
        tipoSelect?.addEventListener('change', checkMonitoraggioAttivo);
        tipoSelect?.addEventListener('change', checkValoreGg);
        commessaSelect?.addEventListener('change', checkMonitoraggioAttivo);
        commessaSelect?.addEventListener('change', checkValoreGg);
        valoreGgInput?.addEventListener('input', checkValoreGg);
        statoSelect?.addEventListener('change', checkValoreGg);
        speseViaggiSelect?.addEventListener('change', toggleSpeseViaggi);
        speseVittoSelect?.addEventListener('change', toggleSpeseVitto);
        statoSelect?.addEventListener('change', handleStatoChange);
        dataFineInput?.addEventListener('change', handleDataFineChange);
        toggleAssegnato();
        toggleSpeseViaggi();
        toggleSpeseVitto();
        checkMonitoraggioAttivo();
        checkValoreGg();
    }

    /**
     * Verifica che un task 'Campo' attivo su una commessa cliente abbia un
     * prezzo di vendita. Restituisce il messaggio d'errore, o null se va bene.
     *
     * Stessa regola applicata dal backend in TaskAPI: qui serve solo a dare un
     * riscontro immediato, il controllo che conta è quello lato server.
     */
    verificaValoreGgTaskCampo(taskData) {
        if (taskData.Tipo !== 'Campo') return null;

        // In creazione lo stato può mancare: in ANA_TASK il default è 'In corso'
        const stato = taskData.Stato_Task || 'In corso';
        if (stato !== 'In corso') return null;

        const valore = parseFloat(taskData.Valore_gg);
        if (!isNaN(valore) && valore > 0) return null;

        const commessa = this.app.commesse.find(c => String(c.ID_COMMESSA) === String(taskData.ID_COMMESSA));
        if (!commessa || commessa.Tipo_Commessa !== 'Cliente') return null;

        return `Il task è di tipo "Campo" sulla commessa cliente "${commessa.Commessa}": `
             + `per tenerlo "In corso" devi indicare il Valore Giorno (€), altrimenti le giornate `
             + `consuntivate risulterebbero a ricavo zero. In alternativa mettilo in stato "Sospeso".`;
    }

    async handleTaskFormSubmit(event, taskId = null) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const taskData = Object.fromEntries(formData.entries());
        for (const key in taskData) { if (taskData[key] === '') { taskData[key] = null; } }
        
        // Se stiamo modificando un task esistente, controlla se la commessa è cambiata
        if (taskId) {
            const currentTask = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK == taskId);
            if (currentTask && currentTask.ID_COMMESSA != taskData.ID_COMMESSA) {
                // La commessa è cambiata, chiedi conferma
                const oldCommessa = this.app.commesse.find(c => c.ID_COMMESSA == currentTask.ID_COMMESSA);
                const newCommessa = this.app.commesse.find(c => c.ID_COMMESSA == taskData.ID_COMMESSA);
                
                const confirmMessage = `Attenzione! Stai spostando il task "${currentTask.Task}" dalla commessa "${oldCommessa?.Commessa || 'N/D'}" alla commessa "${newCommessa?.Commessa || 'N/D'}".\n\nQuesta operazione comporterà il trasferimento di tutte le giornate associate al task nella nuova commessa.\n\nSei sicuro di voler procedere?`;
                
                if (!confirm(confirmMessage)) {
                    return; // L'utente ha annullato l'operazione
                }
            }
        }
        
        // Un task Campo attivo su commessa cliente deve avere un prezzo di vendita:
        // senza, le giornate consuntivate producono costo ma ricavo zero.
        // Le commesse interne sono escluse: lì il lavoro non si vende.
        const erroreValore = this.verificaValoreGgTaskCampo(taskData);
        if (erroreValore) {
            this.ui.showToast(erroreValore, 'error');
            return;
        }

        // Blocca la creazione di un secondo task Monitoraggio attivo per la stessa commessa
        if (!taskId && taskData.Tipo === 'Monitoraggio' && taskData.ID_COMMESSA) {
            const commessaConTask = this.commesseConTask?.find(c => c.ID_COMMESSA === taskData.ID_COMMESSA);
            const hasActive = commessaConTask?.tasks.some(t =>
                t.Tipo === 'Monitoraggio' && !['Chiuso', 'Archiviato'].includes(t.Stato_Task)
            );
            if (hasActive) {
                const taskAttivo = commessaConTask.tasks.find(t =>
                    t.Tipo === 'Monitoraggio' && !['Chiuso', 'Archiviato'].includes(t.Stato_Task)
                );
                this.ui.showToast(
                    `Impossibile creare il task: il task Monitoraggio "${taskAttivo?.Task || ''}" è ancora attivo. Chiudilo prima di crearne uno nuovo.`,
                    'error'
                );
                return;
            }
        }

        // Controlla sovrapposizioni temporali tra task Monitoraggio della stessa commessa (in modifica)
        if (taskData.Tipo === 'Monitoraggio' && taskData.ID_COMMESSA && taskData.Data_Apertura_Task) {
            const commessaConTask = this.commesseConTask?.find(c => c.ID_COMMESSA === taskData.ID_COMMESSA);
            const altriMonitor = (commessaConTask?.tasks || []).filter(t =>
                t.Tipo === 'Monitoraggio' && t.ID_TASK !== taskId
            );
            const inizio = taskData.Data_Apertura_Task;
            const fine   = taskData.Data_Fine || '9999-12-31';
            for (const altro of altriMonitor) {
                const altroInizio = altro.Data_Apertura_Task || '0000-01-01';
                const altroFine   = altro.Data_Fine          || '9999-12-31';
                if (inizio <= altroFine && altroInizio <= fine) {
                    const fineLabel   = taskData.Data_Fine    || 'aperto';
                    const altroFineLabel = altro.Data_Fine    || 'aperto';
                    this.ui.showToast(
                        `Sovrapposizione temporale con il task Monitoraggio "${altro.Task}" ` +
                        `(dal ${altroInizio} al ${altroFineLabel}). ` +
                        `Modifica le date in modo che i periodi non si sovrappongano.`,
                        'error'
                    );
                    return;
                }
            }
        }

        try {
            const result = taskId
                ? await this.api.updateTask(taskId, taskData)
                : await this.api.createTask(taskData);
            if (result.success) {
                this.ui.showToast(`Task ${taskId ? 'aggiornato' : 'creato'} con successo!`, 'success');
                bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
                await this.app.loadInitialData();
            } else { throw new Error(result.message || 'Errore nel salvataggio del task.'); }
        } catch (error) { this.ui.showToast(error.message, 'error'); }
    }

    // ========================================================================
    // SEZIONE: AZIONI DI ELIMINAZIONE
    // ========================================================================

    async handleDeleteCommessa(commessaId) {
        const commessa = this.commesseConTask.find(c => c.ID_COMMESSA === commessaId);
        if (!commessa) return;
        if (commessa.tasks.length > 0) {
            this.ui.showToast('Impossibile eliminare: ci sono task associati.', 'error');
            return;
        }
        if (confirm(`Sei sicuro di voler eliminare la commessa "${commessa.Commessa}"? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteCommessa(commessaId);
                if (result.success) {
                    this.ui.showToast('Commessa eliminata!', 'success');
                    const modalElement = document.getElementById(`editCommessaModal_${commessaId}`);
                    if (modalElement) {
                        bootstrap.Modal.getInstance(modalElement)?.hide();
                    }
                    await this.app.loadInitialData();
                } else { throw new Error(result.message); }
            } catch (error) { this.ui.showToast(error.message, 'error'); }
        }
    }

    async handleDeleteTask(taskId) {
        const task = this.commesseConTask.flatMap(c => c.tasks).find(t => t.ID_TASK === taskId);
        if (!task) return;
        if (task.giornate.length > 0) {
            this.ui.showToast('Impossibile eliminare: ci sono giornate associate.', 'error');
            return;
        }
        if (confirm(`Sei sicuro di voler eliminare il task "${task.Task}"? L'azione è irreversibile.`)) {
            try {
                const result = await this.api.deleteTask(taskId);
                if (result.success) {
                    this.ui.showToast('Task eliminato!', 'success');
                    const modalElement = document.getElementById(`editTaskModal_${taskId}`);
                    if (modalElement) {
                        bootstrap.Modal.getInstance(modalElement)?.hide();
                    }
                    await this.app.loadInitialData();
                } else { throw new Error(result.message); }
            } catch (error) { this.ui.showToast(error.message, 'error'); }
        }
    }

    // ========================================================================
    // SEZIONE: GENERAZIONE HTML E UTILITÀ
    // ========================================================================
    
    updateStats(data) {
        // Conta solo le commesse di tipo 'Cliente'
        const commesseCount = data.filter(c => c.Tipo_Commessa === 'Cliente').length;
        // Rimuoviamo la misura del numero totale di Task dalle statistiche
        const taskCount = null;
            
        // CORREZIONE DEFINITIVA: Usa esattamente la stessa logica del createCommessaCard
        const giornateCount = data.reduce((commessaSum, commessa) => {
            const taskSum = commessa.tasks.reduce((sum, task) => {
                const giornateCampo = (task.giornate || [])
                    .filter(g => g.Tipo === 'Campo')
                    .reduce((gSum, g) => gSum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0), 0);
                return sum + giornateCampo;
            }, 0);
            return commessaSum + taskSum;
    }, 0);


        const valoreTotaleLavori = data.reduce((totalSum, commessa) => {
            const sommaValoreCampo = commessa.tasks.reduce((sum, task) => {
                if (task.Tipo === 'Campo') {
                    return sum + (parseFloat(task.valore_gg_maturato) || 0);
                }
                return sum;
            }, 0);

            const sommaValoreMonitoraggio = commessa.tasks.reduce((sum, task) => {
                if (task.Tipo === 'Monitoraggio') {
                    return sum + (parseFloat(task.valore_gg_maturato) || 0);
                }
                return sum;
            }, 0);
            
            return totalSum + sommaValoreCampo + sommaValoreMonitoraggio;
        }, 0);

        const valoreTotaleSpese = data.reduce((totalSum, commessa) => {
            return totalSum + commessa.tasks.reduce((sum, task) => sum + (parseFloat(task.valore_spese_maturato) || 0), 0);
        }, 0);

        // NUOVO: Calcolo del valore totale complessivo
        const valoreTotaleComplessivo = valoreTotaleLavori + valoreTotaleSpese;

        // NUOVO: Calcolo Costo Totale Attività e Margine Commessa a livello globale
        const totaleCostoAttivita = data.reduce((sumComm, commessa) => {
            const costoCampo = commessa.tasks.reduce((sumTask, task) => {
                if (task.Tipo !== 'Campo') return sumTask;
                const giornate = task.giornate || [];
                const costoPerTask = giornate.reduce((accGg, g) => {
                    const costoGg = parseFloat(g.Costo_gg ?? g.costo_gg ?? 0) || 0;
                    const costoSpese = parseFloat(g.spese_totali ?? g.Spese_Totali ?? 0) || 0;
                    return accGg + costoGg + costoSpese;
                }, 0);
                return sumTask + costoPerTask;
            }, 0);

            const sommaValoreCampo = commessa.tasks.reduce((sum, task) => (task.Tipo === 'Campo' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
            const costoMonitor = commessa.tasks.reduce((acc, task) => {
                if (task.Tipo === 'Monitoraggio' && parseFloat(task.Valore_gg) > 0) {
                    return acc + (sommaValoreCampo * (parseFloat(task.Valore_gg) || 0));
                }
                return acc;
            }, 0);

            return sumComm + costoCampo + costoMonitor;
        }, 0);

        const totaleCostoAccounting = data.reduce((sumComm, commessa) => {
            const sommaValoreCampo = commessa.tasks.reduce((sum, task) => (task.Tipo === 'Campo' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
            const commissione = parseFloat(commessa.Commissione) || 0;
            return sumComm + (sommaValoreCampo * commissione);
        }, 0);

        const totaleMargine = valoreTotaleComplessivo - totaleCostoAttivita - totaleCostoAccounting;

        const isUser = this.app.currentUser?.ruolo === 'User';
        const statsContainer = document.getElementById('stats-row-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-row">
                    ${this.ui.createStatsCard('fas fa-briefcase', commesseCount, 'Commesse')}
                    ${this.ui.createStatsCard('fas fa-calendar-check', giornateCount.toFixed(1), 'Giornate Campo')}
                    ${!isUser ? `
                    ${this.ui.createStatsCard('fas fa-calculator', this.app.utils.formatCurrency(valoreTotaleComplessivo), 'Valore TOTALE')}
                    ${this.ui.createStatsCard('fas fa-cogs', this.app.utils.formatCurrency(totaleCostoAttivita), 'Costo Totale Attività')}
                    ${this.ui.createStatsCard('fas fa-building', this.app.utils.formatCurrency(totaleCostoAccounting), 'COSTO ACCOUNTING')}
                    ${this.ui.createStatsCard('fas fa-chart-line', this.app.utils.formatCurrency(totaleMargine), 'MARGINE')}
                    ` : ''}
                </div>
            `;
        }
    }

    getCommessaFormHTML(commessa = {}) {
        const formId = commessa.ID_COMMESSA ? `editCommessaModal_${commessa.ID_COMMESSA}_form` : 'newCommessaModal_form';
        const clientiOptions = this.app.utils.ordinaPerNome(this.app.clienti, 'Cliente').map(c => `<option value="${c.ID_CLIENTE}" ${commessa.ID_CLIENTE == c.ID_CLIENTE ? 'selected' : ''}>${c.Cliente}</option>`).join('');
        const collaboratoriOptions = this.app.utils.ordinaPerNome(this.app.collaboratori, 'Collaboratore').map(c => `<option value="${c.ID_COLLABORATORE}" ${commessa.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        const stati = ['In corso', 'Sospesa', 'Chiusa', 'Archiviata'];
        const statiOptions = stati.map(s => `<option value="${s}" ${(commessa.Stato_Commessa || 'In corso') === s ? 'selected' : ''}>${s}</option>`).join('');
        const today = new Date().toISOString().split('T')[0];
        const dataApertura = commessa.Data_Apertura_Commessa ? new Date(commessa.Data_Apertura_Commessa).toISOString().split('T')[0] : today;
        // Chiudere la commessa chiude anche i task ancora aperti: va detto prima di salvare.
        const taskAperti = (commessa.tasks || []).filter(t => !['Chiuso', 'Archiviato'].includes(t.Stato_Task)).length;

        return `
            <form id="${formId}" novalidate>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Commessa" class="form-label">Nome Commessa</label><input type="text" class="form-control" id="Commessa" name="Commessa" value="${commessa.Commessa || ''}" required></div>
                    <div class="col-md-3 mb-3"><label for="Tipo_Commessa" class="form-label">Tipo</label><select class="form-select" id="Tipo_Commessa" name="Tipo_Commessa"><option value="Cliente" ${commessa.Tipo_Commessa === 'Cliente' ? 'selected' : ''}>Cliente</option><option value="Interna" ${commessa.Tipo_Commessa === 'Interna' ? 'selected' : ''}>Interna</option></select></div>
                    <div class="col-md-3 mb-3"><label for="Stato_Commessa" class="form-label">Stato</label><select class="form-select" id="Stato_Commessa" name="Stato_Commessa" required>${statiOptions}</select></div>
                </div>
                <div class="alert alert-warning py-2 d-none" id="avvisoChiusuraTask" data-task-aperti="${taskAperti}"></div>
                <div id="clienteFieldsContainer">
                    <div class="mb-3" id="clienteFieldContainer"><label for="ID_CLIENTE" class="form-label">Cliente</label><select class="form-select" id="ID_CLIENTE" name="ID_CLIENTE"><option value="">Seleziona cliente...</option>${clientiOptions}</select></div>
                    <div class="mb-3" id="responsabileFieldContainer"><label for="ID_COLLABORATORE" class="form-label">Responsabile</label><select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE"><option value="">Seleziona responsabile...</option>${collaboratoriOptions}</select></div>
                    <div class="mb-3" id="commissioneFieldContainer"><label for="Commissione" class="form-label">Commissione</label><input type="number" class="form-control" id="Commissione" name="Commissione" min="0" max="1" step="0.01" value="${commessa.Commissione || '0.27'}"></div>
                </div>
                <div class="mb-3"><label for="Data_Apertura_Commessa" class="form-label">Data Inizio</label><input type="date" class="form-control" id="Data_Apertura_Commessa" name="Data_Apertura_Commessa" value="${dataApertura}"></div>
                <div class="mb-3"><label for="Desc_Commessa" class="form-label">Descrizione</label><textarea class="form-control" id="Desc_Commessa" name="Desc_Commessa" rows="3">${commessa.Desc_Commessa || ''}</textarea></div>
            </form>
        `;
    }

    /**
     * Come si legge il regime di una categoria di spesa nella scheda task.
     * I tre casi sono quelli di CalcoloSpese: compreso, a diaria, a consuntivo.
     */
    descrizioneRegimeSpese(compreso, diaria) {
        if (compreso === 'Si') return 'Compreso nel valore giornata';
        const valore = parseFloat(diaria);
        if (valore > 0) return `Diaria di ${this.app.utils.formatCurrency(valore)} per giornata di campo`;
        return 'A consuntivo, sulla spesa effettiva';
    }

    getTaskFormHTML(task = {}) {
        const formId = task.ID_TASK ? `editTaskModal_${task.ID_TASK}_form` : `newTaskModal_${task.ID_COMMESSA}_form`;
        const tipiTask = ['Campo', 'Monitoraggio', 'Promo', 'Sviluppo', 'Formazione'];
        const tipiOptions = tipiTask.map(t => `<option value="${t}" ${task.Tipo === t ? 'selected' : ''}>${t}</option>`).join('');
        const statiTask = ['In corso', 'Sospeso', 'Chiuso', 'Archiviato'];
        const statiOptions = statiTask.map(s => `<option value="${s}" ${task.Stato_Task === s ? 'selected' : ''}>${s}</option>`).join('');
        const collaboratoriOptions = this.app.utils.ordinaPerNome(this.app.collaboratori, 'Collaboratore').map(c => `<option value="${c.ID_COLLABORATORE}" ${task.ID_COLLABORATORE == c.ID_COLLABORATORE ? 'selected' : ''}>${c.Collaboratore}</option>`).join('');
        const dataAperturaFormatted = (task.Data_Apertura_Task ? new Date(task.Data_Apertura_Task) : new Date()).toISOString().split('T')[0];
        const dataInizioFormatted = task.Data_Inizio ? task.Data_Inizio.split('T')[0] : '';
        const dataFineFormatted = task.Data_Fine ? task.Data_Fine.split('T')[0] : '';

        // Aggiungi le opzioni per le commesse ordinate alfabeticamente
        const commesseOrderedOptions = this.app.utils.ordinaPerNome(this.app.commesse, 'Commessa');
        const commesseOptions = commesseOrderedOptions.map(c => `<option value="${c.ID_COMMESSA}" ${task.ID_COMMESSA == c.ID_COMMESSA ? 'selected' : ''}>${c.Commessa}</option>`).join('');

        return `
            <form id="${formId}" novalidate>
                <div class="mb-3"><label for="ID_COMMESSA" class="form-label">Commessa</label><select class="form-select" id="ID_COMMESSA" name="ID_COMMESSA" required><option value="">Seleziona commessa...</option>${commesseOptions}</select></div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Task" class="form-label">Nome Task</label><input type="text" class="form-control" id="Task" name="Task" value="${task.Task || ''}" required></div>
                    <div class="col-md-6 mb-3"><label for="Tipo" class="form-label">Tipo Task</label><select class="form-select" id="Tipo" name="Tipo">${tipiOptions}</select></div>
                </div>
                <div class="mb-3"><label for="Desc_Task" class="form-label">Descrizione</label><textarea class="form-control" id="Desc_Task" name="Desc_Task" rows="2">${task.Desc_Task || ''}</textarea></div>
                <div class="mb-3" id="assegnatoAContainer" style="display: none;"><label for="ID_COLLABORATORE" class="form-label">Assegnato a (per Monitoraggio)</label><select class="form-select" id="ID_COLLABORATORE" name="ID_COLLABORATORE"><option value="">Nessuno</option>${collaboratoriOptions}</select></div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Stato_Task" class="form-label">Stato</label><select class="form-select" id="Stato_Task" name="Stato_Task" required>${statiOptions}</select></div>
                    <div class="col-md-6 mb-3"><label for="Data_Apertura_Task" class="form-label">Data Apertura</label><input type="date" class="form-control" id="Data_Apertura_Task" name="Data_Apertura_Task" value="${dataAperturaFormatted}" required></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3"><label for="Data_Inizio" class="form-label">Data Inizio</label><input type="date" class="form-control" id="Data_Inizio" name="Data_Inizio" value="${dataInizioFormatted}"></div>
                    <div class="col-md-6 mb-3"><label for="Data_Fine" class="form-label">Data Chiusura</label><input type="date" class="form-control" id="Data_Fine" name="Data_Fine" value="${dataFineFormatted}"><div class="form-text">Se antecedente a oggi il task verrà chiuso automaticamente.</div></div>
                </div>
                <hr>
                <h5>Dettagli Economici</h5>
                <div class="row align-items-end">
                    <div class="col-md-4 mb-3"><label for="gg_previste" class="form-label">Giorni Previsti</label><input type="number" step="0.5" class="form-control" id="gg_previste" name="gg_previste" value="${task.gg_previste || ''}"></div>
                    <div class="col-md-4 mb-3"><label for="Valore_gg" class="form-label">Valore Giorno (€)</label><input type="number" step="0.01" class="form-control" id="Valore_gg" name="Valore_gg" value="${task.Valore_gg || ''}"></div>
                </div>
                <h6 class="text-muted mt-2">Spese addebitate al cliente</h6>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="border rounded p-2 h-100">
                            <div class="fw-semibold mb-2">Viaggi</div>
                            <div class="row g-2">
                                <div class="col-6"><label for="Spese_Comprese_Viaggi" class="form-label">Compresi</label><select class="form-select" id="Spese_Comprese_Viaggi" name="Spese_Comprese_Viaggi"><option value="No" ${task.Spese_Comprese_Viaggi === 'No' || !task.Spese_Comprese_Viaggi ? 'selected' : ''}>No</option><option value="Si" ${task.Spese_Comprese_Viaggi === 'Si' ? 'selected' : ''}>Si</option></select></div>
                                <div class="col-6" id="valoreSpeseViaggiContainer" style="display: none;"><label for="Valore_Spese_std_Viaggi" class="form-label">Diaria (€/gg)</label><input type="number" step="0.01" min="0" class="form-control" id="Valore_Spese_std_Viaggi" name="Valore_Spese_std_Viaggi" value="${task.Valore_Spese_std_Viaggi || ''}" placeholder="a consuntivo"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="border rounded p-2 h-100">
                            <div class="fw-semibold mb-2">Vitto/Alloggio + Altre</div>
                            <div class="row g-2">
                                <div class="col-6"><label for="Spese_Comprese_Vitto_Alloggio" class="form-label">Comprese</label><select class="form-select" id="Spese_Comprese_Vitto_Alloggio" name="Spese_Comprese_Vitto_Alloggio"><option value="No" ${task.Spese_Comprese_Vitto_Alloggio === 'No' || !task.Spese_Comprese_Vitto_Alloggio ? 'selected' : ''}>No</option><option value="Si" ${task.Spese_Comprese_Vitto_Alloggio === 'Si' ? 'selected' : ''}>Si</option></select></div>
                                <div class="col-6" id="valoreSpeseVittoContainer" style="display: none;"><label for="Valore_Spese_std_Vitto_Alloggio" class="form-label">Diaria (€/gg)</label><input type="number" step="0.01" min="0" class="form-control" id="Valore_Spese_std_Vitto_Alloggio" name="Valore_Spese_std_Vitto_Alloggio" value="${task.Valore_Spese_std_Vitto_Alloggio || ''}" placeholder="a consuntivo"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-text mb-2">Diaria vuota: si riaddebita la spesa reale. La diaria si addebita intera per ogni giornata di campo, anche sulle mezze giornate; i viaggi solo sulle giornate con il flag Viaggio attivo.</div>
            </form>
        `;
    }

    generateCommessaCode() {
        // Genera un codice automatico nel formato COM + anno + numero progressivo
        const year = new Date().getFullYear();
        const existingCommesse = this.commesse || [];
        
        let maxNumber = 0;
        const yearPrefix = `COM${year}`;
        
        existingCommesse.forEach(commessa => {
            if (commessa.ID_COMMESSA && commessa.ID_COMMESSA.startsWith(yearPrefix)) {
                const numberPart = commessa.ID_COMMESSA.replace(yearPrefix, '');
                const number = parseInt(numberPart, 10);
                if (!isNaN(number) && number > maxNumber) {
                    maxNumber = number;
                }
            }
        });
        
        const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
        return `${yearPrefix}${nextNumber}`;
    }

    groupTasksByCommessa() {
        const commesseMap = new Map();
        this.app.commesse.forEach(commessa => {
            const cliente = this.app.clienti.find(c => c.ID_CLIENTE == commessa.ID_CLIENTE);
            const responsabile = this.app.collaboratori.find(c => c.ID_COLLABORATORE == commessa.ID_COLLABORATORE);
            commesseMap.set(commessa.ID_COMMESSA, { ...commessa, cliente_nome: cliente?.Cliente || 'N/D', responsabile_nome: responsabile?.Collaboratore || 'N/D', tasks: [] });
        });
        this.app.tasks.forEach(task => {
            if (commesseMap.has(task.ID_COMMESSA)) {
                const giornateTask = this.app.giornate.filter(g => String(g.ID_TASK) === String(task.ID_TASK));
                // CORREZIONE: conta solo le giornate di tipo 'Campo' (esclude Promo, Formazione, ecc.)
                const totaleGiornate = giornateTask.filter(g => g.Tipo === 'Campo').reduce((sum, g) => sum + (parseFloat(g.gg?.toString().replace(',', '.')) || 0), 0);
                // Rimuovi gg_effettuate dall'API (include tutti i tipi) per forzare il ricalcolo Campo-only nel badge
                const { gg_effettuate: _apiGgEffettuate, gg_effettuate_filtrate: _apiGgFiltrate, ...taskProps } = task;
                commesseMap.get(task.ID_COMMESSA).tasks.push({ ...taskProps, giornate: giornateTask, totale_giornate: totaleGiornate });
            }
        });
        return Array.from(commesseMap.values()).sort((a, b) => (a.Commessa || '').localeCompare(b.Commessa || ''));
    }

    // Export delle commesse attualmente visualizzate in CSV (aperto in Excel)
    exportCommesseToExcel() {
        const data = this.lastFilteredData || this.groupTasksByCommessa();
        if (!data || data.length === 0) { this.ui.showToast('Nessuna commessa da esportare.', 'warning'); return; }

        const headers = [
            'ID_COMMESSA','Commessa','Tipo_Commessa','Cliente','Responsabile','Stato_Commessa','Valore_TOTALE','Valore_Lavori','Valore_Spese','Costo_Totale_Attivita','Costo_Accounting','Margine_Commessa','Giornate_Campo','Totale_Giornate','Num_Tasks'
        ];

        const rows = data.map(commessa => {
            const sommaValoreCampo = commessa.tasks.reduce((sum, task) => (task.Tipo === 'Campo' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
            const valoreSpese = commessa.tasks.reduce((sum, task) => sum + (parseFloat(task.valore_spese_maturato) || 0), 0);
            const valoreLavori = sommaValoreCampo + commessa.tasks.reduce((sum, task) => (task.Tipo === 'Monitoraggio' ? sum + (parseFloat(task.valore_gg_maturato) || 0) : sum), 0);
            // calcola costo totale attività per la commessa (Campo + Monitoraggio)
            const costoCampoAttivita = commessa.tasks.reduce((accTask, task) => {
                if (task.Tipo !== 'Campo') return accTask;
                const giornate = task.giornate || [];
                return accTask + giornate.reduce((accGg, g) => {
                    const costoGg = parseFloat(g.Costo_gg ?? g.costo_gg ?? 0) || 0;
                    const costoSp = parseFloat(g.spese_totali ?? g.Spese_Totali ?? 0) || 0;
                    return accGg + costoGg + costoSp;
                }, 0);
            }, 0);
            // contributo dei task di Monitoraggio: usa il valore già calcolato dall'API
            const costoMonitoraggio = commessa.tasks.reduce((acc, task) => {
                if (task.Tipo === 'Monitoraggio') {
                    return acc + (parseFloat(task.valore_gg_maturato) || 0);
                }
                return acc;
            }, 0);
            const costoAttivita = costoCampoAttivita + costoMonitoraggio;
            const costoAccounting = sommaValoreCampo * (parseFloat(commessa.Commissione) || 0);
            const margine = (valoreLavori + valoreSpese) - costoAttivita - costoAccounting;
            const totaleGiornate = commessa.tasks.reduce((sum, task) => sum + (parseFloat(task.gg_effettuate) || 0), 0);
            const giornateCampo = commessa.tasks.reduce((sumTask, task) => {
                const gg = (task.giornate || []).filter(g => g.Tipo === 'Campo').reduce((s, g) => s + (parseFloat(g.gg) || 0), 0);
                return sumTask + gg;
            }, 0);
            const numTasks = commessa.tasks.length;
            return [commessa.ID_COMMESSA, commessa.Commessa, commessa.Tipo_Commessa, commessa.cliente_nome, commessa.responsabile_nome, commessa.Stato_Commessa, valoreLavori + valoreSpese, valoreLavori, valoreSpese, costoAttivita, costoAccounting, margine, giornateCampo, totaleGiornate, numTasks];
        });

        // costruisci CSV
        const csvLines = [headers.join(';')];
        rows.forEach(r => {
            csvLines.push(r.map(v => typeof v === 'number' ? v.toString().replace('.', ',') : `"${(v||'').toString().replace(/"/g,'""')}"`).join(';'));
        });

        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commesse_export_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.ui.showToast('Esportazione avviata.', 'success');
    }
}