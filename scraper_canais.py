import time
import re
import threading
import queue # Usado para coletar os resultados de forma segura
import os # Para usar variáveis de ambiente
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait

# CORREÇÃO CRÍTICA: Importe a exceção principal de onde ela VEM
from github import Github
from github.GithubException import UnknownObjectException # <-- MUDANÇA AQUI!

# ==============================================================================
# 1. CONFIGURAÇÕES E LISTA DE URLS
# ==============================================================================

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

NOME_ARQUIVO_SAIDA = "minha_lista_canais.m3u"
M3U8_PATTERN = r'https?:\/\/[^\s"\']+\.m3u8(?:\?[^\s"\']*)?'
NUMERO_DE_THREADS = 4

# ==============================================================================
# CONFIGURAÇÕES DO GITHUB (ATUALIZADAS CONFORME SEU REPOSITÓRIO)
# ==============================================================================
# ⚠️ REMOVI SEU TOKEN DE EXIBIÇÃO PÚBLICA. COLOQUE-O DE VOLTA AQUI OU USE VAR. DE AMBIENTE.
# Seu script agora irá buscar o token na variável CRON_GITHUB_TOKEN
GITHUB_TOKEN = os.getenv("CRON_GITHUB_TOKEN", None)

# Dados do seu repositório ting560/tv
GITHUB_REPO_OWNER = "ting560"
GITHUB_REPO_NAME = "tv"
GITHUB_FILE_PATH = "minha_lista_canais.m3u" # Se quiser atualizar 'tv.m3u', mude para "tv.m3u"
GITHUB_BRANCH = "main"

# ==============================================================================
# 2. FUNÇÕES DE SUPORTE
# ==============================================================================

def iniciar_browser():
    """Configura e inicia o driver do Chrome."""
    chrome_options = Options()
    # Configurações para rodar em ambiente sem GUI (headless)
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
    
    try:
        # Nota: O driver do Chrome deve estar no PATH ou especificado.
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except WebDriverException as e:
        print(f"❌ ERRO AO INICIAR O CHROME DRIVER: {e}")
        return None

def get_channel_name(url):
    """Extrai o nome do canal do final da URL."""
    return url.split('/')[-1].upper() if url.split('/')[-1] else "CANAL_DESCONHECIDO"

def m3u8_found_in_source(driver):
    """Verifica se o código-fonte da página contém um link M3U8."""
    page_source = driver.page_source
    match = re.search(M3U8_PATTERN, page_source, re.IGNORECASE)
    if match:
        return match.group(0)
    else:
        return False

# ==============================================================================
# 3. FUNÇÃO DO TRABALHADOR (THREAD)
# ==============================================================================

def processar_canal(url_alvo, resultados_fila):
    channel_name = get_channel_name(url_alvo)
    driver = iniciar_browser()
    if not driver:
        resultados_fila.put(f"ERRO ao iniciar browser para {channel_name}")
        return

    try:
        print(f"🔎 [Thread-{threading.current_thread().name}] Escaneando: {channel_name}")
        driver.get(url_alvo)
        
        # Espera até 15 segundos para o link M3U8 aparecer no código-fonte
        link_m3u8 = WebDriverWait(driver, 15).until(m3u8_found_in_source)
        
        if link_m3u8:
            print(f"    ✅ [Thread-{threading.current_thread().name}] SUCESSO: {channel_name}")
            m3u_entry = f'#EXTINF:-1 tvg-name="{channel_name}" group-title="TV ABERTA/PREMIUM",{channel_name}\n{link_m3u8}'
            resultados_fila.put(m3u_entry)
        else:
            print(f"    ❌ [Thread-{threading.current_thread().name}] FALHA: {channel_name}")

    except TimeoutException:
        print(f"    ❌ [Thread-{threading.current_thread().name}] TIMEOUT: {channel_name}")
    except Exception as e:
        print(f"    ❌ [Thread-{threading.current_thread().name}] ERRO GERAL em {channel_name}: {e}")
    finally:
        driver.quit()

# ==============================================================================
# FUNÇÃO PARA SALVAR NO GITHUB (CORRIGIDA NOVAMENTE)
# ==============================================================================

def salvar_no_github(conteudo_m3u):
    """
    Conecta-se à API do GitHub e cria ou atualiza um arquivo no repositório.
    """
    if not GITHUB_TOKEN or GITHUB_TOKEN == "SEU_TOKEN_REAL_AQUI":
        print("\n❌ ERRO: Token do GitHub não configurado. Pulando o envio para o GitHub.")
        print("   Defina a variável de ambiente GITHUB_TOKEN ou substitua o token no script.")
        return

    try:
        print("\n🔗 Conectando ao GitHub...")
        # DeprecationWarning ignorada por enquanto, mas use auth=github.Auth.Token(...) no futuro.
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(f"{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}")
        
        # Prepara o conteúdo completo do arquivo
        file_content = "#EXTM3U\n" + "\n".join(conteudo_m3u)
        commit_message = f"Atualização automática da lista de canais - {time.strftime('%Y-%m-%d %H:%M:%S')}"

        # Tenta obter o arquivo para ver se ele já existe
        try:
            file = repo.get_contents(GITHUB_FILE_PATH, ref=GITHUB_BRANCH)
            
            # Se o arquivo existe, atualizamos
            repo.update_file(
                path=GITHUB_FILE_PATH,
                message=commit_message,
                content=file_content,
                sha=file.sha,
                branch=GITHUB_BRANCH
            )
            print(f"✅ Arquivo '{GITHUB_FILE_PATH}' ATUALIZADO com sucesso no GitHub!")
        
        # CORREÇÃO FINAL: Usa a exceção importada diretamente
        except UnknownObjectException: 
            # Se o arquivo não existe, criamos ele
            repo.create_file(
                path=GITHUB_FILE_PATH,
                message=commit_message,
                content=file_content,
                branch=GITHUB_BRANCH
            )
            print(f"✅ Arquivo '{GITHUB_FILE_PATH}' CRIADO com sucesso no GitHub!")

    except Exception as e:
        print(f"❌ ERRO ao interagir com a API do GitHub: {e}")


# ==============================================================================
# 4. ROTINA PRINCIPAL DE EXTRAÇÃO
# ==============================================================================

def processar_lista_canais_paralelo():
    """Gerencia as threads para processar a lista de canais em paralelo."""
    resultados_fila = queue.Queue()
    threads = []
    
    print(f"\n=========================================================")
    print(f"🚀 INICIANDO O SCANNER PARALELO com {NUMERO_DE_THREADS} threads")
    print(f"=========================================================\n")

    for i, url in enumerate(URLS_CANAIS):
        # Limita o número de threads ativas
        while threading.active_count() > NUMERO_DE_THREADS:
            time.sleep(0.5)

        thread = threading.Thread(target=processar_canal, args=(url, resultados_fila), name=f"Canal-{i+1}")
        threads.append(thread)
        thread.start()

    # Espera todas as threads terminarem
    for thread in threads:
        thread.join()

    print("\n=========================================================")
    print("✅ Todas as threads finalizaram. Coletando resultados.")
    print("=========================================================\n")

    lista_m3u_final = []
    while not resultados_fila.empty():
        resultado = resultados_fila.get()
        if not resultado.startswith("ERRO"):
            lista_m3u_final.append(resultado)

    # Salva o arquivo M3U final LOCALMENTE
    if lista_m3u_final:
        try:
            with open(NOME_ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
                f.write("#EXTM3U\n")
                f.write("\n".join(lista_m3u_final))
            print(f"\n🎉 SUCESSO! {len(lista_m3u_final)} links salvos LOCALMENTE em '{NOME_ARQUIVO_SAIDA}'")
        except Exception as e:
            print(f"❌ ERRO FATAL ao salvar o arquivo local: {e}")
        
        # Chama a função para salvar no GitHub
        salvar_no_github(lista_m3u_final)

    else:
        print("\nNenhum link M3U8 foi extraído. Nenhum arquivo será salvo.")


# ==============================================================================
# EXECUÇÃO DO SCRIPT
# ==============================================================================
if __name__ == "__main__":
    processar_lista_canais_paralelo()