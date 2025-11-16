<?php
// stream_audio.php
session_start();

// 1. CONFIGURAÇÃO DO CAMINHO DA PASTA PRIVADA
// ===========================================
// *** VOCÊ DEVE MUDAR ESTE VALOR ***
// Tente este primeiro, substituindo 'radiopos' pelo seu usuário de FTP/cPanel se for diferente:
$base_dir = '/home/radiopos/musicas_premium/'; 
// Se não funcionar, pergunte ao seu suporte de hospedagem qual é o "Caminho Absoluto"
// para a pasta 'musicas_premium'. O caminho deve terminar com uma barra '/'.
// ===========================================

// 2. VERIFICAÇÃO DE AUTENTICAÇÃO (CRÍTICO!)
// Checa se a variável de sessão (criada pelo set_session.php) existe.
if (!isset($_SESSION['uid_firebase_logado']) || empty($_SESSION['uid_firebase_logado'])) {
    header("HTTP/1.0 401 Unauthorized");
    header('Content-Type: text/plain'); 
    die("Acesso negado. Por favor, faça login para ouvir o conteúdo exclusivo.");
}

// 3. PROCESSAMENTO DO ARQUIVO

if (isset($_GET['file']) && !empty($_GET['file'])) {
    $file_name = basename($_GET['file']);
    $file_path = $base_dir . $file_name;

    if (file_exists($file_path) && strtolower(pathinfo($file_name, PATHINFO_EXTENSION)) == 'mp3') {
        
        // 4. Definição dos Headers para Streaming
        header('Content-Type: audio/mpeg');
        header('Content-Disposition: inline; filename="' . $file_name . '"');
        header('Content-Length: ' . filesize($file_path));
        header('Accept-Ranges: bytes');
        header('Cache-Control: no-cache, no-store, must-revalidate'); 
        
        // 5. Streaming do Arquivo: envia o conteúdo
        readfile($file_path);
        exit;
    } else {
        header("HTTP/1.0 404 Not Found");
        die("Arquivo de música não encontrado no caminho restrito.");
    }
} else {
    header("HTTP/1.0 400 Bad Request");
    die("Nome do arquivo não especificado.");
}
?>