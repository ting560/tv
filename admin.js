// admin.js

import { auth, db } from './firebase-config.js'; // Importa 'auth'
import { ADMIN_KEY } from './admin-key.js';
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
    keyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredKey = adminKeyInput.value;
        if (enteredKey === ADMIN_KEY) {
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
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupKeyFormListener);
} else {
    setupKeyFormListener();
}

// --- Listagem e Gerenciamento de Músicas ---
let musicasAdmin = [];

function renderMusicasAdmin() {
    const musicasAdminList = document.getElementById('musicasAdminList');
    if (!musicasAdminList) return;
    if (!musicasAdmin || musicasAdmin.length === 0) {
        musicasAdminList.innerHTML = '<div style="text-align:center; color:#888; padding:16px;">Nenhuma música cadastrada.</div>';
        return;
    }
    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.95em;">
        <thead><tr style="background:#f4f7f6;"><th>Título</th><th>Artista</th><th>Arquivo</th><th>Nova?</th><th>Data</th><th>Partitura?</th><th>Ações</th></tr></thead><tbody>`;
    for (const m of musicasAdmin) {
        html += `<tr>
            <td>${m.titulo || ''}</td>
            <td>${m.artista || ''}</td>
            <td>${m.arquivo || ''}</td>
            <td>${m.nova ? 'Sim' : 'Não'}</td>
            <td>${m.data ? (m.data.toDate ? m.data.toDate().toLocaleDateString('pt-BR') : m.data) : ''}</td>
            <td>${m.partitura ? 'Sim' : 'Não'}</td>
            <td>
                <button class="btn-edit" data-id="${m.id}">Editar</button>
                <button class="btn-remove" data-id="${m.id}" style="margin-left:8px; color:#b00;">Remover</button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    musicasAdminList.innerHTML = html;

    // Adiciona listeners aos botões
    musicasAdminList.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editarMusica(btn.getAttribute('data-id')));
    });
    musicasAdminList.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => removerMusica(btn.getAttribute('data-id')));
    });
}

async function carregarMusicasAdmin() {
    const musicasAdminList = document.getElementById('musicasAdminList');
    if (!musicasAdminList) return;
    musicasAdminList.innerHTML = '<div style="text-align:center; color:#888; padding:16px;">Carregando músicas...</div>';
    try {
        const snap = await getDocs(collection(db, 'musicas'));
        musicasAdmin = [];
        snap.forEach(docSnap => {
            const m = docSnap.data();
            m.id = docSnap.id;
            musicasAdmin.push(m);
        });
        renderMusicasAdmin();
    } catch (error) {
        console.error("Erro ao carregar músicas:", error);
        musicasAdminList.innerHTML = '<div style="text-align:center; color:#b00; padding:16px;">Erro ao carregar músicas.</div>';
    }
}

async function removerMusica(id) {
    if (!confirm('Tem certeza que deseja remover esta música?')) return;
    try {
        await deleteDoc(doc(db, 'musicas', id));
        showMessage('Música removida com sucesso!', 'success');
        carregarMusicasAdmin();
    } catch (e) {
        console.error("Erro ao remover música:", e);
        showMessage('Erro ao remover música.', 'error');
    }
}

function editarMusica(id) {
    const m = musicasAdmin.find(x => x.id === id);
    if (!m) return;
    // Preenche o formulário de cadastro com os dados da música
    document.getElementById('titulo').value = m.titulo || '';
    document.getElementById('artista').value = m.artista || '';
    // Converte a data do Timestamp para o formato YYYY-MM-DD
    const dateValue = m.data && m.data.toDate ? m.data.toDate().toISOString().slice(0,10) : '';
    document.getElementById('data').value = dateValue; 
    document.getElementById('nova').checked = !!m.nova;
    // Preenche o campo de partitura se existir
    document.getElementById('partitura').value = m.partitura || '';
    
    // Não altera o arquivo MP3
    showMessage('Edite os dados e clique em "Cadastrar Música" para salvar as alterações.', 'alert-success');
    uploadForm.setAttribute('data-edit-id', id);
    // Rolar para o topo do formulário
    document.getElementById('uploadScreen').scrollIntoView({ behavior: 'smooth' });
}

// Função para limpar o formulário e criar uma nova música
function novaMusica() {
    uploadForm.reset();
    uploadForm.removeAttribute('data-edit-id');
    showMessage('Pronto para cadastrar uma nova música!', 'alert-success');
}
window.novaMusica = novaMusica; // Expor globalmente para o botão no HTML

// --- Lógica de Cadastro e Upload de Músicas ---

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = uploadForm.getAttribute('data-edit-id');
        const titulo = document.getElementById('titulo').value;
        const artista = document.getElementById('artista').value;
        const data = document.getElementById('data').value;
        const isNova = document.getElementById('nova').checked;
        const partitura = document.getElementById('partitura').value; 

        if (editId) {
            // MODO DE EDIÇÃO
            try {
                await updateDoc(doc(db, 'musicas', editId), {
                    titulo,
                    artista,
                    data: new Date(data),
                    nova: isNova,
                    partitura: partitura || null 
                });
                showMessage('Música editada com sucesso!', 'success');
                uploadForm.removeAttribute('data-edit-id');
                uploadForm.reset();
                carregarMusicasAdmin();
            } catch (err) {
                console.error("Erro ao editar música:", err);
                showMessage('Erro ao editar música.', 'error');
            }
            return;
        }

        // Cadastro normal de nova música
        const fileInput = document.getElementById('file');
        const file = fileInput.files[0];

        // Se NÃO estiver em edição E NÃO houver arquivo, exibe erro.
        if (!file) { 
            showMessage('Por favor, selecione um arquivo MP3 para pegar o nome.', 'alert-error');
            return;
        }

        const fileName = file.name;
        showMessage('Iniciando cadastro...', 'alert-success');

        try {
            const musicData = {
                titulo: titulo,
                artista: artista,
                data: new Date(data),
                nova: isNova,
                arquivo: fileName, 
                partitura: partitura || null 
            };

            await addDoc(collection(db, "musicas"), musicData);
            showMessage(`Música "${titulo}" cadastrada com sucesso! Lembre-se de mover o arquivo para a pasta /musicas.`, 'success');
            uploadForm.reset();
            carregarMusicasAdmin();
        } catch (err) {
            console.error("Erro ao cadastrar música:", err);
            showMessage('Erro ao cadastrar música.', 'error');
        }
    });
}


// --- Lógica de Importação em Massa (Pasta) ---

async function handleBulkUpload(files) {
    if (!bulkProgress) return;
    bulkProgress.textContent = `Iniciando importação de ${files.length} arquivos...`;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const parsed = parseFileName(f.name);

        const musicData = {
            titulo: parsed.titulo,
            artista: parsed.artista,
            data: new Date(),
            nova: false,
            arquivo: f.name,
            partitura: null
        };

        bulkProgress.textContent = `Importando ${i+1}/${files.length}: ${f.name}`;

        try {
            await addDoc(collection(db, 'musicas'), musicData);
            success++;
        } catch (err) {
            console.error('Erro ao importar', f.name, err);
            failed++;
        }

        // Pequena pausa para não saturar requisições
        await new Promise(r => setTimeout(r, 150));
    }

    bulkProgress.textContent = `Importação finalizada. Sucesso: ${success}, Falhas: ${failed}.`;
    showMessage(`Importação finalizada. ${success} cadastradas, ${failed} falharam.`, 'alert-success');
    carregarMusicasAdmin(); // Atualizar a lista após importação
}

if (dirInput) {
    dirInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        // Solicitamos confirmação antes de iniciar
        if (confirm(`Serão importados ${files.length} arquivos. Deseja continuar?`)) {
            handleBulkUpload(files);
        } else {
            dirInput.value = ''; // Limpa a seleção
            bulkProgress.textContent = 'Aguardando seleção de pasta...';
        }
    });
}