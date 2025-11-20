// admin.js

import { auth, db, storage } from './firebase-config.js'; // Importa 'auth' e 'storage'
// Removido import do admin-key.js
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js"; // Importa função de cadastro

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

// Timer de inatividade para admin
let adminInactivityTimer;
const ADMIN_INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos em milissegundos

// Função para resetar o timer de inatividade do admin
function resetAdminInactivityTimer() {
    clearTimeout(adminInactivityTimer);
    adminInactivityTimer = setTimeout(() => {
        // Expira a sessão após 15 minutos de inatividade
        window.location.href = 'index.html'; // Redireciona para a página de login
    }, ADMIN_INACTIVITY_TIMEOUT);
}

// Adiciona listeners para resetar o timer de inatividade do admin
function setupAdminInactivityListeners() {
    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetAdminInactivityTimer, true);
    });
    
    // Inicia o timer
    resetAdminInactivityTimer();
}

// Inicia os listeners de inatividade do admin
setupAdminInactivityListeners();

// Função para fazer upload de arquivo de partitura
async function uploadPartitura(file) {
    if (!file) return null;
    
    try {
        // Cria uma referência para o arquivo no Storage
        const fileRef = ref(storage, `partituras/${Date.now()}_${file.name}`);
        
        // Faz o upload do arquivo
        const snapshot = await uploadBytes(fileRef, file);
        
        // Obtém a URL de download
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error("Erro ao fazer upload da partitura:", error);
        throw new Error('Falha ao fazer upload da partitura');
    }
}

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

// Função para converter URLs do GitHub para jsDelivr
function convertGitHubToJsDelivr(githubUrl) {
    // Exemplo: https://github.com/ting560/tv/blob/main/partituras/ARQUIVO.pdf
    // Para: https://cdn.jsdelivr.net/gh/ting560/tv@main/partituras/ARQUIVO.pdf
    
    const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/;
    const match = githubUrl.match(githubRegex);
    
    if (match) {
        const user = match[1];
        const repo = match[2];
        const branch = match[3];
        const filePath = match[4];
        
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${filePath}`;
    }
    
    // Verifica se é uma URL raw.githubusercontent.com
    const rawRegex = /https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/;
    const rawMatch = githubUrl.match(rawRegex);
    
    if (rawMatch) {
        const user = rawMatch[1];
        const repo = rawMatch[2];
        const branch = rawMatch[3];
        const filePath = rawMatch[4];
        
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${filePath}`;
    }
    
    return githubUrl; // Retorna a URL original se não for do GitHub
}

// Função para procurar partituras na pasta PARTITURAS
async function procurarPartitura(titulo) {
    try {
        console.log('Procurando partitura para:', titulo);
        
        // Primeiro tenta encontrar localmente
        // Lista os arquivos da pasta PARTITURAS
        const response = await fetch('./PARTITURAS/');
        const html = await response.text();
        console.log('Resposta do servidor:', html.substring(0, 200) + '...');
        
        // Extrai os nomes dos arquivos do HTML retornado
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a');
        console.log('Links encontrados:', links.length);
        
        // Procura por uma partitura com nome semelhante ao título
        for (const link of links) {
            const fileName = link.textContent || link.innerText;
            console.log('Verificando arquivo:', fileName);
            
            // Normaliza os nomes para comparação
            const normalizedFileName = fileName.toLowerCase().replace(/\s+/g, ' ').trim();
            const normalizedTitulo = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // Verifica se o título está contido no nome do arquivo ou vice-versa
            if (fileName && 
                (normalizedFileName.includes(normalizedTitulo) || normalizedTitulo.includes(normalizedFileName.replace(/\.(pdf|jpg|jpeg|png)$/, ''))) && 
                (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.png'))) {
                console.log('Partitura encontrada:', fileName);
                return `./PARTITURAS/${encodeURIComponent(fileName)}`;
            }
        }
        
        // Se não encontrou localmente, tenta no repositório do GitHub
        console.log('Nenhuma partitura encontrada localmente, tentando no GitHub...');
        const githubPartituraUrl = await procurarPartituraNoGithub(titulo);
        if (githubPartituraUrl) {
            return githubPartituraUrl;
        }
        
        console.log('Nenhuma partitura encontrada para:', titulo);
        return null;
    } catch (error) {
        console.error('Erro ao procurar partitura:', error);
        return null;
    }
}

// Função para procurar partituras no repositório do GitHub
async function procurarPartituraNoGithub(titulo) {
    try {
        // Cria uma URL do GitHub com base no título
        // Esta é uma abordagem heurística, pois não temos acesso à API do GitHub aqui
        
        // Formato esperado: https://github.com/ting560/tv/blob/main/partituras/NOME%20DO%20ARQUIVO.pdf
        const fileName = `${titulo}.pdf`;
        const githubUrl = `https://github.com/ting560/tv/blob/main/partituras/${encodeURIComponent(fileName)}`;
        
        console.log('Tentando URL do GitHub:', githubUrl);
        
        // Retorna a URL do GitHub (a conversão para jsDelivr será feita posteriormente)
        return githubUrl;
    } catch (error) {
        console.error('Erro ao procurar partitura no GitHub:', error);
        return null;
    }
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
            const response = await fetch('./verify_admin.php', {
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

// Funções para salvar e carregar o estado do formulário
function saveFormState() {
    const formData = {
        titulo: document.getElementById('titulo').value,
        artista: document.getElementById('artista').value,
        data: document.getElementById('data').value,
        partitura: document.getElementById('partitura').value,
        nova: document.getElementById('nova').checked
    };
    
    try {
        localStorage.setItem('adminFormState', JSON.stringify(formData));
    } catch (error) {
        console.error('Erro ao salvar estado do formulário:', error);
    }
}

function loadFormState() {
    try {
        const savedState = localStorage.getItem('adminFormState');
        if (savedState) {
            const formData = JSON.parse(savedState);
            
            document.getElementById('titulo').value = formData.titulo || '';
            document.getElementById('artista').value = formData.artista || '';
            document.getElementById('data').value = formData.data || '2025-01-01';
            document.getElementById('partitura').value = formData.partitura || '';
            document.getElementById('nova').checked = formData.nova || false;
        }
    } catch (error) {
        console.error('Erro ao carregar estado do formulário:', error);
    }
}

// Carrega o estado do formulário ao iniciar
loadFormState();

// --- Lógica de Cadastro de Música ---

// Adiciona listener de submit ao formulário de upload após DOM pronto
function setupUploadFormListener() {
    if (!uploadForm) return;
    
    // Listener para o campo de arquivo individual
    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const { titulo, artista } = parseFileName(file.name);
                document.getElementById('titulo').value = titulo;
                document.getElementById('artista').value = artista;
                
                // Procura automaticamente por uma partitura
                procurarPartitura(titulo).then(partituraUrl => {
                    if (partituraUrl) {
                        document.getElementById('partitura').value = partituraUrl;
                        document.getElementById('partituraStatus').textContent = `Partitura encontrada automaticamente: ${partituraUrl}`;
                        document.getElementById('partituraStatus').style.color = 'green';
                    } else {
                        document.getElementById('partituraStatus').textContent = 'Nenhuma partitura encontrada automaticamente.';
                        document.getElementById('partituraStatus').style.color = 'orange';
                    }
                });
            }
        });
    }
    
    // Listener para o campo de diretório
    if (dirInput) {
        dirInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                bulkProgress.innerHTML = `Processando ${files.length} arquivos...`;
                // Aqui você pode adicionar a lógica para processar múltiplos arquivos
            }
        });
    }
    
    // Listener para o campo de upload de partitura
    const partituraFileInput = document.getElementById('partituraFile');
    if (partituraFileInput) {
        partituraFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('partituraFileStatus').textContent = `Arquivo selecionado: ${file.name}`;
                document.getElementById('partituraFileStatus').style.color = 'green';
            } else {
                document.getElementById('partituraFileStatus').textContent = '';
            }
        });
    }
    
    // Listener para o formulário de upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Coleta os dados do formulário
        const titulo = document.getElementById('titulo').value;
        const artista = document.getElementById('artista').value;
        const data = document.getElementById('data').value;
        const partituraLink = document.getElementById('partitura').value;
        const partituraFile = document.getElementById('partituraFile').files[0];
        const nova = document.getElementById('nova').checked;
        
        // Validação básica
        if (!titulo || !artista || !data) {
            showMessage('Por favor, preencha todos os campos obrigatórios.', 'alert-error');
            return;
        }
        
        try {
            let partituraUrl = partituraLink || null;
            
            // Se foi selecionado um arquivo de partitura, faz o upload
            if (partituraFile) {
                try {
                    document.getElementById('partituraFileStatus').textContent = 'Fazendo upload da partitura...';
                    partituraUrl = await uploadPartitura(partituraFile);
                    document.getElementById('partituraFileStatus').textContent = 'Partitura enviada com sucesso!';
                } catch (uploadError) {
                    console.error("Erro ao fazer upload da partitura:", uploadError);
                    showMessage('❌ Erro ao fazer upload da partitura. Tente novamente.', 'error');
                    return;
                }
            }
            
            // Converte URLs do GitHub para jsDelivr se necessário
            const finalPartituraUrl = partituraUrl ? convertGitHubToJsDelivr(partituraUrl) : null;
            
            // Adiciona o documento ao Firestore
            await addDoc(collection(db, 'musicas'), {
                titulo,
                artista,
                data: new Date(data),
                partitura: finalPartituraUrl,
                nova: nova || false,
                arquivo: `${titulo} (${artista}).mp3` // Nome simulado do arquivo
            });
            
            showMessage('Música cadastrada com sucesso!', 'success');
            uploadForm.reset();
            document.getElementById('data').value = '2025-01-01'; // Reseta a data para o valor padrão
            document.getElementById('partituraStatus').textContent = ''; // Limpa o status da partitura
            document.getElementById('partituraFileStatus').textContent = ''; // Limpa o status do arquivo de partitura
            
            // Limpa o estado salvo no localStorage
            try {
                localStorage.removeItem('adminFormState');
            } catch (error) {
                console.error('Erro ao limpar estado do formulário:', error);
            }
            
            // Recarrega a lista de músicas
            carregarMusicasAdmin();
        } catch (error) {
            console.error("Erro ao cadastrar música:", error);
            showMessage('❌ Erro ao cadastrar música. Tente novamente.', 'error');
        }
    });
    
    // Adiciona listeners para salvar o estado do formulário
    const formElements = [
        document.getElementById('titulo'),
        document.getElementById('artista'),
        document.getElementById('data'),
        document.getElementById('partitura'),
        document.getElementById('nova')
    ];
    
    formElements.forEach(element => {
        if (element) {
            element.addEventListener('change', saveFormState);
            element.addEventListener('input', saveFormState);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUploadFormListener);
} else {
    setupUploadFormListener();
}

// Função para carregar e exibir as músicas cadastradas
async function carregarMusicasAdmin() {
    const musicasAdminList = document.getElementById('musicasAdminList');
    if (!musicasAdminList) return;
    
    try {
        musicasAdminList.innerHTML = '<div style="text-align:center; color:#888; padding:16px;">Carregando músicas...</div>';
        
        // Consulta as músicas ordenadas por data descendente
        const q = query(collection(db, 'musicas'), orderBy('data', 'desc'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            musicasAdminList.innerHTML = '<div style="text-align:center; color:#888; padding:16px;">Nenhuma música cadastrada.</div>';
            return;
        }
        
        // Monta a tabela com as músicas
        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Título</th>
                        <th>Artista</th>
                        <th>Data</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        querySnapshot.forEach((doc) => {
            const musica = doc.data();
            const dataFormatada = musica.data ? new Date(musica.data.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
            
            // Define a cor do botão de partituras com base na existência de partitura
            const partituraButtonClass = musica.partitura ? 'btn-partitura-exists' : 'btn-partitura-none';
            const partituraButtonText = musica.partitura ? 'Partituras (Editar)' : 'Partituras (Adicionar)';
            
            tableHtml += `
                <tr>
                    <td>${musica.titulo || 'N/A'}</td>
                    <td>${musica.artista || 'N/A'}</td>
                    <td>${dataFormatada}</td>
                    <td>
                        <button class="btn-edit" onclick="editarMusica('${doc.id}')">Editar</button>
                        <button class="btn-remove" onclick="removerMusica('${doc.id}')">Remover</button>
                        <button class="${partituraButtonClass}" onclick="gerenciarPartitura('${doc.id}')">${partituraButtonText}</button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `
                </tbody>
            </table>
        `;
        
        musicasAdminList.innerHTML = tableHtml;
    } catch (error) {
        console.error("Erro ao carregar músicas:", error);
        musicasAdminList.innerHTML = '<div style="text-align:center; color:#d43c3c; padding:16px;">Erro ao carregar músicas.</div>';
    }
}

// Função para editar uma música
window.editarMusica = async function(musicaId) {
    try {
        // Busca o documento da música no Firestore
        const docRef = doc(db, 'musicas', musicaId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const musica = docSnap.data();
            
            // Preenche o formulário com os dados da música
            document.getElementById('titulo').value = musica.titulo || '';
            document.getElementById('artista').value = musica.artista || '';
            
            // Converte timestamp para formato de data aceito pelo input
            if (musica.data) {
                const data = musica.data.toDate ? musica.data.toDate() : new Date(musica.data);
                document.getElementById('data').value = data.toISOString().split('T')[0];
            }
            
            // Converte URLs do GitHub para jsDelivr se necessário
            const convertedPartituraUrl = musica.partitura ? convertGitHubToJsDelivr(musica.partitura) : '';
            document.getElementById('partitura').value = convertedPartituraUrl;
            document.getElementById('nova').checked = musica.nova || false;
            
            // Limpa o campo de arquivo (não é possível preencher com um arquivo)
            document.getElementById('partituraFile').value = '';
            document.getElementById('partituraFileStatus').textContent = '';
            
            // Armazena o ID da música sendo editada em um atributo oculto
            let hiddenIdInput = document.getElementById('editingMusicId');
            if (!hiddenIdInput) {
                hiddenIdInput = document.createElement('input');
                hiddenIdInput.type = 'hidden';
                hiddenIdInput.id = 'editingMusicId';
                document.getElementById('uploadForm').appendChild(hiddenIdInput);
            }
            hiddenIdInput.value = musicaId;
            
            // Altera o texto do botão de submit
            const submitButton = document.querySelector('#uploadForm .btn-submit');
            submitButton.textContent = 'Atualizar Música';
            
            // Substitui o evento de submit para atualizar em vez de criar nova
            const originalSubmitHandler = uploadForm.onsubmit;
            uploadForm.onsubmit = async function(e) {
                e.preventDefault();
                await atualizarMusica(musicaId);
            };
            
            // Exibe mensagem de sucesso
            showMessage('Música carregada para edição. Faça as alterações e clique em "Atualizar Música".', 'success');
        } else {
            showMessage('Música não encontrada.', 'alert-error');
        }
    } catch (error) {
        console.error("Erro ao carregar música para edição:", error);
        showMessage('❌ Erro ao carregar música para edição. Tente novamente.', 'error');
    }
};

// Função para atualizar uma música existente
async function atualizarMusica(musicaId) {
    // Coleta os dados do formulário
    const titulo = document.getElementById('titulo').value;
    const artista = document.getElementById('artista').value;
    const data = document.getElementById('data').value;
    const partituraLink = document.getElementById('partitura').value;
    const partituraFile = document.getElementById('partituraFile').files[0];
    const nova = document.getElementById('nova').checked;
    
    // Validação básica
    if (!titulo || !artista || !data) {
        showMessage('Por favor, preencha todos os campos obrigatórios.', 'alert-error');
        return;
    }
    
    try {
        let partituraUrl = partituraLink || null;
        
        // Se foi selecionado um arquivo de partitura, faz o upload
        if (partituraFile) {
            try {
                document.getElementById('partituraFileStatus').textContent = 'Fazendo upload da partitura...';
                partituraUrl = await uploadPartitura(partituraFile);
                document.getElementById('partituraFileStatus').textContent = 'Partitura enviada com sucesso!';
            } catch (uploadError) {
                console.error("Erro ao fazer upload da partitura:", uploadError);
                showMessage('❌ Erro ao fazer upload da partitura. Tente novamente.', 'error');
                return;
            }
        }
        
        // Converte URLs do GitHub para jsDelivr se necessário
        // Se partituraUrl já é um link (não um arquivo carregado), não converte novamente
        const finalPartituraUrl = partituraUrl ? (partituraFile ? convertGitHubToJsDelivr(partituraUrl) : partituraUrl) : null;
        
        // Atualiza o documento no Firestore
        const docRef = doc(db, 'musicas', musicaId);
        await updateDoc(docRef, {
            titulo,
            artista,
            data: new Date(data),
            partitura: finalPartituraUrl,
            nova: nova || false
        });
        
        // Restaura o formulário e o botão
        const submitButton = document.querySelector('#uploadForm .btn-submit');
        submitButton.textContent = 'Cadastrar Música';
        
        // Remove o campo oculto de ID
        const hiddenIdInput = document.getElementById('editingMusicId');
        if (hiddenIdInput) {
            hiddenIdInput.remove();
        }
        
        // Restaura o handler original do formulário
        uploadForm.onsubmit = null;
        
        showMessage('Música atualizada com sucesso!', 'success');
        uploadForm.reset();
        document.getElementById('data').value = '2025-01-01'; // Reseta a data para o valor padrão
        document.getElementById('partituraStatus').textContent = ''; // Limpa o status da partitura
        document.getElementById('partituraFileStatus').textContent = ''; // Limpa o status do arquivo de partitura
        
        // Limpa o estado salvo no localStorage
        try {
            localStorage.removeItem('adminFormState');
        } catch (error) {
            console.error('Erro ao limpar estado do formulário:', error);
        }
        
        // Recarrega a lista de músicas
        carregarMusicasAdmin();
    } catch (error) {
        console.error("Erro ao atualizar música:", error);
        showMessage('❌ Erro ao atualizar música. Tente novamente.', 'error');
    }
}

// Função para remover uma música
window.removerMusica = async function(musicaId) {
    if (!confirm('Tem certeza que deseja remover esta música?')) return;
    
    try {
        await deleteDoc(doc(db, 'musicas', musicaId));
        showMessage('Música removida com sucesso!', 'success');
        carregarMusicasAdmin(); // Recarrega a lista
    } catch (error) {
        console.error("Erro ao remover música:", error);
        showMessage('❌ Erro ao remover música. Tente novamente.', 'error');
    }
};

// Função para gerenciar partituras de uma música
window.gerenciarPartitura = async function(musicaId) {
    try {
        // Busca o documento da música no Firestore
        const docRef = doc(db, 'musicas', musicaId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const musica = docSnap.data();
            
            // Cria um modal para gerenciar a partitura
            const modalHtml = `
                <div id="partituraModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
                    <div style="background:#fff; padding:20px; border-radius:10px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; position:relative;">
                        <button id="closePartituraModal" style="position:absolute; top:10px; right:10px; background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                        <h3 style="margin-top:0; color:#667eea;">Gerenciar Partitura</h3>
                        <p><strong>Música:</strong> ${musica.titulo || 'N/A'} - ${musica.artista || 'N/A'}</p>
                        
                        <div class="form-group">
                            <label for="partituraLink">Link da Partitura (PDF ou imagem):</label>
                            <input type="url" id="partituraLink" value="${musica.partitura || ''}" style="width:100%; padding:8px; margin:8px 0; border:1px solid #ccc; border-radius:4px;">
                        </div>
                        
                        <div class="form-group">
                            <label for="partituraFile">Upload de Partitura (PDF ou imagem):</label>
                            <input type="file" id="partituraFile" accept=".pdf,.jpg,.jpeg,.png" style="width:100%; padding:8px 0; margin:8px 0; border:none;">
                            <small id="partituraFileStatus"></small>
                        </div>
                        
                        <div style="margin-top:15px; text-align:center;">
                            <button id="salvarPartitura" class="btn-submit" style="background:#667eea; margin-right:10px;">Salvar</button>
                            <button id="removerPartitura" class="btn-submit" style="background:#ff6b6b;">Remover</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Adiciona o modal ao body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Exibe o modal
            const modal = document.getElementById('partituraModal');
            modal.style.display = 'flex';
            
            // Event listeners para o modal
            document.getElementById('closePartituraModal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Event listener para upload de arquivo
            const partituraFileInput = document.getElementById('partituraFile');
            partituraFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('partituraFileStatus').textContent = `Arquivo selecionado: ${file.name}`;
                    document.getElementById('partituraFileStatus').style.color = 'green';
                } else {
                    document.getElementById('partituraFileStatus').textContent = '';
                }
            });
            
            // Event listener para salvar partitura
            document.getElementById('salvarPartitura').addEventListener('click', async () => {
                const partituraLink = document.getElementById('partituraLink').value;
                const partituraFile = partituraFileInput.files[0];
                
                try {
                    let partituraUrl = partituraLink || null;
                    
                    // Se foi selecionado um arquivo de partitura, faz o upload
                    if (partituraFile) {
                        try {
                            document.getElementById('partituraFileStatus').textContent = 'Fazendo upload da partitura...';
                            partituraUrl = await uploadPartitura(partituraFile);
                            document.getElementById('partituraFileStatus').textContent = 'Partitura enviada com sucesso!';
                        } catch (uploadError) {
                            console.error("Erro ao fazer upload da partitura:", uploadError);
                            showMessage('❌ Erro ao fazer upload da partitura. Tente novamente.', 'error');
                            return;
                        }
                    }
                    
                    // Converte URLs do GitHub para jsDelivr se necessário
                    const finalPartituraUrl = partituraUrl ? convertGitHubToJsDelivr(partituraUrl) : null;
                    
                    // Atualiza o documento no Firestore
                    await updateDoc(docRef, {
                        partitura: finalPartituraUrl
                    });
                    
                    showMessage('Partitura atualizada com sucesso!', 'success');
                    modal.remove();
                    carregarMusicasAdmin(); // Recarrega a lista
                } catch (error) {
                    console.error("Erro ao atualizar partitura:", error);
                    showMessage('❌ Erro ao atualizar partitura. Tente novamente.', 'error');
                }
            });
            
            // Event listener para remover partitura
            document.getElementById('removerPartitura').addEventListener('click', async () => {
                if (confirm('Tem certeza que deseja remover a partitura desta música?')) {
                    try {
                        await updateDoc(docRef, {
                            partitura: null
                        });
                        
                        showMessage('Partitura removida com sucesso!', 'success');
                        modal.remove();
                        carregarMusicasAdmin(); // Recarrega a lista
                    } catch (error) {
                        console.error("Erro ao remover partitura:", error);
                        showMessage('❌ Erro ao remover partitura. Tente novamente.', 'error');
                    }
                }
            });
        } else {
            showMessage('Música não encontrada.', 'alert-error');
        }
    } catch (error) {
        console.error("Erro ao carregar música para gerenciar partitura:", error);
        showMessage('❌ Erro ao carregar música. Tente novamente.', 'error');
    }
};

// Função para limpar o formulário
window.novaMusica = function() {
    uploadForm.reset();
    document.getElementById('data').value = '2025-01-01';
    document.getElementById('partituraStatus').textContent = '';
    document.getElementById('partituraFileStatus').textContent = '';
    
    // Remove o modo de edição se estiver ativo
    const hiddenIdInput = document.getElementById('editingMusicId');
    if (hiddenIdInput) {
        hiddenIdInput.remove();
    }
    
    // Restaura o texto do botão de submit
    const submitButton = document.querySelector('#uploadForm .btn-submit');
    submitButton.textContent = 'Cadastrar Música';
    
    // Limpa o estado salvo no localStorage
    try {
        localStorage.removeItem('adminFormState');
    } catch (error) {
        console.error('Erro ao limpar estado do formulário:', error);
    }
    
    showMessage('Formulário limpo!', 'success');
};

// Adiciona listener para procurar partituras quando o título é alterado
document.getElementById('titulo').addEventListener('blur', async (e) => {
    const titulo = e.target.value;
    if (titulo) {
        // Limpa qualquer valor anterior no campo de link
        document.getElementById('partitura').value = '';
        
        // Procura partitura automaticamente
        const partituraUrl = await procurarPartitura(titulo);
        if (partituraUrl) {
            const convertedUrl = convertGitHubToJsDelivr(partituraUrl);
            document.getElementById('partitura').value = convertedUrl;
            document.getElementById('partituraStatus').textContent = `Partitura encontrada automaticamente: ${convertedUrl}`;
            document.getElementById('partituraStatus').style.color = 'green';
        } else {
            document.getElementById('partituraStatus').textContent = 'Nenhuma partitura encontrada automaticamente.';
            document.getElementById('partituraStatus').style.color = 'orange';
        }
    }
});

// Adiciona listener para procurar partituras quando o artista é alterado
document.getElementById('artista').addEventListener('blur', async (e) => {
    const artista = e.target.value;
    const titulo = document.getElementById('titulo').value;
    
    if (titulo && artista) {
        // Combina título e artista para uma busca mais precisa
        const buscaCombinada = `${titulo} ${artista}`;
        
        // Limpa qualquer valor anterior no campo de link
        document.getElementById('partitura').value = '';
        
        // Procura partitura automaticamente
        const partituraUrl = await procurarPartitura(buscaCombinada);
        if (partituraUrl) {
            const convertedUrl = convertGitHubToJsDelivr(partituraUrl);
            document.getElementById('partitura').value = convertedUrl;
            document.getElementById('partituraStatus').textContent = `Partitura encontrada automaticamente: ${convertedUrl}`;
            document.getElementById('partituraStatus').style.color = 'green';
        } else {
            document.getElementById('partituraStatus').textContent = 'Nenhuma partitura encontrada automaticamente.';
            document.getElementById('partituraStatus').style.color = 'orange';
        }
    }
});

// Adiciona listener para procurar partituras quando o botão de submit é clicado
document.querySelector('#uploadForm .btn-submit').addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Coleta os dados do formulário
    const titulo = document.getElementById('titulo').value;
    const artista = document.getElementById('artista').value;
    
    if (titulo && artista) {
        // Combina título e artista para uma busca mais precisa
        const buscaCombinada = `${titulo} ${artista}`;
        
        // Limpa qualquer valor anterior no campo de link
        document.getElementById('partitura').value = '';
        
        // Procura partitura automaticamente
        const partituraUrl = await procurarPartitura(buscaCombinada);
        if (partituraUrl) {
            const convertedUrl = convertGitHubToJsDelivr(partituraUrl);
            document.getElementById('partitura').value = convertedUrl;
            document.getElementById('partituraStatus').textContent = `Partitura encontrada automaticamente: ${convertedUrl}`;
            document.getElementById('partituraStatus').style.color = 'green';
        } else {
            document.getElementById('partituraStatus').textContent = 'Nenhuma partitura encontrada automaticamente.';
            document.getElementById('partituraStatus').style.color = 'orange';
        }
    }
});

// Adiciona listener para o botão de teste
document.getElementById('testarPartitura').addEventListener('click', async () => {
    const titulo = document.getElementById('titulo').value;
    if (titulo) {
        // Limpa qualquer valor anterior no campo de link
        document.getElementById('partitura').value = '';
        
        const partituraUrl = await procurarPartitura(titulo);
        if (partituraUrl) {
            const convertedUrl = convertGitHubToJsDelivr(partituraUrl);
            document.getElementById('partitura').value = convertedUrl;
            document.getElementById('partituraStatus').textContent = `Partitura encontrada: ${convertedUrl}`;
            document.getElementById('partituraStatus').style.color = 'green';
        } else {
            document.getElementById('partituraStatus').textContent = 'Nenhuma partitura encontrada.';
            document.getElementById('partituraStatus').style.color = 'red';
        }
    } else {
        document.getElementById('partituraStatus').textContent = 'Por favor, informe o título da música.';
        document.getElementById('partituraStatus').style.color = 'red';
    }
});
