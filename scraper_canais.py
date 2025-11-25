import os
import time
import re
import random
# Importa o webdriver do selenium-wire em vez do selenium normal
from seleniumwire import webdriver as webdriver_selenium_wire
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor
from github import Github

# ==============================================================================
# 1. CONFIGURAÇÕES DE AMBIENTE E GITHUB
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
# O Padrão M3U8 ainda pode ser útil para debug ou como fallback, mas a interceptação é a primária
M3U8_PATTERN = r'https?:\/\/[^\s"\']+\.m3u8(?:\?[^\s"\']*)?'
MAX_THREADS = 2

# ==============================================================================
# 2. FUNÇÕES DE SUPORTE E INFRAESTRUTURA
# ==============================================================================

def inicializar_driver():
    """Inicializa o driver Chrome com opções otimizadas e compatíveis com selenium-wire."""
    try:
        chrome_options = Options()
        
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-plugins")
        chrome_options.add_argument("--disable-web-security")
        chrome_options.add_argument("--allow-running-insecure-content")
        chrome_options.add_argument("--ignore-certificate-errors")
        chrome_options.add_argument("--ignore-ssl-errors")
        chrome_options.add_argument("--disable-features=VizDisplayCompositor")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # 🌟 Usamos o webdriver do seleniumwire aqui!
        driver = webdriver_selenium_wire.Chrome(options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        print(f"❌ ERRO AO INICIAR O CHROME DRIVER: {e}")
        return None

def get_channel_name(url):
    """Extrai o nome do canal do final da URL."""
    nome_canal_raw = url.split('/')[-1]
    return f"{nome_canal_raw.replace(' ', '').title()}"


def salvar_no_github(lista_m3u_final):
    """Faz o commit do arquivo m3u atualizado no repositório do GitHub."""
    if not GITHUB_TOKEN:
        print("❌ ERRO FATAL: Token do GitHub não configurado. Não é possível fazer commit.")
        return

    try:
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(REPO_NAME)
        
        novo_conteudo = "\n".join(lista_m3u_final)
        data_hora = time.strftime('%Y-%m-%d %H:%M:%S')

        try:
            conteudo_arquivo = repo.get_contents(ARQUIVO_SAIDA, ref="main")
            
            repo.update_file(conteudo_arquivo.path, 
                             f"Atualização automática da lista de canais - {data_hora}", 
                             novo_conteudo, 
                             conteudo_arquivo.sha,
                             branch="main")
            print(f"✅ Arquivo '{ARQUIVO_SAIDA}' ATUALIZADO com sucesso no GitHub!")

        except Exception as e:
            if "Not Found" in str(e) or "404" in str(e):
                repo.create_file(ARQUIVO_SAIDA, 
                                 f"Criação automática da lista de canais - {data_hora}", 
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
        
        # Damos um tempo para todas as requisições de rede serem feitas
        time.sleep(random.uniform(5.0, 10.0)) 
        
        # 🌟 NOVA LÓGICA: Iterar sobre as requisições de rede feitas pelo navegador
        for request in driver.requests:
            if request.response:
                # Procura por URLs de requisição que terminam em .m3u8
                if re.search(r'\.m3u8$', request.url, re.IGNORECASE):
                    link_m3u8_real = request.url
                    break # Encontramos o primeiro, podemos sair

        if link_m3u8_real:
            print(f"    ✅ [Canal {nome_canal}] SUCESSO (Network Request): Link extraído: {link_m3u8_real}")
            resultado_m3u = f'#EXTINF:-1 tvg-name="{nome_canal}" group-title="CANAIS TV",{nome_canal}\n{link_m3u8_real}'
            return resultado_m3u
        else:
            print(f"    ❌ [Canal {nome_canal}] FALHA: Link M3U8 não encontrado nas requisições de rede.")
            
            # 💡 Opcional: Fallback para procurar no page_source se a interceptação falhar
            page_source = driver.page_source
            match = re.search(M3U8_PATTERN, page_source, re.IGNORECASE)
            if match:
                link_m3u8_real = match.group(0)
                print(f"    ⚠️ [Canal {nome_canal}] ALERTA: Link M3U8 encontrado no page_source (fallback).")
                resultado_m3u = f'#EXTINF:-1 tvg-name="{nome_canal}" group-title="CANAIS TV",{nome_canal}\n{link_m3u8_real}'
                return resultado_m3u
            else:
                print(f"    ❌ [Canal {nome_canal}] FALHA: Link M3U8 não encontrado em nenhum lugar.")
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

    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        resultados = list(executor.map(extrair_m3u8, URLS_CANAIS))
    
    lista_m3u_final = [r for r in resultados if r and r.startswith('#EXTINF')]

    print("\n=========================================================")
    print(f"🎉 FIM DO SCAN: {len(lista_m3u_final)} link(s) M3U8 extraído(s).")
    
    if lista_m3u_final:
        lista_final_com_header = ["#EXTM3U"] + lista_m3u_final
        
        try:
            with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
                f.write("\n".join(lista_final_com_header))
            print(f"✅ SUCESSO! {len(lista_m3u_final)} link(s) salvo(s) LOCALMENTE.")
        except Exception as e:
            print(f"❌ ERRO FATAL ao salvar o arquivo local: {e}")
            
        salvar_no_github(lista_final_com_header)
    else:
        print("Nenhum link M3U8 foi extraído. Nenhum commit será feito.")


# ==============================================================================
# EXECUÇÃO DO SCRIPT
# ==============================================================================
if __name__ == "__main__":
    processar_lista_canais_paralelo()
