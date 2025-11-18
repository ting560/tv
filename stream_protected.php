<?php
// stream_protected.php - Script para proteger e servir músicas
session_start();

// Verificação de autenticação baseada em múltiplos métodos
$authenticated = false;

// Método 1: Verificação de sessão (como no sistema original)
if (isset($_SESSION['uid_firebase_logado']) && !empty($_SESSION['uid_firebase_logado'])) {
    $authenticated = true;
}

// Método 2: Verificação via token temporário (para contornar limitação do GitHub Pages)
if (!$authenticated && isset($_GET['temp_token'])) {
    // Verifica se o token temporário é válido (você pode gerar tokens mais seguros)
    $valid_tokens = [
        'temp_2025_secure_token_1',
        'temp_2025_secure_token_2'
    ];
    
    if (in_array($_GET['temp_token'], $valid_tokens)) {
        $authenticated = true;
        // Opcional: registrar acesso para auditoria
    }
}

// Se não autenticado, retorna erro
if (!$authenticated) {
    header("HTTP/1.0 401 Unauthorized");
    header('Content-Type: text/plain'); 
    die("Acesso negado. Faça login para ouvir o conteúdo exclusivo.");
}

// Processamento do arquivo
if (isset($_GET['file']) && !empty($_GET['file'])) {
    $file_name = basename($_GET['file']);
    $file_path = __DIR__ . '/musicas/' . $file_name; // Caminho para a pasta musicas

    // Verifica se é um arquivo MP3 e se existe
    if (strtolower(pathinfo($file_name, PATHINFO_EXTENSION)) == 'mp3' && file_exists($file_path)) {
        // Definição dos Headers para Streaming
        header('Content-Type: audio/mpeg');
        header('Content-Disposition: inline; filename="' . $file_name . '"');
        header('Content-Length: ' . filesize($file_path));
        header('Accept-Ranges: bytes');
        header('Cache-Control: no-cache, no-store, must-revalidate'); 
        
        // Streaming do Arquivo: envia o conteúdo
        readfile($file_path);
        exit;
    } else {
        header("HTTP/1.0 404 Not Found");
        die("Arquivo de música não encontrado.");
    }
} else {
    header("HTTP/1.0 400 Bad Request");
    die("Nome do arquivo não especificado.");
}
?>