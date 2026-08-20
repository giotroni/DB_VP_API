<?php
/**
 * FattureAPI - Gestione CRUD per la tabella FACT_FATTURE
 *
 * Le note di accredito seguono la regola descritta in
 * docs/REGOLE-FATTURAZIONE.md e riassunta qui perche' e' quella che governa
 * quasi tutte le eccezioni di questo file:
 *   1. importi sempre NEGATIVI, cosi' il fatturato netto e' SUM(Fatturato_TOT);
 *   2. nessuna scadenza (Tempi_Pagamento e Scadenza_Pagamento a NULL): una nota
 *      di accredito non si incassa, si compensa, e non entra nello scaduto;
 *   3. punta alla fattura che storna con ID_FATTURA_STORNATA, da cui si ricava
 *      lo stato della fattura: stornata quando le note collegate la coprono
 *      per intero, stornata_parzialmente quando ne coprono una parte.
 */

require_once 'BaseAPI.php';

class FattureAPI extends BaseAPI {

    public function __construct() {
        parent::__construct('FACT_FATTURE', 'ID_FATTURA');

        $this->requiredFields = ['Data', 'ID_CLIENTE', 'NR'];
        // Gli importi non hanno qui un vincolo di segno: quale sia quello giusto
        // dipende dal TIPO, e la verifica sta in validateBusinessRules().
        $this->validationRules = [
            'ID_FATTURA' => ['max_length' => 50],
            'Data' => ['required' => true, 'date' => true],
            'ID_CLIENTE' => ['required' => true, 'max_length' => 50],
            'TIPO' => ['enum' => ['Fattura', 'Nota_Accredito']],
            'NR' => ['required' => true, 'max_length' => 100],
            'ID_FATTURA_STORNATA' => ['max_length' => 50],
            'ID_COMMESSA' => ['max_length' => 50],
            'Fatturato_gg' => ['numeric' => true],
            'Fatturato_Spese' => ['numeric' => true],
            'Fatturato_TOT' => ['numeric' => true],
            'Note' => ['max_length' => 65535],
            'Riferimento_Ordine' => ['max_length' => 255],
            'Data_Ordine' => ['date' => true],
            'Tempi_Pagamento' => ['numeric' => true, 'min' => 0, 'max' => 365],
            'Scadenza_Pagamento' => ['date' => true],
            'Data_Pagamento' => ['date' => true],
            'Valore_Pagato' => ['numeric' => true]
        ];
    }

    /**
     * Il TIPO del documento in gioco: quello inviato dal client se c'e',
     * altrimenti quello gia' salvato. Un update parziale che non manda il TIPO
     * significa "non lo sto cambiando", non "e' una fattura".
     */
    private function resolveTipo($data) {
        if (!empty($data['TIPO'])) {
            return $data['TIPO'];
        }

        if (!empty($data['ID_FATTURA'])) {
            try {
                $stmt = $this->db->prepare("SELECT TIPO FROM {$this->table} WHERE ID_FATTURA = :id");
                $stmt->bindValue(':id', $data['ID_FATTURA']);
                $stmt->execute();
                $tipo = $stmt->fetchColumn();
                if (!empty($tipo)) {
                    return $tipo;
                }
            } catch (PDOException $e) {
                // Cade sul default qui sotto: e' il default anche della colonna.
            }
        }

        return 'Fattura';
    }

    /**
     * Il segno che l'importo deve avere una volta salvato.
     * Sul documento cartaceo una nota di accredito riporta importi positivi ed
     * e' cosi' che vengono digitati: la conversione avviene qui, in un punto solo.
     */
    private function normalizzaImporto($valore, $isNotaAccredito) {
        $numero = floatval($valore);
        return $isNotaAccredito ? -abs($numero) : $numero;
    }
    
    /**
     * Validazione input per fatture
     */
    protected function validateInput($data, $requireAll = true) {
        $errors = [];
        
        // Verifica campi richiesti
        if ($requireAll) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || (is_string($data[$field]) && empty(trim($data[$field])))) {
                    $errors[] = "Campo '$field' richiesto";
                }
            }
        }
        
        // Validazione specifiche per ogni campo
        foreach ($data as $field => $value) {
            if (!isset($this->validationRules[$field]) || $value === null || $value === '') {
                continue;
            }
            
            $rules = $this->validationRules[$field];
            
            // Verifica lunghezza massima
            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']} caratteri)";
            }
            
            // Verifica enum
            if (isset($rules['enum']) && !in_array($value, $rules['enum'])) {
                $errors[] = "Valore '$field' non valido. Valori consentiti: " . implode(', ', $rules['enum']);
            }
            
            // Verifica numerico
            if (isset($rules['numeric']) && !is_numeric($value)) {
                $errors[] = "Campo '$field' deve essere numerico";
            }
            
            // Verifica range numerico
            if (isset($rules['min']) && floatval($value) < $rules['min']) {
                $errors[] = "Campo '$field' deve essere >= {$rules['min']}";
            }
            
            if (isset($rules['max']) && floatval($value) > $rules['max']) {
                $errors[] = "Campo '$field' deve essere <= {$rules['max']}";
            }
            
            // Verifica data
            if (isset($rules['date']) && !$this->isValidDate($value)) {
                $errors[] = "Formato data '$field' non valido (YYYY-MM-DD)";
            }
        }
        
        // Validazioni business logic
        $businessValidation = $this->validateBusinessRules($data);
        if (!$businessValidation['valid']) {
            $errors = array_merge($errors, $businessValidation['errors']);
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Validazioni business logic specifiche
     */
    private function validateBusinessRules($data) {
        $errors = [];
        
        // Verifica che il cliente esista
        if (isset($data['ID_CLIENTE']) && !empty($data['ID_CLIENTE'])) {
            if (!$this->existsInTable('ANA_CLIENTI', 'ID_CLIENTE', $data['ID_CLIENTE'])) {
                $errors[] = "Cliente specificato non esistente";
            }
        }
        
        // Verifica che la commessa esista se specificata
        if (isset($data['ID_COMMESSA']) && !empty($data['ID_COMMESSA'])) {
            if (!$this->existsInTable('ANA_COMMESSE', 'ID_COMMESSA', $data['ID_COMMESSA'])) {
                $errors[] = "Commessa specificata non esistente";
            }
        }
        
        // Verifica univocità numero fattura per anno
        if (isset($data['NR'], $data['Data'])) {
            $duplicateCheck = $this->checkDuplicateNumber($data);
            if (!$duplicateCheck['valid']) {
                $errors[] = $duplicateCheck['message'];
            }
        }
        
        // Verifica coerenza date
        if (isset($data['Data_Ordine'], $data['Data']) && !empty($data['Data_Ordine'])) {
            if ($data['Data_Ordine'] > $data['Data']) {
                $errors[] = "La data ordine non può essere successiva alla data fattura";
            }
        }
        
        if (isset($data['Data_Pagamento'], $data['Data']) && !empty($data['Data_Pagamento'])) {
            if ($data['Data_Pagamento'] < $data['Data']) {
                $errors[] = "La data pagamento non può essere precedente alla data fattura";
            }
        }
        
        $isNotaAccredito = $this->resolveTipo($data) === 'Nota_Accredito';

        // Segno degli importi. Su una fattura restano positivi come prima; su una
        // nota di accredito il segno lo mette preprocessData(), quindi qui non c'è
        // nulla da respingere: qualunque cosa arrivi diventa negativa.
        if (!$isNotaAccredito) {
            foreach (['Fatturato_gg', 'Fatturato_Spese', 'Fatturato_TOT', 'Valore_Pagato'] as $campo) {
                if (isset($data[$campo]) && $data[$campo] !== '' && floatval($data[$campo]) < 0) {
                    $errors[] = "Su una fattura gli importi non possono essere negativi: per stornare si emette una nota di accredito";
                    break;
                }
            }
        }

        // Verifica coerenza importi, sui valori come verranno salvati
        if (isset($data['Fatturato_gg'], $data['Fatturato_Spese'], $data['Fatturato_TOT'])) {
            $calcolato = $this->normalizzaImporto($data['Fatturato_gg'], $isNotaAccredito)
                       + $this->normalizzaImporto($data['Fatturato_Spese'], $isNotaAccredito);
            $totale = $this->normalizzaImporto($data['Fatturato_TOT'], $isNotaAccredito);

            if (abs($calcolato - $totale) > 0.01) { // Tolleranza per arrotondamenti
                $errors[] = "Il totale fatturato non corrisponde alla somma di giornate e spese (calcolato: $calcolato, dichiarato: $totale)";
            }
        }

        // Verifica valore pagato: il confronto è in valore assoluto, così vale
        // anche per la compensazione di una nota di accredito.
        if (isset($data['Valore_Pagato'], $data['Fatturato_TOT']) && !empty($data['Valore_Pagato'])) {
            if (abs(floatval($data['Valore_Pagato'])) > abs(floatval($data['Fatturato_TOT'])) + 0.01) {
                $errors[] = "Il valore pagato non può essere superiore al totale fatturato";
            }
        }

        // Documento stornato
        $stornata = isset($data['ID_FATTURA_STORNATA']) ? trim((string)$data['ID_FATTURA_STORNATA']) : '';

        if ($stornata !== '' && !$isNotaAccredito) {
            $errors[] = "Solo una nota di accredito può stornare una fattura";
        } elseif ($stornata !== '') {
            $errors = array_merge($errors, $this->validateStorno($stornata, $data));
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
    
    /**
     * Controlli sul documento che una nota di accredito dice di stornare.
     *
     * Una nota storna una fattura dello stesso cliente, emessa prima, e non
     * puo' far scendere sotto zero quello che resta da stornare: se le note
     * gia' collegate coprono l'intero importo, un'altra non ci sta.
     */
    private function validateStorno($idStornata, $data) {
        $errors = [];

        try {
            $stmt = $this->db->prepare("
                SELECT ID_FATTURA, TIPO, NR, Data, ID_CLIENTE, Fatturato_TOT
                  FROM {$this->table} WHERE ID_FATTURA = :id
            ");
            $stmt->bindValue(':id', $idStornata);
            $stmt->execute();
            $fattura = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return ["Errore nella verifica del documento stornato"];
        }

        if (!$fattura) {
            return ["Il documento da stornare non esiste"];
        }

        if ($fattura['TIPO'] !== 'Fattura') {
            $errors[] = "Una nota di accredito può stornare solo una fattura, non un'altra nota";
        }

        if (!empty($data['ID_CLIENTE']) && $fattura['ID_CLIENTE'] !== $data['ID_CLIENTE']) {
            $errors[] = "La fattura da stornare è intestata a un altro cliente";
        }

        if (!empty($data['Data']) && !empty($fattura['Data']) && $fattura['Data'] > $data['Data']) {
            $errors[] = "La fattura da stornare ({$fattura['NR']}) è successiva alla nota di accredito";
        }

        // Capienza residua: le note gia' collegate, escludendo se stessa in
        // caso di modifica.
        if (isset($data['Fatturato_TOT']) && $data['Fatturato_TOT'] !== '') {
            try {
                $sql = "SELECT IFNULL(SUM(Fatturato_TOT), 0) FROM {$this->table}
                         WHERE ID_FATTURA_STORNATA = :id";
                $params = [':id' => $idStornata];
                if (!empty($data['ID_FATTURA'])) {
                    $sql .= " AND ID_FATTURA <> :self";
                    $params[':self'] = $data['ID_FATTURA'];
                }
                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                $giaStornato = abs(floatval($stmt->fetchColumn()));
            } catch (PDOException $e) {
                $giaStornato = 0;
            }

            $questa = abs($this->normalizzaImporto($data['Fatturato_TOT'], true));
            $capienza = abs(floatval($fattura['Fatturato_TOT']));

            if ($giaStornato + $questa > $capienza + 0.01) {
                $residuo = number_format($capienza - $giaStornato, 2, ',', '.');
                $errors[] = "Lo storno supera quanto resta da stornare sulla fattura {$fattura['NR']} (residuo: $residuo)";
            }
        }

        return $errors;
    }

    /**
     * Verifica univocità numero fattura per anno
     */
    private function checkDuplicateNumber($data) {
        try {
            $anno = date('Y', strtotime($data['Data']));
            
            $sql = "SELECT COUNT(*) as count FROM {$this->table} 
                    WHERE NR = :numero 
                    AND YEAR(Data) = :anno";
            
            $params = [
                ':numero' => $data['NR'],
                ':anno' => $anno
            ];
            
            // Esclude il record corrente se è un aggiornamento
            if (isset($data['ID_FATTURA'])) {
                $sql .= " AND ID_FATTURA != :current_id";
                $params[':current_id'] = $data['ID_FATTURA'];
            }
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->fetchColumn();
            
            if ($count > 0) {
                return [
                    'valid' => false,
                    'message' => "Numero fattura '$data[NR]' già esistente per l'anno $anno"
                ];
            }
            
            return ['valid' => true, 'message' => ''];
            
        } catch (PDOException $e) {
            return [
                'valid' => false,
                'message' => 'Errore durante la verifica del numero fattura'
            ];
        }
    }
    
    /**
     * Genera nuovo ID fattura
     */
    protected function generateId() {
        try {
            // Genera ID basato su anno: FAT + YY + numero progressivo
            $anno = date('y'); // Anno a 2 cifre
            
            // Trova il prossimo numero disponibile per quest'anno
            $sql = "SELECT ID_FATTURA FROM {$this->table} WHERE ID_FATTURA LIKE 'FAT{$anno}%' ORDER BY ID_FATTURA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $lastId = $stmt->fetchColumn();
            
            if ($lastId) {
                $number = intval(substr($lastId, 5)) + 1; // FAT + 2 cifre anno + numero
            } else {
                $number = 1;
            }
            
            return 'FAT' . $anno . str_pad($number, 3, '0', STR_PAD_LEFT);
            
        } catch (PDOException $e) {
            return 'FAT' . date('y') . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        }
    }
    
    /**
     * Pre-processing dei dati prima dell'inserimento/aggiornamento
     */
    protected function preprocessData($data) {
        // In aggiornamento la chiave primaria e' gia' dentro $data: la mette
        // update() prima di chiamarci.
        $isUpdate = isset($data[$this->primaryKey]) && !empty($data[$this->primaryKey]);

        // Valida e formatta le date
        $dateFields = ['Data', 'Data_Ordine', 'Scadenza_Pagamento', 'Data_Pagamento'];
        foreach ($dateFields as $field) {
            if (isset($data[$field]) && !empty($data[$field])) {
                $data[$field] = date('Y-m-d', strtotime($data[$field]));
            }
        }
        
        // Imposta il tipo: in creazione è 'Fattura', in aggiornamento è quello
        // già salvato. Prima veniva forzato a 'Fattura' in entrambi i casi, e un
        // update che non mandava il campo trasformava una nota di accredito.
        if (!isset($data['TIPO']) || empty($data['TIPO'])) {
            $data['TIPO'] = $this->resolveTipo($data);
        }

        // Imposta importi a 0 se non specificati, ma SOLO in creazione. E' lo
        // stesso motivo per cui poco sopra TIPO non viene piu' forzato: in
        // aggiornamento un campo assente vuol dire "non lo sto cambiando", e
        // azzerarlo qui svuotava l'importo di una fattura gia' emessa.
        if (!$isUpdate) {
            $importiFields = ['Fatturato_gg', 'Fatturato_Spese', 'Fatturato_TOT', 'Valore_Pagato'];
            foreach ($importiFields as $field) {
                if (!isset($data[$field]) || $data[$field] === '') {
                    $data[$field] = 0;
                }
            }
        }
        
        // Calcola automaticamente il totale se non specificato
        if ((!isset($data['Fatturato_TOT']) || $data['Fatturato_TOT'] == 0) && 
            (isset($data['Fatturato_gg']) || isset($data['Fatturato_Spese']))) {
            $data['Fatturato_TOT'] = floatval($data['Fatturato_gg'] ?? 0) + floatval($data['Fatturato_Spese'] ?? 0);
        }
        
        // Calcola scadenza pagamento se non specificata ma ci sono tempi di pagamento
        if (isset($data['Tempi_Pagamento'], $data['Data']) && !empty($data['Tempi_Pagamento']) &&
            (!isset($data['Scadenza_Pagamento']) || empty($data['Scadenza_Pagamento']))) {
            $dataFattura = new DateTime($data['Data']);
            $dataFattura->add(new DateInterval('P' . intval($data['Tempi_Pagamento']) . 'D'));
            $data['Scadenza_Pagamento'] = $dataFattura->format('Y-m-d');
        }

        // --- Le due regole della nota di accredito ---
        // Sta in fondo di proposito: sovrascrive la scadenza appena calcolata e
        // normalizza importi già completi di totale.
        if ($data['TIPO'] === 'Nota_Accredito') {
            foreach (['Fatturato_gg', 'Fatturato_Spese', 'Fatturato_TOT', 'Valore_Pagato'] as $campo) {
                if (isset($data[$campo]) && $data[$campo] !== null && $data[$campo] !== '') {
                    $data[$campo] = $this->normalizzaImporto($data[$campo], true);
                }
            }

            // Nessuna scadenza da attendere: una nota di accredito non si incassa.
            $data['Tempi_Pagamento'] = null;
            $data['Scadenza_Pagamento'] = null;

            // Campo vuoto dal form: a database va NULL, non stringa vuota,
            // altrimenti la chiave esterna lo rifiuta.
            if (isset($data['ID_FATTURA_STORNATA']) && trim((string)$data['ID_FATTURA_STORNATA']) === '') {
                $data['ID_FATTURA_STORNATA'] = null;
            }
        } elseif (array_key_exists('ID_FATTURA_STORNATA', $data)) {
            // Una fattura non storna nulla: se il tipo cambia da nota a fattura
            // il collegamento va tolto, non lasciato indietro.
            $data['ID_FATTURA_STORNATA'] = null;
        }

        // Normalizza note e riferimenti
        if (isset($data['Note'])) {
            $data['Note'] = trim($data['Note']);
        }
        
        if (isset($data['Riferimento_Ordine'])) {
            $data['Riferimento_Ordine'] = trim($data['Riferimento_Ordine']);
        }
        
        return $data;
    }
    
    /**
     * Costruisce clausola WHERE per filtri
     */
    /**
     * Il ruolo 'User' non vede alcuna fattura: il fatturato ai clienti è il
     * dato economico più sensibile e non compare in nessuna sua schermata.
     * Management carica comunque la risorsa all'avvio per tutti i ruoli, quindi
     * la risposta è un elenco vuoto e non un errore.
     */
    protected function getRoleScopeClause(&$params, $alias = '') {
        if (!$this->isRestrictedUser()) {
            return null;
        }

        return '1 = 0';
    }

    /**
     * Condizione SQL "questa fattura è stornata da almeno una nota di accredito".
     *
     * Basta l'esistenza di una nota collegata, non la copertura totale: una
     * fattura stornata a metà non va comunque trattata come un credito pieno,
     * e il residuo esatto lo calcola aggiungiDatiStorno() sul record.
     */
    private function clausolaStornata() {
        return "EXISTS (SELECT 1 FROM {$this->table} nc
                         WHERE nc.ID_FATTURA_STORNATA = {$this->table}.ID_FATTURA)";
    }

    protected function buildWhereClause(&$params) {
        $conditions = [];
        
        // Filtro per cliente
        if (isset($_GET['cliente']) && !empty($_GET['cliente'])) {
            $conditions[] = "ID_CLIENTE = :cliente";
            $params[':cliente'] = $_GET['cliente'];
        }
        
        // Filtro per commessa
        if (isset($_GET['commessa']) && !empty($_GET['commessa'])) {
            $conditions[] = "ID_COMMESSA = :commessa";
            $params[':commessa'] = $_GET['commessa'];
        }
        
        // Filtro per tipo
        if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
            $conditions[] = "TIPO = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        
        // Filtro per numero
        if (isset($_GET['numero']) && !empty($_GET['numero'])) {
            $conditions[] = "NR LIKE :numero";
            $params[':numero'] = '%' . $_GET['numero'] . '%';
        }
        
        // Filtro per data (da)
        if (isset($_GET['data_da']) && !empty($_GET['data_da'])) {
            $conditions[] = "Data >= :data_da";
            $params[':data_da'] = $_GET['data_da'];
        }
        
        // Filtro per data (a)
        if (isset($_GET['data_a']) && !empty($_GET['data_a'])) {
            $conditions[] = "Data <= :data_a";
            $params[':data_a'] = $_GET['data_a'];
        }
        
        // Filtro per anno
        if (isset($_GET['anno']) && !empty($_GET['anno'])) {
            $conditions[] = "YEAR(Data) = :anno";
            $params[':anno'] = intval($_GET['anno']);
        }
        
        // Filtro per mese/anno
        if (isset($_GET['mese']) && !empty($_GET['mese']) && isset($_GET['anno']) && !empty($_GET['anno'])) {
            $conditions[] = "YEAR(Data) = :anno_mese AND MONTH(Data) = :mese";
            $params[':anno_mese'] = intval($_GET['anno']);
            $params[':mese'] = intval($_GET['mese']);
        }
        
        // Filtro per stato pagamento. Le note di accredito restano fuori da tutti
        // gli stati di incasso e hanno il proprio; le fatture stornate escono
        // dallo scaduto e dal non pagato, perché non sono un credito.
        if (isset($_GET['stato_pagamento'])) {
            $stornata = $this->clausolaStornata();
            switch ($_GET['stato_pagamento']) {
                // NOT $stornata anche qui: getStatoPagamento() guarda lo storno
                // PRIMA dell'incasso, perche' una fattura annullata non e' un
                // credito qualunque cosa sia stato pagato. La 20/25 risulta
                // insieme stornata e incassata - e' un'anomalia dei dati, gia'
                // nota - e senza questa riga compariva fra le pagate nel filtro
                // e fra le annullate nell'elenco.
                case 'pagata':
                    $conditions[] = "Data_Pagamento IS NOT NULL AND TIPO <> 'Nota_Accredito' AND NOT $stornata
                                     AND Valore_Pagato >= Fatturato_TOT";
                    break;
                // Le condizioni qui sotto devono dire esattamente quello che
                // dice getStatoPagamento(): sono la stessa regola scritta due
                // volte, e finche' e' cosi' vanno cambiate insieme. Era gia'
                // andata storta: il vecchio filtro 'non_pagata' prendeva anche
                // le scadute, quindi la tendina rispondeva 6 dove le righe con
                // quell'etichetta erano 4.
                case 'da_incassare':
                    $conditions[] = "Data_Pagamento IS NULL AND TIPO <> 'Nota_Accredito' AND NOT $stornata
                                     AND (Scadenza_Pagamento IS NULL OR Scadenza_Pagamento >= CURDATE())";
                    break;
                case 'scaduta':
                    $conditions[] = "Scadenza_Pagamento < CURDATE() AND Data_Pagamento IS NULL AND TIPO <> 'Nota_Accredito' AND NOT $stornata";
                    break;
                // Mancava del tutto: la voce c'era in tendina, il ramo no,
                // quindi selezionandola non filtrava niente e si vedeva tutto.
                case 'parzialmente_pagata':
                    $conditions[] = "Data_Pagamento IS NOT NULL AND TIPO <> 'Nota_Accredito' AND NOT $stornata
                                     AND (Valore_Pagato IS NULL OR Valore_Pagato < Fatturato_TOT)";
                    break;
                case 'nota_accredito':
                    $conditions[] = "TIPO = 'Nota_Accredito'";
                    break;
                case 'stornata':
                    $conditions[] = "TIPO <> 'Nota_Accredito' AND $stornata";
                    break;
            }
        }
        
        // Filtro per range importo
        if (isset($_GET['importo_min']) && !empty($_GET['importo_min'])) {
            $conditions[] = "Fatturato_TOT >= :importo_min";
            $params[':importo_min'] = floatval($_GET['importo_min']);
        }
        
        if (isset($_GET['importo_max']) && !empty($_GET['importo_max'])) {
            $conditions[] = "Fatturato_TOT <= :importo_max";
            $params[':importo_max'] = floatval($_GET['importo_max']);
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Ordinamento predefinito
     */
    protected function getOrderBy() {
        $allowedFields = ['ID_FATTURA', 'Data', 'NR', 'ID_CLIENTE', 'Fatturato_TOT', 'Scadenza_Pagamento', 'Data_Pagamento', 'Data_Creazione'];
        $sortField = $_GET['sort'] ?? 'Data';
        $sortOrder = (isset($_GET['order']) && strtoupper($_GET['order']) === 'DESC') ? 'DESC' : 'ASC';
        
        if (!in_array($sortField, $allowedFields)) {
            $sortField = 'Data';
        }
        
        return "$sortField $sortOrder, NR ASC";
    }
    
    /**
     * Verifica vincoli prima dell'eliminazione
     */
    protected function checkDeleteConstraints($id) {
        try {
            // Verifica se la fattura è già stata pagata
            $sql = "SELECT Data_Pagamento FROM {$this->table} WHERE ID_FATTURA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $result = $stmt->fetch();
            
            if ($result && !empty($result['Data_Pagamento'])) {
                return [
                    'canDelete' => false,
                    'message' => 'Impossibile eliminare: fattura già pagata'
                ];
            }

            // Se ci sono note di accredito collegate la chiave esterna le
            // scollegherebbe in silenzio, lasciandole senza riferimento.
            $sql = "SELECT GROUP_CONCAT(NR ORDER BY NR SEPARATOR ', ')
                      FROM {$this->table} WHERE ID_FATTURA_STORNATA = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
            $note = $stmt->fetchColumn();

            if (!empty($note)) {
                return [
                    'canDelete' => false,
                    'message' => "Impossibile eliminare: la fattura è stornata dalla nota di accredito $note"
                ];
            }

            return ['canDelete' => true, 'message' => ''];
            
        } catch (PDOException $e) {
            return [
                'canDelete' => false,
                'message' => 'Errore durante la verifica dei vincoli'
            ];
        }
    }
    
    /**
     * Post-processing del record (aggiunge dati correlati)
     */
    protected function processRecord($record) {
        try {
            // Aggiungi informazioni cliente
            if (!empty($record['ID_CLIENTE'])) {
                $clienteInfo = $this->getRelatedData('ANA_CLIENTI', 'ID_CLIENTE', $record['ID_CLIENTE'], ['Cliente', 'Ragione_Sociale']);
                $record['cliente_info'] = $clienteInfo;
            }
            
            // Aggiungi informazioni commessa se presente
            if (!empty($record['ID_COMMESSA'])) {
                $commessaInfo = $this->getRelatedData('ANA_COMMESSE', 'ID_COMMESSA', $record['ID_COMMESSA'], ['Commessa', 'Tipo_Commessa']);
                $record['commessa_info'] = $commessaInfo;
            }
            
            // Storni: su una fattura, quanto è stato annullato da note di
            // accredito e quanto resta davvero esigibile; su una nota, la
            // fattura che storna.
            $record = $this->aggiungiDatiStorno($record);

            // Calcola stato pagamento
            $record['stato_pagamento'] = $this->getStatoPagamento($record);

            // Calcola giorni alla scadenza
            if (!empty($record['Scadenza_Pagamento']) && empty($record['Data_Pagamento'])) {
                $oggi = new DateTime();
                $scadenza = new DateTime($record['Scadenza_Pagamento']);
                $diff = $oggi->diff($scadenza);
                
                if ($scadenza < $oggi) {
                    $record['giorni_scadenza'] = -$diff->days; // Negativo se scaduta
                } else {
                    $record['giorni_scadenza'] = $diff->days;
                }
            }
            
            // Calcola percentuale pagata (valore assoluto: su una nota di
            // accredito totale e compensazione sono entrambi negativi)
            if (abs(floatval($record['Fatturato_TOT'])) > 0) {
                $record['percentuale_pagata'] = round((floatval($record['Valore_Pagato']) / floatval($record['Fatturato_TOT'])) * 100, 2);
            }
            
            return $record;
        } catch (Exception $e) {
            return $record;
        }
    }
    
    /**
     * Aggiunge al record i dati dello storno.
     *
     * Su una fattura: quanto le note collegate hanno annullato ('stornato'),
     * quanto resta esigibile ('residuo' = importo - stornato - incassato) e i
     * numeri delle note ('note_storno'). Su una nota di accredito: numero e
     * data della fattura stornata ('fattura_stornata_info').
     *
     * Nessuno di questi valori viene salvato: si ricalcolano sempre da
     * ID_FATTURA_STORNATA, che è l'unica cosa memorizzata.
     */
    private function aggiungiDatiStorno($record) {
        $record['stornato'] = 0.0;
        $record['residuo'] = round(floatval($record['Fatturato_TOT']) - floatval($record['Valore_Pagato'] ?? 0), 2);
        $record['note_storno'] = [];

        if (empty($record['ID_FATTURA'])) {
            return $record;
        }

        if (($record['TIPO'] ?? 'Fattura') === 'Nota_Accredito') {
            if (!empty($record['ID_FATTURA_STORNATA'])) {
                $record['fattura_stornata_info'] = $this->getRelatedData(
                    $this->table, 'ID_FATTURA', $record['ID_FATTURA_STORNATA'], ['NR', 'Data', 'Fatturato_TOT']
                );
            }
            return $record;
        }

        try {
            $stmt = $this->db->prepare("
                SELECT NR, Data, Fatturato_TOT FROM {$this->table}
                 WHERE ID_FATTURA_STORNATA = :id
                 ORDER BY Data, NR
            ");
            $stmt->bindValue(':id', $record['ID_FATTURA']);
            $stmt->execute();
            $note = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return $record;
        }

        if (!$note) {
            return $record;
        }

        // Gli importi delle note sono negativi: lo storno è il loro opposto.
        $stornato = 0.0;
        foreach ($note as $n) {
            $stornato -= floatval($n['Fatturato_TOT']);
        }

        $record['stornato'] = round($stornato, 2);
        $record['residuo'] = round(
            floatval($record['Fatturato_TOT']) - $stornato - floatval($record['Valore_Pagato'] ?? 0), 2
        );
        $record['note_storno'] = array_map(function ($n) {
            return ['NR' => $n['NR'], 'Data' => $n['Data'], 'Fatturato_TOT' => $n['Fatturato_TOT']];
        }, $note);

        return $record;
    }

    /**
     * Determina lo stato del pagamento
     */
    private function getStatoPagamento($record) {
        // Una nota di accredito sta fuori dall'aging: non ha scadenza, quindi non
        // può essere "scaduta" né "in scadenza". Ha uno stato proprio.
        if (($record['TIPO'] ?? 'Fattura') === 'Nota_Accredito') {
            return 'nota_accredito';
        }

        // Una fattura annullata da una nota di accredito non si incassa e non
        // scade: viene prima di ogni altro stato, altrimenti resterebbe nello
        // scaduto per sempre.
        $stornato = floatval($record['stornato'] ?? 0);
        if ($stornato > 0.01) {
            $coperta = $stornato >= abs(floatval($record['Fatturato_TOT'])) - 0.01;
            return $coperta ? 'stornata' : 'stornata_parzialmente';
        }

        if (!empty($record['Data_Pagamento'])) {
            if (floatval($record['Valore_Pagato']) >= floatval($record['Fatturato_TOT'])) {
                return 'pagata';
            } else {
                return 'parzialmente_pagata';
            }
        }
        
        // Il credito aperto ha due soli stati: o il termine e' passato, o no.
        //
        // Prima ce n'erano tre, con 'in_scadenza' per l'ultima settimana e
        // 'non_pagata' per il resto. La distinzione non veniva usata - il
        // conteggio 'in_scadenza' era gia' stato tolto dal riepilogo - e
        // costava due difetti: il filtro della tendina e l'etichetta della
        // riga intendevano cose diverse con lo stesso nome, e 'non_pagata'
        // mescolava "scade fra tre mesi" con "scadenza mai registrata", che
        // e' il caso che non emerge da nessuna parte.
        //
        // L'urgenza dell'ultima settimana non sparisce: resta nei giorni alla
        // scadenza, che il front-end usa per il colore. E' presentazione, non
        // uno stato a se'.
        if (!empty($record['Scadenza_Pagamento']) && $record['Scadenza_Pagamento'] < date('Y-m-d')) {
            return 'scaduta';
        }

        return 'da_incassare';
    }
    
    /**
     * Metodi aggiuntivi specifici per le fatture
     */
    
    /**
     * Recupera riepilogo fatturato per periodo
     */
    public function getRiepilogoFatturato($dataInizio, $dataFine, $clienteId = null) {
        try {
            // Il segno è nel dato: le note di accredito sono già negative, quindi
            // il netto è una somma semplice e non un CASE.
            $sql = "SELECT
                        COUNT(*) as numero_fatture,
                        SUM(CASE WHEN TIPO = 'Fattura' THEN Fatturato_TOT ELSE 0 END) as totale_fatture,
                        SUM(CASE WHEN TIPO = 'Nota_Accredito' THEN Fatturato_TOT ELSE 0 END) as totale_note_accredito,
                        SUM(Fatturato_TOT) as fatturato_netto,
                        SUM(Valore_Pagato) as totale_incassato
                    FROM {$this->table}
                    WHERE Data BETWEEN :data_inizio AND :data_fine";
            
            $params = [
                ':data_inizio' => $dataInizio,
                ':data_fine' => $dataFine
            ];
            
            if ($clienteId) {
                $sql .= " AND ID_CLIENTE = :cliente";
                $params[':cliente'] = $clienteId;
            }
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            return $stmt->fetch();
            
        } catch (PDOException $e) {
            return null;
        }
    }
    
    /**
     * Utility functions
     */
    private function isValidDate($date) {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    private function existsInTable($table, $field, $value) {
        try {
            $sql = "SELECT 1 FROM $table WHERE $field = :value LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':value', $value);
            $stmt->execute();
            return $stmt->fetchColumn() !== false;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    private function getRelatedData($table, $field, $value, $selectFields) {
        try {
            $fields = implode(', ', $selectFields);
            $sql = "SELECT $fields FROM $table WHERE $field = :value LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':value', $value);
            $stmt->execute();
            return $stmt->fetch();
        } catch (PDOException $e) {
            return null;
        }
    }
}
?>