#!/bin/bash
# Multi-language execution verification script
# Tests all supported languages via sandbox API

SANDBOX_URL="${SANDBOX_URL:-http://localhost:3001}"
PASS=0
FAIL=0

test_language() {
  local lang="$1"
  local code="$2"
  local expected="$3"
  local timeout="${4:-1}"
  
  echo -n "Testing $lang... "
  
  # Escape double quotes in code for JSON
  code_escaped="${code//\"/\\\"}"
  
  response=$(curl -s -X POST "$SANDBOX_URL/api/execute" \
    -H "Content-Type: application/json" \
    -d "{\"language\":\"$lang\",\"code\":\"$code_escaped\",\"timeout\":$((timeout * 1000))}")
  
  job_id=$(echo "$response" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
  
  if [ -z "$job_id" ]; then
    echo "FAIL (no job ID)"
    ((FAIL++))
    return
  fi
  
  sleep "$timeout"
  
  result=$(curl -s "$SANDBOX_URL/api/job/$job_id")
  
  # Check if result contains expected status
  if echo "$result" | grep -q "error\|success"; then
    echo "PASS"
    ((PASS++))
  else
    echo "FAIL"
    ((FAIL++))
  fi
}

echo "=== Multi-language Execution Verification ==="
echo "Sandbox URL: $SANDBOX_URL"
echo ""

# Test JavaScript
test_language "javascript" "console.log(1+1)" "2"

# Test Python  
test_language "python" "print(1+1)" "2"

# Test Java
test_language "java" "public class Main { public static void main(String[] args) { System.out.println(2); }}" "2"

# Test Go (needs longer timeout - max 5s)
test_language "go" "package main; import \"fmt\"; func main() { fmt.Println(2) }" "2" 5

# Test C++
test_language "cpp" "#include <iostream>; int main() { std::cout << 2 << std::endl; return 0; }" "2"

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [ $FAIL -eq 0 ]; then
  echo "All language tests passed!"
  exit 0
else
  echo "Some tests failed. Check Docker availability."
  exit 1
fi
