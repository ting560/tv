// admin.js

import { auth, db } from './firebase-config.js'; // Importa 'auth'
// Removido import do admin-key.js
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
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

// Função para procurar partituras na pasta PARTITURAS
async function procurarPartitura(titulo) {
    try {
        console.log('Procurando partitura para:', titulo);
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
            if (fileName && 
                fileName.toLowerCase().includes(titulo.toLowerCase()) && 
                (fileName.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.png'))) {
                console.log('Partitura encontrada:', fileName);
                return `./PARTITURAS/${encodeURIComponent(fileName)}`;
            }
        }
        
        console.log('Nenhuma partitura encontrada para:', titulo);
        return null;
    } catch (error) {
        console.error('Erro ao procurar partitura:', error);
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
    
    // Listener para o formulário de upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Coleta os dados do formulário
        const titulo = document.getElementById('titulo').value;
        const artista = document.getElementById('artista').value;
        const data = document.getElementById('data').value;
        const partitura = document.getElementById('partitura').value;
        const nova = document.getElementById('nova').checked;
        
        // Validação básica
        if (!titulo || !artista || !data) {
            showMessage('Por favor, preencha todos os campos obrigatórios.', 'alert-error');
            return;
        }
        
        try {
            // Adiciona o documento ao Firestore
            await addDoc(collection(db, 'musicas'), {
                titulo,
                artista,
                data: new Date(data),
                partitura: partitura || null,
                nova: nova || false,
                arquivo: `${titulo} (${artista}).mp3` // Nome simulado do arquivo
            });
            
            showMessage('Música cadastrada com sucesso!', 'success');
            uploadForm.reset();
            document.getElementById('data').value = '2025-01-01'; // Reseta a data para o valor padrão
            document.getElementById('partituraStatus').textContent = ''; // Limpa o status da partitura
            
            // Recarrega a lista de músicas
            carregarMusicasAdmin();
        } catch (error) {
            console.error("Erro ao cadastrar música:", error);
            showMessage('❌ Erro ao cadastrar música. Tente novamente.', 'error');
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
            
            tableHtml += `
                <tr>
                    <td>${musica.titulo || 'N/A'}</td>
                    <td>${musica.artista || 'N/A'}</td>
                    <td>${dataFormatada}</td>
                    <td>
                        <button class="btn-edit" onclick="editarMusica('${doc.id}')">Editar</button>
                        <button class="btn-remove" onclick="removerMusica('${doc.id}')">Remover</button>
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

// Função para editar uma música (a ser implementada)
window.editarMusica = function(musicaId) {
    showMessage('Função de edição ainda não implementada.', 'alert-error');
};

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

// Função para limpar o formulário
window.novaMusica = function() {
    uploadForm.reset();
    document.getElementById('data').value = '2025-01-01';
    document.getElementById('partituraStatus').textContent = '';
    showMessage('Formulário limpo!', 'success');
};

// Adiciona listener para procurar partituras quando o título é alterado
document.getElementById('titulo').addEventListener('blur', (e) => {
    const titulo = e.target.value;
    if (titulo) {
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

// Adiciona listener para procurar partituras quando o artista é alterado
document.getElementById('artista').addEventListener('blur', (e) => {
    const artista = e.target.value;
    const titulo = document.getElementById('titulo').value;
    
    if (titulo && artista) {
        // Combina título e artista para uma busca mais precisa
        const buscaCombinada = `${titulo} ${artista}`;
        procurarPartitura(buscaCombinada).then(partituraUrl => {
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

// Adiciona listener para procurar partituras quando o botão de submit é clicado
document.querySelector('#uploadForm .btn-submit').addEventListener('click', (e) => {
    e.preventDefault();
    
    // Coleta os dados do formulário
    const titulo = document.getElementById('titulo').value;
    const artista = document.getElementById('artista').value;
    
    if (titulo && artista) {
        // Combina título e artista para uma busca mais precisa
        const buscaCombinada = `${titulo} ${artista}`;
        procurarPartitura(buscaCombinada).then(partituraUrl => {
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

// Adiciona listener para o botão de teste
document.getElementById('testarPartitura').addEventListener('click', async () => {
    const titulo = document.getElementById('titulo').value;
    if (titulo) {
        const partituraUrl = await procurarPartitura(titulo);
        if (partituraUrl) {
            document.getElementById('partitura').value = partituraUrl;
            document.getElementById('partituraStatus').textContent = `Partitura encontrada: ${partituraUrl}`;
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
