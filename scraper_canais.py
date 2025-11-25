import os
import time
import re
import json
import random
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By
from github import Github

# ==============================================================================
# CONFIGURAÇÕES
# ==============================================================================

GITHUB_TOKEN = os.getenv("CRON_GITHUB_TOKEN", None)
REPO_NAME = "ting560/tv"
ARQUIVO_SAIDA = "minha_lista_canais.m3u"

URLS_CANAIS = [
    "https://embedtv-5.icu/sportv",
    "https://embedtv-5.icu/premiere",
    "https://embedtv-5.icu/premiere2",
    "https://embedtv-5.icu/premiere3",
    "https://embedtv-5.icu/premiere4",
    "https://embedtv-5.icu/premiere5",
    "https://embedtv-5.icu/premiere6",
    "https://embedtv-5.icu/premiere7",
    "https://embedtv-5.icu/premiere8",
    "https://embedtv-5.icu/tnt",
    "https://embedtv-5.icu/primevideo",
    "https://embedtv-5.icu/sbt",
    "https://embedtv-5.icu/record",
    "https://embedtv-5.icu/megapix",
    "https://embedtv-5.icu/max1",
    "https://embedtv-5.icu/hbo",
    "https://embedtv-5.icu/hbo2",
    "https://embedtv-5.icu/globorj",
    "https://embedtv-5.icu/globonews",
    "https://embedtv-5.icu/fx",
    "https://embedtv-5.icu/espn",
    "https://embedtv-5.icu/espn4",
    "https://embedtv-5.icu/disneyplus1",
    "https://embedtv-5.icu/band",
    "https://embedtv-5.icu/telecineaction",
    "https://embedtv-5.icu/telecinecult",
    "https://embedtv-5.icu/telecinefun",
    "https://embedtv-5.icu/telecinepipoca",
    "https://embedtv-5.icu/telecinepremium",
    "https://embedtv-5.icu/telecinetouch",
    "https://embedtv-5.icu/universaltv",
]

# ==============================================================================
# FUNÇÕES
# ==============================================================================

def inicializar_driver():
    options = Options()
    options.add_argument('--headless=new') # Headless mais moderno
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # 🌟 HABILITA LOGS DE PERFORMANCE (Para ler a aba Network)
    options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    
    driver = webdriver.Chrome(options=options)
    return driver

def get_channel_name(url):
    nome = url.split('/')[-1]
    return nome.replace(' ', '').title()

def extrair_m3u8_sequencial(urls):
    """Processa um por um para evitar sobrecarga de memória no GitHub Actions"""
    driver = inicializar_driver()
    lista_m3u = []

    if not driver:
        return []

    for url in urls:
        nome_canal = get_channel_name(url)
        print(f"🔎 [Canal {nome_canal}] Abrindo: {url}")
        
        try:
            driver.get(url)
            time.sleep(3) # Espera inicial

            # 🌟 TENTATIVA DE CLICAR NO PLAYER (Crucial para sites com overlay)
            try:
                # Tenta clicar no centro da tela ou em elementos comuns de player
                driver.execute_script("document.body.click();")
                print("    🖱️  Clique simulado no corpo da página.")
            except:
                pass
            
            # Espera o vídeo carregar após o clique
            time.sleep(6) 

            # 🌟 LÊ OS LOGS DE PERFORMANCE (Igual aba Network)
            logs = driver.get_log("performance")
            link_encontrado = None

            for entry in logs:
                message = json.loads(entry["message"])["message"]
                if "Network.requestWillBeSent" in message["method"]:
                    request_url = message["params"]["request"]["url"]
                    if ".m3u8" in request_url:
                        link_encontrado = request_url
                        # Prioriza links que não sejam do próprio site (geralmente CDNs)
                        if "embedtv" not in link_encontrado:
                            break 
            
            if link_encontrado:
                print(f"    ✅ SUCESSO: {link_encontrado[:60]}...")
                lista_m3u.append(f'#EXTINF:-1 tvg-name="{nome_canal}" group-title="CANAIS TV",{nome_canal}\n{link_encontrado}')
            else:
                print("    ❌ FALHA: Nenhum .m3u8 nos logs de rede.")

        except Exception as e:
            print(f"    ❌ ERRO: {e}")
            # Recria o driver se der crash
            driver.quit()
            driver = inicializar_driver()

    driver.quit()
    return lista_m3u

def salvar_no_github(lista_m3u_final):
    if not GITHUB_TOKEN or not lista_m3u_final:
        return

    try:
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(REPO_NAME)
        novo_conteudo = "#EXTM3U\n" + "\n".join(lista_m3u_final)
        
        try:
            conteudo_arquivo = repo.get_contents(ARQUIVO_SAIDA, ref="main")
            repo.update_file(conteudo_arquivo.path, "Update Lista", novo_conteudo, conteudo_arquivo.sha, branch="main")
            print("✅ GitHub atualizado!")
        except:
            repo.create_file(ARQUIVO_SAIDA, "Create Lista", novo_conteudo, branch="main")
            print("✅ Arquivo criado no GitHub!")
            
    except Exception as e:
        print(f"❌ Erro GitHub: {e}")

if __name__ == "__main__":
    links = extrair_m3u8_sequencial(URLS_CANAIS)
    if links:
        # Salva local para garantir
        with open(ARQUIVO_SAIDA, "w") as f:
            f.write("#EXTM3U\n" + "\n".join(links))
        salvar_no_github(links)
    else:
        print("Nenhum canal extraído.")
