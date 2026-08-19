<?php
/**
 * FattureCollaboratoriAPI - Gestione CRUD per la tabella FACT_FATTURE_COLLABORATORI
 */

require_once 'BaseAPI.php';

class FattureCollaboratoriAPI extends BaseAPI {

    public function __construct() {
        parent::__construct('FACT_FATTURE_COLLABORATORI', 'ID_FATTURA');

        $this->requiredFields = ['Data', 'ID_COLLABORATORE', 'Importo_netto', 'Netto_pagare'];
        $this->validationRules = [
            'ID_FATTURA' => ['max_length' => 50],
            'Data' => ['required' => true, 'date' => true],
            'ID_COLLABORATORE' => ['required' => true, 'max_length' => 50],
            'Descrizione' => ['max_length' => 65535],
            'Importo_netto' => ['numeric' => true, 'min' => 0],
            'Importo_IVA' => ['numeric' => true, 'min' => 0],
            'Importo_Totale' => ['numeric' => true, 'min' => 0],
            'Ritenuta_Acconto' => ['numeric' => true, 'min' => 0],
            'Netto_pagare' => ['numeric' => true, 'min' => 0],
            'Stato' => ['enum' => ['Ricevuta','Pagata','Annullata']],
            'Data_Pagamento' => ['date' => true]
        ];
    }

    /**
     * Override getAll per supportare action=summary
     */
    protected function getAll() {
        if (isset($_GET['action']) && $_GET['action'] === 'summary') {
            // summary() aggrega con SQL proprio e non passa dal filtro di
            // ruolo: per il ruolo 'User' resta chiuso.
            $this->assertNotRestrictedUser();
            $this->summary();
            return;
        }
        parent::getAll();
    }

    /**
     * Il ruolo 'User' vede al più le proprie fatture passive, mai quelle
     * degli altri collaboratori.
     */
    protected function getRoleScopeClause(&$params, $alias = '') {
        if (!$this->isRestrictedUser()) {
            return null;
        }

        $self = $this->newScopeParam($params, $this->getCurrentUserId());
        return "{$alias}ID_COLLABORATORE = $self";
    }

    /**
     * Ritorna il totale pagato (Netto_pagare) per un collaboratore, opzionalmente filtrato per anno
     * GET /fatture_collaboratori?action=summary&id=COLLID&anno=2025
     */
    public function summary() {
        try {
            $id = $_GET['id'] ?? null;
            $anno = isset($_GET['anno']) ? intval($_GET['anno']) : null;

            if (!$id) {
                sendErrorResponse('Parametro id (ID_COLLABORATORE) mancante', 400);
                return;
            }

            $sql = "SELECT IFNULL(SUM(Netto_pagare),0) as totale_pagato FROM {$this->table} WHERE ID_COLLABORATORE = :id AND Stato = 'Pagata'";
            $params = [':id' => $id];

            if ($anno) {
                $sql .= " AND YEAR(Data_Pagamento) = :anno";
                $params[':anno'] = $anno;
            }

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $row = $stmt->fetch();

            sendSuccessResponse(['totale_pagato' => floatval($row['totale_pagato'])], 'Riepilogo totale pagato');

        } catch (PDOException $e) {
            sendErrorResponse('Errore durante il calcolo del riepilogo: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Validazione input per fatture collaboratori
     */
    protected function validateInput($data, $requireAll = true) {
        $errors = [];

        if ($requireAll) {
            foreach ($this->requiredFields as $field) {
                if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                    $errors[] = "Campo richiesto mancante: $field";
                }
            }
        }

        foreach ($data as $field => $value) {
            if (!isset($this->validationRules[$field]) || $value === null || $value === '') {
                continue;
            }

            $rules = $this->validationRules[$field];

            if (isset($rules['max_length']) && strlen($value) > $rules['max_length']) {
                $errors[] = "Campo '$field' troppo lungo (max {$rules['max_length']})";
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

            if (isset($rules['date']) && !$this->isValidDate($value)) {
                $errors[] = "Formato data '$field' non valido (YYYY-MM-DD)";
            }
        }

        // Business rules: verificare esistenza collaboratore
        if (isset($data['ID_COLLABORATORE']) && !empty($data['ID_COLLABORATORE'])) {
            if (!$this->existsInTable('ANA_COLLABORATORI', 'ID_COLLABORATORE', $data['ID_COLLABORATORE'])) {
                $errors[] = 'Collaboratore specificato non esistente';
            }
        }

        // Coerenza importi
        if (isset($data['Importo_netto'], $data['Importo_IVA']) && !empty($data['Importo_netto'])) {
            $calcolato = floatval($data['Importo_netto']) + floatval($data['Importo_IVA'] ?? 0);
            if (isset($data['Importo_Totale']) && abs($calcolato - floatval($data['Importo_Totale'])) > 0.05) {
                $errors[] = 'Importo_Totale non coerente con Importo_netto + Importo_IVA';
            }
        }

        return ['valid' => empty($errors), 'errors' => $errors];
    }

    /**
     * Genera un ID fattura per collaboratori: FC + YY + numero
     */
    protected function generateId() {
        try {
            $anno = date('y');
            $prefix = 'FC' . $anno;
            $sql = "SELECT ID_FATTURA FROM {$this->table} WHERE ID_FATTURA LIKE :pattern ORDER BY ID_FATTURA DESC LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':pattern' => $prefix . '%']);
            $last = $stmt->fetchColumn();

            if ($last) {
                $num = intval(substr($last, 4)) + 1;
            } else {
                $num = 1;
            }

            return $prefix . str_pad($num, 4, '0', STR_PAD_LEFT);
        } catch (PDOException $e) {
            return 'FC' . date('y') . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        }
    }

    protected function preprocessData($data) {
        // Normalizza le date
        if (isset($data['Data']) && !empty($data['Data'])) {
            $d = new DateTime($data['Data']);
            $data['Data'] = $d->format('Y-m-d');
        }
        if (isset($data['Data_Pagamento']) && !empty($data['Data_Pagamento'])) {
            $d = new DateTime($data['Data_Pagamento']);
            $data['Data_Pagamento'] = $d->format('Y-m-d');
        }

        // Calcola Importo_Totale se non fornito
        if ((!isset($data['Importo_Totale']) || $data['Importo_Totale'] === '') && isset($data['Importo_netto'])) {
            $data['Importo_Totale'] = floatval($data['Importo_netto']) + floatval($data['Importo_IVA'] ?? 0);
        }

        // Stato di default solo in creazione: in aggiornamento un campo assente
        // vuol dire "non lo sto cambiando", e riportava a 'Ricevuta' una
        // fattura gia' pagata.
        $isUpdate = isset($data[$this->primaryKey]) && !empty($data[$this->primaryKey]);
        if (!$isUpdate && (!isset($data['Stato']) || $data['Stato'] === '')) {
            $data['Stato'] = 'Ricevuta';
        }

        return $data;
    }

    /**
     * Post-processing dei record: aggiunge info collaboratore
     */
    protected function processRecord($record) {
        try {
            if (!empty($record['ID_COLLABORATORE'])) {
                $stmt = $this->db->prepare("SELECT Collaboratore, Email FROM ANA_COLLABORATORI WHERE ID_COLLABORATORE = :id LIMIT 1");
                $stmt->execute([':id' => $record['ID_COLLABORATORE']]);
                $coll = $stmt->fetch();
                if ($coll) {
                    $record['collaboratore_nome'] = $coll['Collaboratore'];
                    $record['collaboratore_email'] = $coll['Email'];
                }
            }
        } catch (Exception $e) {
            // ignore
        }

        return $record;
    }

    protected function checkDeleteConstraints($id) {
        try {
            $sql = "SELECT Stato FROM {$this->table} WHERE {$this->primaryKey} = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();

            if ($row && isset($row['Stato']) && $row['Stato'] === 'Pagata') {
                return ['canDelete' => false, 'message' => 'Impossibile eliminare una fattura già pagata'];
            }

            return ['canDelete' => true, 'message' => ''];
        } catch (PDOException $e) {
            return ['canDelete' => false, 'message' => 'Errore controllo vincoli: ' . $e->getMessage()];
        }
    }

    /**
     * Utility: verifica formato data YYYY-MM-DD
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
}

?>
