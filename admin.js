// admin.js

import { auth, db } from './firebase-config.js'; // Importa 'auth'
// Removido import do admin-key.js
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"; // Importa função de cadastro

// --- Elementos da UI ---
let loginScreen, uploadScreen, keyForm, adminKeyInput, uploadForm, messageEl, dirInput, bulkProgress;
let registerUserForm; // Novo seletor

function initAdminElements() {
    loginScreen = document.getElementById('loginScreen');
    uploadScreen = document.getElementById('uploadScreen');
    keyForm = document.getElementById('keyForm');
    adminKeyInput = document.getElementById('adminKey');
    uploadForm = document.getElementById('uploadForm');
    messageEl = document.getElementById('message');
    dirInput = document.getElementById('dirInput');
    bulkProgress = document.getElementById('bulkProgress');
    registerUserForm = document.getElementById('registerUserForm'); // Inicializa novo seletor
}

// Inicializa elementos após DOM pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminElements);
} else {
    initAdminElements();
}

// --- Funções Auxiliares ---

function showMessage(msg, type = 'success', persist = false) {
    // Mensagem sempre visível no login
    const isError = (type === 'error' || type === 'alert-error');
    messageEl.innerHTML = `<div class="alert alert-${type}" style="margin-bottom:18px; font-size:1.1em;">${msg}</div>`;
    if (!isError && !persist) {
        setTimeout(() => { messageEl.innerHTML = ''; }, 5000);
    }
}

// Função para extrair Título e Artista de um nome de arquivo
function parseFileName(fileName) {
    // Exemplo: "Nome da Musica (Autor).mp3"
    const name = fileName.replace(/\.(mp3|MP3)$/, '').trim();
    const match = name.match(/^(.*)\s\((.*)\)$/);
    if (match) {
        return { titulo: match[1].trim(), artista: match[2].trim() };
    }
    return { titulo: name, artista: 'Desconhecido' };
}

// --- Lógica de Cadastro de Novo Usuário (Apenas Admin) ---

if (registerUserForm) {
    registerUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerUserForm['register-email'].value;
        const password = registerUserForm['register-password'].value;

        if (password.length < 6) {
            showMessage('A senha deve ter pelo menos 6 caracteres.', 'alert-error');
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showMessage(`Usuário ${email} cadastrado com sucesso!`, 'success');
            registerUserForm.reset();
        } catch (error) {
            let errorMsg = 'Erro ao cadastrar usuário.';
            if (error.code === 'auth/email-already-in-use') {
                errorMsg = 'Este e-mail já está em uso.';
            } else if (error.code === 'auth/weak-password') {
                errorMsg = 'A senha é muito fraca.';
            }
            console.error("Erro no cadastro de usuário:", error);
            showMessage(errorMsg, 'error');
        }
    });
}

// --- Lógica de Login (Chave Secreta) ---

// Adiciona listener de submit após DOM pronto
function setupKeyFormListener() {
    if (!keyForm) return;
    keyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredKey = adminKeyInput.value;
        
        // Verifica a chave através do script PHP
        try {
            const response = await fetch('https://www.basesdechorinho.com.br/verify_admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `admin_key=${encodeURIComponent(enteredKey)}`
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                showMessage('✅ Acesso liberado! Painel administrativo desbloqueado.', 'alert-success', true);
                setTimeout(() => {
                    loginScreen.style.display = 'none';
                    uploadScreen.style.display = 'block';
                    carregarMusicasAdmin();
                    messageEl.innerHTML = '';
                }, 1200);
            } else {
                showMessage('❌ Chave de acesso incorreta. Tente novamente.', 'alert-error', true);
                adminKeyInput.value = '';
            }
        } catch (error) {
            console.error("Erro ao verificar chave de acesso:", error);
            showMessage('❌ Erro ao verificar chave de acesso. Tente novamente.', 'alert-error', true);
            adminKeyInput.value = '';
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupKeyFormListener);
} else {
    setupKeyFormListener();
}

// ... rest of the file remains the same ...