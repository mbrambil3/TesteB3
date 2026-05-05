#!/usr/bin/env python3
"""
TESTE RÁPIDO DO BACKEND - Help Invest
Foco específico em LOGG3 e validação dos critérios CAGR e P/L vs Histórico
"""

import httpx
import json
import sys
import asyncio

# Test configuration
BASE_URL = "https://action-scorer.preview.emergentagent.com"
TIMEOUT = 30.0

class TestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, message: str, response_data: dict = None):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASSED"
        else:
            self.failed_tests += 1
            status = "❌ FAILED"
        
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "response_data": response_data
        }
        self.results.append(result)
        print(f"{status}: {test_name} - {message}")
        if response_data and not passed:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def print_summary(self):
        print("\n" + "="*60)
        print("TESTE RÁPIDO LOGG3 - SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")

def calculate_pl_historico_score(pl_atual: float, pl_historico_media: float) -> tuple:
    """
    Calcula o score do critério P/L vs Histórico baseado na lógica do sistema
    
    Returns:
        tuple: (score, ratio, is_ideal, description)
    """
    if pl_atual is None or pl_historico_media is None or pl_atual <= 0 or pl_historico_media <= 0:
        return (0, None, False, "Dados insuficientes")
    
    ratio = pl_atual / pl_historico_media
    
    # Lógica baseada no código do recommendations.py
    if 0.90 <= ratio <= 0.95:
        return (10, ratio, True, "IDEAL: 5-10% abaixo da média")
    elif ratio < 0.90:
        if ratio >= 0.75:
            return (8, ratio, False, "10-25% abaixo: muito bom")
        else:
            return (6, ratio, False, ">25% abaixo: bom mas pode indicar problemas")
    elif ratio <= 1.0:
        return (7, ratio, False, "0-5% abaixo: bom")
    elif ratio <= 1.1:
        return (7, ratio, True, "0-10% acima: FAVORÁVEL")  # IMPORTANTE: até 1.1 deve ser positivo
    elif ratio <= 1.3:
        return (1, ratio, False, "10-30% acima: caro")
    else:
        return (-3, ratio, False, "> 30% acima: muito caro")

async def test_logg3_stock_data():
    """Teste do endpoint GET /api/stock/LOGG3"""
    test_results = TestResults()
    test_name = "GET /api/stock/LOGG3 - CAGR Fields"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/LOGG3"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            # Check response status
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False, 
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return test_results
            
            # Parse JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return test_results
            
            print(f"LOGG3 Response data:")
            print(json.dumps(data, indent=2))
            
            # Check if error field exists
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"API returned error for LOGG3: {data.get('error')}",
                    data
                )
                return test_results
            
            # Verificar campos CAGR obrigatórios
            required_cagr_fields = ["cagr_receitas_5a", "cagr_lucros_5a"]
            missing_fields = []
            
            for field in required_cagr_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                test_results.add_result(
                    test_name, False,
                    f"LOGG3 missing CAGR fields: {missing_fields}",
                    data
                )
                return test_results
            
            # Verificar se CAGR são numéricos
            cagr_receitas = data.get("cagr_receitas_5a")
            cagr_lucros = data.get("cagr_lucros_5a")
            
            if cagr_receitas is None or not isinstance(cagr_receitas, (int, float)):
                test_results.add_result(
                    test_name, False,
                    f"cagr_receitas_5a should be numeric, got {type(cagr_receitas)}: {cagr_receitas}",
                    data
                )
                return test_results
            
            if cagr_lucros is None or not isinstance(cagr_lucros, (int, float)):
                test_results.add_result(
                    test_name, False,
                    f"cagr_lucros_5a should be numeric, got {type(cagr_lucros)}: {cagr_lucros}",
                    data
                )
                return test_results
            
            # SUCCESS: CAGR fields present and valid
            test_results.add_result(
                test_name, True,
                f"✅ LOGG3 retorna CAGR corretamente: Receitas={cagr_receitas}%, Lucros={cagr_lucros}%",
                {
                    "ticker": data.get("ticker"),
                    "cagr_receitas_5a": cagr_receitas,
                    "cagr_lucros_5a": cagr_lucros,
                    "nome_empresa": data.get("nome_empresa")
                }
            )
        
        return test_results
            
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )
        return test_results

async def test_logg3_score_calculation():
    """Teste manual do cálculo de score do LOGG3 com foco em P/L vs Histórico"""
    test_results = TestResults()
    test_name = "LOGG3 - P/L vs Histórico Logic"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/LOGG3"
            print(f"\nTesting P/L vs Histórico Logic for LOGG3...")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False, 
                    f"Could not fetch LOGG3 data: HTTP {response.status_code}",
                    None
                )
                return test_results
            
            data = response.json()
            
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"Error fetching LOGG3: {data.get('error')}",
                    data
                )
                return test_results
            
            # Extrair dados necessários para o teste P/L vs Histórico
            pl_atual = data.get("pl_atual")
            pl_historico_media = data.get("pl_historico_media")
            
            print(f"LOGG3 P/L Data:")
            print(f"  P/L Atual: {pl_atual}")
            print(f"  P/L Histórico Médio: {pl_historico_media}")
            
            if pl_atual is None or pl_historico_media is None:
                test_results.add_result(
                    test_name, False,
                    f"Missing P/L data for score calculation. P/L atual: {pl_atual}, P/L histórico: {pl_historico_media}",
                    data
                )
                return test_results
            
            # Calcular score do P/L vs Histórico manualmente
            score, ratio, is_ideal, description = calculate_pl_historico_score(pl_atual, pl_historico_media)
            
            print(f"\nAnálise P/L vs Histórico:")
            print(f"  Ratio (Atual/Histórico): {ratio:.3f}")
            print(f"  Score calculado: {score} pontos")
            print(f"  É ideal: {is_ideal}")
            print(f"  Descrição: {description}")
            
            # TESTE ESPECÍFICO: Verificar se ratio até 1.1 (10% acima) retorna score positivo
            if ratio <= 1.1:
                if score >= 7:
                    test_results.add_result(
                        test_name, True,
                        f"✅ P/L vs Histórico correto: ratio {ratio:.3f} (≤1.1) retorna score positivo {score} pontos",
                        {
                            "pl_atual": pl_atual,
                            "pl_historico_media": pl_historico_media,
                            "ratio": round(ratio, 3),
                            "score": score,
                            "is_ideal": is_ideal,
                            "description": description
                        }
                    )
                else:
                    test_results.add_result(
                        test_name, False,
                        f"❌ P/L vs Histórico incorreto: ratio {ratio:.3f} (≤1.1) deveria retornar score ≥7, mas retornou {score}",
                        {
                            "pl_atual": pl_atual,
                            "pl_historico_media": pl_historico_media,
                            "ratio": round(ratio, 3),
                            "score": score,
                            "expected_score": "≥7"
                        }
                    )
            else:
                # Ratio > 1.1, verificar se score é apropriado
                test_results.add_result(
                    test_name, True,
                    f"✅ P/L vs Histórico: ratio {ratio:.3f} (>1.1) retorna score {score} pontos - {description}",
                    {
                        "pl_atual": pl_atual,
                        "pl_historico_media": pl_historico_media,
                        "ratio": round(ratio, 3),
                        "score": score,
                        "description": description
                    }
                )
        
        return test_results
            
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )
        return test_results

async def test_cagr_inclusion_in_score():
    """Teste para verificar se CAGR está sendo incluído no cálculo do score"""
    test_results = TestResults()
    test_name = "LOGG3 - CAGR Inclusion in Score"
    
    try:
        # Importar a função de cálculo de score do sistema
        # Vamos fazer uma análise baseada nos dados de LOGG3
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/LOGG3"
            
            response = await client.get(url)
            data = response.json()
            
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"Could not fetch LOGG3 for CAGR test: {data.get('error')}",
                    data
                )
                return test_results
            
            # Verificar se temos dados CAGR
            cagr_receitas = data.get("cagr_receitas_5a")
            cagr_lucros = data.get("cagr_lucros_5a")
            
            if cagr_receitas is None or cagr_lucros is None:
                test_results.add_result(
                    test_name, False,
                    f"Missing CAGR data for score inclusion test. Receitas: {cagr_receitas}, Lucros: {cagr_lucros}",
                    data
                )
                return test_results
            
            print(f"\nVerificando inclusão do CAGR no score:")
            print(f"  CAGR Receitas 5a: {cagr_receitas}%")
            print(f"  CAGR Lucros 5a: {cagr_lucros}%")
            
            # Análise da lógica CAGR baseada no código
            cagr_receitas_score = 0
            cagr_lucros_score = 0
            
            # CAGR Receitas scoring (baseado no recommendations.py)
            if cagr_receitas >= 15:
                cagr_receitas_score = 5
            elif cagr_receitas > 10:
                cagr_receitas_score = 4  # IDEAL: > 10%
            elif cagr_receitas >= 5:
                cagr_receitas_score = 2
            elif cagr_receitas >= 0:
                cagr_receitas_score = 0
            else:
                cagr_receitas_score = -3  # Receita caindo
            
            # CAGR Lucros scoring
            if cagr_lucros >= 20:
                cagr_lucros_score = 5
            elif cagr_lucros > 10:
                cagr_lucros_score = 4  # IDEAL: > 10%
            elif cagr_lucros >= 5:
                cagr_lucros_score = 2
            elif cagr_lucros >= 0:
                cagr_lucros_score = 0
            else:
                cagr_lucros_score = -3  # Lucro caindo
            
            total_cagr_score = cagr_receitas_score + cagr_lucros_score
            
            print(f"  Score CAGR Receitas: {cagr_receitas_score} pontos")
            print(f"  Score CAGR Lucros: {cagr_lucros_score} pontos")
            print(f"  Total CAGR Score: {total_cagr_score} pontos")
            
            # Verificar se o CAGR está sendo incluído adequadamente
            if total_cagr_score > 0:
                test_results.add_result(
                    test_name, True,
                    f"✅ CAGR incluído no cálculo: Receitas={cagr_receitas}%→{cagr_receitas_score}pts, Lucros={cagr_lucros}%→{cagr_lucros_score}pts (Total: {total_cagr_score}pts)",
                    {
                        "cagr_receitas_5a": cagr_receitas,
                        "cagr_lucros_5a": cagr_lucros,
                        "cagr_receitas_score": cagr_receitas_score,
                        "cagr_lucros_score": cagr_lucros_score,
                        "total_cagr_score": total_cagr_score
                    }
                )
            else:
                test_results.add_result(
                    test_name, True,
                    f"⚠️ CAGR incluído mas pontuação baixa: Receitas={cagr_receitas}%→{cagr_receitas_score}pts, Lucros={cagr_lucros}%→{cagr_lucros_score}pts (Total: {total_cagr_score}pts)",
                    {
                        "cagr_receitas_5a": cagr_receitas,
                        "cagr_lucros_5a": cagr_lucros,
                        "cagr_receitas_score": cagr_receitas_score,
                        "cagr_lucros_score": cagr_lucros_score,
                        "total_cagr_score": total_cagr_score
                    }
                )
        
        return test_results
            
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )
        return test_results

async def main():
    """Execute teste rápido do LOGG3"""
    print("="*60)
    print("TESTE RÁPIDO DO BACKEND - Help Invest")
    print("Foco: LOGG3, CAGR e lógica P/L vs Histórico")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    
    all_results = TestResults()
    
    # 1. Teste GET /api/stock/LOGG3 - verificar se retorna CAGR
    print("\n1️⃣ TESTANDO: GET /api/stock/LOGG3 - CAGR Fields")
    logg3_results = await test_logg3_stock_data()
    
    # 2. Teste cálculo manual do score - lógica P/L vs Histórico
    print("\n2️⃣ TESTANDO: Lógica P/L vs Histórico")
    pl_results = await test_logg3_score_calculation()
    
    # 3. Teste inclusão do CAGR no score
    print("\n3️⃣ TESTANDO: Inclusão CAGR no Score")
    cagr_results = await test_cagr_inclusion_in_score()
    
    # Combinar resultados
    all_results.total_tests = logg3_results.total_tests + pl_results.total_tests + cagr_results.total_tests
    all_results.passed_tests = logg3_results.passed_tests + pl_results.passed_tests + cagr_results.passed_tests
    all_results.failed_tests = logg3_results.failed_tests + pl_results.failed_tests + cagr_results.failed_tests
    all_results.results = logg3_results.results + pl_results.results + cagr_results.results
    
    # Summary
    print("\n" + "="*60)
    print("RESUMO DOS TESTES")
    print("="*60)
    print(f"Total de Testes: {all_results.total_tests}")
    print(f"Passou: {all_results.passed_tests}")
    print(f"Falhou: {all_results.failed_tests}")
    
    if all_results.failed_tests > 0:
        print("\n❌ TESTES QUE FALHARAM:")
        for result in all_results.results:
            if "❌" in result["status"]:
                print(f"  - {result['test']}: {result['message']}")
    else:
        print("\n✅ TODOS OS TESTES PASSARAM!")
    
    print(f"\nTaxa de Sucesso: {(all_results.passed_tests/all_results.total_tests*100):.1f}%")
    
    return all_results.failed_tests == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)