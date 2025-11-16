<?php
// set_session.php
// Cria a sessão PHP após o login no Firebase.

session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['uid']) && !empty($_POST['uid'])) {
        // Armazena o UID na sessão.
        $_SESSION['uid_firebase_logado'] = $_POST['uid'];
        echo json_encode(['status' => 'success', 'message' => 'Sessão PHP criada com sucesso.']);
        exit;
    } else {
        http_response_code(400); // Bad Request
        echo json_encode(['status' => 'error', 'message' => 'UID do Firebase faltando.']);
        exit;
    }
} else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido.']);
    exit;
}
?>