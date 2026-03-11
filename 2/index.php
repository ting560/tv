<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estúdio de Playbacks - Biblioteca Musical</title>
    <style>
        :root { 
            --primary: #6366f1; 
            --secondary: #8b5cf6; 
            --dark: #1e293b; 
            --success: #10b981;
            --accent: #f59e0b;
        }
        body { 
            font-family: 'Segoe UI', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: rgba(255, 255, 255, 0.95);
            padding: 40px; 
            border-radius: 20px; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        }
        header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 3px solid var(--primary);
        }
        h1 {
            color: var(--dark);
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(45deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle { color: #64748b; font-size: 1.1em; }
        .search-box { max-width: 600px; margin: 30px auto; position: relative; }
        .search-box input {
            width: 100%;
            padding: 15px 25px;
            font-size: 16px;
            border: 2px solid #e2e8f0;
            border-radius: 50px;
            outline: none;
            transition: all 0.3s;
        }
        .search-box input:focus { border-color: var(--primary); box-shadow: 0 6px 12px rgba(99, 102, 241, 0.2); }
        .music-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; margin-top: 30px; }
        .music-card {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            border: 2px solid transparent;
        }
        .music-card:hover { transform: translateY(-8px); border-color: var(--primary); }
        .music-card-content { padding: 25px; }
        .music-icon {
            width: 60px; height: 60px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 15px; font-size: 28px;
        }
        .music-title { font-size: 1.2em; font-weight: bold; color: var(--dark); margin-bottom: 8px; }
        .play-overlay {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(99, 102, 241, 0.9);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s;
        }
        .music-card:hover .play-overlay { opacity: 1; }
        .play-button { background: white; color: var(--primary); padding: 15px 40px; border-radius: 50px; font-weight: bold; }
        .no-results { text-align: center; padding: 60px 20px; color: #94a3b8; display: none; }
        .total-songs { text-align: center; margin-bottom: 20px; color: #64748b; font-size: 0.95em; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>🎵 Biblioteca de Playbacks</h1>
        <p class="subtitle">Selecione uma música para acessar os instrumentos individuais</p>
    </header>
    
    <div class="search-box">
        <input type="text" id="searchInput" placeholder="🔍 Buscar música..." onkeyup="filterSongs()">
    </div>
    
    <div class="total-songs" id="totalSongs"></div>
    
    <div class="music-grid" id="musicGrid">
        <?php
        $baseDir = __DIR__ . '/instrumentos'; // Alterado para a raiz
        if (is_dir($baseDir)) {
            $folders = glob($baseDir . '/*', GLOB_ONLYDIR);
            $total = 0;
            foreach ($folders as $folder) {
                $folderName = basename($folder);
                if (strpos($folderName, 'url_publica') !== false) continue;
                $mp3Files = glob($folder . '/*.mp3');
                $instrumentCount = count($mp3Files);
                if ($instrumentCount > 0) {
                    $total++;
                    $encodedFolder = urlencode($folderName);
                    echo '
                    <div class="music-card" data-name="'. strtolower($folderName) .'" onclick="openMultitracks(\''. $encodedFolder .'\')">
                        <div class="music-card-content">
                            <div class="music-icon">🎸</div>
                            <div class="music-title">'. htmlspecialchars($folderName) .'</div>
                            <div style="color:#64748b; font-size:0.9em;">🎼 '.$instrumentCount.' instrumentos</div>
                        </div>
                        <div class="play-overlay"><div class="play-button">▶ Abrir Mixer</div></div>
                    </div>';
                }
            }
            echo '<script>document.getElementById("totalSongs").innerHTML = "'.$total.' músicas disponíveis";</script>';
        }
        ?>
    </div>
    <div class="no-results" id="noResults"><p>😕 Nenhuma música encontrada.</p></div>
</div>

<script>
function filterSongs() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.music-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        if (name.includes(input)) { card.style.display = 'block'; visibleCount++; }
        else { card.style.display = 'none'; }
    });
    document.getElementById('noResults').style.display = (visibleCount === 0 && input.length > 0) ? 'block' : 'none';
}
function openMultitracks(songFolder) { window.location.href = 'multitracks.php?song=' + songFolder; }
</script>
</body>
</html>
