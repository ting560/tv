import os
import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor
from github import Github

# ==============================================================================
# 1. CONFIGURAÇÕES DE AMBIENTE E GITHUB
# ==============================================================================

# O Token é lido do Secret do GitHub Actions
GITHUB_TOKEN = os.getenv("CRON_GITHUB_TOKEN", None)
REPO_NAME = "ting560/tv"  # <--- VERIFIQUE SE SEU REPO É ESTE!
ARQUIVO_SAIDA = "minha_lista_canais.m3u"

# Lista de URLs ATUALIZADA
URLS_CANAIS = [
    "https://embedtv-4.icu/ae",
    "https://embedtv-4.icu/axn",
    "https://embedtv-4.icu/adultswim",
    "https://embedtv-4.icu/animalplanet",
    "https://embedtv-4.icu/aparecida",
    "https://embedtv-4.icu/band",
    "https://embedtv-4.icu/bandnews",
    "https://embedtv-4.icu/bandsports",
    "https://embedtv-4.icu/cancaonova",
    "https://embedtv-4.icu/cartoonnetwork",
    "https://embedtv-4.icu/cartoonito",
    "https://embedtv-4.icu/caze1",
    "https://embedtv-4.icu/caze2",
    "https://embedtv-4.icu/caze3",
    "https://embedtv-4.icu/cinemax",
    "https://embedtv-4.icu/combate",
    "https://embedtv-4.icu/comedycentral",
    "https://embedtv-4.icu/cultura",
    "https://embedtv-4.icu/discoverychannel",
    "https://embedtv-4.icu/discoveryid",
    "https://embedtv-4.icu/discoveryhh",
    "https://embedtv-4.icu/discoverykids",
    "https://embedtv-4.icu/discoveryscience",
    "https://embedtv-4.icu/discoverytheather",
    "https://embedtv-4.icu/discoveryturbo",
    "https://embedtv-4.icu/discoveryword",
    "https://embedtv-4.icu/disneyplus1",
    "https://embedtv-4.icu/disneyplus2",
    "https://embedtv-4.icu/disneyplus3",
    "https://embedtv-4.icu/espn",
    "https://embedtv-4.icu/espn2",
    "https://embedtv-4.icu/espn3",
    "https://embedtv-4.icu/espn4",
    "https://embedtv-4.icu/espn5",
    "https://embedtv-4.icu/espn6",
    "https://embedtv-4.icu/nba1",
    "https://embedtv-4.icu/nba2",
    "https://embedtv-4.icu/24h_odeiachris",
    "https://embedtv-4.icu/24h_simpsons",
    "https://embedtv-4.icu/24h_dragonball",
    "https://embedtv-4.icu/fx",
    "https://embedtv-4.icu/fish",
    "https://embedtv-4.icu/foodnetwork",
    "https://embedtv-4.icu/gnt",
    "https://embedtv-4.icu/globonews",
    "https://embedtv-4.icu/globorj",
    "https://embedtv-4.icu/globosp",
    "https://embedtv-4.icu/gloob",
    "https://embedtv-4.icu/cnnbrasil",
    "https://embedtv-4.icu/hbo",
    "https://embedtv-4.icu/hbo2",
    "https://embedtv-4.icu/hbofamily",
    "https://embedtv-4.icu/hbomundi",
    "https://embedtv-4.icu/hbopop",
    "https://embedtv-4.icu/hboplus",
    "https://embedtv-4.icu/hboxtreme",
    "https://embedtv-4.icu/hgtv",
    "https://embedtv-4.icu/history",
    "https://embedtv-4.icu/history2",
    "https://embedtv-4.icu/mtv",
    "https://embedtv-4.icu/masterchef",
    "https://embedtv-4.icu/goat1",
    "https://embedtv-4.icu/goat2",
    "https://embedtv-4.icu/goat3",
    "https://embedtv-4.icu/max1",
    "https://embedtv-4.icu/max2",
    "https://embedtv-4.icu/max3",
    "https://embedtv-4.icu/max4",
    "https://embedtv-4.icu/max5",
    "https://embedtv-4.icu/max6",
    "https://embedtv-4.icu/megapix",
    "https://embedtv-4.icu/multishow",
    "https://embedtv-4.icu/nickjunior",
    "https://embedtv-4.icu/nickelodeon",
    "https://embedtv-4.icu/nossofutebol",
    "https://embedtv-4.icu/nossofutebol2",
    "https://embedtv-4.icu/nossofutebol3",
    "https://embedtv-4.icu/paramountchannel",
    "https://embedtv-4.icu/paramountplus",
    "https://embedtv-4.icu/paramountplus2",
    "https://embedtv-4.icu/playboy",
    "https://embedtv-4.icu/premiere",
    "https://embedtv-4.icu/premiere2",
    "https://embedtv-4.icu/premiere3",
    "https://embedtv-4.icu/premiere4",
    "https://embedtv-4.icu/premiere5",
    "https://embedtv-4.icu/premiere6",
    "https://embedtv-4.icu/premiere7",
    "https://embedtv-4.icu/premiere8",
    "https://embedtv-4.icu/primevideo",
    "https://embedtv-4.icu/primevideo2",
    "https://embedtv-4.icu/record",
    "https://embedtv-4.icu/sbt",
    "https://embedtv-4.icu/sexyhot",
    "https://embedtv-4.icu/sonychannel",
    "https://embedtv-4.icu/space",
    "https://embedtv-4.icu/sportv",
    "https://embedtv-4.icu/sportv2",
    "https://embedtv-4.icu/sportv3",
    "https://embedtv-4.icu/sportv4",
    "https://embedtv-4.icu/starchannel",
    "https://embedtv-4.icu/studiouniversal",
    "https://embedtv-4.icu/tcm",
    "https://embedtv-4.icu/tlc",
    "https://embedtv-4.icu/tnt",
    "https://embedtv-4.icu/tntnovelas",
    "https://embedtv-4.icu/tntseries",
    "https://embedtv-4.icu/telecineaction",
    "https://embedtv-4.icu/telecinecult",
    "https://embedtv-4.icu/telecinefun",
    "https://embedtv-4.icu/telecinepipoca",
    "https://embedtv-4.icu/telecinepremium",
    "https://embedtv-4.icu/telecinetouch",
    "https://embedtv-4.icu/ufcfightpass",
    "https://embedtv-4.icu/universaltv",
    "https://embedtv-4.icu/viva",
    "https://embedtv-4.icu/warnerchannel",
    "https://embedtv-4.icu/off",
]

# Expressão regular para encontrar links .m3u8 no código-fonte
M3U8_PATTERN = r'https?:\/\/[^\s"\']+\.m3u8(?:\?[^\s"\']*)?'
# Mantemos o limite de 2 threads para evitar o erro DevToolsActivePort/concorrência.
MAX_THREADS = 2

# ==============================================================================
# 2. FUNÇÕES DE SUPORTE E INFRAESTRUTURA
# ==============================================================================

def inicializar_driver():
    """Inicializa o driver Chrome com opções otimizadas para o GitHub Actions."""
    try:
        chrome_options = Options()
        
        # Opções ESSENCIAIS para rodar no servidor Linux do GitHub
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
        
        # O ChromeDriver está no PATH graças ao browser-actions/setup-chrome
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except Exception as e:
        print(f"❌ ERRO AO INICIAR O CHROME DRIVER: {e}")
        return None

def get_channel_name(url):
    """Extrai o nome do canal do final da URL."""
    nome_canal_raw = url.split('/')[-1]
    return nome_canal_raw.replace(' ', '').title()


def salvar_no_github(lista_m3u_final):
    """Faz o commit do arquivo m3u atualizado no repositório do GitHub."""
    if not GITHUB_TOKEN:
        print("❌ ERRO FATAL: Token do GitHub não configurado. Não é possível fazer commit.")
        return

    try:
        # Nota: O uso de login_or_token está depreciado, mas funciona com o token
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(REPO_NAME)
        
        novo_conteudo = "\n".join(lista_m3u_final)

        try:
            # Tenta buscar o arquivo existente
            conteudo_arquivo = repo.get_contents(ARQUIVO_SAIDA, ref="main")
            # Atualiza o arquivo
            repo.update_file(conteudo_arquivo.path, 
                             f"Atualização automática da lista de canais - {time.strftime('%Y-%m-%d %H:%M:%S')}", 
                             novo_conteudo, 
                             conteudo_arquivo.sha,
                             branch="main")
            print(f"✅ Arquivo '{ARQUIVO_SAIDA}' ATUALIZADO com sucesso no GitHub!")

        except Exception as e:
            # Cria o arquivo se ele não existir
            if "Not Found" in str(e) or "404" in str(e):
                repo.create_file(ARQUIVO_SAIDA, 
                                 f"Criação automática da lista de canais - {time.strftime('%Y-%m-%d %H:%M:%S')}", 
                                 novo_conteudo,
                                 branch="main")
                print(f"✅ Arquivo '{ARQUIVO_SAIDA}' CRIADO com sucesso no GitHub!")
            else:
                 print(f"❌ ERRO ao fazer commit no GitHub: {e}")

    except Exception as e:
        print(f"❌ ERRO geral no GitHub: {e}")

# ==============================================================================
# 3. FUNÇÃO PRINCIPAL DE SCRAPING (COM LÓGICA DE EXTRAÇÃO ATUALIZADA)
# ==============================================================================

def extrair_m3u8(url):
    driver = inicializar_driver()
    if not driver:
        return None
        
    nome_canal = get_channel_name(url)
    link_m3u8_real = None

    try:
        print(f"🔎 [Canal {nome_canal}] Escaneando: {url}")
        driver.get(url)
        
        # Espera que o corpo da página esteja carregado (Timeout de 20s)
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # LÓGICA DE EXTRAÇÃO: Procurar link M3U8 no código-fonte
        page_source = driver.page_source
        match = re.search(M3U8_PATTERN, page_source, re.IGNORECASE)
        
        if match:
            link_m3u8_real = match.group(0)

        # Se não encontrar no código-fonte, tente o log de rede ou outros elementos (muito complexo para um script simples)
        # Manteremos apenas a busca no código-fonte (page_source)

        if link_m3u8_real:
            print(f"    ✅ [Canal {nome_canal}] SUCESSO: Link extraído.")
            # Formato M3U que seu player precisa
            resultado_m3u = f'#EXTINF:-1 tvg-name="{nome_canal}" group-title="CANAIS TV",{nome_canal}\n{link_m3u8_real}'
            return resultado_m3u
        else:
            print(f"    ❌ [Canal {nome_canal}] FALHA: Link M3U8 não encontrado no código-fonte.")
            return None

    except TimeoutException:
        print(f"    ❌ [Canal {nome_canal}] TIMEOUT: A página demorou muito para carregar (20s).")
        return None
    except Exception as e:
        print(f"    ❌ [Canal {nome_canal}] ERRO GERAL: {e}")
        return None
    finally:
        if driver:
            driver.quit()

# ==============================================================================
# 4. ROTINA PRINCIPAL DE EXECUÇÃO
# ==============================================================================

def processar_lista_canais_paralelo():
    """Gerencia a execução paralela das URLs e salva o resultado."""
    
    print("=========================================================")
    print(f"🚀 INICIANDO O SCANNER PARALELO com {MAX_THREADS} threads")
    print("=========================================================")

    # Executa a função extrair_m3u8 em paralelo
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        resultados = list(executor.map(extrair_m3u8, URLS_CANAIS))
    
    # Filtra apenas os resultados válidos (que não são None)
    lista_m3u_final = [r for r in resultados if r and r.startswith('#EXTINF')]

    print("\n=========================================================")
    print(f"🎉 FIM DO SCAN: {len(lista_m3u_final)} link(s) M3U8 extraído(s).")
    
    # Salva o arquivo M3U8 e faz commit
    if lista_m3u_final:
        lista_final_com_header = ["#EXTM3U"] + lista_m3u_final
        
        # Salva o arquivo M3U8 LOCALMENTE
        try:
            with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
                f.write("\n".join(lista_final_com_header))
            print(f"✅ SUCESSO! {len(lista_m3u_final)} link(s) salvo(s) LOCALMENTE.")
        except Exception as e:
            print(f"❌ ERRO FATAL ao salvar o arquivo local: {e}")
            
        # Chama a função para salvar no GitHub
        salvar_no_github(lista_final_com_header)
    else:
        print("Nenhum link M3U8 foi extraído. Nenhum commit será feito.")


# ==============================================================================
# EXECUÇÃO DO SCRIPT
# ==============================================================================
if __name__ == "__main__":
    processar_lista_canais_paralelo()
