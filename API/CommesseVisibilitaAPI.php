<?php
/**
 * CommesseVisibilitaAPI
 * Gestisce la visibilità delle commesse per gli utenti con ruolo 'User'.
 *
 * GET  ?resource=commesse_visibilita&collaboratore_id=XXX
 *      → restituisce la lista degli ID_COMMESSA visibili per quel collaboratore
 *
 * POST ?resource=commesse_visibilita
 *      body: { "ID_COLLABORATORE": "XXX", "commesse_ids": ["C001", "C002", ...] }
 *      → sostituisce l'intera lista di commesse visibili (solo Admin/Manager)
 */

require_once 'BaseAPI.php';

class CommesseVisibilitaAPI {

    private $db;

    public function __construct() {
        $this->db = getDatabase();
    }

    public function handleRequest($id = null) {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $method = $_SERVER['REQUEST_METHOD'];

        switch ($method) {
            case 'GET':
                $this->getVisibilita();
                break;
            case 'POST':
                $this->setVisibilita();
                break;
            default:
                sendErrorResponse('Metodo non supportato', 405);
        }
    }

    /**
     * GET: restituisce gli ID_COMMESSA visibili per un collaboratore
     */
    private function getVisibilita() {
        $collaboratoreId = $_GET['collaboratore_id'] ?? null;
        if (!$collaboratoreId) {
            sendErrorResponse('Parametro collaboratore_id richiesto', 400);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT ID_COMMESSA FROM ANA_COMMESSE_VISIBILITA WHERE ID_COLLABORATORE = :id"
            );
            $stmt->bindValue(':id', $collaboratoreId);
            $stmt->execute();
            $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
            sendSuccessResponse(['commesse_ids' => $ids]);
        } catch (PDOException $e) {
            sendErrorResponse('Errore database: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST: sostituisce la lista di commesse visibili per un collaboratore.
     * Solo Admin e Manager possono modificare la visibilità.
     */
    private function setVisibilita() {
        $role = $_SESSION['user_role'] ?? '';
        if (!in_array($role, ['Admin', 'Manager'])) {
            sendErrorResponse('Non autorizzato: solo Admin e Manager possono modificare la visibilità', 403);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $collaboratoreId = $body['ID_COLLABORATORE'] ?? null;
        $commesseIds     = $body['commesse_ids'] ?? [];

        if (!$collaboratoreId) {
            sendErrorResponse('Campo ID_COLLABORATORE richiesto nel body', 400);
            return;
        }

        // Valida che commesse_ids sia un array
        if (!is_array($commesseIds)) {
            sendErrorResponse('Campo commesse_ids deve essere un array', 400);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Elimina tutte le visibilità precedenti per questo collaboratore
            $stmtDel = $this->db->prepare(
                "DELETE FROM ANA_COMMESSE_VISIBILITA WHERE ID_COLLABORATORE = :id"
            );
            $stmtDel->bindValue(':id', $collaboratoreId);
            $stmtDel->execute();

            // Inserisce le nuove
            if (!empty($commesseIds)) {
                $stmtIns = $this->db->prepare(
                    "INSERT INTO ANA_COMMESSE_VISIBILITA (ID_COLLABORATORE, ID_COMMESSA) VALUES (:coll_id, :comm_id)"
                );
                foreach ($commesseIds as $commessaId) {
                    $stmtIns->bindValue(':coll_id', $collaboratoreId);
                    $stmtIns->bindValue(':comm_id', $commessaId);
                    $stmtIns->execute();
                }
            }

            $this->db->commit();
            sendSuccessResponse(
                ['saved' => count($commesseIds)],
                'Visibilità commesse aggiornata con successo'
            );
        } catch (PDOException $e) {
            $this->db->rollBack();
            sendErrorResponse('Errore database: ' . $e->getMessage(), 500);
        }
    }
}
