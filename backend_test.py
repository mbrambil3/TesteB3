#!/usr/bin/env python3
"""
Backend API Testing for Help Invest Application
Tests Stock Data API and NEW AI Recommendations System endpoints
"""

import httpx
import json
import sys
import time
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://action-scorer.preview.emergentagent.com"
TIMEOUT = 30.0

class TestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, message: str, response_data: Dict = None):
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
        print("STOCK DATA API TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if "❌" in result["status"]:
                    print(f"- {result['test']}: {result['message']}")

def is_reasonable_value(value: Any, field_name: str, expected_range: tuple = None) -> bool:
    """Check if a numeric value is reasonable (not null, not 0, within expected range)"""
    if value is None:
        return False
    if not isinstance(value, (int, float)):
        return False
    if value == 0:
        return False
    
    if expected_range:
        min_val, max_val = expected_range
        return min_val <= value <= max_val
    
    # Default reasonable ranges for each field
    ranges = {
        "preco_atual": (1, 1000),  # Stock price between R$1 and R$1000
        "lpa": (0.1, 50),          # LPA between 0.1 and 50
        "vpa": (1, 100),           # VPA between 1 and 100
        "dividend_yield": (0.1, 20), # DY between 0.1% and 20%
        "roe": (1, 50),            # ROE between 1% and 50%
        "div_liquida_ebitda": (0.1, 20)  # Ratio between 0.1 and 20
    }
    
    if field_name in ranges:
        min_val, max_val = ranges[field_name]
        return min_val <= value <= max_val
    
    return True

async def test_stock_endpoint(ticker: str, test_results: TestResults, expected_data: Dict = None):
    """Test a specific stock ticker endpoint"""
    test_name = f"GET /api/stock/{ticker}"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/{ticker}"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            # Check response status
            if response.status_code != 200:
                if ticker == "XXXXX":
                    # Invalid ticker should return error
                    test_results.add_result(
                        test_name, True, 
                        f"Correctly returned error status {response.status_code} for invalid ticker",
                        {"status_code": response.status_code, "response": response.text}
                    )
                    return
                else:
                    test_results.add_result(
                        test_name, False, 
                        f"Unexpected status code: {response.status_code}",
                        {"status_code": response.status_code, "response": response.text}
                    )
                    return
            
            # Parse JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Response data: {json.dumps(data, indent=2)}")
            
            # Check if error field exists for valid tickers
            if ticker != "XXXXX":
                if data.get("error"):
                    test_results.add_result(
                        test_name, False,
                        f"API returned error for valid ticker: {data.get('error')}",
                        data
                    )
                    return
                
                # Test required fields exist and have reasonable values
                required_fields = ["ticker", "preco_atual", "lpa", "vpa", "dividend_yield", "roe", "nome_empresa"]
                missing_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    test_results.add_result(
                        test_name, False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                    return
                
                # Test ticker matches
                if data["ticker"] != ticker:
                    test_results.add_result(
                        test_name, False,
                        f"Ticker mismatch: expected {ticker}, got {data['ticker']}",
                        data
                    )
                    return
                
                # Test numeric values are reasonable
                unreasonable_fields = []
                for field in ["preco_atual", "lpa", "vpa", "dividend_yield", "roe"]:
                    if not is_reasonable_value(data.get(field), field):
                        unreasonable_fields.append(f"{field}={data.get(field)}")
                
                if unreasonable_fields:
                    test_results.add_result(
                        test_name, False,
                        f"Unreasonable values: {', '.join(unreasonable_fields)}",
                        data
                    )
                    return
                
                # Test company name exists
                if not data.get("nome_empresa") or data["nome_empresa"].strip() == "":
                    test_results.add_result(
                        test_name, False,
                        "Company name is missing or empty",
                        data
                    )
                    return
                
                # Test specific expected values if provided
                if expected_data:
                    validation_errors = []
                    for key, expected_value in expected_data.items():
                        if key == "nome_empresa":
                            if data.get(key) != expected_value:
                                validation_errors.append(f"{key}: expected '{expected_value}', got '{data.get(key)}'")
                        elif key in ["preco_atual", "lpa", "vpa", "dividend_yield", "roe", "div_liquida_ebitda"]:
                            actual_value = data.get(key)
                            if isinstance(expected_value, tuple):  # Range check
                                min_val, max_val = expected_value
                                if not (actual_value and min_val <= actual_value <= max_val):
                                    validation_errors.append(f"{key}: expected {min_val}-{max_val}, got {actual_value}")
                            elif isinstance(expected_value, (int, float)):  # Approximate check
                                if not (actual_value and abs(actual_value - expected_value) <= expected_value * 0.3):
                                    validation_errors.append(f"{key}: expected ~{expected_value}, got {actual_value}")
                    
                    if validation_errors:
                        test_results.add_result(
                            test_name, False,
                            f"Value validation failed: {'; '.join(validation_errors)}",
                            data
                        )
                        return
                
                test_results.add_result(
                    test_name, True,
                    f"All fields valid - Company: {data['nome_empresa']}, Price: R${data['preco_atual']:.2f}",
                    data
                )
            
            else:  # XXXXX invalid ticker case
                if not data.get("error"):
                    test_results.add_result(
                        test_name, False,
                        "Invalid ticker should return error field",
                        data
                    )
                    return
                
                if "não encontrada" not in data["error"].lower() and "erro" not in data["error"].lower():
                    test_results.add_result(
                        test_name, False,
                        f"Error message should indicate stock not found, got: {data['error']}",
                        data
                    )
                    return
                
                test_results.add_result(
                    test_name, True,
                    f"Correctly returned error for invalid ticker: {data['error']}",
                    data
                )
    
    except httpx.TimeoutException:
        test_results.add_result(
            test_name, False,
            f"Request timed out after {TIMEOUT} seconds",
            None
        )
    except httpx.RequestError as e:
        test_results.add_result(
            test_name, False,
            f"Request error: {str(e)}",
            None
        )
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )

async def test_api_root():
    """Test that the API root is accessible"""
    test_results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{BASE_URL}/api/"
            response = await client.get(url)
            
            if response.status_code == 200:
                test_results.add_result(
                    "API Root Accessibility", True,
                    f"API root accessible at {url}",
                    {"status_code": response.status_code}
                )
            else:
                test_results.add_result(
                    "API Root Accessibility", False,
                    f"API root returned status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
    
    except Exception as e:
        test_results.add_result(
            "API Root Accessibility", False,
            f"Could not access API root: {str(e)}",
            None
        )
    
    return test_results

async def test_recommendations_status(test_results: TestResults):
    """Test GET /api/recommendations/status endpoint"""
    test_name = "GET /api/recommendations/status"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/recommendations/status"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Status response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            required_fields = ["is_running", "progress", "total", "total_stocks_analyzed"]
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                test_results.add_result(
                    test_name, False,
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return
            
            # Validate field types
            if not isinstance(data["is_running"], bool):
                test_results.add_result(
                    test_name, False,
                    f"is_running should be boolean, got {type(data['is_running'])}",
                    data
                )
                return
            
            if not isinstance(data["progress"], int) or data["progress"] < 0:
                test_results.add_result(
                    test_name, False,
                    f"progress should be non-negative integer, got {data['progress']}",
                    data
                )
                return
            
            if not isinstance(data["total"], int) or data["total"] < 0:
                test_results.add_result(
                    test_name, False,
                    f"total should be non-negative integer, got {data['total']}",
                    data
                )
                return
            
            if not isinstance(data["total_stocks_analyzed"], int) or data["total_stocks_analyzed"] < 0:
                test_results.add_result(
                    test_name, False,
                    f"total_stocks_analyzed should be non-negative integer, got {data['total_stocks_analyzed']}",
                    data
                )
                return
            
            # Initially should show is_running=false, total_stocks_analyzed should be 0 or positive
            test_results.add_result(
                test_name, True,
                f"Status endpoint working correctly - is_running: {data['is_running']}, total_analyzed: {data['total_stocks_analyzed']}",
                data
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )


async def test_recommendations_list(test_results: TestResults):
    """Test GET /api/recommendations?limit=20 endpoint"""
    test_name = "GET /api/recommendations?limit=20"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/recommendations?limit=20"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Recommendations response: {json.dumps(data, indent=2)[:500]}...")
            
            # Should return an array
            if not isinstance(data, list):
                test_results.add_result(
                    test_name, False,
                    f"Response should be an array, got {type(data)}",
                    data
                )
                return
            
            # Initially should return empty array or array with data
            if len(data) == 0:
                test_results.add_result(
                    test_name, True,
                    "Correctly returned empty array (no analysis performed yet)",
                    data
                )
                return
            
            # If data exists, validate structure
            if len(data) > 20:
                test_results.add_result(
                    test_name, False,
                    f"Should return max 20 items, got {len(data)}",
                    {"count": len(data)}
                )
                return
            
            # Check first item structure
            first_item = data[0]
            required_fields = ["ticker", "score", "status", "ultima_atualizacao", "dados_completos"]
            missing_fields = []
            
            for field in required_fields:
                if field not in first_item:
                    missing_fields.append(field)
            
            if missing_fields:
                test_results.add_result(
                    test_name, False,
                    f"First item missing required fields: {missing_fields}",
                    first_item
                )
                return
            
            # Check that items are ordered by score (highest first)
            scores = [item.get("score", 0) for item in data]
            if scores != sorted(scores, reverse=True):
                test_results.add_result(
                    test_name, False,
                    f"Items not ordered by score (highest first). Scores: {scores[:5]}",
                    {"scores": scores}
                )
                return
            
            test_results.add_result(
                test_name, True,
                f"Returned {len(data)} recommendations ordered by score (top score: {data[0]['score']})",
                {"count": len(data), "top_score": data[0]['score']}
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )


async def test_recommendations_analyze(test_results: TestResults):
    """Test POST /api/recommendations/analyze endpoint"""
    test_name = "POST /api/recommendations/analyze"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/recommendations/analyze"
            print(f"\nTesting: {url}")
            
            response = await client.post(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Analyze response: {json.dumps(data, indent=2)}")
            
            # Should return message and status
            if "message" not in data:
                test_results.add_result(
                    test_name, False,
                    "Response should contain 'message' field",
                    data
                )
                return
            
            # Check if analysis started or already running
            message = data.get("message", "").lower()
            if "iniciada" in message or "já em execução" in message or "started" in message or "running" in message:
                test_results.add_result(
                    test_name, True,
                    f"Analysis endpoint working correctly: {data.get('message')}",
                    data
                )
            else:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected message format: {data.get('message')}",
                    data
                )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )


async def test_recommendations_setores(test_results: TestResults):
    """Test GET /api/recommendations/setores endpoint"""
    test_name = "GET /api/recommendations/setores"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/recommendations/setores"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Setores response: {json.dumps(data, indent=2)}")
            
            # Should return object with setores array
            if not isinstance(data, dict) or "setores" not in data:
                test_results.add_result(
                    test_name, False,
                    "Response should be object with 'setores' array",
                    data
                )
                return
            
            setores = data["setores"]
            if not isinstance(setores, list):
                test_results.add_result(
                    test_name, False,
                    f"'setores' should be an array, got {type(setores)}",
                    data
                )
                return
            
            # Initially should return empty array or array with sectors
            test_results.add_result(
                test_name, True,
                f"Setores endpoint working correctly - returned {len(setores)} sectors",
                data
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )


async def test_ai_recommendations_system():
    """Test all AI Recommendations System endpoints"""
    print("\n" + "="*60)
    print("AI RECOMMENDATIONS SYSTEM TESTS")
    print("="*60)
    
    test_results = TestResults()
    
    # Test all new endpoints
    await test_recommendations_status(test_results)
    await test_recommendations_list(test_results)
    await test_recommendations_analyze(test_results)
    await test_recommendations_setores(test_results)
    
    return test_results

async def test_new_fundamentalist_criteria():
    """Test NEW FUNDAMENTALIST CRITERIA as specified in review request"""
    print("\n" + "="*60)
    print("NEW FUNDAMENTALIST CRITERIA TESTS")
    print("="*60)
    
    test_results = TestResults()
    
    # Test cases for NEW CRITERIA (as specified in the review request)
    test_cases = [
        {
            "ticker": "ITUB4",
            "description": "ITUB4 (banco): deve retornar is_banco=true, cagr_receitas_5a, cagr_lucros_5a, div_liquida_ebitda=0",
            "expected_is_banco": True,
            "expected_div_liquida_ebitda": 0.0
        },
        {
            "ticker": "VALE3", 
            "description": "VALE3 (não banco): deve retornar is_banco=false, cagr_receitas_5a, cagr_lucros_5a, div_liquida_ebitda com valor real",
            "expected_is_banco": False,
            "expected_div_liquida_ebitda": "real_value"  # Should not be 0
        },
        {
            "ticker": "BBAS3",
            "description": "BBAS3 (banco): deve retornar is_banco=true",
            "expected_is_banco": True,
            "expected_div_liquida_ebitda": 0.0
        }
    ]
    
    # Run each test case
    for test_case in test_cases:
        await test_new_criteria_endpoint(test_case, test_results)
        time.sleep(1)  # Brief pause between requests
    
    return test_results

async def test_new_criteria_endpoint(test_case: dict, test_results: TestResults):
    """Test a specific ticker for new fundamentalist criteria"""
    ticker = test_case["ticker"]
    description = test_case["description"]
    test_name = f"NEW CRITERIA - {ticker}"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/{ticker}"
            print(f"\nTesting NEW CRITERIA: {url}")
            print(f"Description: {description}")
            
            response = await client.get(url)
            
            # Check response status
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False, 
                    f"Unexpected status code: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return
            
            # Parse JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text}
                )
                return
            
            print(f"Response data: {json.dumps(data, indent=2)}")
            
            # Check if error field exists
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"API returned error: {data.get('error')}",
                    data
                )
                return
            
            # Test NEW REQUIRED FIELDS for updated criteria
            new_required_fields = ["cagr_receitas_5a", "cagr_lucros_5a", "is_banco"]
            missing_fields = []
            
            for field in new_required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                test_results.add_result(
                    test_name, False,
                    f"Missing NEW required fields: {missing_fields}",
                    data
                )
                return
            
            # Test is_banco field
            expected_is_banco = test_case.get("expected_is_banco")
            actual_is_banco = data.get("is_banco")
            
            if actual_is_banco != expected_is_banco:
                test_results.add_result(
                    test_name, False,
                    f"is_banco mismatch: expected {expected_is_banco}, got {actual_is_banco}",
                    data
                )
                return
            
            # Test div_liquida_ebitda for banks vs non-banks
            expected_div_ebitda = test_case.get("expected_div_liquida_ebitda")
            actual_div_ebitda = data.get("div_liquida_ebitda")
            
            if expected_div_ebitda == 0.0:  # For banks
                if actual_div_ebitda != 0.0:
                    test_results.add_result(
                        test_name, False,
                        f"Banks should have div_liquida_ebitda=0.0, got {actual_div_ebitda}",
                        data
                    )
                    return
            elif expected_div_ebitda == "real_value":  # For non-banks
                if actual_div_ebitda is None or actual_div_ebitda == 0.0:
                    test_results.add_result(
                        test_name, False,
                        f"Non-banks should have real div_liquida_ebitda value, got {actual_div_ebitda}",
                        data
                    )
                    return
            
            # Test CAGR fields exist and are numeric
            cagr_receitas = data.get("cagr_receitas_5a")
            cagr_lucros = data.get("cagr_lucros_5a")
            
            if cagr_receitas is None:
                test_results.add_result(
                    test_name, False,
                    "cagr_receitas_5a should not be None",
                    data
                )
                return
            
            if cagr_lucros is None:
                test_results.add_result(
                    test_name, False,
                    "cagr_lucros_5a should not be None",
                    data
                )
                return
            
            if not isinstance(cagr_receitas, (int, float)):
                test_results.add_result(
                    test_name, False,
                    f"cagr_receitas_5a should be numeric, got {type(cagr_receitas)}",
                    data
                )
                return
            
            if not isinstance(cagr_lucros, (int, float)):
                test_results.add_result(
                    test_name, False,
                    f"cagr_lucros_5a should be numeric, got {type(cagr_lucros)}",
                    data
                )
                return
            
            # Success message with key data
            success_msg = f"✓ NEW CRITERIA VALIDATED: is_banco={actual_is_banco}, "
            success_msg += f"CAGR_Receitas={cagr_receitas}%, CAGR_Lucros={cagr_lucros}%, "
            success_msg += f"Dív/EBITDA={actual_div_ebitda}"
            
            test_results.add_result(
                test_name, True,
                success_msg,
                data
            )
    
    except httpx.TimeoutException:
        test_results.add_result(
            test_name, False,
            f"Request timed out after {TIMEOUT} seconds",
            None
        )
    except httpx.RequestError as e:
        test_results.add_result(
            test_name, False,
            f"Request error: {str(e)}",
            None
        )
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None
        )

async def test_existing_stock_api():
    """Test existing Stock Data API endpoints to ensure they still work"""
    print("\n" + "="*60)
    print("EXISTING STOCK DATA API TESTS")
    print("="*60)
    
    test_results = TestResults()
    
    # Test cases for existing API (as specified in the review request)
    test_cases = [
        {
            "ticker": "PETR4",
            "expected": {
                "nome_empresa": "Petrobrás",
                "div_liquida_ebitda": (4, 5)  # Should have this field
            }
        },
        {
            "ticker": "VALE3",
            "expected": {
                "nome_empresa": "Vale"
            }
        },
        {
            "ticker": "XXXXX",  # Invalid ticker
            "expected": None
        }
    ]
    
    # Run each test case
    for test_case in test_cases:
        ticker = test_case["ticker"]
        expected = test_case.get("expected")
        await test_stock_endpoint(ticker, test_results, expected)
        time.sleep(1)  # Brief pause between requests
    
    return test_results


async def main():
    """Run all backend API tests"""
    print("Starting Help Invest Backend API Tests...")
    print(f"Base URL: {BASE_URL}")
    print(f"Timeout: {TIMEOUT} seconds")
    
    # Test API accessibility first
    api_test = await test_api_root()
    
    if api_test.failed_tests > 0:
        print("❌ API is not accessible. Stopping tests.")
        api_test.print_summary()
        return False
    
    # Test NEW FUNDAMENTALIST CRITERIA (PRIMARY FOCUS)
    new_criteria_results = await test_new_fundamentalist_criteria()
    
    # Test existing Stock Data API
    stock_results = await test_existing_stock_api()
    
    # Test new AI Recommendations System
    ai_results = await test_ai_recommendations_system()
    
    # Combine all results
    combined_results = TestResults()
    combined_results.total_tests = api_test.total_tests + new_criteria_results.total_tests + stock_results.total_tests + ai_results.total_tests
    combined_results.passed_tests = api_test.passed_tests + new_criteria_results.passed_tests + stock_results.passed_tests + ai_results.passed_tests
    combined_results.failed_tests = api_test.failed_tests + new_criteria_results.failed_tests + stock_results.failed_tests + ai_results.failed_tests
    combined_results.results = api_test.results + new_criteria_results.results + stock_results.results + ai_results.results
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL BACKEND API TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {combined_results.total_tests}")
    print(f"Passed: {combined_results.passed_tests}")
    print(f"Failed: {combined_results.failed_tests}")
    print(f"Success Rate: {(combined_results.passed_tests/combined_results.total_tests*100):.1f}%")
    
    if combined_results.failed_tests > 0:
        print("\nFAILED TESTS:")
        for result in combined_results.results:
            if "❌" in result["status"]:
                print(f"- {result['test']}: {result['message']}")
    else:
        print("\n✅ ALL TESTS PASSED!")
    
    return combined_results.failed_tests == 0

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    sys.exit(0 if success else 1)