// app.js

import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    collection, 
    query, 
    orderBy, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- Variáveis Globais e Seletores de Elementos ---
const appContainer = document.getElementById('app-container');
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const musicListContainer = document.getElementById('musicList');
const messageEl = document.getElementById('message');
const searchInput = document.getElementById('searchInput');
const orderSelect = document.getElementById('orderSelect');

// Controles de Música Principal
let currentAudio = null;
let allMusicas = [];
let currentFilter = '';
let currentOrder = 'recent';

// Playlist personalizada
let userPlaylist = [];

// Carrega a playlist do localStorage ao iniciar
function loadUserPlaylist() {
    try {
        const savedPlaylist = localStorage.getItem('userPlaylist');
        if (savedPlaylist) {
            userPlaylist = JSON.parse(savedPlaylist);
        }
    } catch (error) {
        console.error('Erro ao carregar playlist do localStorage:', error);
        userPlaylist = [];
    }
}

// Salva a playlist no localStorage
function saveUserPlaylist() {
    try {
        localStorage.setItem('userPlaylist', JSON.stringify(userPlaylist));
    } catch (error) {
        console.error('Erro ao salvar playlist no localStorage:', error);
    }
}

// Carrega a playlist ao iniciar
loadUserPlaylist();

// Controles do Modal Player
const openPlayerListBtn = document.getElementById('openPlayerListBtn');
const playerListModal = document.getElementById('playerListModal');
const closePlayerListModal = document.getElementById('closePlayerListModal');
const modalPlayerControls = document.getElementById('modalPlayerControls');
const modalMusicList = document.getElementById('modalMusicList');

let modalMusicas = [];
let modalCurrentIndex = 0;
let modalAudioPlayerInstance = null;
let isPlaying = false; 

// Seletores para o Modal de Partitura
const sheetModal = document.getElementById('sheetModal');
const closeSheetModal = document.getElementById('closeSheetModal');
const sheetViewer = document.getElementById('sheetViewer');


// --- Funções Auxiliares e Botões de Ação ---

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

function showMessage(msg, type = 'success') {
    messageEl.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    setTimeout(() => { messageEl.innerHTML = ''; }, 5000);
}

// Função Global para abrir a partitura em um MODAL/POPUP
window.openSheet = function(url) {
    if (url) {
        // Verifica se é uma imagem
        const isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(url);
        
        if (isImage) {
            // Para imagens, cria um conteúdo HTML com a imagem centralizada
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        html, body {
                            height: 100%;
                            margin: 0;
                            padding: 0;
                            overflow: hidden;
                        }
                        body {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background: #000;
                        }
                        .image-container {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            width: 100vw;
                            height: 100vh;
                            overflow: auto;
                        }
                        img {
                            max-width: 95vw;
                            max-height: 95vh;
                            width: auto;
                            height: auto;
                            object-fit: contain;
                            display: block;
                        }
                        @media (max-width: 768px) {
                            img {
                                max-width: 98vw;
                                max-height: 98vh;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="image-container">
                        <img src="${url}" alt="Partitura">
                    </div>
                </body>
                </html>
            `;
            
            // Cria um blob com o conteúdo HTML
            const blob = new Blob([htmlContent], {type: 'text/html'});
            const blobUrl = URL.createObjectURL(blob);
            
            sheetViewer.src = blobUrl;
        } else {
            // Para PDFs e outros tipos, usa o URL diretamente
            sheetViewer.src = url;
        }
        
        sheetModal.style.display = 'flex'; // Exibe o modal
    }
};

// Função para fechar o Modal de Partitura
function closeSheetModalFn() {
    if (!sheetModal) return;
    sheetModal.style.display = 'none';
    sheetViewer.src = ''; // Limpa o iframe
}

if (closeSheetModal) closeSheetModal.addEventListener('click', closeSheetModalFn);

// Fecha o modal ao clicar fora
if (sheetModal) {
    sheetModal.addEventListener('click', (e) => {
        if (e.target === sheetModal) {
            closeSheetModalFn();
        }
    });
}

// Ajusta o tamanho do modal ao redimensionar a janela
window.addEventListener('resize', () => {
    if (sheetModal && sheetModal.style.display === 'flex') {
        // Força um pequeno atraso para garantir que o redimensionamento seja aplicado
        setTimeout(() => {
            if (sheetViewer && sheetViewer.contentWindow) {
                sheetViewer.contentWindow.dispatchEvent(new Event('resize'));
            }
        }, 100);
    }
});

// Função para renderizar o botão de partitura para a LISTA DO MODAL (estilo compacto)
function renderModalSheetButton(musica) {
    if (musica.partitura) {
        // Estilo inline compacto para não quebrar o layout flexível da modal-music-list
        return `<button class="modal-sheet-btn" 
                    title="Partitura"
                    style="background: var(--success-color); color: var(--text-light); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; margin-left: 6px; flex-shrink: 0;"
                    onclick="window.openSheet('${convertGitHubToJsDelivr(musica.partitura)}')">
                    🎼
                </button>`; 
    }
    return '';
}

/**
 * ATUALIZA O ESTADO VISUAL DE UM BOTÃO DE ADICIONAR.
 * @param {HTMLElement} buttonElement O botão a ser atualizado.
 */
function updateButtonState(buttonElement) {
    const musicaArquivo = buttonElement.getAttribute('data-musica-arquivo');
    
    const isInPlaylist = userPlaylist.some(m => m.arquivo === musicaArquivo);

    if (isInPlaylist) {
        buttonElement.classList.add('in-playlist');
        buttonElement.textContent = "✔️ Selecionado";
        buttonElement.disabled = true;
    } else {
        buttonElement.classList.remove('in-playlist');
        buttonElement.textContent = "+ Adicionar à Lista";
        buttonElement.disabled = false;
    }
}

function addToUserPlaylist(musica) {
    if (userPlaylist.some(m => m.arquivo === musica.arquivo)) {
        showMessage('Esta música já está na sua lista!', 'error');
        return;
    }
    userPlaylist.push(musica);
    saveUserPlaylist(); // Salva a playlist no localStorage
    showMessage('Música adicionada à sua lista!', 'success');
    
    document.querySelectorAll(`[data-musica-arquivo="${musica.arquivo}"]`).forEach(btn => {
        updateButtonState(btn);
    });
}


// --- Lógica do Modal Player Lista ---

function openPlayerListModalFn() {
    if (!playerListModal) return;
    
    // Sincroniza a lista do modal com a playlist do usuário
    modalMusicas = userPlaylist.slice();
    modalCurrentIndex = 0;
    
    if (modalMusicas.length > 0) {
        renderModalPlayer();
    } else {
        modalPlayerControls.innerHTML = '<p class="now-playing">Nenhuma música na lista.</p>';
    }
    renderModalMusicList();
    // Torna o modal visível
    playerListModal.style.display = 'flex';
}

function closePlayerListModalFn() {
    if (!playerListModal) return;
    
    // Para a música ao fechar o modal
    if (modalAudioPlayerInstance) {
        modalAudioPlayerInstance.pause();
    }
    isPlaying = false;
    
    // Oculta o modal
    playerListModal.style.display = 'none';
}

if (openPlayerListBtn) openPlayerListBtn.addEventListener('click', openPlayerListModalFn);
if (closePlayerListModal) closePlayerListModal.addEventListener('click', closePlayerListModalFn);

// Fecha o modal ao clicar fora
if (playerListModal) {
    playerListModal.addEventListener('click', (e) => {
        if (e.target === playerListModal) {
            closePlayerListModalFn();
        }
    });
}


function renderModalPlayer() {
    if (!modalPlayerControls) return;
    
    if (!modalMusicas.length) {
        modalPlayerControls.innerHTML = '<p class="now-playing">Nenhuma música na lista.</p>';
        return;
    }
    
    const musica = modalMusicas[modalCurrentIndex];
    const safeFileName = (musica.arquivo || '').trim();
    
    // *** A URL AGORA APONTA PARA O SCRIPT PROTEGIDO ***
    const audioUrl = `https://radiopositivafm.com.br/bandas/imgem/stream_protected.php?file=${encodeURIComponent(safeFileName)}&token=b3JkZW1fZGVfY2hvcmluaG9fMjAyNQ==`;
    
    modalPlayerControls.innerHTML = `
        <div class="now-playing">Tocando: ${musica.titulo || 'Título Desconhecido'}</div>
        
        <audio id="modalAudioPlayer" 
               controls 
               data-src="${audioUrl}" 
               controlsList="nodownload" 
               preload="none"
               crossorigin="anonymous"></audio>

        <div class="player-main-controls">
            <button id="modalPrevBtn" class="control-nav" title="Anterior" ${modalCurrentIndex===0 ? 'disabled' : ''}>&#9664;&#9664;</button> 
            
            <button id="modalPlayPauseBtn" class="control-main" title="Play">&#9654;</button> 

            <button id="modalNextBtn" class="control-nav" title="Próxima" ${modalCurrentIndex === modalMusicas.length - 1 ? 'disabled' : ''}>&#9654;&#9654;</button>
        </div>
    `;
    
    // --- LÓGICA DE CONTROLE DO PLAYER ---
    
    const audioPlayer = document.getElementById('modalAudioPlayer');
    const playPauseBtn = document.getElementById('modalPlayPauseBtn');
    
    // Remove o src inicial para evitar carregamento automático
    if (audioPlayer.hasAttribute('src')) {
        audioPlayer.removeAttribute('src');
    }
    
    // Define o src apenas quando o usuário clica para reproduzir
    audioPlayer.addEventListener('play', () => {
        const srcUrl = audioPlayer.getAttribute('data-src');
        if (!audioPlayer.src || audioPlayer.src === window.location.href) {
            audioPlayer.src = srcUrl;
            // Força o carregamento do áudio
            setTimeout(() => {
                audioPlayer.load();
            }, 10);
        }
    });
    
    // Também define o src no evento canplaythrough
    audioPlayer.addEventListener('canplaythrough', () => {
        const srcUrl = audioPlayer.getAttribute('data-src');
        if (!audioPlayer.src || audioPlayer.src === window.location.href) {
            audioPlayer.src = srcUrl;
        }
    });
    
    // Adiciona evento para verificar erros
    audioPlayer.addEventListener('error', (e) => {
        console.error('Erro no player modal:', e);
    });
    
    modalAudioPlayerInstance = audioPlayer;

    if (isPlaying) {
        // Se já estava tocando, define o src e inicia a reprodução
        const srcUrl = audioPlayer.getAttribute('data-src');
        if (!audioPlayer.src || audioPlayer.src === window.location.href) {
            audioPlayer.src = srcUrl;
            audioPlayer.load();
        }
        audioPlayer.play();
        playPauseBtn.innerHTML = '&#10073;&#10073;';
        playPauseBtn.title = 'Pause';
    }
    
    playPauseBtn.onclick = () => {
        if (audioPlayer.paused) {
            // Define o src apenas quando o usuário clica para reproduzir
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                audioPlayer.load();
            }
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    };
    
    audioPlayer.onplay = () => {
        playPauseBtn.innerHTML = '&#10073;&#10073;';
        playPauseBtn.title = 'Pause';
        isPlaying = true;
    };
    
    audioPlayer.onpause = () => {
        playPauseBtn.innerHTML = '&#9654;';
        playPauseBtn.title = 'Play';
        isPlaying = false;
    };
    
    audioPlayer.onended = () => {
        if (modalCurrentIndex < modalMusicas.length - 1) {
            modalCurrentIndex++;
            renderModalPlayer();
            renderModalMusicList();
        } else {
            isPlaying = false;
            playPauseBtn.innerHTML = '&#9654;';
            playPauseBtn.title = 'Play';
            modalCurrentIndex = 0; 
            renderModalPlayer();
            renderModalMusicList();
        }
    };
    
    document.getElementById('modalPrevBtn').onclick = () => { 
        if (modalCurrentIndex > 0) { 
            modalCurrentIndex--; 
            renderModalPlayer(); 
            renderModalMusicList();
        } 
    };
    
    document.getElementById('modalNextBtn').onclick = () => { 
        if (modalCurrentIndex < modalMusicas.length - 1) { 
            modalCurrentIndex++; 
            renderModalPlayer(); 
            renderModalMusicList();
        } 
    };
    
    // Garante que o player esteja pronto
    setTimeout(() => {
        const srcUrl = audioPlayer.getAttribute('data-src');
        if (!audioPlayer.src || audioPlayer.src === window.location.href) {
            audioPlayer.src = srcUrl;
        }
    }, 100);
}


function renderModalMusicList() {
    if (!modalMusicList) return;
    if (!modalMusicas.length) {
        modalMusicList.innerHTML = '<p>Lista vazia.</p>';
        return;
    }
    modalMusicList.innerHTML = modalMusicas.map((musica, idx) => {
        const isCurrent = idx === modalCurrentIndex ? 'style="background:#b2ebf2; border: 2px solid var(--primary-color);"' : '';
        return `
            <div ${isCurrent}>
                <span style="flex:1; font-weight:600;">${idx+1}. ${musica.titulo || 'Título Desconhecido'}</span>
                
                ${renderModalSheetButton(musica)}
                <button class="remove" onclick="window.removeModalMusic(${idx})">Remover</button>
                <button onclick="window.moveModalMusicUp(${idx})" ${idx===0 ? 'disabled' : ''}>&#9650;</button>
                <button onclick="window.moveModalMusicDown(${idx})" ${idx===modalMusicas.length - 1 ? 'disabled' : ''}>&#9660;</button>
            </div>
        `;
    }).join('');
}

// Funções expostas globalmente para serem chamadas pelo onclick no HTML do modal
window.removeModalMusic = function(idx) {
    if (idx < 0 || idx >= modalMusicas.length) return;
    
    const removedMusica = modalMusicas.splice(idx, 1)[0];
    
    // Remove também da userPlaylist
    userPlaylist = userPlaylist.filter(m => m.arquivo !== removedMusica.arquivo);
    
    // Atualiza o estado dos botões de adicionar na lista principal
    document.querySelectorAll(`[data-musica-arquivo="${removedMusica.arquivo}"]`).forEach(btn => {
        updateButtonState(btn);
    });

    // Ajusta o índice da música atual
    if (modalCurrentIndex > idx || (modalCurrentIndex === idx && modalCurrentIndex === modalMusicas.length)) {
        modalCurrentIndex--;
    }
    if (modalCurrentIndex < 0) modalCurrentIndex = 0; 
    
    renderModalPlayer();
    renderModalMusicList();
    if (modalMusicas.length === 0) closePlayerListModalFn();
};

window.moveModalMusicUp = function(idx) {
    if (idx <= 0 || idx >= modalMusicas.length) return;
    const temp = modalMusicas[idx-1];
    modalMusicas[idx-1] = modalMusicas[idx];
    modalMusicas[idx] = temp;
    if (modalCurrentIndex === idx) modalCurrentIndex--;
    else if (modalCurrentIndex === idx-1) modalCurrentIndex++;
    renderModalPlayer();
    renderModalMusicList();
};

window.moveModalMusicDown = function(idx) {
    if (idx < 0 || idx >= modalMusicas.length-1) return;
    const temp = modalMusicas[idx+1];
    modalMusicas[idx+1] = modalMusicas[idx];
    modalMusicas[idx] = temp;
    if (modalCurrentIndex === idx) modalCurrentIndex++;
    else if (modalCurrentIndex === idx+1) modalCurrentIndex--;
    renderModalPlayer();
    renderModalMusicList();
};


// --- Funções de UI e Autenticação ---

// Timer de inatividade
let inactivityTimer;
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos em milissegundos

// Função para resetar o timer de inatividade
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        // Expira a sessão após 15 minutos de inatividade
        signOut(auth);
        clearPhpSession();
        showMessage('Sessão expirada por inatividade.', 'error');
    }, INACTIVITY_TIMEOUT);
}

// Adiciona listeners para resetar o timer de inatividade
function setupInactivityListeners() {
    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });
    
    // Inicia o timer
    resetInactivityTimer();
}

// Inicia os listeners de inatividade
setupInactivityListeners();

/**
 * Envia o UID do Firebase para um script PHP para criar a sessão do servidor.
 * @param {string} uid O ID de usuário do Firebase.
 */
async function setPhpSession(uid) {
    try {
        const response = await fetch('set_session.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `uid=${uid}`
        });
        const result = await response.json();
        if (result.status !== 'success') {
            console.error('Erro ao criar sessão PHP:', result.message);
        }
    } catch (error) {
        console.error('Erro de rede ao comunicar com set_session.php:', error);
    }
}

/**
 * Encerra a sessão PHP no servidor.
 */
async function clearPhpSession() {
    try {
        await fetch('clear_session.php', { method: 'POST' });
    } catch (error) {
        console.error('Erro de rede ao comunicar com clear_session.php:', error);
    }
}


function showAuthScreen() {
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
    logoutBtn.style.display = 'none';
    musicListContainer.innerHTML = '';
}

function showAppScreen(user) {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadMusicList();
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        showAppScreen(user);
        // Garante que a sessão PHP está ativa ao carregar a página
        setPhpSession(user.uid); 
    } else {
        showAuthScreen();
        // Garante que a sessão PHP é limpa ao carregar a página e não estar logado
        clearPhpSession(); 
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // *** NOVO PASSO CRÍTICO: CRIA SESSÃO PHP ***
            await setPhpSession(userCredential.user.uid);

            showMessage('Login realizado com sucesso!', 'success');
        } catch (error) {
            showMessage('Erro ao fazer login. Verifique suas credenciais.', 'error');
        }
    });
}

// Se você tiver um formulário de cadastro, adicione a chamada `setPhpSession` lá também.
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // *** NOVO PASSO CRÍTICO: CRIA SESSÃO PHP ***
            await setPhpSession(userCredential.user.uid); 
            
            showMessage('Cadastro realizado com sucesso! Você já está logado.', 'success');
            // Redireciona para a página principal após o registro
            setTimeout(() => { window.location.href = 'index.html'; }, 1000); 

        } catch (error) {
            showMessage(`Erro ao cadastrar: ${error.message}`, 'error');
        }
    });
}


if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            
            // *** PASSO CRÍTICO: LIMPA SESSÃO PHP ***
            await clearPhpSession();

            showMessage('Logout realizado com sucesso!', 'success');
            // Limpa a playlist ao sair
            userPlaylist = [];
            saveUserPlaylist(); // Salva a playlist vazia no localStorage
        } catch (error) {
            showMessage('Erro ao fazer logout.', 'error');
        }
    });
}


// --- Lógica de Carregamento e Renderização da Lista de Músicas ---

function renderMusicList(musicas) {
    musicListContainer.innerHTML = '';
    if (musicas.length === 0) {
        musicListContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888;">Nenhuma música encontrada com o filtro atual.</p>';
        return;
    }
    
    musicas.forEach(musica => {
        const card = document.createElement('div');
        card.className = 'music-card';
        
        const safeFileName = (musica.arquivo || '').trim();
        
        // *** A URL AGORA APONTA PARA O SCRIPT PROTEGIDO ***
        const audioUrl = `https://radiopositivafm.com.br/bandas/imgem/stream_protected.php?file=${encodeURIComponent(safeFileName)}&token=b3JkZW1fZGVfY2hvcmluaG9fMjAyNQ==`;
        
        // Formata a data
        let date = 'N/A';
        // Conversão segura de data/Timestamp
        let dateObj = musica.data && musica.data.toDate ? musica.data.toDate() : (musica.data ? new Date(musica.data) : null);
        if (dateObj && !isNaN(dateObj)) {
            date = dateObj.toLocaleDateString('pt-BR');
        }
        
        const cardHtml = `
            <h3>${musica.titulo || 'Título Desconhecido'}</h3>
            <p>Artista: ${musica.artista || 'N/A'}</p>
            <p>Lançamento: ${date}</p>
            
            <audio controls class="audio-player" 
                   data-src="${audioUrl}" 
                   controlsList="nodownload" 
                   preload="none"
                   crossorigin="anonymous">
                Seu navegador não suporta o elemento de áudio.
            </audio>
            
            <button class="add-to-playlist-btn" 
                    data-musica-arquivo="${safeFileName}" 
                    title="Adicionar à Lista"> 
                + Adicionar à Lista 
            </button>
            
            ${musica.partitura && musica.partitura !== '' ? `
                <button class="open-sheet-btn" 
                        title="Abrir Partitura" 
                        onclick="window.openSheet('${convertGitHubToJsDelivr(musica.partitura)}')"> 
                    Ver Partitura 🎼 
                </button>` : ''}
            `;

        card.innerHTML = cardHtml;
        
        // Lógica de áudio na grade principal
        const audioPlayer = card.querySelector('.audio-player');
        // Armazena a URL no atributo data
        audioPlayer.setAttribute('data-src', audioUrl);
        
        // Remove o src inicial para evitar carregamento automático
        if (audioPlayer.hasAttribute('src')) {
            audioPlayer.removeAttribute('src');
        }
        
        // Adiciona evento para definir o src quando o player é carregado
        audioPlayer.addEventListener('loadstart', () => {
            console.log('Iniciando carregamento do áudio:', audioUrl);
        });
        
        audioPlayer.addEventListener('loadeddata', () => {
            console.log('Dados do áudio carregados:', audioUrl);
        });
        
        audioPlayer.addEventListener('error', (e) => {
            console.error('Erro ao carregar áudio:', audioUrl, e);
        });
        
        // Define o src e carrega o áudio quando o usuário interage com o player
        audioPlayer.addEventListener('play', () => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                // Força o carregamento do áudio
                setTimeout(() => {
                    audioPlayer.load();
                }, 10);
            }
            
            try {
                if (currentAudio && currentAudio !== audioPlayer) {
                    currentAudio.pause();
                }
                currentAudio = audioPlayer;
            } catch (e) {
                console.error("Erro ao pausar outros áudios:", e);
            }
        });
        
        // Também carrega quando o usuário clica em qualquer parte do player
        audioPlayer.addEventListener('click', () => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                setTimeout(() => {
                    audioPlayer.load();
                }, 10);
            }
        });
        
        // Carrega o áudio quando o mouse passa sobre o player (mouseenter)
        audioPlayer.addEventListener('mouseenter', () => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                setTimeout(() => {
                    audioPlayer.load();
                }, 10);
            }
        });
        
        // Carrega o áudio quando o player recebe foco
        audioPlayer.addEventListener('focus', () => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                setTimeout(() => {
                    audioPlayer.load();
                }, 10);
            }
        });
        
        // Carrega o áudio quando o player é selecionado via teclado
        audioPlayer.addEventListener('keydown', (e) => {
            // Se for Enter ou Espaço (teclas de play/pause)
            if (e.keyCode === 13 || e.keyCode === 32) {
                e.preventDefault();
                const srcUrl = audioPlayer.getAttribute('data-src');
                if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                    audioPlayer.src = srcUrl;
                    setTimeout(() => {
                        audioPlayer.load();
                    }, 10);
                }
                // Tenta reproduzir o áudio após um pequeno delay
                setTimeout(() => {
                    audioPlayer.play().catch(e => {
                        console.log('Erro ao reproduzir:', e);
                    });
                }, 100);
            }
        });
        
        // Garante que o player esteja pronto após um curto período
        setTimeout(() => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                // Força o carregamento do áudio
                setTimeout(() => {
                    audioPlayer.load();
                }, 50);
            }
        }, 300);
        
        // Previne o comportamento padrão de carregamento automático
        audioPlayer.addEventListener('loadstart', (e) => {
            // Se o src for o da página atual, significa que o navegador tentou carregar automaticamente
            if (audioPlayer.src === window.location.href) {
                e.preventDefault();
                // Definimos o src correto
                const srcUrl = audioPlayer.getAttribute('data-src');
                audioPlayer.src = srcUrl;
                // Força o carregamento após um pequeno delay
                setTimeout(() => {
                    audioPlayer.load();
                }, 50);
            }
        });
        
        // Trata erros de carregamento
        audioPlayer.addEventListener('error', (e) => {
            console.error('Erro no player principal:', e);
            // Tenta recarregar o áudio
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (audioPlayer.src && audioPlayer.src !== window.location.href) {
                setTimeout(() => {
                    audioPlayer.src = srcUrl;
                    audioPlayer.load();
                }, 100);
            }
        });
        
        // Garante que o player esteja pronto após um período maior
        setTimeout(() => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
                // Força o carregamento do áudio
                setTimeout(() => {
                    audioPlayer.load();
                }, 100);
            } else {
                // Se já tem src, verifica se está carregado
                if (audioPlayer.networkState === 0) { // NETWORK_EMPTY
                    setTimeout(() => {
                        audioPlayer.load();
                    }, 50);
                }
            }
        }, 1000);
        
        // Verifica o estado do player periodicamente
        const checkInterval = setInterval(() => {
            if (audioPlayer.networkState === 0 && audioPlayer.src && audioPlayer.src !== window.location.href) {
                // Se o player está vazio mas tem src válido, força o carregamento
                setTimeout(() => {
                    audioPlayer.load();
                }, 50);
            }
        }, 2000);
        
        // Limpa o interval após 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 10000);
        
        // Para garantir compatibilidade, também definimos o src no evento canplay
        audioPlayer.addEventListener('canplay', () => {
            const srcUrl = audioPlayer.getAttribute('data-src');
            // Apenas define o src se ainda não estiver definido
            if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                audioPlayer.src = srcUrl;
            }
        });
        
        // Adiciona evento para verificar quando o player está pronto
        audioPlayer.addEventListener('canplaythrough', () => {
            console.log('Player pronto para reprodução contínua:', audioUrl);
        });
        
        // Monitora o estado de carregamento
        const loadingCheck = setInterval(() => {
            if (audioPlayer.readyState >= 2) { // HAVE_CURRENT_DATA
                console.log('Áudio carregado com dados suficientes:', audioUrl);
                clearInterval(loadingCheck);
            } else if (audioPlayer.networkState === 3) { // NETWORK_NO_SOURCE
                console.log('Erro de rede ao carregar áudio:', audioUrl);
                clearInterval(loadingCheck);
            }
        }, 1000);
        
        // Limpa o interval após 5 segundos
        setTimeout(() => {
            clearInterval(loadingCheck);
        }, 5000);
        
        // Adiciona listener ao botão de adicionar à playlist
        const addBtn = card.querySelector('.add-to-playlist-btn');
        addBtn.addEventListener('click', () => addToUserPlaylist(musica));
        
        // Atualiza o estado visual do botão ao renderizar
        updateButtonState(addBtn);

        musicListContainer.appendChild(card);
    });
}


function filterAndOrderMusicas() {
    let filtered = allMusicas;

    // 1. Filtragem (Busca)
    if (currentFilter) {
        const filterLower = currentFilter.toLowerCase();
        filtered = filtered.filter(musica => 
            (musica.titulo || '').toLowerCase().includes(filterLower) ||
            (musica.artista || '').toLowerCase().includes(filterLower)
        );
    }

    // 2. Ordenação
    if (currentOrder === 'alpha') {
        filtered = filtered.slice().sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    } else if (currentOrder === 'artista') {
        filtered = filtered.slice().sort((a, b) => (a.artista || '').localeCompare(b.artista || ''));
    } else {
        // 'recent' (default) - Ordenação por data descendente
        filtered = filtered.slice().sort((a, b) => {
            const da = a.data && a.data.toDate ? a.data.toDate().getTime() : (a.data ? new Date(a.data).getTime() : 0);
            const db = b.data && b.data.toDate ? b.data.toDate().getTime() : (b.data ? new Date(b.data).getTime() : 0);
            return db - da;
        });
    }
    renderMusicList(filtered);
}

async function loadMusicList() {
    musicListContainer.innerHTML = '<h2>Carregando lista de chorinhos...</h2>';
    try {
        const q = query(collection(db, 'musicas'));
        const querySnapshot = await getDocs(q);
        allMusicas = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allMusicas.push(data);
        });
        filterAndOrderMusicas();
    } catch (error) {
        console.error("Erro ao carregar a lista de músicas:", error);
        musicListContainer.innerHTML = '<h2>Erro ao carregar a lista. Verifique as Regras de Permissão do Firestore.</h2>';
    }
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentFilter = e.target.value.trim();
        filterAndOrderMusicas();
    });
}

if (orderSelect) {
    orderSelect.addEventListener('change', (e) => {
        currentOrder = e.target.value;
        filterAndOrderMusicas();
    });
}