/**
 * @file documenti-commessa.js
 * @description Gli ordini e le offerte di una commessa: elenco, scheda, allegato.
 *
 * Sta in un file suo e non dentro commesse-task-section.js per due motivi.
 * Il primo e' la dimensione: quel file e' gia' oltre i 100 KB e ogni aggiunta
 * lo rende meno leggibile. Il secondo e' che questa non e' una sezione del
 * menu - non ha una voce, non si apre da sola - ma una finestra che si apre
 * dalla commessa, e i dati se li carica da se' quando serve.
 *
 * Il carico su richiesta e' voluto: i documenti NON entrano in
 * loadInitialData(). Il ruolo 'User' non li vede affatto (l'API gli risponde
 * con un elenco vuoto) e chi li vede li guarda una commessa per volta.
 */
class DocumentiCommessa {

    constructor(appInstance) {
        this.app = appInstance;
        this.ui = appInstance.ui;
        this.api = appInstance.api;

        this.commessa = null;
        this.documenti = [];

        // Quale delle due viste e' a schermo: l'elenco, oppure la scheda di un
        // documento. Sono nella STESSA finestra e non in due sovrapposte:
        // chiudendo una modale sopra un'altra, createModal() toglie tutti gli
        // sfondi in pagina e quella sotto resta senza.
        this.vista = 'elenco';
        this.inModifica = null;

        this.modalId = 'documentiCommessaModal';
    }

    // ========================================================================
    // APERTURA E CARICAMENTO
    // ========================================================================

    async apri(commessaId) {
        this.commessa = (this.app.commesse || []).find(c => c.ID_COMMESSA === commessaId);
        if (!this.commessa) {
            this.ui.showToast('Commessa non trovata.', 'error');
            return;
        }

        this.vista = 'elenco';
        this.inModifica = null;
        this.documenti = [];

        const titolo = `<i class="fas fa-file-signature me-2"></i>Ordini e offerte — ${this.app.utils.escapeHtml(this.commessa.Commessa)}`;
        const azioni = [{ html: '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>' }];

        this.ui.createModal(this.modalId, titolo, this.ui.createLoadingState('Caricamento documenti...'), azioni, { size: 'modal-xl' });
        this.bindEventi();

        await this.ricarica();
    }

    async ricarica() {
        const risposta = await this.api.getDocumenti({ commessa: this.commessa.ID_COMMESSA, limit: 200 });

        if (!risposta.success) {
            this.documenti = [];
            this.scrivi(`<div class="alert alert-danger mb-0">${this.app.utils.escapeHtml(risposta.message || 'Errore nel caricamento dei documenti.')}</div>`);
            return;
        }

        this.documenti = risposta.data?.data || [];
        this.disegna();
    }

    /** Il corpo della finestra, secondo la vista attiva. */
    disegna() {
        this.scrivi(this.vista === 'elenco' ? this.vistaElenco() : this.vistaScheda());
    }

    scrivi(html) {
        const corpo = document.querySelector(`#${this.modalId} .modal-body`);
        if (corpo) corpo.innerHTML = html;
    }

    // ========================================================================
    // VISTA: L'ELENCO
    // ========================================================================

    vistaElenco() {
        const t = this.totali();
        // Una volta sola per disegnata: le righe la leggono, non la ricalcolano.
        this.gg = this.avanzamentoGiornate();

        // I documenti a corpo hanno tre numeri confrontabili fra loro; quelli a
        // giornate ne hanno altri, e stanno in un riquadro separato invece che
        // sommati a forza dentro i primi.
        const riquadro = (etichetta, valore, nota, classe = '') => `
            <div class="col-md-3"><div class="border rounded p-2 h-100">
                <div class="text-muted small">${etichetta}</div>
                <div class="fs-5 fw-semibold ${classe}">${valore}</div>
                ${nota ? `<div class="text-muted small">${nota}</div>` : ''}
            </div></div>`;

        const riquadri = [];

        if (t.nQuantificati || !t.aGiornate) {
            riquadri.push(riquadro('Ordinato a corpo',
                this.app.utils.formatCurrency(t.ordinato),
                t.nQuantificati ? `${t.nQuantificati} ${t.nQuantificati === 1 ? 'documento' : 'documenti'}` : 'nessun documento a corpo'));
            riquadri.push(riquadro('Fatturato su questi', this.app.utils.formatCurrency(t.fatturato)));
            riquadri.push(riquadro('Residuo',
                this.app.utils.formatCurrency(t.residuo), '',
                t.residuo < -0.01 ? 'text-danger' : ''));
        }

        if (t.aGiornate) {
            // Niente residuo in euro: il valore della giornata sta sul task e
            // l'ordine non lo duplica. L'avanzamento pero' c'e', ed e' in
            // GIORNATE: quelle previste dal documento contro quelle gia' fatte,
            // che il gestionale sa dalle consuntivazioni.
            const gg = this.avanzamentoGiornate();
            const attribuibili = gg && this.giornateAttribuibili();
            const percentuale = attribuibili && t.giornatePreviste > 0
                ? Math.round(gg.fatte / t.giornatePreviste * 100)
                : null;

            const valore = t.giornatePreviste
                ? (attribuibili
                    ? `${this.numero(gg.fatte)} di ${this.numero(t.giornatePreviste)} gg`
                    : `${this.numero(t.giornatePreviste)} gg previste`)
                : (attribuibili ? `${this.numero(gg.fatte)} gg fatte` : '—');

            const nota = [
                percentuale !== null ? `${percentuale}% delle giornate previste` : null,
                `fatturato ${this.app.utils.formatCurrency(t.fatturatoGiornate)}`,
                !attribuibili && gg ? `${this.numero(gg.fatte)} gg fatte sulla commessa, su più documenti` : null,
            ].filter(Boolean).join(' · ');

            riquadri.push(riquadro('A giornate', valore, nota,
                percentuale !== null && percentuale > 100 ? 'text-danger' : ''));
        }

        const intestazione = `
            <div class="row g-2 mb-3">
                ${riquadri.join('')}
                <div class="col-md-3 d-flex align-items-center justify-content-md-end gap-2">
                    <button class="btn btn-outline-primary btn-sm" data-doc-azione="nuova-offerta"><i class="fas fa-plus me-1"></i>Offerta</button>
                    <button class="btn btn-vp-primary btn-sm" data-doc-azione="nuovo-ordine"><i class="fas fa-plus me-1"></i>Ordine</button>
                </div>
            </div>
            ${t.senzaImporto ? `<div class="alert alert-warning py-2 small">
                <i class="fas fa-exclamation-triangle me-1"></i>
                ${t.senzaImporto === 1
                    ? "Un documento a corpo non ha l'importo"
                    : `${t.senzaImporto} documenti a corpo non hanno l'importo`}, per
                ${this.app.utils.formatCurrency(t.fatturatoSenzaImporto)} già fatturati: i totali qui sopra
                non li comprendono. Su un documento a corpo l'importo mancante è un dato da recuperare.
            </div>` : ''}`;

        if (this.documenti.length === 0) {
            return `${intestazione}
                ${this.avvisoFattureSciolte()}
                <div class="text-center text-muted py-4">
                    <i class="fas fa-folder-open fa-2x mb-2 d-block"></i>
                    Questa commessa non ha ancora né offerte né ordini.
                </div>`;
        }

        return `${intestazione}
            ${this.avvisoFattureSciolte()}
            <div class="table-responsive">
                <table class="table table-sm align-middle">
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Data</th>
                            <th>Stato</th>
                            <th class="text-end">Importo</th>
                            <th class="text-end">Fatturato</th>
                            <th class="text-end">Residuo</th>
                            <th class="text-center">Allegato</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${this.albero().map(r => this.riga(r.doc, r.annidato)).join('')}</tbody>
                </table>
            </div>
            <p class="text-muted small mb-0">
                <i class="fas fa-info-circle me-1"></i>
                L'ordinato somma gli ordini e le offerte che non hanno ancora generato ordini: contare entrambi
                significherebbe contare due volte la stessa fornitura.
                ${t.aGiornate ? `Sui documenti a giornate non c'è un ordinato in euro: il valore della giornata sta
                sul task, dove convive con il costo del collaboratore, e l'ordine non lo duplica.` : ''}
            </p>`;
    }

    /**
     * Le offerte con sotto i loro ordini, poi gli ordini che offerta non hanno.
     * L'annidamento e' l'unico posto dove si vede che quei documenti sono la
     * stessa fornitura.
     */
    albero() {
        const righe = [];
        const ordinaData = (a, b) => String(a.Data || '').localeCompare(String(b.Data || ''));

        const offerte = this.documenti.filter(d => d.Tipo === 'Offerta').sort(ordinaData);
        const ordini = this.documenti.filter(d => d.Tipo === 'Ordine').sort(ordinaData);

        offerte.forEach(offerta => {
            righe.push({ doc: offerta, annidato: false });
            ordini.filter(o => o.ID_PADRE === offerta.ID_DOCUMENTO)
                  .forEach(o => righe.push({ doc: o, annidato: true }));
        });

        ordini.filter(o => !o.ID_PADRE || !offerte.some(off => off.ID_DOCUMENTO === o.ID_PADRE))
              .forEach(o => righe.push({ doc: o, annidato: false }));

        return righe;
    }

    riga(doc, annidato) {
        const id = this.app.utils.escapeHtml(doc.ID_DOCUMENTO);
        const numero = doc.Numero ? this.app.utils.escapeHtml(doc.Numero) : '<span class="text-muted">senza numero</span>';
        const icona = doc.Tipo === 'Offerta' ? 'fa-file-alt' : 'fa-file-contract';

        const importo = doc.Tipo_Importo === 'A_giornate'
            ? `<span class="text-muted">a giornate${doc.Giornate_Previste ? ` · ${this.numero(doc.Giornate_Previste)} gg` : ''}</span>`
            : (doc.Importo !== null && doc.Importo !== undefined ? this.app.utils.formatCurrency(doc.Importo) : '<span class="text-muted">—</span>');

        // residuo e percentuale arrivano gia' a null dove non hanno risposta:
        // ordine a giornate, offerta coperta dai suoi ordini. Qui non si
        // reinventa un denominatore.
        //
        // Su un documento a giornate il residuo in euro non esiste, ma quello in
        // GIORNATE si': previste meno fatte. Vale pero' solo quando la commessa
        // ha un documento solo - vedi giornateAttribuibili().
        const residuoGiornate = doc.Tipo_Importo === 'A_giornate' && doc.Giornate_Previste
            && this.gg && this.giornateAttribuibili()
            ? parseFloat(doc.Giornate_Previste) - this.gg.fatte
            : null;

        const residuo = residuoGiornate !== null
            ? `<span class="${residuoGiornate < -0.01 ? 'text-danger' : ''}" title="Giornate previste dal documento meno quelle già fatte">${this.numero(residuoGiornate)} gg</span>`
            : (doc.residuo === null || doc.residuo === undefined
                ? `<span class="text-muted" title="${doc.coperta_da_ordini ? 'Le cifre stanno sugli ordini nati da questa offerta' : "Ordine a giornate: non c'è un importo totale"}">—</span>`
                : `<span class="${parseFloat(doc.residuo) < -0.01 ? 'text-danger' : ''}">${this.app.utils.formatCurrency(doc.residuo)}</span>`);

        // Il documento dice N giornate, i task ne prevedono altre: e' una
        // discordanza che vale la pena vedere subito, non un errore.
        const scostamento = doc.Tipo_Importo === 'A_giornate' && doc.Giornate_Previste
            && this.gg?.previsteDaiTask > 0 && this.giornateAttribuibili()
            && Math.abs(parseFloat(doc.Giornate_Previste) - this.gg.previsteDaiTask) > 0.01
            ? `<div class="small text-warning-emphasis">i task ne prevedono ${this.numero(this.gg.previsteDaiTask)}</div>`
            : '';

        const percentuale = doc.percentuale_fatturata === null || doc.percentuale_fatturata === undefined
            ? ''
            : `<div class="progress mt-1" style="height:4px" title="${doc.percentuale_fatturata}% fatturato">
                   <div class="progress-bar ${parseFloat(doc.percentuale_fatturata) > 100.01 ? 'bg-danger' : 'bg-success'}"
                        style="width:${Math.min(100, Math.max(0, parseFloat(doc.percentuale_fatturata)))}%"></div>
               </div>`;

        const nFatture = parseInt(doc.n_fatture || 0, 10);
        const fatturato = `${this.app.utils.formatCurrency(doc.fatturato || 0)}
            ${nFatture ? `<span class="badge bg-light text-dark ms-1" title="${nFatture} ${nFatture === 1 ? 'fattura collegata' : 'fatture collegate'}">${nFatture}</span>` : ''}
            ${percentuale}`;

        const allegato = doc.documento_url
            ? `<a class="btn btn-sm btn-outline-secondary" href="${doc.documento_url}" target="_blank" rel="noopener" title="Apri l'allegato"><i class="fas fa-paperclip"></i></a>
               <button class="btn btn-sm btn-outline-danger" data-doc-azione="rimuovi-file" data-doc-id="${id}" title="Rimuovi l'allegato"><i class="fas fa-times"></i></button>`
            : `<button class="btn btn-sm btn-outline-secondary" data-doc-azione="carica-file" data-doc-id="${id}" title="Carica il documento"><i class="fas fa-upload"></i></button>`;

        return `
            <tr>
                <td>
                    ${annidato ? '<span class="text-muted me-1">↳</span>' : ''}
                    <i class="fas ${icona} me-1 text-muted"></i>
                    <strong>${numero}</strong>
                    <span class="badge ${doc.Tipo === 'Offerta' ? 'bg-info text-dark' : 'bg-primary'} ms-1">${doc.Tipo}</span>
                    ${doc.numero_offerta && annidato ? `<div class="small text-muted">da offerta ${this.app.utils.escapeHtml(doc.numero_offerta)}</div>` : ''}
                    ${doc.cliente_intestatario && doc.cliente_intestatario !== doc.cliente_commessa
                        ? `<div class="small text-muted">intestato a ${this.app.utils.escapeHtml(doc.cliente_intestatario)}</div>` : ''}
                    ${scostamento}
                </td>
                <td>${doc.Data ? this.app.utils.formatDate(doc.Data) : '<span class="text-muted">—</span>'}</td>
                <td>${this.badgeStato(doc)}</td>
                <td class="text-end">${importo}</td>
                <td class="text-end">${fatturato}</td>
                <td class="text-end">${residuo}</td>
                <td class="text-center text-nowrap">${allegato}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-primary" data-doc-azione="modifica" data-doc-id="${id}" title="Modifica"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn btn-sm btn-outline-danger" data-doc-azione="elimina" data-doc-id="${id}" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    }

    /**
     * Le giornate gia' fatte sulla commessa, e quelle che i task prevedono.
     *
     * NON si ricalcolano qui: si chiedono a calcolaValoriCommessa() della
     * sezione Commesse, che e' il posto dove la regola e' scritta - contano le
     * giornate di tipo Campo, non tutte. Riscriverla vorrebbe dire vedere due
     * numeri diversi per la stessa cosa in due schermate, che a questo
     * gestionale e' gia' successo.
     *
     * Si legge da `commesseConTask`, che e' la fotografia INTERA della
     * commessa: `lastFilteredData` invece risente del filtro per anno e mese in
     * cima alla pagina, e qui il confronto e' con le giornate previste da un
     * ordine, che un periodo non ce l'hanno.
     */
    avanzamentoGiornate() {
        const sezione = this.app.sections?.['commesse-task'];
        const commessa = sezione?.commesseConTask?.find(c => c.ID_COMMESSA === this.commessa.ID_COMMESSA);

        if (!commessa || typeof sezione.calcolaValoriCommessa !== 'function') {
            return null;
        }

        const v = sezione.calcolaValoriCommessa(commessa);
        return {
            fatte: v.giornateCampo,
            previsteDaiTask: v.giornatePreviste,
            maturato: v.valoreLavori,
        };
    }

    /**
     * A quale documento appartengono quelle giornate?
     *
     * Una giornata sta su un task, e il task sulla commessa: il documento non
     * c'entra. Finche' la commessa ha UN documento solo la risposta e' ovvia e
     * si puo' dire «5 fatte su 8». Con due o piu' documenti no, e nessuna
     * divisione sarebbe piu' vera di un'altra: allora le giornate si mostrano
     * come dato della commessa, e la percentuale non si calcola affatto.
     */
    giornateAttribuibili() {
        return this.documenti.length === 1;
    }

    /** Le giornate come si scrivono in italiano: 8, non 8.00; 8,5 e non 8.5. */
    numero(valore) {
        return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(parseFloat(valore) || 0);
    }

    badgeStato(doc) {
        const offerta = doc.Tipo === 'Offerta';

        if (doc.Stato === 'Chiuso') {
            const residuo = doc.Residuo_Alla_Chiusura;
            const titolo = residuo !== null && residuo !== undefined && Math.abs(parseFloat(residuo)) > 0.01
                ? `Chiuso con ${this.app.utils.formatCurrency(residuo)} non fatturati`
                : 'Non ci si fattura più';
            return `<span class="badge bg-secondary" title="${titolo}">${offerta ? 'Chiusa' : 'Chiuso'}</span>`;
        }
        if (doc.Stato === 'Atteso') {
            return `<span class="badge bg-warning text-dark" title="Confermato dal cliente, ma il documento non è ancora arrivato">Atteso</span>`;
        }
        // Un'offerta che aspetta ancora l'ordine e' la coda da sollecitare;
        // quella a cui l'ordine non arrivera' mai e' un'altra cosa, e va detto.
        if (offerta) {
            if (doc.n_ordini_figli) {
                return '<span class="badge bg-success" title="Da questa offerta sono nati ordini: le cifre stanno su quelli">Con ordini</span>';
            }
            return doc.Ordine_Atteso === 'No'
                ? '<span class="badge bg-success" title="Cliente che non emette ordini: si fattura su questa offerta">Aperta</span>'
                : '<span class="badge bg-warning text-dark" title="Ordine da sollecitare">Ordine atteso</span>';
        }
        return '<span class="badge bg-success" title="Documento agli atti: si fattura su questo">Ricevuto</span>';
    }

    /**
     * Le fatture della commessa che non puntano ad alcun documento.
     *
     * E' la coda di lavoro della fase 4, e va detta qui: senza, il residuo per
     * ordine sembra completo mentre una parte del fatturato non e' stata
     * ancora attribuita a nulla.
     */
    avvisoFattureSciolte() {
        if (this.documenti.length === 0) return '';

        const sciolte = (this.app.fatture || []).filter(f =>
            f.ID_COMMESSA === this.commessa.ID_COMMESSA && !f.ID_DOCUMENTO);

        if (sciolte.length === 0) return '';

        const totale = sciolte.reduce((s, f) => s + (parseFloat(f.Fatturato_TOT) || 0), 0);
        return `<div class="alert alert-warning py-2 small">
                <i class="fas fa-exclamation-triangle me-1"></i>
                ${sciolte.length} ${sciolte.length === 1 ? 'fattura di questa commessa non è collegata' : 'fatture di questa commessa non sono collegate'}
                a nessun ordine, per ${this.app.utils.formatCurrency(totale)}: il residuo qui sopra non ne tiene conto.
                Il collegamento si imposta dalla scheda della fattura.
            </div>`;
    }

    /**
     * Ordinato, fatturato e residuo della commessa, divisi in tre gruppi.
     *
     * L'ordinato somma gli ordini e le offerte SENZA ordini figli: sommarli
     * tutti conterebbe due volte la stessa fornitura, prima come promessa e
     * poi come impegno.
     *
     * I tre gruppi non si mescolano, ed e' il punto:
     *
     *   a corpo            hanno un importo: ordinato, fatturato e residuo
     *                      sono confrontabili fra loro
     *   a giornate         l'importo totale non esiste - il fee sta sul task,
     *                      non sull'ordine - e la previsione e' in GIORNATE
     *   senza importo      ordini a corpo con l'importo ancora da recuperare
     *
     * Sommare il fatturato di tutti e tre e sottrarlo da un ordinato che
     * comprende solo il primo dava un residuo negativo: la commessa Sammontana
     * mostrava «ordinato 0, residuo -13.090» pur essendo tutto in regola. Ogni
     * gruppo si confronta solo con se stesso.
     */
    totali() {
        const t = {
            ordinato: 0, fatturato: 0, residuo: 0,
            nQuantificati: 0,
            aGiornate: 0, giornatePreviste: 0, fatturatoGiornate: 0,
            senzaImporto: 0, fatturatoSenzaImporto: 0,
        };

        this.documenti.forEach(doc => {
            if (doc.coperta_da_ordini) return;

            const fatturato = parseFloat(doc.fatturato) || 0;

            if (doc.Tipo_Importo === 'A_giornate') {
                t.aGiornate++;
                t.giornatePreviste += parseFloat(doc.Giornate_Previste) || 0;
                t.fatturatoGiornate += fatturato;
            } else if (doc.Importo === null || doc.Importo === undefined) {
                t.senzaImporto++;
                t.fatturatoSenzaImporto += fatturato;
            } else {
                t.nQuantificati++;
                t.ordinato += parseFloat(doc.Importo) || 0;
                t.fatturato += fatturato;
            }
        });

        t.residuo = t.ordinato - t.fatturato;
        return t;
    }

    // ========================================================================
    // VISTA: LA SCHEDA
    // ========================================================================

    vistaScheda() {
        const doc = this.inModifica || {};
        const isNuovo = !doc.ID_DOCUMENTO;
        const tipo = doc.Tipo || 'Ordine';

        // Un ordine puo' nascere da un'offerta di QUESTA commessa: e' l'unico
        // legame consentito, e il backend lo ricontrolla.
        const offerte = this.documenti
            .filter(d => d.Tipo === 'Offerta' && d.ID_DOCUMENTO !== doc.ID_DOCUMENTO)
            .map(d => `<option value="${d.ID_DOCUMENTO}" ${doc.ID_PADRE === d.ID_DOCUMENTO ? 'selected' : ''}>${this.app.utils.escapeHtml(d.Numero || d.ID_DOCUMENTO)}${d.Data ? ` — ${this.app.utils.formatDate(d.Data)}` : ''}</option>`)
            .join('');

        const clienti = this.app.utils.ordinaPerNome(this.app.clienti || [], 'Cliente')
            .map(c => `<option value="${c.ID_CLIENTE}" ${doc.ID_CLIENTE_INTESTATARIO === c.ID_CLIENTE ? 'selected' : ''}>${this.app.utils.escapeHtml(c.Cliente)}</option>`)
            .join('');

        const opzioni = (valori, scelto) => valori
            .map(v => `<option value="${v[0]}" ${scelto === v[0] ? 'selected' : ''}>${v[1]}</option>`).join('');

        return `
            <form id="documentoForm" novalidate>
                <div class="d-flex align-items-center mb-3">
                    <button type="button" class="btn btn-sm btn-outline-secondary me-2" data-doc-azione="torna"><i class="fas fa-arrow-left"></i></button>
                    <h6 class="mb-0">${isNuovo ? `Nuovo ${tipo.toLowerCase()}` : `Modifica ${tipo.toLowerCase()} ${this.app.utils.escapeHtml(doc.Numero || doc.ID_DOCUMENTO)}`}</h6>
                </div>

                <div class="row">
                    <div class="col-md-3 mb-3">
                        <label class="form-label" for="docTipo">Tipo</label>
                        <select class="form-select" id="docTipo" name="Tipo">${opzioni([['Ordine', 'Ordine'], ['Offerta', 'Offerta']], tipo)}</select>
                    </div>
                    <div class="col-md-5 mb-3">
                        <label class="form-label" for="docNumero">Numero</label>
                        <input type="text" class="form-control" id="docNumero" name="Numero" value="${doc.Numero ? this.app.utils.escapeHtml(doc.Numero) : ''}" placeholder="Il numero che porta il documento del cliente">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label" for="docData">Data</label>
                        <input type="date" class="form-control" id="docData" name="Data" value="${doc.Data || ''}">
                        <div class="form-text">Decide l'anno del codice interno.</div>
                    </div>
                </div>

                <div class="row" id="rigaPadre" ${tipo === 'Ordine' ? '' : 'hidden'}>
                    <div class="col-12 mb-3">
                        <label class="form-label" for="docPadre">Nasce dall'offerta
                            <i class="fas fa-info-circle text-muted ms-1" data-bs-toggle="tooltip" title="Il legame fra offerta e ordine è l'unico posto in cui è scritto che sono la stessa fornitura."></i>
                        </label>
                        <select class="form-select" id="docPadre" name="ID_PADRE"><option value="">Nessuna offerta</option>${offerte}</select>
                        ${offerte ? '' : '<div class="form-text">Questa commessa non ha offerte registrate.</div>'}
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label class="form-label" for="docTipoImporto">Importo</label>
                        <select class="form-select" id="docTipoImporto" name="Tipo_Importo">${opzioni([['Chiuso', 'A corpo'], ['A_giornate', 'A giornate']], doc.Tipo_Importo || 'Chiuso')}</select>
                    </div>
                    <div class="col-md-4 mb-3" id="campoImporto">
                        <label class="form-label" for="docImporto">Valore (€)</label>
                        <input type="number" step="0.01" min="0" class="form-control" id="docImporto" name="Importo" value="${doc.Importo ?? ''}">
                    </div>
                    <div class="col-md-4 mb-3" id="campoGiornate">
                        <label class="form-label" for="docGiornate">Giornate previste</label>
                        <input type="number" step="0.5" min="0" class="form-control" id="docGiornate" name="Giornate_Previste" value="${doc.Giornate_Previste ?? ''}">
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label class="form-label" for="docStato">Stato</label>
                        <select class="form-select" id="docStato" name="Stato">${this.opzioniStato(tipo, doc.Stato || 'Ricevuto')}</select>
                        <div class="form-text" id="statoHint"></div>
                    </div>
                    <div class="col-md-4 mb-3" id="campoOrdineAtteso" ${tipo === 'Offerta' ? '' : 'hidden'}>
                        <label class="form-label" for="docOrdineAtteso">Ordine atteso</label>
                        <select class="form-select" id="docOrdineAtteso" name="Ordine_Atteso">${opzioni([['Si', 'Sì, da sollecitare'], ['No', 'No, si fattura sull\'offerta']], doc.Ordine_Atteso || 'Si')}</select>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label" for="docIntestatario">Intestatario
                            <i class="fas fa-info-circle text-muted ms-1" data-bs-toggle="tooltip" title="Chi riceve la fattura, quando non è il cliente della commessa. Lasciando vuoto vale il cliente della commessa."></i>
                        </label>
                        <select class="form-select" id="docIntestatario" name="ID_CLIENTE_INTESTATARIO"><option value="">${this.app.utils.escapeHtml(this.commessa.cliente_nome || 'Cliente della commessa')}</option>${clienti}</select>
                    </div>
                </div>

                <div class="row" id="rigaChiusura" ${doc.Stato === 'Chiuso' ? '' : 'hidden'}>
                    <div class="col-md-4 mb-3">
                        <label class="form-label" for="docResiduoChiusura">Residuo alla chiusura (€)</label>
                        <input type="number" step="0.01" class="form-control" id="docResiduoChiusura" name="Residuo_Alla_Chiusura" value="${doc.Residuo_Alla_Chiusura ?? ''}">
                    </div>
                    <div class="col-md-8 mb-3">
                        <label class="form-label" for="docNoteChiusura">Perché è stato chiuso</label>
                        <input type="text" class="form-control" id="docNoteChiusura" name="Note_Chiusura" value="${doc.Note_Chiusura ? this.app.utils.escapeHtml(doc.Note_Chiusura) : ''}">
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label" for="docNote">Note</label>
                    <textarea class="form-control" id="docNote" name="Note" rows="2">${doc.Note ? this.app.utils.escapeHtml(doc.Note) : ''}</textarea>
                </div>

                <div class="mb-3">
                    <label class="form-label" for="docFile">Documento allegato</label>
                    ${doc.documento_url
                        ? `<div class="mb-1"><a href="${doc.documento_url}" target="_blank" rel="noopener"><i class="fas fa-paperclip me-1"></i>Apri l'allegato attuale</a> <span class="text-muted small">— caricandone un altro sostituisce questo.</span></div>`
                        : ''}
                    <input type="file" class="form-control" id="docFile" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                    <div class="form-text">PDF, immagine o Word, fino a 20 MB.</div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-outline-secondary" data-doc-azione="torna">Annulla</button>
                    <button type="submit" class="btn btn-vp-primary">${isNuovo ? 'Crea' : 'Salva'}</button>
                </div>
            </form>`;
    }

    /**
     * Lo stato, che vuol dire due cose diverse sui due tipi di documento.
     *
     * Su un ORDINE e' la sua vita, nell'ordine in cui accade:
     *
     *   Atteso     il cliente ha confermato ma il documento non e' arrivato
     *   Ricevuto   il documento e' agli atti: su questo si fattura
     *   Chiuso     non ci si fattura piu', esaurito o abbandonato
     *
     * Su un'OFFERTA no. Un'offerta la scriviamo noi: non si "riceve", e non si
     * "aspetta". Nel gestionale ci entra solo se confermata (decisione dell'8
     * agosto), quindi le domande sono due sole: ci si fattura ancora sopra,
     * oppure no. Il caso "aspetto l'ordine" ha gia' un campo suo - Ordine
     * atteso - e sarebbe questo il posto sbagliato per ripeterlo.
     *
     * A database i valori restano i tre di sempre: quello che cambia e' cosa
     * c'e' scritto, perche' 'Ricevuto' su un'offerta non significa niente per
     * chi lo legge.
     */
    opzioniStato(tipo, scelto) {
        const voci = tipo === 'Offerta'
            ? [['Ricevuto', 'Aperta: si fattura su questa offerta'],
               ['Chiuso', 'Chiusa: non si fattura più']]
            : [['Atteso', 'Atteso: confermato, ma il documento non è ancora arrivato'],
               ['Ricevuto', 'Ricevuto: documento agli atti, si fattura su questo'],
               ['Chiuso', 'Chiuso: non si fattura più']];

        // 'Atteso' su un'offerta non esiste: chi cambia tipo si porterebbe
        // dietro uno stato che l'elenco non saprebbe come mostrare.
        const valido = voci.some(v => v[0] === scelto) ? scelto : 'Ricevuto';

        return voci.map(([valore, etichetta]) =>
            `<option value="${valore}" ${valore === valido ? 'selected' : ''}>${etichetta}</option>`).join('');
    }

    /** Mostra i campi che il tipo di documento rende sensati, e nasconde gli altri. */
    aggiornaCampiScheda() {
        const form = document.getElementById('documentoForm');
        if (!form) return;

        const tipo = form.querySelector('#docTipo')?.value;
        const tipoImporto = form.querySelector('#docTipoImporto')?.value;

        // Le voci dello stato dipendono dal tipo e si rifanno a ogni cambio:
        // passando a Offerta, «Atteso» sparisce e «Ricevuto» diventa «Aperta».
        const selectStato = form.querySelector('#docStato');
        if (selectStato) {
            selectStato.innerHTML = this.opzioniStato(tipo, selectStato.value);
        }
        const stato = selectStato?.value;

        const statoHint = form.querySelector('#statoHint');
        if (statoHint) {
            statoHint.textContent = tipo === 'Offerta'
                ? "Un'offerta non si riceve: la scriviamo noi, ed entra qui solo se confermata."
                : 'Atteso → Ricevuto → Chiuso: è la vita del documento del cliente.';
        }

        // ID_PADRE solo sugli ordini: e' un vincolo del database, non una scelta
        // dell'interfaccia (chk_padre_solo_su_ordine).
        form.querySelector('#rigaPadre')?.toggleAttribute('hidden', tipo !== 'Ordine');
        if (tipo !== 'Ordine') {
            const padre = form.querySelector('#docPadre');
            if (padre) padre.value = '';
        }

        form.querySelector('#campoOrdineAtteso')?.toggleAttribute('hidden', tipo !== 'Offerta');
        form.querySelector('#campoImporto')?.toggleAttribute('hidden', tipoImporto === 'A_giornate');
        form.querySelector('#campoGiornate')?.toggleAttribute('hidden', tipoImporto !== 'A_giornate');
        form.querySelector('#rigaChiusura')?.toggleAttribute('hidden', stato !== 'Chiuso');
    }

    // ========================================================================
    // EVENTI
    // ========================================================================

    bindEventi() {
        const modale = document.getElementById(this.modalId);
        if (!modale) return;

        // Un solo ascoltatore sulla finestra, non uno per riga: il corpo viene
        // riscritto a ogni ricarica e gli ascoltatori sulle righe resterebbero
        // appesi a nodi che non esistono piu'.
        modale.addEventListener('click', (e) => {
            const bottone = e.target.closest('[data-doc-azione]');
            if (!bottone) return;
            e.preventDefault();
            this.esegui(bottone.dataset.docAzione, bottone.dataset.docId);
        });

        modale.addEventListener('submit', (e) => {
            if (e.target.id !== 'documentoForm') return;
            e.preventDefault();
            this.salva(e.target);
        });

        modale.addEventListener('change', (e) => {
            if (['docTipo', 'docTipoImporto', 'docStato'].includes(e.target.id)) {
                this.aggiornaCampiScheda();
            }
        });

        // Il selettore di file per il caricamento rapido dall'elenco: uno solo,
        // fuori dalla tabella, con l'ID del documento appeso addosso.
        const selettore = document.createElement('input');
        selettore.type = 'file';
        selettore.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
        selettore.className = 'd-none';
        selettore.addEventListener('change', () => {
            const file = selettore.files?.[0];
            const id = selettore.dataset.docId;
            selettore.value = '';
            if (file && id) this.caricaAllegato(id, file);
        });
        modale.appendChild(selettore);
        this.selettoreFile = selettore;
    }

    esegui(azione, id) {
        switch (azione) {
            case 'nuova-offerta':
                this.inModifica = { Tipo: 'Offerta' };
                this.vista = 'scheda';
                this.disegna();
                this.aggiornaCampiScheda();
                break;
            case 'nuovo-ordine':
                this.inModifica = { Tipo: 'Ordine' };
                this.vista = 'scheda';
                this.disegna();
                this.aggiornaCampiScheda();
                break;
            case 'modifica':
                this.inModifica = this.documenti.find(d => d.ID_DOCUMENTO === id);
                if (!this.inModifica) return;
                this.vista = 'scheda';
                this.disegna();
                this.aggiornaCampiScheda();
                break;
            case 'torna':
                this.inModifica = null;
                this.vista = 'elenco';
                this.disegna();
                break;
            case 'elimina':
                this.elimina(id);
                break;
            case 'carica-file':
                this.selettoreFile.dataset.docId = id;
                this.selettoreFile.click();
                break;
            case 'rimuovi-file':
                this.rimuoviAllegato(id);
                break;
        }
    }

    // ========================================================================
    // SALVATAGGI
    // ========================================================================

    async salva(form) {
        const dati = Object.fromEntries(new FormData(form).entries());
        Object.keys(dati).forEach(k => { if (dati[k] === '') dati[k] = null; });

        dati.ID_COMMESSA = this.commessa.ID_COMMESSA;

        // I due campi dell'importo si escludono: quello nascosto va svuotato,
        // altrimenti un ordine passato da "a corpo" a "a giornate" si porta
        // dietro il valore vecchio e il residuo continua a calcolarsi su quello.
        if (dati.Tipo_Importo === 'A_giornate') {
            dati.Importo = null;
        } else {
            dati.Giornate_Previste = null;
        }
        if (dati.Tipo !== 'Offerta') dati.Ordine_Atteso = null;
        if (dati.Stato !== 'Chiuso') { dati.Residuo_Alla_Chiusura = null; dati.Note_Chiusura = null; }

        const idEsistente = this.inModifica?.ID_DOCUMENTO || null;

        const risposta = idEsistente
            ? await this.api.updateDocumento(idEsistente, dati)
            : await this.api.createDocumento(dati);

        if (!risposta.success) {
            this.ui.showToast(risposta.message || 'Salvataggio non riuscito.', 'error');
            return;
        }

        // Il file si carica DOPO: su un documento nuovo l'ID esiste solo ora.
        const file = form.querySelector('#docFile')?.files?.[0];
        const id = idEsistente || risposta.data?.ID_DOCUMENTO || risposta.data?.id;

        if (file && id) {
            const esito = await this.api.uploadDocumentoFile(id, file);
            if (!esito.success) {
                this.ui.showToast(`Documento salvato, ma l'allegato no: ${esito.message}`, 'warning');
            }
        }

        this.ui.showToast(idEsistente ? 'Documento aggiornato.' : 'Documento creato.', 'success');
        this.inModifica = null;
        this.vista = 'elenco';
        await this.ricarica();
        await this.aggiornaCommesse();
    }

    async elimina(id) {
        const doc = this.documenti.find(d => d.ID_DOCUMENTO === id);
        if (!doc) return;

        const nome = doc.Numero || doc.ID_DOCUMENTO;
        if (!confirm(`Eliminare ${doc.Tipo.toLowerCase()} ${nome}?`)) return;

        const risposta = await this.api.deleteDocumento(id);
        if (!risposta.success) {
            // Il 409 arriva qui come messaggio: fatture collegate, o ordini nati
            // da questa offerta. Sono i due casi in cui cancellare perderebbe un
            // collegamento scritto in un posto solo.
            this.ui.showToast(risposta.message || 'Eliminazione non riuscita.', 'error');
            return;
        }

        this.ui.showToast('Documento eliminato.', 'success');
        await this.ricarica();
    }

    async caricaAllegato(id, file) {
        const esito = await this.api.uploadDocumentoFile(id, file);
        if (!esito.success) {
            this.ui.showToast(esito.message || 'Caricamento non riuscito.', 'error');
            return;
        }
        this.ui.showToast('Allegato caricato.', 'success');
        await this.ricarica();
    }

    async rimuoviAllegato(id) {
        if (!confirm("Rimuovere l'allegato? Il file viene cancellato dal server.")) return;

        const esito = await this.api.deleteDocumentoFile(id);
        if (!esito.success) {
            this.ui.showToast(esito.message || 'Rimozione non riuscita.', 'error');
            return;
        }
        this.ui.showToast('Allegato rimosso.', 'success');
        await this.ricarica();
    }

    /**
     * Ricarica le fatture, che possono aver cambiato commessa.
     *
     * Non serve dopo ogni salvataggio: serve quando una fattura senza commessa
     * si aggancia a un ordine e la eredita. Si limita alle fatture per non
     * rifare l'intero giro di loadInitialData() a finestra aperta.
     */
    async aggiornaCommesse() {
        const risposta = await this.api.getFatture({ limit: 1000 });
        if (risposta.success && risposta.data?.data) {
            this.app.fatture = risposta.data.data;
        }
    }
}

window.DocumentiCommessa = DocumentiCommessa;
