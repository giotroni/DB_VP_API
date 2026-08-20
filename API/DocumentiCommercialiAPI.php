<?php
/**
 * DocumentiCommercialiAPI - Gestione CRUD per la tabella ANA_DOCUMENTI_COMMERCIALI
 *
 * Offerte e ordini in una tabella sola. Li distingue Tipo, li lega ID_PADRE:
 * un'offerta puo' generare piu' ordini, e la fattura punta all'una o all'altro
 * con un campo solo. Vedi docs/PROGETTO-COMMESSE-ORDINI.md, § 4.
 *
 * Il ruolo 'User' non vede nulla di qui: un documento commerciale porta
 * l'importo ordinato, che e' il dato piu' sensibile dopo il fatturato. Stesso
 * trattamento delle fatture.
 */

require_once 'BaseAPI.php';

class DocumentiCommercialiAPI extends BaseAPI {

    public function __construct() {
        parent::__construct('ANA_DOCUMENTI_COMMERCIALI', 'ID_DOCUMENTO');

        $this->requiredFields = ['Tipo', 'ID_COMMESSA'];
        $this->validationRules = [
            'ID_DOCUMENTO'            => ['max_length' => 50],
            'Tipo'                    => ['required' => true, 'enum' => ['Offerta', 'Ordine']],
            'ID_PADRE'                => ['max_length' => 50],
            'ID_COMMESSA'             => ['required' => true, 'max_length' => 50],
            'Numero'                  => ['max_length' => 100],
            'Data'                    => ['date' => true],
            'Tipo_Importo'            => ['enum' => ['Chiuso', 'A_giornate']],
            'Importo'                 => ['numeric' => true, 'min' => 0],
            'Giornate_Previste'       => ['numeric' => true, 'min' => 0],
            'ID_CLIENTE_INTESTATARIO' => ['max_length' => 50],
            'Documento'               => ['max_length' => 500],
            'Stato'                   => ['enum' => ['Atteso', 'Ricevuto', 'Chiuso']],
            'Ordine_Atteso'           => ['enum' => ['Si', 'No']],
            'Residuo_Alla_Chiusura'   => ['numeric' => true],
        ];
    }

    /**
     * Il ruolo 'User' non vede alcun documento commerciale.
     *
     * Elenco vuoto e non errore, come per le fatture: Management carica la
     * risorsa all'avvio per tutti i ruoli, e un 403 li farebbe comparire un
     * messaggio d'errore a ogni accesso.
     */
    protected function getRoleScopeClause(&$params, $alias = '') {
        return $this->isRestrictedUser() ? '1 = 0' : null;
    }

    /**
     * ID nella forma DOC{yy}###.
     *
     * L'anno e' quello del DOCUMENTO, non quello corrente: caricando a gennaio
     * un ordine di dicembre, l'anno corrente lo archivierebbe sotto l'anno
     * sbagliato. E' il difetto che hanno gli ID delle fatture, e non va
     * ripetuto qui.
     */
    protected function generateId() {
        $input = $this->getRequestBody();
        $anno = !empty($input['Data'])
            ? date('y', strtotime($input['Data']))
            : date('y');

        try {
            $sql = "SELECT ID_DOCUMENTO FROM {$this->table}
                     WHERE ID_DOCUMENTO LIKE :prefisso
                     ORDER BY ID_DOCUMENTO DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':prefisso', "DOC{$anno}%");
            $stmt->execute();
            $ultimo = $stmt->fetchColumn();

            $numero = $ultimo ? intval(substr($ultimo, 5)) + 1 : 1;
            return 'DOC' . $anno . str_pad($numero, 3, '0', STR_PAD_LEFT);

        } catch (PDOException $e) {
            return 'DOC' . $anno . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        }
    }

    protected function validateInput($data, $requireAll = true) {
        $errors = [];

        if ($requireAll) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
                    $errors[] = "Campo '$field' richiesto";
                }
            }
        }

        foreach ($data as $field => $value) {
            if (!isset($this->validationRules[$field]) || $value === null || $value === '') {
                continue;
            }
            $rules = $this->validationRules[$field];

            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']} caratteri)";
            }
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) {
                $errors[] = "Valore '$field' non valido. Valori consentiti: " . implode(', ', $rules['enum']);
            }
            if (isset($rules['numeric']) && !is_numeric($value)) {
                $errors[] = "Campo '$field' deve essere numerico";
            }
            if (isset($rules['min']) && is_numeric($value) && floatval($value) < $rules['min']) {
                $errors[] = "Campo '$field' deve essere >= {$rules['min']}";
            }
            if (isset($rules['date']) && strtotime($value) === false) {
                $errors[] = "Campo '$field' non e' una data valida";
            }
        }

        $errors = array_merge($errors, $this->erroriDiCoerenza($data));

        return ['valid' => empty($errors), 'errors' => $errors];
    }

    /**
     * Le regole che il database gia' impone, tradotte in messaggi leggibili.
     *
     * I vincoli veri stanno sulla tabella - chiave esterna sulla commessa,
     * CHECK sul padre - e restano l'ultima parola: qui si intercettano prima,
     * perche' un errore SQL grezzo in faccia a chi carica un ordine non dice
     * cosa ha sbagliato.
     */
    private function erroriDiCoerenza($data) {
        $errors = [];

        // In aggiornamento arriva solo quello che si sta cambiando: le regole
        // che mettono in relazione due campi vanno valutate sul record intero,
        // altrimenti cambiare il solo Tipo non farebbe scattare nulla.
        $completo = $data;
        $id = $data[$this->primaryKey] ?? null;
        if ($id) {
            $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE ID_DOCUMENTO = :id");
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $esistente = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($esistente) {
                $completo = array_merge($esistente, $data);
            }
        }

        $tipo    = $completo['Tipo'] ?? null;
        $padre   = $completo['ID_PADRE'] ?? null;
        $tipoImp = $completo['Tipo_Importo'] ?? null;

        // Solo un ordine puo' avere un padre: e' il CHECK chk_padre_solo_su_ordine.
        if (!empty($padre) && $tipo === 'Offerta') {
            $errors[] = "Un'offerta non discende da un altro documento: il campo 'nasce da' vale solo sugli ordini";
        }

        // E il padre dev'essere un'offerta, non un altro ordine. Questo il
        // database non lo sa: la chiave esterna punta alla stessa tabella e
        // non distingue il Tipo.
        if (!empty($padre)) {
            if ($padre === $id) {
                $errors[] = "Un documento non puo' discendere da se stesso";
            } else {
                $stmt = $this->db->prepare("SELECT Tipo FROM {$this->table} WHERE ID_DOCUMENTO = :p");
                $stmt->bindValue(':p', $padre);
                $stmt->execute();
                $tipoPadre = $stmt->fetchColumn();
                if ($tipoPadre === false) {
                    $errors[] = "Il documento di origine '$padre' non esiste";
                } elseif ($tipoPadre !== 'Offerta') {
                    $errors[] = "Un ordine nasce da un'offerta, non da un altro ordine";
                }
            }
        }

        // Offerte e ordini stanno solo sulle commesse Cliente. Su una commessa
        // interna l'avanzamento economico non e' vuoto, e' privo di senso.
        if (!empty($completo['ID_COMMESSA'])) {
            $stmt = $this->db->prepare("SELECT Tipo_Commessa FROM ANA_COMMESSE WHERE ID_COMMESSA = :c");
            $stmt->bindValue(':c', $completo['ID_COMMESSA']);
            $stmt->execute();
            $tipoCommessa = $stmt->fetchColumn();
            if ($tipoCommessa === false) {
                $errors[] = "La commessa '{$completo['ID_COMMESSA']}' non esiste";
            } elseif ($tipoCommessa === 'Interna') {
                $errors[] = "Una commessa interna non ha offerte ne' ordini";
            }
        }

        // Le giornate previste hanno senso solo dove non c'e' un importo
        // pattuito: su un ordine chiuso il tetto e' l'importo.
        if ($tipoImp === 'Chiuso' && !empty($completo['Giornate_Previste'])) {
            $errors[] = "Le giornate previste si indicano sugli ordini a giornate, non su quelli chiusi";
        }

        // Il residuo alla chiusura si registra chiudendo il documento, non prima.
        if (!empty($completo['Residuo_Alla_Chiusura']) && ($completo['Stato'] ?? null) !== 'Chiuso') {
            $errors[] = "Il residuo si registra solo chiudendo il documento";
        }

        return $errors;
    }

    protected function preprocessData($data) {
        // In aggiornamento la chiave primaria e' gia' dentro $data: la mette
        // update() prima di chiamarci. I valori predefiniti valgono solo in
        // creazione, altrimenti un salvataggio parziale li riscrive.
        $isUpdate = isset($data[$this->primaryKey]) && !empty($data[$this->primaryKey]);

        if (isset($data['Data']) && !empty($data['Data'])) {
            $data['Data'] = date('Y-m-d', strtotime($data['Data']));
        }
        foreach (['Numero', 'Documento', 'Note', 'Note_Chiusura'] as $campo) {
            if (isset($data[$campo])) {
                $data[$campo] = trim((string)$data[$campo]);
            }
        }

        // Campo vuoto dal form: a database va NULL, non stringa vuota,
        // altrimenti la chiave esterna lo rifiuta.
        foreach (['ID_PADRE', 'ID_CLIENTE_INTESTATARIO'] as $campo) {
            if (isset($data[$campo]) && trim((string)$data[$campo]) === '') {
                $data[$campo] = null;
            }
        }

        // Un'offerta non ha un padre, qualunque cosa arrivi dal form.
        if (($data['Tipo'] ?? null) === 'Offerta' && array_key_exists('ID_PADRE', $data)) {
            $data['ID_PADRE'] = null;
        }

        if (!$isUpdate) {
            if (empty($data['Tipo_Importo']))  { $data['Tipo_Importo']  = 'Chiuso'; }
            if (empty($data['Stato']))         { $data['Stato']         = 'Ricevuto'; }
            if (empty($data['Ordine_Atteso'])) { $data['Ordine_Atteso'] = 'No'; }

            // L'intestatario, se non detto, e' il cliente della commessa. Lo
            // decide l'ordine e puo' divergere - 4512149513 chiede fattura a
            // Egidio Galbani e 4512149558 a Gruppo Lactalis, stesso gruppo -
            // ma il caso normale e' che coincidano.
            if (empty($data['ID_CLIENTE_INTESTATARIO']) && !empty($data['ID_COMMESSA'])) {
                $stmt = $this->db->prepare("SELECT ID_CLIENTE FROM ANA_COMMESSE WHERE ID_COMMESSA = :c");
                $stmt->bindValue(':c', $data['ID_COMMESSA']);
                $stmt->execute();
                $cliente = $stmt->fetchColumn();
                if ($cliente) {
                    $data['ID_CLIENTE_INTESTATARIO'] = $cliente;
                }
            }
        }

        return $data;
    }

    /**
     * Aggiunge al documento quello che non sta nella sua riga: da chi discende,
     * su cosa insiste, e quanto e' stato fatturato contro quanto ordinato.
     */
    protected function processRecord($record) {
        if (!is_array($record) || !isset($record['ID_DOCUMENTO'])) {
            return $record;
        }

        try {
            $stmt = $this->db->prepare("
                SELECT cm.Commessa, cm.Stato_Commessa, cl.Cliente AS cliente_commessa,
                       ci.Cliente AS cliente_intestatario, pa.Numero AS numero_offerta
                  FROM ANA_DOCUMENTI_COMMERCIALI d
                  LEFT JOIN ANA_COMMESSE cm ON cm.ID_COMMESSA = d.ID_COMMESSA
                  LEFT JOIN ANA_CLIENTI   cl ON cl.ID_CLIENTE = cm.ID_CLIENTE
                  LEFT JOIN ANA_CLIENTI   ci ON ci.ID_CLIENTE = d.ID_CLIENTE_INTESTATARIO
                  LEFT JOIN ANA_DOCUMENTI_COMMERCIALI pa ON pa.ID_DOCUMENTO = d.ID_PADRE
                 WHERE d.ID_DOCUMENTO = :id");
            $stmt->bindValue(':id', $record['ID_DOCUMENTO']);
            $stmt->execute();
            $ctx = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $record = array_merge($record, $ctx);

            // Fatturato sul documento, al netto degli storni: le note di
            // accredito hanno importo negativo e si sottraggono da sole.
            $stmt = $this->db->prepare("
                SELECT IFNULL(SUM(Fatturato_TOT), 0) AS fatturato, COUNT(*) AS n_fatture
                  FROM FACT_FATTURE WHERE ID_DOCUMENTO = :id");
            $stmt->bindValue(':id', $record['ID_DOCUMENTO']);
            $stmt->execute();
            $f = $stmt->fetch(PDO::FETCH_ASSOC);
            $record['fatturato']  = floatval($f['fatturato']);
            $record['n_fatture']  = intval($f['n_fatture']);

            // Gli ordini nati da questa offerta. Serve alla regola contro il
            // doppio conteggio: ordinato = ordini + offerte SENZA ordini figli.
            $stmt = $this->db->prepare("
                SELECT COUNT(*) FROM ANA_DOCUMENTI_COMMERCIALI WHERE ID_PADRE = :id");
            $stmt->bindValue(':id', $record['ID_DOCUMENTO']);
            $stmt->execute();
            $record['n_ordini_figli'] = intval($stmt->fetchColumn());

            // Un'offerta che ha generato ordini non porta piu' cifre proprie:
            // le fatture stanno sugli ordini, e leggerla da sola direbbe "0%
            // fatturato, residuo pieno" mentre la fornitura e' gia' saldata.
            // E' la stessa regola che evita il doppio conteggio dell'ordinato:
            // ordini + offerte SENZA ordini figli.
            $record['coperta_da_ordini'] = ($record['Tipo'] === 'Offerta' && $record['n_ordini_figli'] > 0);

            // Residuo e percentuale solo dove l'ordinato e' un numero. Su un
            // ordine a giornate l'importo totale non esiste, e chiedere "a che
            // percentuale siamo" non ha risposta: meglio nessun dato che un
            // dato su un denominatore inventato.
            if (!$record['coperta_da_ordini']
                && $record['Tipo_Importo'] === 'Chiuso' && $record['Importo'] !== null) {
                $importo = floatval($record['Importo']);
                $record['residuo'] = round($importo - $record['fatturato'], 2);
                $record['percentuale_fatturata'] = $importo > 0
                    ? round($record['fatturato'] / $importo * 100, 2)
                    : null;
            } else {
                $record['residuo'] = null;
                $record['percentuale_fatturata'] = null;
            }

        } catch (Exception $e) {
            // Un documento senza contesto resta leggibile: meglio la riga
            // nuda che un elenco che non si apre.
            error_log('DocumentiCommercialiAPI::processRecord - ' . $e->getMessage());
        }

        return $record;
    }

    protected function buildWhereClause(&$params) {
        $conditions = [];

        foreach (['ID_COMMESSA' => 'commessa', 'Tipo' => 'tipo', 'Stato' => 'stato',
                  'ID_PADRE' => 'padre', 'Tipo_Importo' => 'tipo_importo'] as $colonna => $filtro) {
            if (isset($_GET[$filtro]) && $_GET[$filtro] !== '') {
                $conditions[] = "$colonna = :$filtro";
                $params[":$filtro"] = $_GET[$filtro];
            }
        }

        if (isset($_GET['cliente']) && $_GET['cliente'] !== '') {
            $conditions[] = "ID_CLIENTE_INTESTATARIO = :cliente";
            $params[':cliente'] = $_GET['cliente'];
        }

        // Le offerte ancora senza ordine, distinte fra quelle che lo aspettano
        // e quelle a cui non arrivera' mai: e' la differenza fra "da
        // sollecitare" e "cliente che non emette ordini".
        if (isset($_GET['senza_ordine']) && $_GET['senza_ordine'] === 'si') {
            $conditions[] = "Tipo = 'Offerta' AND NOT EXISTS (
                SELECT 1 FROM ANA_DOCUMENTI_COMMERCIALI figli
                 WHERE figli.ID_PADRE = {$this->table}.ID_DOCUMENTO)";
        }

        if (isset($_GET['search']) && $_GET['search'] !== '') {
            $conditions[] = "(Numero LIKE :search OR Note LIKE :search)";
            $params[':search'] = '%' . $_GET['search'] . '%';
        }

        return implode(' AND ', $conditions);
    }

    /**
     * Cancellazione: prima si guarda cosa resta appeso.
     *
     * Il database ferma gia' la cancellazione di un'offerta con ordini figli
     * (ON DELETE RESTRICT) e slega le fatture (ON DELETE SET NULL), ma un
     * documento con fatture emesse sopra non va cancellato per sbaglio: quelle
     * fatture resterebbero senza il documento che le autorizza.
     */
    protected function delete($id) {
        $this->assertWriteAllowed();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM FACT_FATTURE WHERE ID_DOCUMENTO = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        $fatture = intval($stmt->fetchColumn());

        if ($fatture > 0) {
            $quante = $fatture === 1 ? "c'e' una fattura" : "ci sono $fatture fatture";
            sendErrorResponse(
                "Su questo documento $quante: spostala su un altro documento prima di eliminarlo",
                409);
            return;
        }

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM {$this->table} WHERE ID_PADRE = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        $figli = intval($stmt->fetchColumn());

        if ($figli > 0) {
            $quanti = $figli === 1 ? "discende un ordine" : "discendono $figli ordini";
            sendErrorResponse(
                "Da questa offerta $quanti: il legame e' l'unico posto in cui e' scritto che sono la stessa fornitura",
                409);
            return;
        }

        parent::delete($id);
    }
}
