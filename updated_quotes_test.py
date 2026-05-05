#!/usr/bin/env python3
"""
UPDATED QUOTES BUG FIX TEST
Tests the specific bug fix for updated stock quotes in Help Invest backend.

BUG: POMO4 was showing outdated price R$ 6,36 instead of current price R$ 6,50+
FIX: Using real-time API https://investidor10.com.br/api/cotacao/ticker/{ticker_id}
"""

import httpx
import json
import sys
import asyncio
from typing import Dict, Any

# Test configuration using production URL
BASE_URL = "https://action-scorer.preview.emergentagent.com"
TIMEOUT = 30.0

class QuotesTestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.critical_issues = []
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, message: str, response_data: Dict = None, critical: bool = False):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASSED"
        else:
            self.failed_tests += 1
            status = "❌ FAILED"
            if critical:
                self.critical_issues.append(f"{test_name}: {message}")
        
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "response_data": response_data,
            "critical": critical
        }
        self.results.append(result)
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if response_data and not passed:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def print_summary(self):
        print("\n" + "="*70)
        print("UPDATED QUOTES BUG FIX TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.critical_issues:
            print(f"\nCRITICAL ISSUES ({len(self.critical_issues)}):")
            for issue in self.critical_issues:
                print(f"- {issue}")
        
        if self.failed_tests > 0:
            print(f"\nALL FAILED TESTS:")
            for result in self.results:
                if "❌" in result["status"]:
                    critical_marker = " [CRITICAL]" if result.get("critical") else ""
                    print(f"- {result['test']}: {result['message']}{critical_marker}")

async def test_pomo4_updated_price(test_results: QuotesTestResults):
    """Test POMO4 specifically - price should be updated (6.50-7.00, not old 6.36)"""
    test_name = "POMO4 Updated Price Test"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/POMO4"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False, 
                    f"API returned status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text},
                    critical=True
                )
                return
            
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
            
            # Check for API error
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"API returned error for POMO4: {data.get('error')}",
                    data,
                    critical=True
                )
                return
            
            # Get current price
            preco_atual = data.get("preco_atual")
            if preco_atual is None:
                test_results.add_result(
                    test_name, False,
                    "preco_atual field is missing",
                    data,
                    critical=True
                )
                return
            
            # Check if price is updated (should be 6.50-7.00, NOT 6.36)
            if preco_atual == 6.36:
                test_results.add_result(
                    test_name, False,
                    f"Price still shows old value R$ {preco_atual} (bug not fixed)",
                    data,
                    critical=True
                )
                return
            
            # Allow slightly wider range (6.45-7.00) since market prices can vary slightly
            if not (6.45 <= preco_atual <= 7.00):
                test_results.add_result(
                    test_name, False,
                    f"Price R$ {preco_atual} outside expected range 6.45-7.00 (may still be outdated)",
                    data,
                    critical=True
                )
                return
            
            # Check earning_yield calculation
            lpa = data.get("lpa")
            earning_yield = data.get("earning_yield")
            
            if lpa and earning_yield:
                expected_earning_yield = (lpa / preco_atual) * 100
                tolerance = 0.5  # 0.5% tolerance as specified
                
                if abs(earning_yield - expected_earning_yield) > tolerance:
                    test_results.add_result(
                        test_name, False,
                        f"Earning Yield calculation incorrect: got {earning_yield}%, expected {expected_earning_yield:.2f}% (tolerance ±{tolerance}%)",
                        data,
                        critical=False  # Minor issue
                    )
                    return
            
            test_results.add_result(
                test_name, True,
                f"✅ BUG FIXED: POMO4 price updated to R$ {preco_atual} (was R$ 6.36). Earning Yield: {earning_yield}%",
                {"ticker": "POMO4", "preco_atual": preco_atual, "earning_yield": earning_yield}
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None,
            critical=True
        )

async def test_multiple_tickers_updated_prices(test_results: QuotesTestResults):
    """Test multiple tickers for updated prices in expected ranges"""
    
    test_cases = [
        {"ticker": "PETR4", "min_price": 35.0, "max_price": 40.0},
        {"ticker": "VALE3", "min_price": 80.0, "max_price": 90.0},
        {"ticker": "BBAS3", "min_price": 24.0, "max_price": 28.0}
    ]
    
    for case in test_cases:
        await test_ticker_price_range(case["ticker"], case["min_price"], case["max_price"], test_results)

async def test_ticker_price_range(ticker: str, min_price: float, max_price: float, test_results: QuotesTestResults):
    """Test a specific ticker for price in expected range"""
    test_name = f"{ticker} Updated Price Range Test"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/{ticker}"
            print(f"\nTesting: {url}")
            
            response = await client.get(url)
            
            if response.status_code != 200:
                test_results.add_result(
                    test_name, False, 
                    f"API returned status {response.status_code}",
                    {"status_code": response.status_code},
                    critical=True
                )
                return
            
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
            
            # Check for API error
            if data.get("error"):
                test_results.add_result(
                    test_name, False,
                    f"API returned error for {ticker}: {data.get('error')}",
                    data,
                    critical=True
                )
                return
            
            # Get current price
            preco_atual = data.get("preco_atual")
            if preco_atual is None:
                test_results.add_result(
                    test_name, False,
                    "preco_atual field is missing",
                    data,
                    critical=True
                )
                return
            
            # Check if price is > 0
            if preco_atual <= 0:
                test_results.add_result(
                    test_name, False,
                    f"Price should be > 0, got {preco_atual}",
                    data,
                    critical=True
                )
                return
            
            # Check if price is in expected range
            if not (min_price <= preco_atual <= max_price):
                test_results.add_result(
                    test_name, False,
                    f"Price R$ {preco_atual} outside expected range R$ {min_price}-{max_price}",
                    data,
                    critical=False  # May be market variation, not critical
                )
                return
            
            # Check earning_yield calculation consistency
            lpa = data.get("lpa")
            earning_yield = data.get("earning_yield")
            
            if lpa and earning_yield and lpa > 0:
                expected_earning_yield = (lpa / preco_atual) * 100
                tolerance = 0.5  # 0.5% tolerance
                
                if abs(earning_yield - expected_earning_yield) > tolerance:
                    test_results.add_result(
                        test_name, False,
                        f"Earning Yield calculation inconsistent: got {earning_yield}%, expected {expected_earning_yield:.2f}%",
                        data,
                        critical=False
                    )
                    return
            
            test_results.add_result(
                test_name, True,
                f"✅ Price updated: R$ {preco_atual} (range: {min_price}-{max_price}). Earning Yield: {earning_yield}%",
                {"ticker": ticker, "preco_atual": preco_atual, "earning_yield": earning_yield}
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None,
            critical=True
        )

async def test_earning_yield_consistency(test_results: QuotesTestResults):
    """Test earning yield calculation consistency across different stocks"""
    test_name = "Earning Yield Consistency Test"
    
    tickers_to_test = ["POMO4", "PETR4", "VALE3", "BBAS3"]
    calculations = []
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            for ticker in tickers_to_test:
                url = f"{BASE_URL}/api/stock/{ticker}"
                response = await client.get(url)
                
                if response.status_code != 200:
                    continue
                
                try:
                    data = response.json()
                    if data.get("error"):
                        continue
                    
                    preco_atual = data.get("preco_atual")
                    lpa = data.get("lpa")
                    earning_yield = data.get("earning_yield")
                    
                    if all([preco_atual, lpa, earning_yield]) and lpa > 0 and preco_atual > 0:
                        expected = (lpa / preco_atual) * 100
                        difference = abs(earning_yield - expected)
                        
                        calculations.append({
                            "ticker": ticker,
                            "preco_atual": preco_atual,
                            "lpa": lpa,
                            "earning_yield": earning_yield,
                            "expected": expected,
                            "difference": difference
                        })
                
                except:
                    continue
        
        if not calculations:
            test_results.add_result(
                test_name, False,
                "No valid calculations could be performed",
                None,
                critical=True
            )
            return
        
        # Check all calculations
        tolerance = 0.5  # 0.5% tolerance
        inconsistent_calculations = [calc for calc in calculations if calc["difference"] > tolerance]
        
        if inconsistent_calculations:
            error_details = []
            for calc in inconsistent_calculations:
                error_details.append(f"{calc['ticker']}: got {calc['earning_yield']}%, expected {calc['expected']:.2f}%")
            
            test_results.add_result(
                test_name, False,
                f"Earning Yield calculations inconsistent for: {'; '.join(error_details)}",
                {"inconsistent": inconsistent_calculations},
                critical=False
            )
            return
        
        test_results.add_result(
            test_name, True,
            f"✅ All {len(calculations)} Earning Yield calculations consistent (tolerance ±{tolerance}%)",
            {"calculations": calculations}
        )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None,
            critical=True
        )

async def test_error_handling_invalid_ticker(test_results: QuotesTestResults):
    """Test error handling for invalid ticker"""
    test_name = "Invalid Ticker Error Handling Test"
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            url = f"{BASE_URL}/api/stock/INVALID123"
            print(f"\nTesting error handling: {url}")
            
            response = await client.get(url)
            
            # Should still return 200 with error message (as per existing API design)
            if response.status_code not in [200, 404, 410]:
                test_results.add_result(
                    test_name, False,
                    f"Unexpected status code for invalid ticker: {response.status_code}",
                    {"status_code": response.status_code},
                    critical=False
                )
                return
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                # If not JSON, check if it's a proper error response
                test_results.add_result(
                    test_name, True,
                    f"Invalid ticker properly handled with status {response.status_code}",
                    {"status_code": response.status_code}
                )
                return
            
            # Should have error field for invalid ticker
            if not data.get("error"):
                test_results.add_result(
                    test_name, False,
                    "Invalid ticker should return error field",
                    data,
                    critical=False
                )
                return
            
            test_results.add_result(
                test_name, True,
                f"✅ Invalid ticker properly handled: {data.get('error')}",
                data
            )
    
    except Exception as e:
        test_results.add_result(
            test_name, False,
            f"Unexpected error: {str(e)}",
            None,
            critical=True
        )

async def main():
    """Run all updated quotes bug fix tests"""
    print("="*70)
    print("HELP INVEST - UPDATED QUOTES BUG FIX TESTING")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing the fix for outdated stock quotes (POMO4: R$ 6.36 → R$ 6.50+)")
    
    test_results = QuotesTestResults()
    
    # Run all tests
    print("\n🔍 RUNNING BUG FIX TESTS...")
    
    # 1. Test POMO4 specifically (main bug case)
    await test_pomo4_updated_price(test_results)
    
    # 2. Test multiple tickers for updated prices
    await test_multiple_tickers_updated_prices(test_results)
    
    # 3. Test earning yield calculation consistency
    await test_earning_yield_consistency(test_results)
    
    # 4. Test error handling still works
    await test_error_handling_invalid_ticker(test_results)
    
    # Print final summary
    test_results.print_summary()
    
    # Return success status
    success = test_results.failed_tests == 0 and len(test_results.critical_issues) == 0
    
    if success:
        print("\n🎉 BUG FIX VERIFICATION: ALL TESTS PASSED!")
        print("✅ Updated quotes are working correctly")
        print("✅ POMO4 price has been updated from R$ 6.36 to current market price")
        print("✅ Earning Yield calculations are consistent")
    else:
        print(f"\n⚠️  BUG FIX VERIFICATION: {test_results.failed_tests} TESTS FAILED")
        if test_results.critical_issues:
            print(f"🚨 {len(test_results.critical_issues)} CRITICAL ISSUES FOUND")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)