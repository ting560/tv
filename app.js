// app.js

import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    // createUserWithEmailAndPassword, <--- REMOVIDO
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

function showMessage(msg, type = 'success') {
    messageEl.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    setTimeout(() => { messageEl.innerHTML = ''; }, 5000);
}

// Função Global para abrir a partitura em um MODAL/POPUP
window.openSheet = function(url) {
    if (url) {
        sheetViewer.src = url;
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

// Função para renderizar o botão de partitura para a LISTA DO MODAL (estilo compacto)
function renderModalSheetButton(musica) {
    if (musica.partitura) {
        // Estilo inline compacto para não quebrar o layout flexível da modal-music-list
        return `<button class="modal-sheet-btn" 
                    title="Partitura"
                    style="background: var(--success-color); color: var(--text-light); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; margin-left: 6px; flex-shrink: 0;"
                    onclick="window.openSheet('${musica.partitura}')">
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
    const audioUrl = `musicas/${encodeURIComponent(safeFileName)}`;
    
    modalPlayerControls.innerHTML = `
        <div class="now-playing">Tocando: ${musica.titulo || 'Título Desconhecido'}</div>
        
        <audio id="modalAudioPlayer" controls src="${audioUrl}" controlsList="nodownload" preload="auto"></audio>

        <div class="player-main-controls">
            <button id="modalPrevBtn" class="control-nav" title="Anterior" ${modalCurrentIndex===0 ? 'disabled' : ''}>&#9664;&#9664;</button> 
            
            <button id="modalPlayPauseBtn" class="control-main" title="Play">&#9654;</button> 

            <button id="modalNextBtn" class="control-nav" title="Próxima" ${modalCurrentIndex === modalMusicas.length - 1 ? 'disabled' : ''}>&#9654;&#9654;</button>
        </div>
    `;

    // --- LÓGICA DE CONTROLE DO PLAYER ---
    
    const audioPlayer = document.getElementById('modalAudioPlayer');
    const playPauseBtn = document.getElementById('modalPlayPauseBtn');
    
    modalAudioPlayerInstance = audioPlayer;

    if (isPlaying) {
        audioPlayer.play();
        playPauseBtn.innerHTML = '&#10073;&#10073;';
        playPauseBtn.title = 'Pause';
    }
    
    playPauseBtn.onclick = () => {
        if (audioPlayer.paused) {
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
            renderModalMusicList(); // Atualiza a lista para o destaque
        } else {
            isPlaying = false;
            playPauseBtn.innerHTML = '&#9654;';
            playPauseBtn.title = 'Play';
            modalCurrentIndex = 0; 
            renderModalPlayer(); // Volta ao primeiro e atualiza o player
            renderModalMusicList(); // Atualiza a lista para o destaque
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
    } else {
        showAuthScreen();
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showMessage('Login realizado com sucesso!', 'success');
        } catch (error) {
            showMessage('Erro ao fazer login. Verifique suas credenciais.', 'error');
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showMessage('Logout realizado com sucesso!', 'success');
            // Limpa a playlist ao sair
            userPlaylist = [];
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
        const audioUrl = `musicas/${encodeURIComponent(safeFileName)}`;
        
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
            
            <audio controls class="audio-player" data-src="${audioUrl}" controlsList="nodownload">
                Seu navegador não suporta o elemento de áudio.
            </audio>
            
            <button class="add-to-playlist-btn" 
                    data-musica-arquivo="${safeFileName}" 
                    title="Adicionar à Lista"> 
                + Adicionar à Lista 
            </button>
            
            ${musica.partitura ? `
                <button class="open-sheet-btn" 
                        title="Abrir Partitura" 
                        onclick="window.openSheet('${musica.partitura}')"> 
                    Ver Partitura 🎼 
                </button>` : ''}
            `;

        card.innerHTML = cardHtml;
        
        // Lógica de áudio na grade principal
        const audioPlayer = card.querySelector('.audio-player');
        audioPlayer.src = audioPlayer.getAttribute('data-src');
        
        audioPlayer.addEventListener('play', () => {
            try {
                if (currentAudio && currentAudio !== audioPlayer) {
                    currentAudio.pause();
                }
                currentAudio = audioPlayer;
            } catch (e) {
                console.error("Erro ao pausar outros áudios:", e);
            }
        });

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