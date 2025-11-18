<?php
// verify_admin.php
// Script para verificar a chave de acesso ao painel administrativo

// A chave secreta (ALTERE PARA UMA CHAVE SEGURA)
$ADMIN_KEY = "CrisTiano87492#2@&7"; // Mesma chave do admin-key.js

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['admin_key']) && !empty($_POST['admin_key'])) {
        // Verifica se a chave está correta
        if ($_POST['admin_key'] === $ADMIN_KEY) {
            // Chave correta - retorna sucesso
            echo json_encode(['status' => 'success', 'message' => 'Acesso liberado']);
            exit;
        } else {
            // Chave incorreta
            http_response_code(401); // Unauthorized
            echo json_encode(['status' => 'error', 'message' => 'Chave de acesso incorreta']);
            exit;
        }
    } else {
        http_response_code(400); // Bad Request
        echo json_encode(['status' => 'error', 'message' => 'Chave de acesso não fornecida']);
        exit;
    }
} else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido']);
    exit;
}
?>