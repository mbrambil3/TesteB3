"""
Sistema de Recomendações de Ações baseado no Método Graham
Análise automática das 20 maiores ações da B3 com agendamento diário às 18h
Sistema de RANKING MULTI-CRITÉRIO: a ação que ganhar em MAIS critérios = melhor recomendação
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import httpx
from bs4 import BeautifulSoup
import re
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

logger = logging.getLogger(__name__)

# Estado global do processo de análise
analysis_state = {
    "is_running": False,
    "progress": 0,
    "total": 0,
    "current_ticker": None,
    "last_update": None,
    "last_error": None,
    "start_time": None
}


def calculate_multi_criteria_ranking(stocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Calcula ranking baseado em MÚLTIPLOS CRITÉRIOS INDIVIDUAIS com PENALIZAÇÕES/BONIFICAÇÕES
    Sistema híbrido que combina:
    1. Posições relativas (ranking multi-critério)
    2. Valores absolutos ideais do Método Graham (bonificações/penalizações)
    
    Critérios avaliados (12 no total):
    1. ROE (maior → melhor) - Ideal ≥ 12%
    2. Dividend Yield (maior → melhor) - Ideal ≥ 6%
    3. Margem Líquida (maior → melhor) - Ideal ≥ 10%
    4. Margem EBITDA (maior → melhor) - Ideal ≥ 20%
    5. Earning Yield (maior → melhor) - Ideal ≥ 10% ✨
    6. P/L (menor → melhor) - Ideal: 5-10
    7. P/VP (menor → melhor) - Ideal ≤ 1.5
    8. Dív. Líq/EBITDA (menor → melhor) - Ideal ≤ 2x
    9. Dívida Líquida absoluta (menor → melhor) ✨
    10. Desconto vs Preço Justo (maior desconto → melhor) - Deve estar ABAIXO do justo
    11. CAGR Receitas 5a (maior → melhor) - Ideal > 10% ✨
    12. CAGR Lucros 5a (maior → melhor) - Ideal > 10% ✨
    
    Pontuação base: 1º lugar = N pontos, 2º = N-1... último = 1 ponto
    BONIFICAÇÃO: +50 pontos por critério no ideal
    PENALIZAÇÃO: -50 pontos por critério muito fora do ideal
    """
    
    if not stocks:
        return []
    
    # Filtrar ações com dados mínimos necessários
    valid_stocks = [s for s in stocks if s.get('preco_atual') and s.get('lpa') and s.get('vpa')]
    
    if not valid_stocks:
        return stocks  # Retornar sem ranking se não houver dados suficientes
    
    # Inicializar pontos e aplicar bonificações/penalizações por valores absolutos
    for stock in valid_stocks:
        stock['ranking_points'] = 0
        stock['ranking_details'] = {}
        stock['bonus_penalty'] = 0  # Rastrear ajustes
        
        # === BONIFICAÇÕES POR VALORES IDEAIS ===
        
        # ROE ≥ 12%
        if stock.get('roe') and stock['roe'] >= 12:
            stock['bonus_penalty'] += 50
        
        # Dividend Yield ≥ 6%
        if stock.get('dividend_yield') and stock['dividend_yield'] >= 6:
            stock['bonus_penalty'] += 50
        
        # Margem Líquida ≥ 10%
        if stock.get('margem_liquida') and stock['margem_liquida'] >= 10:
            stock['bonus_penalty'] += 50
        
        # Margem EBITDA ≥ 20%
        if stock.get('margem_ebitda') and stock['margem_ebitda'] >= 20:
            stock['bonus_penalty'] += 50
        
        # Earning Yield ≥ 10%
        if stock.get('earning_yield') and stock['earning_yield'] >= 10:
            stock['bonus_penalty'] += 50
        
        # P/VP ≤ 1.5 (ideal)
        if stock.get('pvp') and stock['pvp'] <= 1.5:
            stock['bonus_penalty'] += 50
        
        # Dív/EBITDA ≤ 2x
        if stock.get('div_liquida_ebitda') is not None and stock['div_liquida_ebitda'] <= 2.0:
            stock['bonus_penalty'] += 50
        
        # CAGR Receitas > 10%
        if stock.get('cagr_receitas_5a') and stock['cagr_receitas_5a'] > 10:
            stock['bonus_penalty'] += 50
        
        # CAGR Lucros > 10%
        if stock.get('cagr_lucros_5a') and stock['cagr_lucros_5a'] > 10:
            stock['bonus_penalty'] += 50
        
        # === PENALIZAÇÕES POR VALORES RUINS ===
        
        # CRÍTICO: Score Graham muito baixo (qualidade péssima)
        score = stock.get('score', 0)
        if score == 0:
            stock['bonus_penalty'] -= 500  # ELIMINATÓRIA: Score 0 = última posição
        elif score <= 20:
            stock['bonus_penalty'] -= 300  # Score péssimo
        elif score <= 35:
            stock['bonus_penalty'] -= 150  # Score negativo
        
        # CRÍTICO: Preço ACIMA do Preço Justo (não tem margem de segurança)
        if stock.get('preco_justo') and stock.get('preco_atual'):
            desconto_pct = ((stock['preco_justo'] - stock['preco_atual']) / stock['preco_justo']) * 100
            if desconto_pct < 0:  # Preço atual > Preço Justo
                # Penalização proporcional ao quanto está caro
                penalizacao = min(abs(desconto_pct) * 5, 200)  # Max 200 pontos de penalização
                stock['bonus_penalty'] -= penalizacao
        
        # P/VP > 2.5 (muito caro)
        if stock.get('pvp') and stock['pvp'] > 2.5:
            stock['bonus_penalty'] -= 100
        elif stock.get('pvp') and stock['pvp'] > 1.5:
            stock['bonus_penalty'] -= 30  # Penalização menor se estiver entre 1.5 e 2.5
        
        # Multiplicador Graham > 22.5 (sobrevalorizada)
        if stock.get('graham_multiplier') and stock['graham_multiplier'] > 22.5:
            stock['bonus_penalty'] -= 80
        
        # ROE < 12% (não eficiente)
        if stock.get('roe') and stock['roe'] < 12:
            stock['bonus_penalty'] -= 30
        
        # Earning Yield < 10% (retorno baixo)
        if stock.get('earning_yield') and stock['earning_yield'] < 10:
            stock['bonus_penalty'] -= 30
        
        # Dív/EBITDA > 3x (muito endividada)
        if stock.get('div_liquida_ebitda') is not None and stock['div_liquida_ebitda'] > 3.0:
            stock['bonus_penalty'] -= 50
    
    # CRITÉRIO 1: ROE (maior = melhor)
    roe_stocks = [s for s in valid_stocks if s.get('roe') is not None]
    roe_sorted = sorted(roe_stocks, key=lambda x: x['roe'], reverse=True)
    for i, stock in enumerate(roe_sorted):
        points = len(roe_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['roe_rank'] = i + 1
    
    # CRITÉRIO 2: Dividend Yield (maior = melhor)
    dy_stocks = [s for s in valid_stocks if s.get('dividend_yield') is not None]
    dy_sorted = sorted(dy_stocks, key=lambda x: x['dividend_yield'], reverse=True)
    for i, stock in enumerate(dy_sorted):
        points = len(dy_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['dy_rank'] = i + 1
    
    # CRITÉRIO 3: Margem Líquida (maior = melhor)
    ml_stocks = [s for s in valid_stocks if s.get('margem_liquida') is not None]
    ml_sorted = sorted(ml_stocks, key=lambda x: x['margem_liquida'], reverse=True)
    for i, stock in enumerate(ml_sorted):
        points = len(ml_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['margem_liquida_rank'] = i + 1
    
    # CRITÉRIO 4: Margem EBITDA (maior = melhor)
    me_stocks = [s for s in valid_stocks if s.get('margem_ebitda') is not None]
    me_sorted = sorted(me_stocks, key=lambda x: x['margem_ebitda'], reverse=True)
    for i, stock in enumerate(me_sorted):
        points = len(me_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['margem_ebitda_rank'] = i + 1
    
    # CRITÉRIO 5: Earning Yield (maior = melhor) ✨ NOVO
    ey_stocks = [s for s in valid_stocks if s.get('earning_yield') is not None]
    ey_sorted = sorted(ey_stocks, key=lambda x: x['earning_yield'], reverse=True)
    for i, stock in enumerate(ey_sorted):
        points = len(ey_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['earning_yield_rank'] = i + 1
    
    # CRITÉRIO 6: P/L (menor = melhor)
    pl_stocks = [s for s in valid_stocks if s.get('pl') is not None and s['pl'] > 0]
    pl_sorted = sorted(pl_stocks, key=lambda x: x['pl'])
    for i, stock in enumerate(pl_sorted):
        points = len(pl_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['pl_rank'] = i + 1
    
    # CRITÉRIO 7: P/VP (menor = melhor)
    pvp_stocks = [s for s in valid_stocks if s.get('pvp') is not None and s['pvp'] > 0]
    pvp_sorted = sorted(pvp_stocks, key=lambda x: x['pvp'])
    for i, stock in enumerate(pvp_sorted):
        points = len(pvp_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['pvp_rank'] = i + 1
    
    # CRITÉRIO 8: Dív. Líq/EBITDA (menor = melhor)
    diveb_stocks = [s for s in valid_stocks if s.get('div_liquida_ebitda') is not None]
    diveb_sorted = sorted(diveb_stocks, key=lambda x: x['div_liquida_ebitda'])
    for i, stock in enumerate(diveb_sorted):
        points = len(diveb_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['div_ebitda_rank'] = i + 1
    
    # CRITÉRIO 9: Dívida Líquida absoluta (menor = melhor) ✨ NOVO
    divliq_stocks = [s for s in valid_stocks if s.get('divida_liquida') is not None]
    divliq_sorted = sorted(divliq_stocks, key=lambda x: x['divida_liquida'])
    for i, stock in enumerate(divliq_sorted):
        points = len(divliq_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['divida_liquida_rank'] = i + 1
    
    # CRITÉRIO 10: Desconto vs Preço Justo (maior desconto = melhor)
    # Desconto % = ((Preço Justo - Preço Atual) / Preço Justo) * 100
    pj_stocks = [s for s in valid_stocks if s.get('preco_justo') and s['preco_justo'] > 0]
    for stock in pj_stocks:
        desconto = ((stock['preco_justo'] - stock['preco_atual']) / stock['preco_justo']) * 100
        stock['desconto_preco_justo'] = round(desconto, 2)
    
    pj_sorted = sorted(pj_stocks, key=lambda x: x.get('desconto_preco_justo', -999), reverse=True)
    for i, stock in enumerate(pj_sorted):
        points = len(pj_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['preco_justo_rank'] = i + 1
    
    # CRITÉRIO 11: CAGR Receitas 5a (maior = melhor) ✨ NOVO
    cagr_rec_stocks = [s for s in valid_stocks if s.get('cagr_receitas_5a') is not None]
    cagr_rec_sorted = sorted(cagr_rec_stocks, key=lambda x: x['cagr_receitas_5a'], reverse=True)
    for i, stock in enumerate(cagr_rec_sorted):
        points = len(cagr_rec_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['cagr_receitas_rank'] = i + 1
    
    # CRITÉRIO 12: CAGR Lucros 5a (maior = melhor) ✨ NOVO
    cagr_luc_stocks = [s for s in valid_stocks if s.get('cagr_lucros_5a') is not None]
    cagr_luc_sorted = sorted(cagr_luc_stocks, key=lambda x: x['cagr_lucros_5a'], reverse=True)
    for i, stock in enumerate(cagr_luc_sorted):
        points = len(cagr_luc_sorted) - i
        stock['ranking_points'] += points
        stock['ranking_details']['cagr_lucros_rank'] = i + 1
    
    # === APLICAR BONIFICAÇÕES E PENALIZAÇÕES ===
    for stock in valid_stocks:
        # Somar bônus/penalização à pontuação base
        stock['ranking_points'] += stock.get('bonus_penalty', 0)
        
        # GARANTIR: Ações com Score muito baixo ficam no final
        # Mesmo que tenham pontos de ranking, Score péssimo = última posição
        score = stock.get('score', 0)
        if score == 0:
            stock['ranking_points'] = min(stock['ranking_points'], -1000)  # Forçar para o final
        elif score <= 20:
            stock['ranking_points'] = min(stock['ranking_points'], 50)  # Limitar pontuação máxima
        elif score <= 35:
            stock['ranking_points'] = min(stock['ranking_points'], 200)  # Score negativo limitado
        
        # Converter para inteiro (arredondar)
        stock['ranking_points'] = int(round(stock['ranking_points']))
        
        # Garantir que não fique abaixo de -1000
        if stock['ranking_points'] < -1000:
            stock['ranking_points'] = -1000
    
    # Ordenar por pontos totais (incluindo bônus/penalizações)
    # Em caso de EMPATE, usar o SCORE como desempate (maior score = melhor)
    ranked_stocks = sorted(
        valid_stocks, 
        key=lambda x: (x['ranking_points'], x['score']),  # Ordena por pontos, depois por score
        reverse=True
    )
    
    # Adicionar posição geral no ranking
    for i, stock in enumerate(ranked_stocks):
        stock['ranking_position'] = i + 1
    
    logger.info(f"Multi-criteria ranking completed: Top 3 - {ranked_stocks[0]['ticker']} ({ranked_stocks[0]['ranking_points']} pts [bonus/penalty: {ranked_stocks[0].get('bonus_penalty', 0)}], score {ranked_stocks[0]['score']}), {ranked_stocks[1]['ticker']} ({ranked_stocks[1]['ranking_points']} pts [bonus/penalty: {ranked_stocks[1].get('bonus_penalty', 0)}], score {ranked_stocks[1]['score']}), {ranked_stocks[2]['ticker']} ({ranked_stocks[2]['ranking_points']} pts [bonus/penalty: {ranked_stocks[2].get('bonus_penalty', 0)}], score {ranked_stocks[2]['score']})")
    
    return ranked_stocks


def calculate_graham_score(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula o score de uma ação baseado no Método Graham
    CRITÉRIOS ATUALIZADOS:
    - ROE ideal: ≥ 12% (antes era 15%)
    - P/L vs Histórico: ideal entre 5-10% abaixo da média
    - Dív. Líquida/EBITDA: ideal < 3x (bancos = 0, não se aplica)
    - CAGR Receita e Lucro: ideal > 10%
    
    Args:
        data: Dicionário com os dados da ação (preco_atual, lpa, vpa, etc)
    
    Returns:
        Dict com score, status e detalhes da análise
    """
    try:
        # Extrair dados obrigatórios
        preco_atual = data.get('preco_atual')
        lpa = data.get('lpa')
        vpa = data.get('vpa')
        
        # Validar dados mínimos necessários
        if preco_atual is None or lpa is None or vpa is None:
            return {
                'score': 0,
                'status': 'negativo',
                'error': 'Dados insuficientes para análise'
            }
        
        # Extrair dados opcionais
        dividend_yield = data.get('dividend_yield')
        roe = data.get('roe')
        div_liquida_ebitda = data.get('div_liquida_ebitda')
        rentabilidade_real_media = data.get('rentabilidade_real_media')
        margem_liquida = data.get('margem_liquida')
        margem_ebitda = data.get('margem_ebitda')
        pl_atual = data.get('pl_atual')
        pl_historico_media = data.get('pl_historico_media')
        earning_yield = data.get('earning_yield')
        divida_liquida = data.get('divida_liquida')
        cagr_receitas_5a = data.get('cagr_receitas_5a')  # NOVO
        cagr_lucros_5a = data.get('cagr_lucros_5a')  # NOVO
        is_banco = data.get('is_banco', False)  # NOVO
        
        # Se Dív. Líquida/EBITDA for negativo, considerar como 0 (empresa com caixa líquido positivo)
        if div_liquida_ebitda is not None and div_liquida_ebitda < 0:
            div_liquida_ebitda = 0
        
        # Para bancos, Dív.Líq/EBITDA não se aplica
        if is_banco:
            div_liquida_ebitda = 0
        
        # Fórmula de Graham: √(22.5 × LPA × VPA)
        is_vpa_negativo = vpa < 0
        is_lpa_negativo = lpa < 0
        
        if is_vpa_negativo or is_lpa_negativo:
            preco_justo = 0
        else:
            preco_justo = (22.5 * abs(lpa) * abs(vpa)) ** 0.5
        
        # Calcular P/L e P/VP
        pl = preco_atual / lpa if lpa != 0 else 0
        pvp = preco_atual / vpa if vpa != 0 else 0
        
        # Multiplicador Graham: P/L × P/VP deve ser no máximo 22.5
        graham_multiplier = pl * pvp
        
        # Margem de segurança
        margem_seguranca = ((preco_justo - preco_atual) / preco_justo) * 100 if preco_justo > 0 else 0
        
        # ===== SISTEMA DE PONTUAÇÃO ATUALIZADO =====
        score = 0
        
        # ===== CRITÉRIOS FUNDAMENTAIS DE VALUATION (45 pontos) =====
        
        # 1. PREÇO VS PREÇO JUSTO GRAHAM (18 pontos)
        preco_justo_score = 0
        if is_lpa_negativo or is_vpa_negativo:
            preco_justo_score = 0
        elif preco_atual <= preco_justo * 0.7:
            preco_justo_score = 18
        elif preco_atual <= preco_justo:
            desconto = ((preco_justo - preco_atual) / preco_justo) * 100
            preco_justo_score = 10 + (desconto / 30) * 8
        elif preco_atual <= preco_justo * 1.2:
            excesso = ((preco_atual - preco_justo) / preco_justo) * 100
            preco_justo_score = 10 - (excesso / 20) * 6
        elif preco_atual <= preco_justo * 1.5:
            excesso = ((preco_atual - preco_justo) / preco_justo) * 100
            preco_justo_score = max(0, 4 - ((excesso - 20) / 30) * 4)
        else:
            preco_justo_score = 0
        score += preco_justo_score
        
        # 2. P/VP - PREÇO SOBRE VALOR PATRIMONIAL (12 pontos)
        pvp_score = 0
        if pvp <= 1:
            pvp_score = 12
        elif pvp <= 1.5:
            pvp_score = 8 + ((1.5 - pvp) / 0.5) * 4
        elif pvp <= 2.5:
            pvp_score = 4 + ((2.5 - pvp) / 1) * 4
        elif pvp <= 4:
            pvp_score = max(0, 4 - ((pvp - 2.5) / 1.5) * 4)
        else:
            pvp_score = 0
        score += pvp_score
        
        # 3. MULTIPLICADOR GRAHAM (12 pontos)
        graham_score = 0
        if graham_multiplier <= 0:
            graham_score = 0
        elif graham_multiplier <= 15:
            graham_score = 12
        elif graham_multiplier <= 22.5:
            graham_score = 8 + ((22.5 - graham_multiplier) / 7.5) * 4
        elif graham_multiplier <= 30:
            graham_score = 4 + ((30 - graham_multiplier) / 7.5) * 4
        elif graham_multiplier <= 45:
            graham_score = max(0, 4 - ((graham_multiplier - 30) / 15) * 4)
        else:
            graham_score = 0
        score += graham_score
        
        # 4. P/L ATUAL (10 pontos) - CRITÉRIO BASEADO NO VALOR ABSOLUTO
        # IDEAL: P/L entre 5-10 (favorável independentemente da média histórica)
        # IMPACTO GRADUAL: P/L acima de 10 começa impacto negativo progressivo
        pl_historico_score = 0
        is_pl_abaixo_media = None
        is_pl_ideal = None
        is_pl_favoravel = None
        if pl_atual is not None and pl_atual > 0:
            # Verificar se está abaixo da média (informativo)
            if pl_historico_media is not None and pl_historico_media > 0:
                is_pl_abaixo_media = pl_atual < pl_historico_media
            
            # CRITÉRIO PRINCIPAL: Valor absoluto do P/L
            if pl_atual < 3:
                # P/L muito baixo: pode indicar problemas ou ser oportunidade
                pl_historico_score = 6
                is_pl_ideal = False
                is_pl_favoravel = True
            elif pl_atual < 5:
                # P/L baixo: bom, mas verificar fundamentos
                pl_historico_score = 8
                is_pl_ideal = False
                is_pl_favoravel = True
            elif pl_atual <= 10:
                # P/L IDEAL: entre 5 e 10 - FAVORÁVEL
                pl_historico_score = 10
                is_pl_ideal = True
                is_pl_favoravel = True
            elif pl_atual <= 12:
                # P/L entre 10-12: levemente acima do ideal, impacto mínimo
                fator_penalizacao = (pl_atual - 10) / 2  # 0 a 1
                pl_historico_score = round(10 - (fator_penalizacao * 3))  # 10 a 7
                is_pl_ideal = False
                is_pl_favoravel = True
            elif pl_atual <= 15:
                # P/L entre 12-15: acima do ideal, impacto gradual pequeno
                fator_penalizacao = (pl_atual - 12) / 3  # 0 a 1
                pl_historico_score = round(7 - (fator_penalizacao * 3))  # 7 a 4
                is_pl_ideal = False
                is_pl_favoravel = False
            elif pl_atual <= 20:
                # P/L entre 15-20: elevado, impacto moderado
                fator_penalizacao = (pl_atual - 15) / 5  # 0 a 1
                pl_historico_score = round(4 - (fator_penalizacao * 3))  # 4 a 1
                is_pl_ideal = False
                is_pl_favoravel = False
            elif pl_atual <= 30:
                # P/L entre 20-30: alto
                pl_historico_score = 0
                is_pl_ideal = False
                is_pl_favoravel = False
            else:
                # P/L > 30: muito alto
                pl_historico_score = -3
                is_pl_ideal = False
                is_pl_favoravel = False
            score += pl_historico_score
        
        # 5. EARNING YIELD (6 pontos)
        earning_yield_score = 0
        is_earning_yield_positivo = None
        if earning_yield is not None:
            if earning_yield >= 15:
                earning_yield_score = 6
                is_earning_yield_positivo = True
            elif earning_yield >= 12:
                earning_yield_score = 5
                is_earning_yield_positivo = True
            elif earning_yield >= 10:
                earning_yield_score = 4
                is_earning_yield_positivo = True
            elif earning_yield >= 8:
                earning_yield_score = 3
                is_earning_yield_positivo = False
            elif earning_yield >= 5:
                earning_yield_score = 1
                is_earning_yield_positivo = False
            elif earning_yield > 0:
                earning_yield_score = 0
                is_earning_yield_positivo = False
            else:
                earning_yield_score = -4
                is_earning_yield_positivo = False
            score += earning_yield_score
        
        # ===== CRITÉRIOS DE QUALIDADE DA EMPRESA (45 pontos) =====
        
        # 6. ROE - RETORNO SOBRE PATRIMÔNIO (10 pontos) - CRITÉRIO ATUALIZADO
        # IDEAL: ≥ 12% (antes era 15%)
        roe_score = 0
        is_roe_positivo = None
        is_roe_ideal = None
        if roe is not None:
            if roe < 0:
                roe_score = -10
                is_roe_positivo = False
                is_roe_ideal = False
            elif roe >= 20:
                roe_score = 10
                is_roe_positivo = True
                is_roe_ideal = True
            elif roe >= 15:
                roe_score = 9
                is_roe_positivo = True
                is_roe_ideal = True
            elif roe >= 12:
                roe_score = 8  # NOVO IDEAL: ≥12% agora é considerado ideal
                is_roe_positivo = True
                is_roe_ideal = True
            elif roe >= 10:
                roe_score = 5
                is_roe_positivo = True
                is_roe_ideal = False
            elif roe >= 8:
                roe_score = 2
                is_roe_positivo = False
                is_roe_ideal = False
            elif roe >= 5:
                roe_score = 0
                is_roe_positivo = False
                is_roe_ideal = False
            else:
                roe_score = -3
                is_roe_positivo = False
                is_roe_ideal = False
            score += roe_score
        
        # 7. MARGEM LÍQUIDA (7 pontos) - ATUALIZADO COM PONTUAÇÃO GRADUAL
        # Ideal: ≥ 10%, mas valores próximos (8-10%) têm impacto mínimo
        margem_liquida_score = 0
        is_margem_liquida_positivo = None
        is_margem_liquida_proximo_ideal = None
        if margem_liquida is not None:
            if margem_liquida >= 20:
                margem_liquida_score = 7
                is_margem_liquida_positivo = True
                is_margem_liquida_proximo_ideal = False
            elif margem_liquida >= 15:
                margem_liquida_score = 5
                is_margem_liquida_positivo = True
                is_margem_liquida_proximo_ideal = False
            elif margem_liquida >= 10:
                margem_liquida_score = 3
                is_margem_liquida_positivo = True
                is_margem_liquida_proximo_ideal = False
            elif margem_liquida >= 8:
                # Faixa de "quase ideal" (8-10%) - pontuação gradual
                proximidade_ideal = (margem_liquida - 8) / 2  # 0 a 1
                margem_liquida_score = 1 + (proximidade_ideal * 2)  # 1 a 3 pontos
                is_margem_liquida_positivo = True
                is_margem_liquida_proximo_ideal = True
            elif margem_liquida >= 5:
                # Abaixo do ideal - sem pontos
                margem_liquida_score = 0
                is_margem_liquida_positivo = False
                is_margem_liquida_proximo_ideal = False
            elif margem_liquida >= 0:
                # Muito abaixo - penalização
                margem_liquida_score = -4
                is_margem_liquida_positivo = False
                is_margem_liquida_proximo_ideal = False
            else:
                # Negativa: prejuízo - penalização severa
                margem_liquida_score = -8
                is_margem_liquida_positivo = False
                is_margem_liquida_proximo_ideal = False
            score += margem_liquida_score
        
        # 8. MARGEM EBITDA (6 pontos) - PENALIZAÇÃO GRADUAL
        # Ideal: ≥ 20%, penalização para valores muito abaixo
        margem_ebitda_score = 0
        is_margem_ebitda_positivo = None
        if margem_ebitda is not None:
            if margem_ebitda >= 30:
                margem_ebitda_score = 6  # Excelente
                is_margem_ebitda_positivo = True
            elif margem_ebitda >= 20:
                margem_ebitda_score = 4  # Muito boa (ideal)
                is_margem_ebitda_positivo = True
            elif margem_ebitda >= 15:
                margem_ebitda_score = 2  # Boa
                is_margem_ebitda_positivo = True
            elif margem_ebitda >= 10:
                margem_ebitda_score = 0  # Abaixo do ideal - neutro
                is_margem_ebitda_positivo = False
            elif margem_ebitda >= 5:
                margem_ebitda_score = -3  # Fraca - penalização
                is_margem_ebitda_positivo = False
            elif margem_ebitda >= 0:
                margem_ebitda_score = -5  # Muito fraca - penalização maior
                is_margem_ebitda_positivo = False
            else:
                margem_ebitda_score = -7  # Negativa - penalização severa
                is_margem_ebitda_positivo = False
            score += margem_ebitda_score
        
        # 9. DIVIDEND YIELD (5 pontos)
        dy_score = 0
        is_dy_positivo = None
        if dividend_yield is not None:
            if dividend_yield >= 8:
                dy_score = 5
                is_dy_positivo = True
            elif dividend_yield >= 6:
                dy_score = 4
                is_dy_positivo = True
            elif dividend_yield >= 4:
                dy_score = 3
                is_dy_positivo = True
            elif dividend_yield >= 2:
                dy_score = 1
                is_dy_positivo = False
            else:
                dy_score = 0
                is_dy_positivo = False
            score += dy_score
        
        # 10. DÍVIDA LÍQUIDA/EBITDA (5 pontos) - CRITÉRIO ATUALIZADO
        # IDEAL: < 3x (para bancos = 0, não se aplica)
        divida_score = 0
        is_divida_positivo = None
        is_divida_ideal = None
        if is_banco:
            # Para bancos, Dív/EBITDA não se aplica - pontuação neutra
            divida_score = 3  # Pontuação neutra para bancos
            is_divida_positivo = True
            is_divida_ideal = None  # Não aplicável
        elif div_liquida_ebitda is not None:
            if div_liquida_ebitda <= 0.5:
                divida_score = 5
                is_divida_positivo = True
                is_divida_ideal = True
            elif div_liquida_ebitda <= 1.5:
                divida_score = 4
                is_divida_positivo = True
                is_divida_ideal = True
            elif div_liquida_ebitda < 3:
                divida_score = 3  # IDEAL: < 3x
                is_divida_positivo = True
                is_divida_ideal = True
            elif div_liquida_ebitda <= 4:
                divida_score = 0  # Aceitável mas não ideal
                is_divida_positivo = False
                is_divida_ideal = False
            elif div_liquida_ebitda <= 5:
                divida_score = -2
                is_divida_positivo = False
                is_divida_ideal = False
            else:
                divida_score = -5
                is_divida_positivo = False
                is_divida_ideal = False
            score += divida_score
        
        # 11. DÍVIDA LÍQUIDA ABSOLUTA (4 pontos)
        divida_liquida_score = 0
        is_divida_liquida_positivo = None
        if divida_liquida is not None:
            if divida_liquida < 0:
                divida_liquida_score = 4  # Caixa líquido positivo
                is_divida_liquida_positivo = True
            elif divida_liquida <= 1000:
                divida_liquida_score = 3  # < 1 bilhão
                is_divida_liquida_positivo = True
            elif divida_liquida <= 5000:
                divida_liquida_score = 2  # 1-5 bilhões
                is_divida_liquida_positivo = True
            elif divida_liquida <= 10000:
                divida_liquida_score = 1  # 5-10 bilhões
                is_divida_liquida_positivo = False
            elif divida_liquida <= 20000:
                divida_liquida_score = 0  # 10-20 bilhões
                is_divida_liquida_positivo = False
            else:
                divida_liquida_score = -2  # > 20 bilhões
                is_divida_liquida_positivo = False
            score += divida_liquida_score
        
        # 12. CAGR RECEITAS 5 ANOS - PENALIZAÇÃO GRADUAL
        # IDEAL: > 10%, penalização crescente para valores negativos
        cagr_receitas_score = 0
        is_cagr_receitas_positivo = None
        is_cagr_receitas_ideal = None
        if cagr_receitas_5a is not None:
            if cagr_receitas_5a >= 15:
                cagr_receitas_score = 6  # Excelente crescimento
                is_cagr_receitas_positivo = True
                is_cagr_receitas_ideal = True
            elif cagr_receitas_5a >= 10:
                cagr_receitas_score = 5  # Muito bom (ideal)
                is_cagr_receitas_positivo = True
                is_cagr_receitas_ideal = True
            elif cagr_receitas_5a >= 5:
                cagr_receitas_score = 3  # Bom
                is_cagr_receitas_positivo = True
                is_cagr_receitas_ideal = False
            elif cagr_receitas_5a >= 0:
                cagr_receitas_score = 0  # Estagnado
                is_cagr_receitas_positivo = False
                is_cagr_receitas_ideal = False
            elif cagr_receitas_5a >= -5:
                cagr_receitas_score = -4  # Queda leve
                is_cagr_receitas_positivo = False
                is_cagr_receitas_ideal = False
            elif cagr_receitas_5a >= -10:
                cagr_receitas_score = -8  # Queda moderada
                is_cagr_receitas_positivo = False
                is_cagr_receitas_ideal = False
            else:
                cagr_receitas_score = -12  # Queda severa
                is_cagr_receitas_positivo = False
                is_cagr_receitas_ideal = False
            score += cagr_receitas_score
        
        # 13. CAGR LUCROS 5 ANOS - PENALIZAÇÃO GRADUAL (MAIS IMPORTANTE)
        # IDEAL: > 10%, penalização mais severa para valores negativos
        cagr_lucros_score = 0
        is_cagr_lucros_positivo = None
        is_cagr_lucros_ideal = None
        if cagr_lucros_5a is not None:
            if cagr_lucros_5a >= 20:
                cagr_lucros_score = 8  # Excelente
                is_cagr_lucros_positivo = True
                is_cagr_lucros_ideal = True
            elif cagr_lucros_5a >= 15:
                cagr_lucros_score = 6  # Muito bom
                is_cagr_lucros_positivo = True
                is_cagr_lucros_ideal = True
            elif cagr_lucros_5a >= 10:
                cagr_lucros_score = 5  # Bom (ideal)
                is_cagr_lucros_positivo = True
                is_cagr_lucros_ideal = True
            elif cagr_lucros_5a >= 5:
                cagr_lucros_score = 3  # Aceitável
                is_cagr_lucros_positivo = True
                is_cagr_lucros_ideal = False
            elif cagr_lucros_5a >= 0:
                cagr_lucros_score = 0  # Estagnado
                is_cagr_lucros_positivo = False
                is_cagr_lucros_ideal = False
            elif cagr_lucros_5a >= -5:
                cagr_lucros_score = -5  # Queda leve
                is_cagr_lucros_positivo = False
                is_cagr_lucros_ideal = False
            elif cagr_lucros_5a >= -10:
                cagr_lucros_score = -10  # Queda moderada
                is_cagr_lucros_positivo = False
                is_cagr_lucros_ideal = False
            else:
                cagr_lucros_score = -15  # Queda severa
                is_cagr_lucros_positivo = False
                is_cagr_lucros_ideal = False
            score += cagr_lucros_score
        
        # 14. RENTABILIDADE REAL HISTÓRICA (4 pontos)
        rentabilidade_score = 0
        is_rentabilidade_positivo = None
        if rentabilidade_real_media is not None:
            if rentabilidade_real_media >= 3:
                rentabilidade_score = 4
                is_rentabilidade_positivo = True
            elif rentabilidade_real_media >= 1.5:
                rentabilidade_score = 2
                is_rentabilidade_positivo = True
            elif rentabilidade_real_media >= 0:
                rentabilidade_score = 1
                is_rentabilidade_positivo = True
            elif rentabilidade_real_media >= -2:
                rentabilidade_score = 0
                is_rentabilidade_positivo = False
            elif rentabilidade_real_media >= -5:
                rentabilidade_score = -2
                is_rentabilidade_positivo = False
            else:
                rentabilidade_score = -5
                is_rentabilidade_positivo = False
            score += rentabilidade_score
        
        # Limitar pontuação entre 0-100
        score = max(0, min(100, round(score)))
        
        # Determinar status baseado na pontuação
        if is_lpa_negativo or is_vpa_negativo:
            status = "negativo"
        elif score >= 75:
            status = "positivo"
        elif score <= 35:
            status = "negativo"
        else:
            status = "neutro"
        
        return {
            'score': score,
            'status': status,
            'preco_justo': round(preco_justo, 2),
            'pl': round(pl, 2),
            'pvp': round(pvp, 2),
            'graham_multiplier': round(graham_multiplier, 2),
            'margem_seguranca': round(margem_seguranca, 2),
            'is_lpa_negativo': is_lpa_negativo,
            'is_vpa_negativo': is_vpa_negativo,
            'is_preco_justo_positivo': preco_atual <= preco_justo and not is_lpa_negativo and not is_vpa_negativo,
            'is_pvp_positivo': pvp <= 1.5,
            'is_graham_positivo': graham_multiplier <= 22.5 and graham_multiplier > 0,
            'is_dy_positivo': is_dy_positivo,
            'is_roe_positivo': is_roe_positivo,
            'is_roe_ideal': is_roe_ideal,  # NOVO
            'is_divida_positivo': is_divida_positivo,
            'is_divida_ideal': is_divida_ideal,  # NOVO
            'is_rentabilidade_positivo': is_rentabilidade_positivo,
            'is_margem_liquida_positivo': is_margem_liquida_positivo,
            'is_margem_ebitda_positivo': is_margem_ebitda_positivo,
            'is_pl_abaixo_media': is_pl_abaixo_media,
            'is_pl_ideal': is_pl_ideal,  # NOVO
            'is_earning_yield_positivo': is_earning_yield_positivo,
            'is_divida_liquida_positivo': is_divida_liquida_positivo,
            'is_cagr_receitas_positivo': is_cagr_receitas_positivo,  # NOVO
            'is_cagr_receitas_ideal': is_cagr_receitas_ideal,  # NOVO
            'is_cagr_lucros_positivo': is_cagr_lucros_positivo,  # NOVO
            'is_cagr_lucros_ideal': is_cagr_lucros_ideal,  # NOVO
            'is_banco': is_banco  # NOVO
        }
        
    except Exception as e:
        logger.error(f"Error calculating Graham score: {e}")
        return {
            'score': 0,
            'status': 'negativo',
            'error': str(e)
        }


async def scrape_b3_tickers(analysis_type: str = "market_cap") -> List[str]:
    """
    Busca ações da B3 por diferentes critérios dos rankings REAIS
    IMPORTANTE: Apenas dados reais são usados, sem fallbacks
    
    Args:
        analysis_type: Tipo de ranking:
            - "market_cap": Maior Valor de Mercado (18 ações)
            - "revenue": Maiores Receitas (18 ações)
            - "margin": Maiores Margens Líquidas (18 ações)
            - "popular": As Mais Queridas (7 ações - limite do site gratuito)
            - "no_loss": Nunca Tiveram Prejuízo (18 ações via AUVP)
    
    Returns:
        Lista de tickers das empresas (quantidade varia por tipo)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    }
    
    # Configuração especial para "Sem Prejuízo" - usa AUVP como fonte
    if analysis_type == "no_loss":
        return await scrape_no_loss_tickers(headers)
    
    # Mapeamento de tipos para URLs, labels e limites
    ranking_config = {
        "market_cap": {
            "url": "https://investidor10.com.br/acoes/rankings/maiores-valor-de-mercado/",
            "label": "Maior Valor de Mercado",
            "limit": 18
        },
        "revenue": {
            "url": "https://investidor10.com.br/acoes/rankings/maiores-receitas/",
            "label": "Maiores Receitas",
            "limit": 18
        },
        "margin": {
            "url": "https://investidor10.com.br/acoes/rankings/maiores-margens-liquidas/",
            "label": "Maiores Margens Líquidas",
            "limit": 18
        },
        "popular": {
            "url": "https://investidor10.com.br/acoes/rankings/as-mais-queridas/",
            "label": "As Mais Queridas",
            "limit": 7  # Limite do site gratuito
        }
    }
    
    config = ranking_config.get(analysis_type, ranking_config["market_cap"])
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            url = config["url"]
            label = config["label"]
            limit = config["limit"]
            logger.info(f"Buscando Top {limit} por {label} do ranking real")
            
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                # Buscar por tickers de AÇÕES (4 letras + 1 número de 3-9, exceto 11 que é FII)
                all_tickers = re.findall(r'\b([A-Z]{4}[3-9])\b', response.text)
                
                # Remover duplicatas mantendo ordem (ordem do ranking!)
                tickers = []
                for ticker in all_tickers:
                    if ticker not in tickers and not ticker.endswith('11'):  # Excluir FIIs
                        tickers.append(ticker)
                        if len(tickers) >= limit:
                            break
                
                if len(tickers) > 0:
                    logger.info(f"✅ Encontradas {len(tickers)} ações do ranking {label}: {tickers}")
                    return tickers[:limit]
                else:
                    logger.error(f"Nenhuma ação encontrada no ranking {label}")
                    return []
            else:
                logger.error(f"Erro ao acessar ranking {label}: HTTP {response.status_code}")
                return []
            
    except Exception as e:
        logger.error(f"Error scraping B3 tickers ({analysis_type}): {e}")
        return []


async def scrape_no_loss_tickers(headers: dict) -> List[str]:
    """
    Busca as 18 primeiras ações que nunca tiveram prejuízo
    Fonte: AUVP Analítica (dados reais e atualizados)
    
    Returns:
        Lista de 18 tickers de empresas que nunca tiveram prejuízo
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            url = "https://analitica.auvp.com.br/rankings/acoes/sem_prejuizo?limit=20"
            logger.info("Buscando Top 18 'Sem Prejuízo' da AUVP Analítica")
            
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                # Padrão específico do AUVP: tickers aparecem em URLs como href="/acoes/XXXX3"
                # Isso garante que pegamos apenas os tickers da tabela de ranking
                ticker_pattern = re.findall(r'href="/acoes/([A-Z]{4}[0-9]+)"', response.text)
                
                # Remover duplicatas mantendo ordem (ordem do ranking!)
                tickers = []
                for ticker in ticker_pattern:
                    # Excluir FIIs e units (terminam em 11)
                    if ticker not in tickers and not ticker.endswith('11'):
                        tickers.append(ticker)
                        if len(tickers) >= 18:
                            break
                
                if len(tickers) > 0:
                    logger.info(f"✅ Encontradas {len(tickers)} ações 'Sem Prejuízo' da AUVP: {tickers}")
                    return tickers[:18]
                else:
                    logger.error("Nenhuma ação encontrada no ranking 'Sem Prejuízo' da AUVP")
                    return []
            else:
                logger.error(f"Erro ao acessar AUVP: HTTP {response.status_code}")
                return []
                
    except Exception as e:
        logger.error(f"Error scraping AUVP tickers: {e}")
        return []


async def analyze_all_stocks(db, scrape_stock_data_func, analysis_type: str = "market_cap"):
    """
    Analisa ações da B3 por diferentes critérios e salva no MongoDB
    Processo assíncrono em background
    
    Args:
        db: Instância do MongoDB
        scrape_stock_data_func: Função para fazer scraping dos dados de uma ação
        analysis_type: Tipo de ranking (market_cap, revenue, margin, popular, no_loss)
    """
    global analysis_state
    
    # Labels para cada tipo
    type_labels = {
        "market_cap": "Valor de Mercado",
        "revenue": "Receita",
        "margin": "Margem Líquida",
        "popular": "Mais Queridas",
        "no_loss": "Sem Prejuízo"
    }
    
    try:
        # Marcar início da análise
        analysis_state["is_running"] = True
        analysis_state["progress"] = 0
        analysis_state["start_time"] = datetime.now(timezone.utc)
        analysis_state["last_error"] = None
        
        type_label = type_labels.get(analysis_type, "Valor de Mercado")
        logger.info(f"Starting analysis of stocks by {type_label}...")
        
        # 1. Buscar lista das ações do ranking
        tickers = await scrape_b3_tickers(analysis_type)
        
        if not tickers:
            logger.error("No tickers found. Analysis aborted.")
            analysis_state["is_running"] = False
            analysis_state["last_error"] = "Nenhuma ação encontrada no ranking"
            return
        
        # IMPORTANTE: Limpar dados antigos deste tipo de análise antes de inserir novos
        # Isso garante que apenas os dados reais e atualizados permaneçam
        deleted = await db.recommended_stocks.delete_many({'analysis_type': analysis_type})
        logger.info(f"Cleared {deleted.deleted_count} old records for analysis_type: {analysis_type}")
        
        analysis_state["total"] = len(tickers)
        logger.info(f"Analyzing TOP {len(tickers)} stocks by {type_label}")
        
        # 2. Analisar cada ação
        successful = 0
        failed = 0
        
        for i, ticker in enumerate(tickers):
            try:
                analysis_state["current_ticker"] = ticker
                analysis_state["progress"] = i + 1
                
                logger.info(f"Analyzing {ticker} ({i+1}/{len(tickers)})...")
                
                # Fazer scraping dos dados
                stock_data = await scrape_stock_data_func(ticker)
                
                # Verificar se há erro
                if stock_data.error:
                    logger.warning(f"Failed to fetch data for {ticker}: {stock_data.error}")
                    failed += 1
                    await asyncio.sleep(2)  # Delay menor em caso de erro
                    continue
                
                # Preparar dados para cálculo
                data_dict = {
                    'preco_atual': stock_data.preco_atual,
                    'lpa': stock_data.lpa,
                    'vpa': stock_data.vpa,
                    'dividend_yield': stock_data.dividend_yield,
                    'roe': stock_data.roe,
                    'div_liquida_ebitda': stock_data.div_liquida_ebitda,
                    'rentabilidade_real_media': stock_data.rentabilidade_real_media,
                    'margem_liquida': stock_data.margem_liquida,
                    'margem_ebitda': stock_data.margem_ebitda,
                    'pl_atual': stock_data.pl_atual,
                    'pl_historico_media': stock_data.pl_historico_media,
                    'earning_yield': stock_data.earning_yield,
                    'divida_liquida': stock_data.divida_liquida,
                    'cagr_receitas_5a': stock_data.cagr_receitas_5a,  # NOVO
                    'cagr_lucros_5a': stock_data.cagr_lucros_5a,  # NOVO
                    'is_banco': stock_data.is_banco  # NOVO
                }
                
                # Calcular score
                analysis_result = calculate_graham_score(data_dict)
                
                # Salvar no MongoDB
                recommendation = {
                    'ticker': stock_data.ticker,
                    'nome_empresa': stock_data.nome_empresa,
                    'setor': stock_data.setor,
                    'preco_atual': stock_data.preco_atual,
                    'lpa': stock_data.lpa,
                    'vpa': stock_data.vpa,
                    'dividend_yield': stock_data.dividend_yield,
                    'roe': stock_data.roe,
                    'div_liquida_ebitda': stock_data.div_liquida_ebitda,
                    'divida_liquida': stock_data.divida_liquida,
                    'earning_yield': stock_data.earning_yield,
                    'cagr_receitas_5a': stock_data.cagr_receitas_5a,  # NOVO
                    'cagr_lucros_5a': stock_data.cagr_lucros_5a,  # NOVO
                    'is_banco': stock_data.is_banco,  # NOVO
                    'rentabilidade_real_media': stock_data.rentabilidade_real_media,
                    'margem_liquida': stock_data.margem_liquida,
                    'margem_ebitda': stock_data.margem_ebitda,
                    'pl_atual': stock_data.pl_atual,
                    'pl_historico_media': stock_data.pl_historico_media,
                    'pl_historico_valores': stock_data.pl_historico_valores,
                    'score': analysis_result['score'],
                    'status': analysis_result['status'],
                    'preco_justo': analysis_result.get('preco_justo'),
                    'pl': analysis_result.get('pl'),
                    'pvp': analysis_result.get('pvp'),
                    'graham_multiplier': analysis_result.get('graham_multiplier'),
                    'analysis_type': analysis_type,
                    'ultima_atualizacao': datetime.now(timezone.utc).isoformat(),
                    'dados_completos': stock_data.lpa is not None and stock_data.vpa is not None
                }
                
                # Upsert (update ou insert) - IMPORTANTE: filtrar por ticker E analysis_type
                await db.recommended_stocks.update_one(
                    {
                        'ticker': stock_data.ticker,
                        'analysis_type': analysis_type  # CRÍTICO: incluir no filtro!
                    },
                    {'$set': recommendation},
                    upsert=True
                )
                
                successful += 1
                logger.info(f"✓ {ticker}: Score = {analysis_result['score']} ({analysis_result['status']})")
                
                # Delay entre requisições para evitar bloqueio
                await asyncio.sleep(3)
                
            except Exception as e:
                logger.error(f"Error analyzing {ticker}: {e}")
                failed += 1
                await asyncio.sleep(2)
                continue
        
        # Atualizar estado final
        analysis_state["is_running"] = False
        analysis_state["current_ticker"] = None
        analysis_state["last_update"] = datetime.now(timezone.utc)
        
        logger.info(f"Analysis completed! Successful: {successful}, Failed: {failed}")
        
    except Exception as e:
        logger.error(f"Fatal error in analyze_all_stocks: {e}")
        analysis_state["is_running"] = False
        analysis_state["last_error"] = str(e)


def setup_scheduler(db, scrape_stock_data_func):
    """
    Configura o agendador para executar análise diária às 18h (horário de Brasília)
    
    Args:
        db: Instância do MongoDB
        scrape_stock_data_func: Função para fazer scraping dos dados
    
    Returns:
        AsyncIOScheduler configurado
    """
    scheduler = AsyncIOScheduler()
    
    # Timezone de Brasília
    brasilia_tz = pytz.timezone('America/Sao_Paulo')
    
    # Agendar para todo dia às 18h
    scheduler.add_job(
        analyze_all_stocks,
        trigger=CronTrigger(hour=18, minute=0, timezone=brasilia_tz),
        args=[db, scrape_stock_data_func],
        id='daily_stock_analysis',
        name='Análise Diária de Ações às 18h',
        replace_existing=True
    )
    
    logger.info("Scheduler configured: Daily analysis at 18:00 (Brasília time)")
    
    return scheduler
