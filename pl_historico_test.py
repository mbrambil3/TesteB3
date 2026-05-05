#!/usr/bin/env python3
"""
P/L Histórico Calculation Test
Tests the GET /api/stock/{ticker} endpoint specifically for P/L histórico calculation fix.

CONTEXT: Fixed a bug where P/L Médio was calculated using 5 years of data (including 2020 outlier of 365.04), 
now uses 4 years.

Expected behavior:
1. pl_historico_valores should contain exactly 4 values for each stock
2. All values in pl_historico_valores should be positive
3. The average of pl_historico_valores should match pl_historico_media
4. RDOR3 should show pl_historico_media = 41.20 (not 105.97)
"""

import httpx
import json
import sys
import time
from typing import Dict, Any, List, Optional

# Test configuration
BASE_URL = "https://action-scorer.preview.emergentagent.com"
TIMEOUT = 30.0

class PLHistoricoTestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.results = []
        self.critical_failures = []
    
    def add_result(self, test_name: str, passed: bool, message: str, response_data: Dict = None, critical: bool = False):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASSED"
        else:
            self.failed_tests += 1
            status = "❌ FAILED"
            if critical:
                self.critical_failures.append(f"{test_name}: {message}")
        
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "response_data": response_data,
            "critical": critical
        }
        self.results.append(result)
        print(f"{status}: {test_name} - {message}")
        if response_data and not passed and critical:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("P/L HISTÓRICO CALCULATION TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES ({len(self.critical_failures)}):")
            for failure in self.critical_failures:
                print(f"  ❌ {failure}")
        
        if self.failed_tests > 0:
            print("\nALL FAILED TESTS:")
            for result in self.results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['message']}")

def validate_pl_historico_data(ticker: str, data: Dict, test_results: PLHistoricoTestResults):
    """Validate P/L histórico calculation for a specific ticker"""
    
    # Check if pl_historico_media exists
    pl_media = data.get("pl_historico_media")
    pl_valores = data.get("pl_historico_valores")
    
    if pl_media is None:
        test_results.add_result(
            f"{ticker} - P/L Histórico Média Exists", False,
            "pl_historico_media field is missing or null",
            data, critical=True
        )
        return False
    
    if pl_valores is None:
        test_results.add_result(
            f"{ticker} - P/L Histórico Valores Exists", False,
            "pl_historico_valores field is missing or null",
            data, critical=True
        )
        return False
    
    # Test 1: Should have exactly 4 values (not 5)
    if len(pl_valores) != 4:
        test_results.add_result(
            f"{ticker} - P/L Histórico Count", False,
            f"Expected exactly 4 historical values, got {len(pl_valores)} values: {pl_valores}",
            {"pl_valores": pl_valores}, critical=True
        )
    else:
        test_results.add_result(
            f"{ticker} - P/L Histórico Count", True,
            f"Correctly has 4 historical values: {pl_valores}"
        )
    
    # Test 2: All values should be positive
    negative_values = [v for v in pl_valores if v <= 0]
    if negative_values:
        test_results.add_result(
            f"{ticker} - P/L Values Positive", False,
            f"Found non-positive values: {negative_values}",
            {"pl_valores": pl_valores}, critical=True
        )
    else:
        test_results.add_result(
            f"{ticker} - P/L Values Positive", True,
            f"All values are positive: {pl_valores}"
        )
    
    # Test 3: Average should match pl_historico_media
    if pl_valores:
        calculated_average = round(sum(pl_valores) / len(pl_valores), 2)
        if abs(calculated_average - pl_media) > 0.01:  # Allow small rounding differences
            test_results.add_result(
                f"{ticker} - P/L Average Calculation", False,
                f"Average mismatch: calculated {calculated_average}, API returned {pl_media}. Values: {pl_valores}",
                {"calculated": calculated_average, "api_returned": pl_media, "values": pl_valores}, 
                critical=True
            )
        else:
            test_results.add_result(
                f"{ticker} - P/L Average Calculation", True,
                f"Average calculation correct: {pl_media} (values: {pl_valores})"
            )
    
    # Test 4: Specific validation for RDOR3
    if ticker == "RDOR3":
        if abs(pl_media - 41.20) > 0.01:
            test_results.add_result(
                f"{ticker} - Bug Fix Validation", False,
                f"RDOR3 P/L média should be ~41.20 (bug fix), got {pl_media}. This indicates the 2020 outlier may still be included.",
                {"expected": 41.20, "actual": pl_media, "values": pl_valores},
                critical=True
            )
        else:
            test_results.add_result(
                f"{ticker} - Bug Fix Validation", True,
                f"RDOR3 P/L média correctly shows {pl_media} (bug fixed, 2020 outlier excluded)"
            )
    
    return True

async def test_pl_historico_calculation(ticker: str, test_results: PLHistoricoTestResults):
    """Test P/L histórico calculation for a specific stock ticker"""
    test_name = f"{ticker} - P/L Histórico Endpoint"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/{ticker}"
            print(f"\nTesting P/L histórico for {ticker}: {url}")
            
            response = await client.get(url)
            
            # Check response status
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False,
                    f"API returned status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text},
                    critical=True
                )
                return
            
            # Parse JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                test_results.add_result(
                    test_name, False,
                    f"Invalid JSON response: {e}",
                    {"response": response.text},
                    critical=True
                )
                return
            
            # Print P/L histórico data for inspection
            pl_media = data.get("pl_historico_media")
            pl_valores = data.get("pl_historico_valores")
            print(f"{ticker} P/L Data:")
            print(f"  - pl_historico_media: {pl_media}")
            print(f"  - pl_historico_valores: {pl_valores}")
            print(f"  - Count of values: {len(pl_valores) if pl_valores else 0}")
            
            # Check if error field exists
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"API returned error: {data.get('error')}",
                    data,
                    critical=True
                )
                return
            
            # Test basic response structure
            test_results.add_result(
                test_name, True,
                f"Successfully fetched data for {ticker}"
            )
            
            # Validate P/L histórico calculation
            validate_pl_historico_data(ticker, data, test_results)
    
    except httpx.TimeoutException:
        test_results.add_result(
            test_name, False,
            f"Request timed out after {TIMEOUT} seconds",
            None,
            critical=True
        )
    except httpx.RequestError as e:
        test_results.add_result(
            test_name, False,
            f"Request error: {str(e)}",
            None,
            critical=True
        )
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None,
            critical=True
        )

async def test_api_connectivity():
    """Test that the API is accessible"""
    test_results = PLHistoricoTestResults()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{BASE_URL}/api/"
            response = await client.get(url)
            
            if response.status_code == 200:
                test_results.add_result(
                    "API Connectivity", True,
                    f"API accessible at {url}",
                    {"status_code": response.status_code}
                )
            else:
                test_results.add_result(
                    "API Connectivity", False,
                    f"API returned status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text},
                    critical=True
                )
    
    except Exception as e:
        test_results.add_result(
            "API Connectivity", False,
            f"Could not access API: {str(e)}",
            None,
            critical=True
        )
    
    return test_results

async def main():
    """Run P/L histórico calculation tests"""
    print("🧪 P/L HISTÓRICO CALCULATION TESTS")
    print("="*50)
    print("Testing the bug fix: P/L Médio calculation now uses 4 years instead of 5 years")
    print("This excludes the 2020 outlier and provides accurate historical averages.")
    print(f"Base URL: {BASE_URL}")
    print(f"Timeout: {TIMEOUT} seconds\n")
    
    # Test API connectivity first
    connectivity_test = await test_api_connectivity()
    
    if connectivity_test.failed_tests > 0:
        print("❌ API is not accessible. Stopping tests.")
        connectivity_test.print_summary()
        return False
    
    test_results = PLHistoricoTestResults()
    
    # Test the specific tickers mentioned in the review request
    test_tickers = ["RDOR3", "PETR4", "VALE3", "BBAS3"]
    
    # Run tests for each ticker
    for ticker in test_tickers:
        await test_pl_historico_calculation(ticker, test_results)
        time.sleep(2)  # Brief pause between requests to be respectful
    
    # Combine results
    combined_results = PLHistoricoTestResults()
    combined_results.total_tests = connectivity_test.total_tests + test_results.total_tests
    combined_results.passed_tests = connectivity_test.passed_tests + test_results.passed_tests
    combined_results.failed_tests = connectivity_test.failed_tests + test_results.failed_tests
    combined_results.critical_failures = connectivity_test.critical_failures + test_results.critical_failures
    combined_results.results = connectivity_test.results + test_results.results
    
    combined_results.print_summary()
    
    # Return True only if no critical failures
    return len(combined_results.critical_failures) == 0

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    sys.exit(0 if success else 1)