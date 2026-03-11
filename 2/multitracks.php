<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mixer Multitrack- <?php echo isset($_GET['song']) ? htmlspecialchars(urldecode($_GET['song'])) : 'Música'; ?></title>
    <style>
        :root { 
            --primary: #6366f1; --secondary: #8b5cf6; --dark: #1e293b; --success: #10b981; --danger: #ef4444;
        }
        body { 
            font-family: 'Segoe UI', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px; min-height: 100vh;
        }
        .container { 
            max-width: 1000px; margin: 0 auto; background: rgba(255, 255, 255, 0.98);
            padding: 30px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
        .btn-back { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 14px; }
        .song-title { font-size: 1.8em; font-weight: bold; color: var(--dark); }
        
        .master-controls { 
            background: linear-gradient(135deg, var(--dark), #334155);
            color: white; padding: 25px; border-radius: 15px; margin-bottom: 30px; text-align: center;
            position: sticky; top: 10px; z-index: 100;
        }
        
        /* Estilo da Barra de Progresso / Timeline */
        .timeline-container {
            margin: 20px 0; display: flex; align-items: center; gap: 15px;
            background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;
        }
        .timeline-container input[type="range"] { flex-grow: 1; cursor: pointer; }
        .time-display { font-family: monospace; font-size: 14px; min-width: 50px; }

        .control-buttons { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; }
        .btn-master { padding: 14px 30px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .play-all { background: var(--success); color: white; }
        .pause-all { background: var(--danger); color: white; }
        
        .track-list { display: flex; flex-direction: column; gap: 12px; }
        .track-item { display: grid; grid-template-columns: 1.5fr 3fr 1fr 1fr 1fr; align-items: center; padding: 15px 20px; border: 2px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
        .instrument-name { font-weight: bold; color: var(--dark); display: flex; align-items: center; gap: 8px; }
        audio { height: 35px; width: 100%; display: none; } /* Oculto para usar a timeline mestre */
        
        .btn-control { padding: 10px 15px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; }
        .btn-solo { background: #3b82f6; color: white; }
        .btn-solo.active { background: #f59e0b; }
        .btn-mute { background: #64748b; color: white; }
        .btn-mute.active { background: var(--danger); }
    </style>
</head>
<body>

<div class="container">
    <div class="header-nav">
        <a href="index.php" class="btn-back">← Voltar para Biblioteca</a>
        <h1 class="song-title">🎵 <?php echo isset($_GET['song']) ? htmlspecialchars(urldecode($_GET['song'])) : 'Selecione'; ?></h1>
        <div style="width: 180px;"></div>
    </div>

    <div class="master-controls">
        <div class="control-buttons">
            <button class="btn-master play-all" onclick="playAll()">▶ TOCAR TUDO</button>
            <button class="btn-master pause-all" onclick="pauseAll()">⏸ PAUSAR TUDO</button>
        </div>

        <div class="timeline-container">
            <span class="time-display" id="currentTime">0:00</span>
            <input type="range" id="mainTimeline" value="0" min="0" step="0.1" oninput="syncTimeline(this.value)">
            <span class="time-display" id="duration">0:00</span>
        </div>
        
        <div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:10px; display:inline-block;">
            Velocidade: <input type="range" id="playbackSpeed" min="0.5" max="2" step="0.1" value="1" oninput="updateSpeed(this.value)">
            <span id="speedValue">1.0x</span>
        </div>
    </div>

    <div class="track-list">
        <?php
        if (isset($_GET['song'])) {
            $songName = urldecode($_GET['song']);
            $baseDir = __DIR__ . '/instrumentos/' . $songName; // Caminho corrigido para pasta raiz
            $mp3Files = glob($baseDir . '/*.mp3');
            
            if ($mp3Files) {
                foreach ($mp3Files as $file) {
                    $fileName = basename($file);
                    $cleanName = preg_replace('/^\d+\s*/', '', str_replace('.mp3', '', $fileName));
                    // Caminho web relativo para os áudios
                    $webPath = 'instrumentos/' . rawurlencode($songName) . '/' . rawurlencode($fileName);
                    
                    echo '
                    <div class="track-item">
                        <div class="instrument-name">🎵 '. htmlspecialchars($cleanName) .'</div>
                        <audio class="track-audio" preload="auto" data-id="'. htmlspecialchars($cleanName) .'">
                            <source src="'.$webPath.'" type="audio/mpeg">
                        </audio>
                        <div style="flex-grow:1;"></div>
                        <input type="range" min="0" max="1" step="0.01" value="1" oninput="updateVol(this, \''. htmlspecialchars($cleanName) .'\')">
                        <button class="btn-control btn-solo" onclick="toggleSolo(this, \''. htmlspecialchars($cleanName) .'\')">SOLO</button>
                        <button class="btn-control btn-mute" onclick="toggleMute(this, \''. htmlspecialchars($cleanName) .'\')">MUTE</button>
                    </div>';
                }
            }
        }
        ?>
    </div>
</div>

<script>
const audios = document.querySelectorAll('.track-audio');
const timeline = document.getElementById('mainTimeline');
const curTimeText = document.getElementById('currentTime');
const durText = document.getElementById('duration');

// Configura duração e atualiza tempo
if(audios.length > 0) {
    audios[0].onloadedmetadata = () => {
        timeline.max = audios[0].duration;
        durText.textContent = formatTime(audios[0].duration);
    };
}

setInterval(() => {
    if(audios.length > 0 && !audios[0].paused) {
        timeline.value = audios[0].currentTime;
        curTimeText.textContent = formatTime(audios[0].currentTime);
    }
}, 500);

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function syncTimeline(val) {
    audios.forEach(a => a.currentTime = val);
    curTimeText.textContent = formatTime(val);
}

function playAll() { audios.forEach(a => a.play()); }
function pauseAll() { audios.forEach(a => a.pause()); }
function updateSpeed(v) { 
    document.getElementById('speedValue').textContent = v + 'x';
    audios.forEach(a => a.playbackRate = v); 
}
function updateVol(s, id) { document.querySelector(`.track-audio[data-id="${id}"]`).volume = s.value; }

function toggleSolo(btn, id) {
    const audio = document.querySelector(`.track-audio[data-id="${id}"]`);
    const active = btn.classList.toggle('active');
    audios.forEach(a => a.muted = active);
    if(active) audio.muted = false;
}

function toggleMute(btn, id) {
    const audio = document.querySelector(`.track-audio[data-id="${id}"]`);
    btn.classList.toggle('active');
    audio.muted = btn.classList.contains('active');
}
</script>
</body>
</html>
