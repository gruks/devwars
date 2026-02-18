#!/bin/bash
# Sandbox Entrypoint
# Accepts: language, code file path, timeout
# Executes code with timeout and returns JSON result

set -e

# Parse arguments
LANGUAGE="$1"
CODE_FILE="$2"
TIMEOUT="${3:-2000}"

# Validate inputs
if [ -z "$LANGUAGE" ] || [ -z "$CODE_FILE" ]; then
    echo '{"success": false, "error": "Missing required arguments: language and code file path", "stdout": "", "stderr": "", "runtime": "0ms", "memory": "0mb", "status": "error"}'
    exit 1
fi

# Check if code file exists
if [ ! -f "$CODE_FILE" ]; then
    echo '{"success": false, "error": "Code file not found", "stdout": "", "stderr": "", "runtime": "0ms", "memory": "0mb", "status": "error"}'
    exit 1
fi

# Get memory limit in KB (256MB = 256000KB)
MEMORY_LIMIT_KB=256000

# Function to execute code based on language
execute_code() {
    local lang="$1"
    local code_file="$2"
    local timeout_sec="$3"
    
    case "$lang" in
        javascript|node)
            # Execute Node.js code
            timeout "$timeout_sec" node "$code_file" 2>&1
            ;;
            
        python|python3)
            # Execute Python code
            timeout "$timeout_sec" python3 "$code_file" 2>&1
            ;;
            
        java)
            # Java requires compilation first
            local class_name=$(head -n 1 "$code_file" | sed -n 's/.*class \([A-Za-z_][A-Za-z0-9_]*\).*/\1/p')
            if [ -z "$class_name" ]; then
                class_name="Main"
            fi
            
            # Compile
            local compile_output
            compile_output=$(javac "$code_file" 2>&1) || {
                echo "Compilation Error: $compile_output"
                exit 1
            }
            
            # Run with timeout
            timeout "$timeout_sec" java -Xmx256M -Xss256k "$class_name" 2>&1
            ;;
            
        go)
            # Go requires compilation
            local dir=$(dirname "$code_file")
            timeout "$timeout_sec" go run "$code_file" 2>&1
            ;;
            
        cpp|c++)
            # C++ requires compilation
            local executable="/tmp/sandbox_executable"
            local compile_output
            compile_output=$(g++ -o "$executable" "$code_file" 2>&1) || {
                echo "Compilation Error: $compile_output"
                exit 1
            }
            
            # Run with timeout
            timeout "$timeout_sec" "$executable" 2>&1
            ;;
            
        *)
            echo "Unsupported language: $lang"
            exit 1
            ;;
    esac
}

# Execute with timeout
START_TIME=$(date +%s%3N)

# Run the code and capture output
OUTPUT=$(execute_code "$LANGUAGE" "$CODE_FILE" "$TIMEOUT" 2>&1)
EXIT_CODE=$?

END_TIME=$(date +%s%3N)
RUNTIME=$((END_TIME - START_TIME))

# Check if process was killed by timeout
if [ $EXIT_CODE -eq 124 ]; then
    echo '{"success": false, "error": "Execution timeout - process exceeded time limit", "stdout": "", "stderr": "Timeout after '"$TIMEOUT"'ms", "runtime": "'"$TIMEOUT"'ms", "memory": "0mb", "status": "timeout", "killed": true}'
    exit 0
fi

# Return result as JSON
if [ $EXIT_CODE -eq 0 ]; then
    echo "{\"success\": true, \"stdout\": \"$OUTPUT\", \"stderr\": \"\", \"runtime\": \"${RUNTIME}ms\", \"memory\": \"32mb\", \"status\": \"success\", \"killed\": false}"
else
    echo "{\"success\": false, \"stdout\": \"\", \"stderr\": \"$OUTPUT\", \"runtime\": \"${RUNTIME}ms\", \"memory\": \"0mb\", \"status\": \"error\", \"killed\": false}"
fi
