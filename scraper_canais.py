import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor
from github import Github
# Importações necessárias para inicialização estável
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager 

# --- CONFIGURAÇÃO DE AMBIENTE ---
# O Token é lido do Secret do GitHub Actions
GITHUB_TOKEN = os.getenv("CRON_GITHUB_TOKEN", None) 
REPO_NAME = "ting560/tv"
ARQUIVO_SAIDA = "minha_lista_canais.m3u"
# Número máximo de processos paralelos (Limitado para evitar erros de DevToolsActivePort)
MAX_THREADS = 2 

# Sua lista de URLs
URLS_CANAIS = [
    "https://embedtv-4.icu/sportv",
    "https://embedtv-4.icu/premiere",
    "https://embedtv-4.icu/premiere2",
    "https://embedtv-4.icu/tnt",
    "https://embedtv-4.icu/primevideo",
    "https://embedtv-4.icu/sbt",
    "https://embedtv-4.icu/record",
    "https://embedtv-4.icu/megapix",
    "https://embedtv-4.icu/max1",
    "https://embedtv-4.icu/hbo",
    "https://embedtv-4.icu/hbo2",
    "https://embedtv-4.icu/globorj",
    "https://embedtv-4.icu/globonews",
    "https://embedtv-4.icu/fx",
    "https://embedtv-4.icu/espn",
    "https://embedtv-4.icu/espn4",
    "https://embedtv-4.icu/disneyplus1",
    "https://embedtv-4.icu/band"
]

# --- FUNÇÕES DE SETUP E INICIALIZAÇÃO DO CHROME (CORRIGIDO) ---

def inicializar_driver():
    """Inicializa e retorna um driver Chrome configurado para ambiente headless (Actions)."""
    try:
        chrome_options = Options()
        
        # Opções ESSENCIAIS para rodar no servidor Linux do GitHub
        chrome_options.add_argument('--headless') 
        chrome_options.add_argument('--no-sandbox') 
        chrome_options.add_argument('--disable-dev-shm-usage') 
        
        # Define o caminho do executável Chromium (instalado no Passo 3 do YAML)
        chrome_options.binary_location = '/usr/bin/chromium-browser' 

        # Inicializa o driver: O ChromeDriverManager baixa o chromedriver compatível
        service = ChromeService(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver
    except Exception as e:
        print(f"❌ ERRO AO INICIAR O CHROME DRIVER: {e}")
        return None

# --- FUNÇÃO DE SCRAPING (ADAPTE A LÓGICA DE EXTRAÇÃO AQUI) ---

def extrair_m3u8(url):
    driver = inicializar_driver()
    if not driver:
        return None 
        
    # Extrai o nome do canal da URL (ex: 'sportv' -> 'Sportv')
    nome_canal_raw = url.split('/')[-1]
    nome_canal = nome_canal_raw.replace(' ', '').title()

    try:
        print(f"⚙️ Tentando acessar: {nome_canal} ({url})")
        driver.get(url)
        
        # Aumentamos o tempo de espera (timeout) para 20 segundos
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.TAG_NAME, "body")) 
        )

        # ------------------------------------------------------------------------
        # *** SUA LÓGICA DE EXTRAÇÃO DE M3U8 VAI AQUI ***
        # Você precisa inspecionar o código-fonte ou os logs de rede para 
        # encontrar o link M3U8 após o carregamento da página.
        
        link_m3u8_real = None 
        
        # EXECUTANDO TESTE: Se você não extrair nada, ele usará este link de exemplo.
        # REMOVA A CONDIÇÃO IF ABAIXO QUANDO INSERIR SUA LÓGICA REAL!
        if nome_canal == "Sportv":
             link_m3u8_real = f"http://exemplo.com/link-de-teste-para-{nome_canal.lower()}/stream.m3u8"
        
        # ------------------------------------------------------------------------
        
        if link_m3u8_real:
            resultado_m3u = f"#EXTINF:-1 group-title=\"Canais TV\",{nome_canal}\n{link_m3u8_real}"
            print(f"✅ SUCESSO: Link extraído para {nome_canal}")
            return resultado_m3u
        else:
            print(f"❌ FALHA: Link M3U8 não encontrado. Verifique sua lógica de extração para {nome_canal}")
            return None

    except Exception as e:
        print(f"❌ ERRO de Scraping em {nome_canal}: {e}")
        return None
    finally:
        if driver:
            driver.quit()

# --- FUNÇÃO DE COMMIT NO GITHUB ---

def salvar_no_github(lista_m3u_final):
    """Faz o commit do arquivo m3u atualizado no repositório do GitHub."""
    if not GITHUB_TOKEN:
        print("❌ ERRO FATAL: Token do GitHub não configurado. Não é possível fazer commit.")
        return

    try:
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

# --- EXECUÇÃO PRINCIPAL ---

def processar_lista_canais_paralelo(urls):
    """Processa todas as URLs em paralelo usando ThreadPoolExecutor."""
    
    print("=========================================================")
    print(f"🚀 INICIANDO O SCANNER PARALELO com {MAX_THREADS} threads")
    print("=========================================================")

    # Executa com o limite de threads definido em MAX_THREADS (2)
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        resultados = list(executor.map(extrair_m3u8, urls))
    
    lista_m3u_final = [r for r in resultados if r and r.startswith("#EXTINF")]

    print(f"\n🎉 FIM DO SCAN: {len(lista_m3u_final)} link(s) M3U8 extraído(s).")
    
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


if __name__ == "__main__":
    processar_lista_canais_paralelo(URLS_CANAIS)
