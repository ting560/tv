<?php
// clear_session.php
// Limpa a sessão PHP ao fazer logout.

session_start();

if (isset($_SESSION['uid_firebase_logado'])) {
    unset($_SESSION['uid_firebase_logado']);
}

session_destroy();

header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'message' => 'Sessão PHP limpa.']);
exit;
?>