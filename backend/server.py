from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup
import re
import asyncio

# Importar sistema de recomendações
from recommendations import (
    calculate_graham_score,
    scrape_b3_tickers,
    analyze_all_stocks,
    setup_scheduler,
    analysis_state,
    calculate_multi_criteria_ranking  # NOVO: função de ranking multi-critério
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Stock Data Response Model
class StockData(BaseModel):
    ticker: str
    preco_atual: Optional[float] = None
    lpa: Optional[float] = None
    vpa: Optional[float] = None
    dividend_yield: Optional[float] = None
    roe: Optional[float] = None
    div_liquida_ebitda: Optional[float] = None
    rentabilidade_real_media: Optional[float] = None
    margem_liquida: Optional[float] = None
    margem_ebitda: Optional[float] = None
    pl_atual: Optional[float] = None
    pl_historico_media: Optional[float] = None
    pl_historico_valores: Optional[List[float]] = None
    nome_empresa: Optional[str] = None
    setor: Optional[str] = None
    divida_liquida: Optional[float] = None  # Dívida Líquida em R$ milhões
    earning_yield: Optional[float] = None  # Earning Yield (LPA/Preço * 100)
    cagr_receitas_5a: Optional[float] = None  # CAGR Receitas 5 anos (%)
    cagr_lucros_5a: Optional[float] = None  # CAGR Lucros 5 anos (%)
    is_banco: Optional[bool] = None  # Se é instituição financeira/banco
    error: Optional[str] = None

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


def parse_brazilian_number(value: str) -> Optional[float]:
    """Parse Brazilian number format (1.234,56) to float"""
    if not value or value == '-' or value == 'N/A' or value.strip() == '':
        return None
    try:
        # Remove % if present
        value = value.replace('%', '').strip()
        # Remove R$ if present
        value = value.replace('R$', '').strip()
        # Remove spaces
        value = value.replace(' ', '')
        # Handle Brazilian format: 1.234,56 -> 1234.56
        # First remove thousand separators (dots)
        value = value.replace('.', '')
        # Then replace decimal separator (comma) with dot
        value = value.replace(',', '.')
        return float(value)
    except (ValueError, AttributeError):
        return None


async def get_ticker_id(ticker: str, client: httpx.AsyncClient, headers: dict) -> Optional[int]:
    """Get the ticker ID from the stock page"""
    url = f"https://investidor10.com.br/acoes/{ticker.lower()}/"
    
    try:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return None
        
        # Search for tickerId in the page
        match = re.search(r'tickerId["\']?\s*[:=]\s*["\']?(\d+)', response.text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        # Alternative: search in API URL pattern
        match = re.search(r'api/historico-indicadores/(\d+)/', response.text)
        if match:
            return int(match.group(1))
            
        return None
    except Exception as e:
        logger.error(f"Error getting ticker ID for {ticker}: {e}")
        return None


async def get_current_price(ticker: str, client: httpx.AsyncClient, headers: dict) -> Optional[float]:
    """Get the current stock price"""
    url = f"https://investidor10.com.br/acoes/{ticker.lower()}/"
    
    try:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return None
        
        # Search for price pattern "R$ XX,XX"
        price_matches = re.findall(r'R\$\s*([\d]+[,.][\d]+)', response.text)
        if price_matches:
            return parse_brazilian_number(price_matches[0])
            
        return None
    except Exception as e:
        logger.error(f"Error getting price for {ticker}: {e}")
        return None


async def get_company_name(ticker: str, client: httpx.AsyncClient, headers: dict) -> Optional[str]:
    """Get the company name from the page title"""
    url = f"https://investidor10.com.br/acoes/{ticker.lower()}/"
    
    try:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return None
        
        # Extract from title: "BBAS3 - Banco Do Brasil - ..."
        match = re.search(r'<title>([^<]+)</title>', response.text)
        if match:
            title = match.group(1)
            parts = title.split(' - ')
            if len(parts) >= 2:
                return parts[1].strip()
            
        return None
    except Exception as e:
        logger.error(f"Error getting company name for {ticker}: {e}")
        return None


async def scrape_stock_data(ticker: str) -> StockData:
    """Scrape stock data from investidor10.com.br using their API"""
    ticker = ticker.upper().strip()
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': f'https://investidor10.com.br/acoes/{ticker.lower()}/',
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            # Initialize result
            result = StockData(ticker=ticker)
            
            # First, get the ticker ID from the main page
            page_url = f"https://investidor10.com.br/acoes/{ticker.lower()}/"
            page_response = await client.get(page_url, headers=headers)
            
            if page_response.status_code == 404:
                return StockData(ticker=ticker, error=f"Ação {ticker} não encontrada")
            
            if page_response.status_code != 200:
                return StockData(ticker=ticker, error=f"Erro ao buscar dados: HTTP {page_response.status_code}")
            
            page_text = page_response.text
            
            # Get ticker ID
            ticker_id = None
            match = re.search(r'tickerId["\']?\s*[:=]\s*["\']?(\d+)', page_text, re.IGNORECASE)
            if match:
                ticker_id = int(match.group(1))
            else:
                match = re.search(r'api/historico-indicadores/(\d+)/', page_text)
                if match:
                    ticker_id = int(match.group(1))
            
            if not ticker_id:
                return StockData(ticker=ticker, error="Não foi possível identificar a ação")
            
            # Get company name from title
            match = re.search(r'<title>([^<]+)</title>', page_text)
            if match:
                title = match.group(1)
                parts = title.split(' - ')
                if len(parts) >= 2:
                    result.nome_empresa = parts[1].strip()
            
            # Get current price from the live quotation API
            try:
                cotacao_url = f"https://investidor10.com.br/api/cotacao/ticker/{ticker_id}"
                cotacao_response = await client.get(cotacao_url, headers={**headers, 'Accept': 'application/json, */*'})
                if cotacao_response.status_code == 200:
                    cotacao_data = cotacao_response.json()
                    if 'price' in cotacao_data and cotacao_data['price'] is not None:
                        result.preco_atual = float(cotacao_data['price'])
                        logger.info(f"Preço atual atualizado via API: R$ {result.preco_atual} (última atualização: {cotacao_data.get('last_update', 'N/A')})")
            except Exception as e:
                logger.warning(f"Erro ao buscar preço via API de cotação: {e}")
            
            # Now get the indicators from the API
            api_url = f"https://investidor10.com.br/api/historico-indicadores/{ticker_id}/10?v=2"
            api_response = await client.get(api_url, headers=headers)
            
            if api_response.status_code == 200:
                try:
                    data = api_response.json()
                    
                    # Extract LPA
                    if 'LPA' in data and isinstance(data['LPA'], list) and len(data['LPA']) > 0:
                        atual = data['LPA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            result.lpa = float(atual['value']) if atual['value'] != '-' else None
                    
                    # Extract VPA
                    if 'VPA' in data and isinstance(data['VPA'], list) and len(data['VPA']) > 0:
                        atual = data['VPA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            result.vpa = float(atual['value']) if atual['value'] != '-' else None
                    
                    # Extract ROE
                    if 'ROE' in data and isinstance(data['ROE'], list) and len(data['ROE']) > 0:
                        atual = data['ROE'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            result.roe = float(atual['value']) if atual['value'] != '-' else None
                    
                    # Extract Dividend Yield
                    if 'DIVIDEND YIELD (DY)' in data and isinstance(data['DIVIDEND YIELD (DY)'], list) and len(data['DIVIDEND YIELD (DY)']) > 0:
                        atual = data['DIVIDEND YIELD (DY)'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            result.dividend_yield = float(atual['value']) if atual['value'] != '-' else None
                    
                    # Extract DÍVIDA LÍQUIDA / EBITDA (correct field name)
                    if 'DÍVIDA LÍQUIDA / EBITDA' in data and isinstance(data['DÍVIDA LÍQUIDA / EBITDA'], list) and len(data['DÍVIDA LÍQUIDA / EBITDA']) > 0:
                        atual = data['DÍVIDA LÍQUIDA / EBITDA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None and atual['value'] != '-':
                            try:
                                result.div_liquida_ebitda = float(atual['value'])
                            except (ValueError, TypeError):
                                pass
                    
                    # Extract DÍVIDA LÍQUIDA em R$ milhões (NOVO)
                    if 'DÍVIDA LÍQUIDA' in data and isinstance(data['DÍVIDA LÍQUIDA'], list) and len(data['DÍVIDA LÍQUIDA']) > 0:
                        atual = data['DÍVIDA LÍQUIDA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None and atual['value'] != '-':
                            try:
                                result.divida_liquida = float(atual['value'])
                            except (ValueError, TypeError):
                                pass
                    
                    # Extract MARGEM LÍQUIDA
                    if 'MARGEM LÍQUIDA' in data and isinstance(data['MARGEM LÍQUIDA'], list) and len(data['MARGEM LÍQUIDA']) > 0:
                        atual = data['MARGEM LÍQUIDA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            try:
                                result.margem_liquida = float(atual['value']) if atual['value'] != '-' else None
                            except (ValueError, TypeError):
                                pass
                    
                    # Extract MARGEM EBITDA
                    if 'MARGEM EBITDA' in data and isinstance(data['MARGEM EBITDA'], list) and len(data['MARGEM EBITDA']) > 0:
                        atual = data['MARGEM EBITDA'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            try:
                                result.margem_ebitda = float(atual['value']) if atual['value'] != '-' else None
                            except (ValueError, TypeError):
                                pass
                    
                    # Extract P/L atual e histórico
                    if 'P/L' in data and isinstance(data['P/L'], list) and len(data['P/L']) > 0:
                        # P/L atual
                        atual = data['P/L'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None:
                            try:
                                result.pl_atual = float(atual['value']) if atual['value'] != '-' else None
                            except (ValueError, TypeError):
                                pass
                        
                        # P/L histórico (pegar os últimos 4 anos para média)
                        pl_valores = []
                        for item in data['P/L'][1:5]:  # Pular "Atual", pegar próximos 4 anos
                            if item.get('value') is not None and item['value'] != '-':
                                try:
                                    val = float(item['value'])
                                    if val > 0:  # Só considera P/L positivos para média
                                        pl_valores.append(round(val, 2))
                                except (ValueError, TypeError):
                                    pass
                        
                        if pl_valores:
                            result.pl_historico_valores = pl_valores
                            result.pl_historico_media = round(sum(pl_valores) / len(pl_valores), 2)
                    
                    # Extract CAGR RECEITAS 5 ANOS (NOVO)
                    if 'CAGR RECEITAS 5 ANOS' in data and isinstance(data['CAGR RECEITAS 5 ANOS'], list) and len(data['CAGR RECEITAS 5 ANOS']) > 0:
                        atual = data['CAGR RECEITAS 5 ANOS'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None and atual['value'] != '-':
                            try:
                                result.cagr_receitas_5a = float(atual['value'])
                            except (ValueError, TypeError):
                                pass
                    
                    # Extract CAGR LUCROS 5 ANOS (NOVO)
                    if 'CAGR LUCROS 5 ANOS' in data and isinstance(data['CAGR LUCROS 5 ANOS'], list) and len(data['CAGR LUCROS 5 ANOS']) > 0:
                        atual = data['CAGR LUCROS 5 ANOS'][0]
                        if atual.get('year') == 'Atual' and atual.get('value') is not None and atual['value'] != '-':
                            try:
                                result.cagr_lucros_5a = float(atual['value'])
                            except (ValueError, TypeError):
                                pass
                    
                except Exception as e:
                    logger.warning(f"Error parsing API response for {ticker}: {e}")
            
            # Detectar se é banco/instituição financeira (NOVO)
            # Bancos geralmente têm: Dív.Líq/EBITDA = 0 ou não aplicável, ou o nome contém "banco", "bank", "financeiro"
            if result.nome_empresa:
                nome_lower = result.nome_empresa.lower()
                bancos_keywords = ['banco', 'bank', 'banc', 'financeira', 'financeiro', 'seguradora', 'seguro', 'corretora', 'btg', 'itaú', 'bradesco', 'santander', 'bb seg']
                result.is_banco = any(keyword in nome_lower for keyword in bancos_keywords)
                
                # Para bancos, Dív.Líq/EBITDA não se aplica - definir como 0
                if result.is_banco and result.div_liquida_ebitda is None:
                    result.div_liquida_ebitda = 0.0
            
            # Extract Rentabilidade Real Média Mensal from page text
            # Pattern: rentabilidade real ... 1 mês X% ... 3 meses X% ... 1 ano X% ... 2 anos X% ... 5 anos X%
            try:
                rent_pattern = r'rentabilidade\s*real[^%]*?1\s*m[eê]s[^%]*?([-]?\d+[,.]?\d*)\s*%[^%]*?3\s*meses[^%]*?([-]?\d+[,.]?\d*)\s*%[^%]*?1\s*ano[^%]*?([-]?\d+[,.]?\d*)\s*%[^%]*?2\s*anos[^%]*?([-]?\d+[,.]?\d*)\s*%[^%]*?5\s*anos[^%]*?([-]?\d+[,.]?\d*)\s*%'
                rent_match = re.search(rent_pattern, page_text, re.IGNORECASE | re.DOTALL)
                
                if rent_match:
                    # Parse Brazilian number format
                    def parse_br_number(val):
                        return float(val.replace('.', '').replace(',', '.'))
                    
                    r1m = parse_br_number(rent_match.group(1))  # 1 month
                    r3m = parse_br_number(rent_match.group(2))  # 3 months
                    r1a = parse_br_number(rent_match.group(3))  # 1 year
                    r2a = parse_br_number(rent_match.group(4))  # 2 years
                    r5a = parse_br_number(rent_match.group(5))  # 5 years
                    
                    # Convert to monthly equivalent and calculate average
                    monthly_1m = r1m / 1
                    monthly_3m = r3m / 3
                    monthly_1a = r1a / 12
                    monthly_2a = r2a / 24
                    monthly_5a = r5a / 60
                    
                    # Average of monthly returns
                    avg_monthly = (monthly_1m + monthly_3m + monthly_1a + monthly_2a + monthly_5a) / 5
                    result.rentabilidade_real_media = round(avg_monthly, 2)
                    
            except Exception as e:
                logger.warning(f"Error extracting rentabilidade real for {ticker}: {e}")
            
            # Calcular Earning Yield: (LPA / Preço Atual) * 100
            if result.lpa is not None and result.preco_atual is not None and result.preco_atual > 0:
                result.earning_yield = round((result.lpa / result.preco_atual) * 100, 2)
            
            # Log what we found
            logger.info(f"Scraped {ticker}: LPA={result.lpa}, VPA={result.vpa}, ROE={result.roe}, DY={result.dividend_yield}, Preço={result.preco_atual}, EY={result.earning_yield}, DívLíq={result.divida_liquida}, CAGR_Rec={result.cagr_receitas_5a}, CAGR_Luc={result.cagr_lucros_5a}, isBanco={result.is_banco}")
            
            return result
            
    except httpx.TimeoutException:
        return StockData(ticker=ticker, error="Tempo limite excedido ao buscar dados")
    except httpx.RequestError as e:
        return StockData(ticker=ticker, error=f"Erro de conexão: {str(e)}")
    except Exception as e:
        logger.error(f"Error scraping stock data for {ticker}: {str(e)}")
        return StockData(ticker=ticker, error=f"Erro ao processar dados: {str(e)}")


@api_router.get("/stock/{ticker}", response_model=StockData)
async def get_stock_data(ticker: str):
    """
    Busca dados de uma ação do site investidor10.com.br
    
    Retorna: LPA, VPA, Dividend Yield, ROE, Dívida Líquida/EBITDA, Preço Atual
    """
    if not ticker or len(ticker) < 4:
        raise HTTPException(status_code=400, detail="Código da ação inválido")
    
    result = await scrape_stock_data(ticker)
    
    if result.error:
        logger.warning(f"Error fetching stock {ticker}: {result.error}")
    else:
        logger.info(f"Successfully fetched stock data for {ticker}")
    
    return result


# ===== ENDPOINTS DE RECOMENDAÇÕES =====

class RecommendedStockResponse(BaseModel):
    """Modelo de resposta para ação recomendada"""
    ticker: str
    nome_empresa: Optional[str] = None
    setor: Optional[str] = None
    preco_atual: Optional[float] = None
    lpa: Optional[float] = None
    vpa: Optional[float] = None
    dividend_yield: Optional[float] = None
    roe: Optional[float] = None
    div_liquida_ebitda: Optional[float] = None
    divida_liquida: Optional[float] = None
    earning_yield: Optional[float] = None
    cagr_receitas_5a: Optional[float] = None  # CAGR Receitas 5 anos
    cagr_lucros_5a: Optional[float] = None  # CAGR Lucros 5 anos
    is_banco: Optional[bool] = None  # Se é instituição financeira
    pl_atual: Optional[float] = None
    pl_historico_media: Optional[float] = None
    margem_liquida: Optional[float] = None
    margem_ebitda: Optional[float] = None
    score: int
    status: str
    preco_justo: Optional[float] = None
    pl: Optional[float] = None
    pvp: Optional[float] = None
    graham_multiplier: Optional[float] = None
    desconto_preco_justo: Optional[float] = None
    ultima_atualizacao: str
    dados_completos: bool
    ranking_position: Optional[int] = None
    ranking_points: Optional[int] = None
    ranking_details: Optional[Dict[str, int]] = None


class AnalysisStatusResponse(BaseModel):
    """Modelo de resposta para status da análise"""
    is_running: bool
    progress: int
    total: int
    current_ticker: Optional[str] = None
    last_update: Optional[str] = None
    last_error: Optional[str] = None
    total_stocks_analyzed: int


@api_router.get("/recommendations", response_model=List[RecommendedStockResponse])
async def get_recommendations(
    limit: int = 20,
    min_score: int = 0,
    setor: Optional[str] = None,
    analysis_type: str = "market_cap"  # NOVO: market_cap ou revenue
):
    """
    Retorna as ações recomendadas usando RANKING MULTI-CRITÉRIO
    
    Sistema de Ranking:
    - Cada ação é rankeada em 10 critérios individuais
    - A ação que ganhar em MAIS critérios = melhor posição
    - Critérios: ROE, DY, Margem Líq, Margem EBITDA, Earning Yield, P/L, P/VP, 
                 Dív/EBITDA, Dívida Líquida, Desconto vs Preço Justo
    
    Args:
        limit: Número máximo de ações a retornar (padrão: 20)
        min_score: Score mínimo Graham para filtrar (padrão: 0)
        setor: Filtrar por setor específico (opcional)
        analysis_type: "market_cap" ou "revenue" (padrão: market_cap)
    """
    try:
        # Construir filtro
        filter_query = {
            "score": {"$gte": min_score},
            "analysis_type": analysis_type  # NOVO: filtrar por tipo
        }
        if setor:
            filter_query["setor"] = setor
        
        # Buscar TODAS as ações do MongoDB (sem limite inicial)
        cursor = db.recommended_stocks.find(
            filter_query,
            {"_id": 0}  # Excluir campo _id do MongoDB
        )
        
        all_stocks = await cursor.to_list(length=None)
        
        if not all_stocks:
            logger.warning(f"No stocks found in database for type {analysis_type}")
            return []
        
        # Aplicar RANKING MULTI-CRITÉRIO
        ranked_stocks = calculate_multi_criteria_ranking(all_stocks)
        
        # Retornar apenas o limite solicitado
        final_stocks = ranked_stocks[:limit]
        
        logger.info(f"Returning {len(final_stocks)} recommendations (type: {analysis_type}, ranked by multi-criteria)")
        
        return final_stocks
        
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar recomendações: {str(e)}")


@api_router.get("/recommendations/status", response_model=AnalysisStatusResponse)
async def get_analysis_status():
    """
    Retorna o status da análise atual (em execução ou última execução)
    """
    try:
        # Contar total de ações analisadas no banco
        total_analyzed = await db.recommended_stocks.count_documents({})
        
        return {
            "is_running": analysis_state["is_running"],
            "progress": analysis_state["progress"],
            "total": analysis_state["total"],
            "current_ticker": analysis_state["current_ticker"],
            "last_update": analysis_state["last_update"].isoformat() if analysis_state["last_update"] else None,
            "last_error": analysis_state["last_error"],
            "total_stocks_analyzed": total_analyzed
        }
        
    except Exception as e:
        logger.error(f"Error fetching analysis status: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar status: {str(e)}")


@api_router.post("/recommendations/analyze")
async def start_analysis(background_tasks: BackgroundTasks, analysis_type: str = "market_cap"):
    """
    Inicia análise manual de 18 ações da B3 por diferentes critérios
    Processo executado em background
    
    Args:
        analysis_type: Tipo de ranking:
            - "market_cap": Maior Valor de Mercado
            - "revenue": Maiores Receitas
            - "margin": Maiores Margens Líquidas
            - "popular": As Mais Queridas
            - "no_loss": Nunca Tiveram Prejuízo
    """
    try:
        # Verificar se já existe uma análise em execução
        if analysis_state["is_running"]:
            return {
                "message": "Análise já em execução",
                "progress": analysis_state["progress"],
                "total": analysis_state["total"]
            }
        
        # Mapeamento de tipos para labels
        type_labels = {
            "market_cap": "Valor de Mercado",
            "revenue": "Receita",
            "margin": "Margem Líquida",
            "popular": "Mais Queridas",
            "no_loss": "Sem Prejuízo"
        }
        
        # Iniciar análise em background
        background_tasks.add_task(analyze_all_stocks, db, scrape_stock_data, analysis_type)
        
        type_label = type_labels.get(analysis_type, "Valor de Mercado")
        logger.info(f"Manual analysis started (type: {type_label})")
        
        return {
            "message": f"Análise iniciada com sucesso (Top 18 por {type_label})",
            "status": "running",
            "type": analysis_type
        }
        
    except Exception as e:
        logger.error(f"Error starting analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar análise: {str(e)}")


@api_router.get("/recommendations/setores")
async def get_available_sectors():
    """
    Retorna lista de setores disponíveis nas ações analisadas
    """
    try:
        # Buscar setores distintos
        setores = await db.recommended_stocks.distinct("setor")
        
        # Filtrar valores None/null
        setores = [s for s in setores if s]
        
        return {"setores": sorted(setores)}
        
    except Exception as e:
        logger.error(f"Error fetching sectors: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar setores: {str(e)}")


# ========== ANÁLISE EM LOTE ==========

class BatchAnalysisRequest(BaseModel):
    """Modelo para requisição de análise em lote"""
    tickers: List[str]


class BatchAnalysisResult(BaseModel):
    """Modelo para resultado de uma ação na análise em lote"""
    ticker: str
    nome_empresa: Optional[str] = None
    setor: Optional[str] = None
    preco_atual: Optional[float] = None
    preco_justo: Optional[float] = None
    pl_atual: Optional[float] = None
    pl_historico_media: Optional[float] = None
    pvp: Optional[float] = None
    roe: Optional[float] = None
    dividend_yield: Optional[float] = None
    margem_liquida: Optional[float] = None
    margem_ebitda: Optional[float] = None
    div_liquida_ebitda: Optional[float] = None
    earning_yield: Optional[float] = None
    cagr_receitas_5a: Optional[float] = None
    cagr_lucros_5a: Optional[float] = None
    score: int = 0
    status: str = "neutro"


class BatchAnalysisResponse(BaseModel):
    """Modelo de resposta para análise em lote"""
    results: List[BatchAnalysisResult]
    errors: List[Dict[str, str]]
    total_analyzed: int
    total_errors: int


@api_router.post("/batch-analysis", response_model=BatchAnalysisResponse)
async def analyze_batch(request: BatchAnalysisRequest):
    """
    Analisa uma lista de ações fornecidas pelo usuário e retorna o ranking
    
    Args:
        request: Lista de tickers para analisar
    
    Returns:
        Lista de ações analisadas ordenadas por score + lista de erros
    """
    results = []
    errors = []
    
    for ticker in request.tickers:
        ticker = ticker.strip().upper()
        if not ticker:
            continue
            
        try:
            # Buscar dados da ação
            stock_data = await scrape_stock_data(ticker)
            
            if stock_data.error:
                errors.append({"ticker": ticker, "error": stock_data.error})
                continue
            
            # Preparar dados para cálculo do score
            data = {
                'ticker': ticker,
                'preco_atual': stock_data.preco_atual,
                'lpa': stock_data.lpa,
                'vpa': stock_data.vpa,
                'dividend_yield': stock_data.dividend_yield,
                'roe': stock_data.roe,
                'div_liquida_ebitda': stock_data.div_liquida_ebitda,
                'margem_liquida': stock_data.margem_liquida,
                'margem_ebitda': stock_data.margem_ebitda,
                'pl_atual': stock_data.pl_atual,
                'pl_historico_media': stock_data.pl_historico_media,
                'earning_yield': stock_data.earning_yield,
                'divida_liquida': stock_data.divida_liquida,
                'cagr_receitas_5a': stock_data.cagr_receitas_5a,
                'cagr_lucros_5a': stock_data.cagr_lucros_5a,
                'is_banco': stock_data.is_banco,
                'rentabilidade_real_media': stock_data.rentabilidade_real_media
            }
            
            # Calcular score usando a mesma função do sistema de recomendações
            score_result = calculate_graham_score(data)
            
            # Calcular P/VP e preço justo
            pvp = None
            preco_justo = None
            if stock_data.preco_atual and stock_data.vpa and stock_data.vpa > 0:
                pvp = stock_data.preco_atual / stock_data.vpa
            if stock_data.lpa and stock_data.vpa and stock_data.lpa > 0 and stock_data.vpa > 0:
                preco_justo = (22.5 * stock_data.lpa * stock_data.vpa) ** 0.5
            
            # Criar resultado
            result = BatchAnalysisResult(
                ticker=ticker,
                nome_empresa=stock_data.nome_empresa,
                setor=stock_data.setor,
                preco_atual=stock_data.preco_atual,
                preco_justo=preco_justo,
                pl_atual=stock_data.pl_atual,
                pl_historico_media=stock_data.pl_historico_media,
                pvp=pvp,
                roe=stock_data.roe,
                dividend_yield=stock_data.dividend_yield,
                margem_liquida=stock_data.margem_liquida,
                margem_ebitda=stock_data.margem_ebitda,
                div_liquida_ebitda=stock_data.div_liquida_ebitda,
                earning_yield=stock_data.earning_yield,
                cagr_receitas_5a=stock_data.cagr_receitas_5a,
                cagr_lucros_5a=stock_data.cagr_lucros_5a,
                score=score_result.get('score', 0),
                status=score_result.get('status', 'neutro')
            )
            
            results.append(result)
            
        except Exception as e:
            logger.error(f"Error analyzing {ticker}: {e}")
            errors.append({"ticker": ticker, "error": str(e)})
    
    # Ordenar por score (maior primeiro)
    results.sort(key=lambda x: x.score, reverse=True)
    
    return BatchAnalysisResponse(
        results=results,
        errors=errors,
        total_analyzed=len(results),
        total_errors=len(errors)
    )


# ========== INTEGRAÇÃO COM GITHUB ==========
from github_service import (
    exchange_code_for_token,
    get_github_user,
    GitHubService,
    GITHUB_CLIENT_ID
)

# Armazenamento de sessões GitHub (em produção, use Redis ou banco de dados)
github_sessions: Dict[str, Dict] = {}


class GitHubCallbackRequest(BaseModel):
    """Modelo para requisição de callback do GitHub"""
    code: str


class GitHubCreateRepoRequest(BaseModel):
    """Modelo para criação de repositório"""
    name: str
    description: Optional[str] = None
    private: bool = False


class GitHubPushFileRequest(BaseModel):
    """Modelo para envio de arquivo"""
    repo_name: str
    file_path: str
    content: str
    commit_message: str
    branch: Optional[str] = None


class GitHubPushMultipleFilesRequest(BaseModel):
    """Modelo para envio de múltiplos arquivos"""
    repo_name: str
    files: List[Dict[str, str]]  # [{"path": "...", "content": "..."}]
    commit_message: str
    branch: Optional[str] = None


@api_router.get("/github/client-id")
async def get_github_client_id():
    """Retorna o Client ID do GitHub para o frontend"""
    return {"client_id": GITHUB_CLIENT_ID}


@api_router.post("/github/callback")
async def github_oauth_callback(request: GitHubCallbackRequest):
    """
    Callback do OAuth do GitHub
    Troca o código por token de acesso e retorna informações do usuário
    """
    try:
        # Trocar código por token
        token_response = await exchange_code_for_token(request.code)
        
        if "error" in token_response:
            raise HTTPException(
                status_code=401,
                detail=f"Erro OAuth: {token_response.get('error_description', token_response.get('error'))}"
            )
        
        access_token = token_response.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Token não recebido do GitHub")
        
        # Obter informações do usuário
        user_info = await get_github_user(access_token)
        
        # Gerar ID de sessão
        session_id = str(uuid.uuid4())
        
        # Armazenar sessão
        github_sessions[session_id] = {
            "access_token": access_token,
            "user_id": user_info["id"],
            "login": user_info["login"],
            "created_at": datetime.now(timezone.utc)
        }
        
        return {
            "success": True,
            "session_id": session_id,
            "user": {
                "id": user_info["id"],
                "login": user_info["login"],
                "name": user_info.get("name"),
                "avatar_url": user_info.get("avatar_url")
            }
        }
        
    except httpx.HTTPError as e:
        logger.error(f"Erro de comunicação com GitHub: {e}")
        raise HTTPException(status_code=502, detail="Falha na comunicação com GitHub")
    except Exception as e:
        logger.error(f"Erro no callback do GitHub: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/github/user")
async def get_github_user_info(session_id: str):
    """Retorna informações do usuário GitHub autenticado"""
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        service = GitHubService(session["access_token"])
        return service.get_user_info()
    except Exception as e:
        logger.error(f"Erro ao obter usuário: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/github/repositories")
async def list_github_repositories(session_id: str):
    """Lista repositórios do usuário"""
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        service = GitHubService(session["access_token"])
        return service.list_repositories()
    except Exception as e:
        logger.error(f"Erro ao listar repositórios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/github/repositories")
async def create_github_repository(request: GitHubCreateRepoRequest, session_id: str):
    """Cria um novo repositório"""
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        service = GitHubService(session["access_token"])
        result = service.create_repository(
            name=request.name,
            description=request.description,
            private=request.private
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar repositório: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/github/push")
async def push_to_github(request: GitHubPushFileRequest, session_id: str):
    """Envia um arquivo para o repositório"""
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        service = GitHubService(session["access_token"])
        result = service.push_file(
            repo_name=request.repo_name,
            file_path=request.file_path,
            content=request.content,
            commit_message=request.commit_message,
            branch=request.branch
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao enviar arquivo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/github/push-multiple")
async def push_multiple_to_github(request: GitHubPushMultipleFilesRequest, session_id: str):
    """Envia múltiplos arquivos para o repositório"""
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        service = GitHubService(session["access_token"])
        result = service.push_multiple_files(
            repo_name=request.repo_name,
            files=request.files,
            commit_message=request.commit_message,
            branch=request.branch
        )
        
        return result
    except Exception as e:
        logger.error(f"Erro ao enviar arquivos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/github/logout")
async def github_logout(session_id: str):
    """Encerra a sessão do GitHub"""
    if session_id in github_sessions:
        del github_sessions[session_id]
    return {"success": True, "message": "Sessão encerrada"}


class GitHubPushProjectRequest(BaseModel):
    """Modelo para envio do projeto completo"""
    repo_name: str
    commit_message: str = "Atualização via Help Invest"
    branch: Optional[str] = None


def get_project_files() -> List[Dict[str, str]]:
    """
    Lê todos os arquivos do projeto para enviar ao GitHub
    Exclui arquivos de sistema, cache, node_modules, etc.
    """
    import os
    import base64
    
    project_root = "/app"
    files = []
    
    # Diretórios e arquivos a ignorar
    ignore_dirs = {
        'node_modules', '__pycache__', '.git', '.emergent', 'venv', '.venv',
        'dist', 'build', '.next', 'coverage', '.pytest_cache', '.mypy_cache',
        'logs', 'tmp', 'temp', '.cache', 'memory'
    }
    
    ignore_files = {
        '.DS_Store', 'Thumbs.db', '.env.local', '.env.development.local',
        '.env.test.local', '.env.production.local', '*.pyc', '*.pyo',
        '*.log', '*.lock', 'yarn.lock', 'package-lock.json'
    }
    
    # Extensões binárias (não enviar)
    binary_extensions = {
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
        '.mp3', '.mp4', '.wav', '.avi', '.mov',
        '.zip', '.tar', '.gz', '.rar', '.7z',
        '.exe', '.dll', '.so', '.dylib',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.ttf', '.woff', '.woff2', '.eot', '.otf'
    }
    
    for root, dirs, filenames in os.walk(project_root):
        # Filtrar diretórios ignorados
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
        
        for filename in filenames:
            # Ignorar arquivos específicos
            if filename in ignore_files or filename.startswith('.'):
                continue
            
            # Ignorar extensões binárias
            ext = os.path.splitext(filename)[1].lower()
            if ext in binary_extensions:
                continue
            
            # Ignorar padrões com wildcard
            if any(filename.endswith(pattern.replace('*', '')) for pattern in ignore_files if '*' in pattern):
                continue
            
            filepath = os.path.join(root, filename)
            relative_path = os.path.relpath(filepath, project_root)
            
            try:
                # Tentar ler como texto
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                files.append({
                    "path": relative_path,
                    "content": content
                })
            except (UnicodeDecodeError, IOError):
                # Arquivo binário ou não legível, pular
                continue
    
    return files


@api_router.post("/github/push-project")
async def push_entire_project(request: GitHubPushProjectRequest, session_id: str):
    """
    Envia TODOS os arquivos do projeto para o repositório GitHub
    Similar ao "Save to GitHub" da plataforma Emergent
    """
    session = github_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessão não encontrada")
    
    try:
        logger.info(f"Iniciando push do projeto completo para {request.repo_name}")
        
        # Obter todos os arquivos do projeto
        files = get_project_files()
        logger.info(f"Encontrados {len(files)} arquivos para enviar")
        
        if not files:
            raise HTTPException(status_code=400, detail="Nenhum arquivo encontrado no projeto")
        
        service = GitHubService(session["access_token"])
        
        # Enviar arquivos em lotes para evitar rate limiting
        batch_size = 5
        total_success = 0
        total_errors = []
        
        for i in range(0, len(files), batch_size):
            batch = files[i:i + batch_size]
            
            for file_info in batch:
                try:
                    result = service.push_file(
                        repo_name=request.repo_name,
                        file_path=file_info["path"],
                        content=file_info["content"],
                        commit_message=f"{request.commit_message} - {file_info['path']}",
                        branch=request.branch
                    )
                    
                    if result["success"]:
                        total_success += 1
                        logger.info(f"✓ Enviado: {file_info['path']}")
                    else:
                        total_errors.append({"path": file_info["path"], "error": result.get("error", "Unknown error")})
                        logger.warning(f"✗ Erro em {file_info['path']}: {result.get('error')}")
                        
                except Exception as e:
                    total_errors.append({"path": file_info["path"], "error": str(e)})
                    logger.error(f"✗ Exceção em {file_info['path']}: {e}")
            
            # Pequena pausa entre lotes para evitar rate limiting
            import asyncio
            await asyncio.sleep(0.5)
        
        logger.info(f"Push concluído: {total_success} sucesso, {len(total_errors)} erros")
        
        return {
            "success": len(total_errors) == 0,
            "total_files": len(files),
            "files_pushed": total_success,
            "errors": total_errors[:10],  # Limitar erros retornados
            "message": f"Projeto enviado: {total_success}/{len(files)} arquivos"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao enviar projeto: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None

@app.on_event("startup")
async def startup_event():
    """Inicializa o scheduler quando o servidor inicia"""
    global scheduler
    try:
        scheduler = setup_scheduler(db, scrape_stock_data)
        scheduler.start()
        logger.info("✓ Scheduler started successfully - Daily analysis scheduled for 18:00 (Brasília time)")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Fecha conexões quando o servidor desliga"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
    client.close()
    logger.info("MongoDB connection closed")