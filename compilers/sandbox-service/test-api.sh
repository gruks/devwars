#!/bin/bash

# Sandbox Service - API Test Script
# Tests all supported languages

API_URL="http://localhost:3000/api"

echo "🧪 Testing Sandbox Service API"
echo "================================"
echo ""

# JSON Formatter Fallback
if command -v jq >/dev/null 2>&1; then
  format_json() { jq .; }
elif command -v python3 >/dev/null 2>&1; then
  format_json() { python3 -m json.tool; }
else
  format_json() { cat; }
fi

# Test 1: Health Check
echo "1️⃣  Health Check"
curl -s "$API_URL/../health" | format_json
echo ""
echo ""

# Test 2: Supported Languages
echo "2️⃣  Supported Languages"
curl -s "$API_URL/languages" | format_json
echo ""
echo ""

# Test 3: Python Execution
echo "3️⃣  Python Execution"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "for i in range(5):\n    print(f\"Python: {i}\")",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 4: JavaScript Execution
echo "4️⃣  JavaScript Execution"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "for (let i = 0; i < 5; i++) { console.log(`JavaScript: ${i}`); }",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 5: C++ Execution
echo "5️⃣  C++ Execution"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cpp",
    "code": "#include <iostream>\nint main() {\n    for (int i = 0; i < 5; i++) {\n        std::cout << \"C++: \" << i << std::endl;\n    }\n    return 0;\n}",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 6: Java Execution
echo "6️⃣  Java Execution"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "java",
    "code": "public class Main {\n    public static void main(String[] args) {\n        for (int i = 0; i < 5; i++) {\n            System.out.println(\"Java: \" + i);\n        }\n    }\n}",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 7: Go Execution
echo "7️⃣  Go Execution"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "go",
    "code": "package main\nimport \"fmt\"\nfunc main() {\n    for i := 0; i < 5; i++ {\n        fmt.Printf(\"Go: %d\\n\", i)\n    }\n}",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 8: Error Handling (Syntax Error)
echo "8️⃣  Error Handling (Python Syntax Error)"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Missing closing quote)",
    "timeout": 2000
  }' | format_json
echo ""
echo ""

# Test 9: Timeout Test
echo "9️⃣  Timeout Test (Infinite Loop)"
curl -s -X POST "$API_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "while True: pass",
    "timeout": 1000
  }' | format_json
echo ""
echo ""

# Test 10: Queue Stats
echo "🔟 Queue Statistics"
curl -s "$API_URL/queue/stats" | format_json
echo ""
echo ""

echo "✅ All tests completed!"