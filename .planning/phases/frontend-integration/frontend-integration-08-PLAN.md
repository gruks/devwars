---
phase: frontend-integration
plan: '08'
type: execute
wave: 2
depends_on:
  - frontend-integration-06
  - frontend-integration-07
files_modified:
  - backend/src/services/execution.service.js
  - backend/src/modules/execution/execution.controller.js
  - backend/src/modules/execution/execution.routes.js
  - sandbox-service/Dockerfile.sandbox
  - sandbox-service/docker-compose.yml
  - sandbox-service/src/executors/sandbox.js
autonomous: true
user_setup:
  - service: docker
    why: "Code execution sandbox requires Docker"
    env_vars: []
    dashboard_config: []

must_haves:
  truths:
    - Code executes in isolated Docker container
    - Execution time limit: 2 seconds enforced
    - Memory limit: 256MB enforced
    - Two test cases run against submitted code
    - Output compared exactly (trimmed) with expected
    - Results include: passed count, execution time, memory usage, actual vs expected
    - Infinite loops are terminated by timeout
    - System calls are blocked by container restrictions
  artifacts:
    - path: backend/src/services/execution.service.js
      provides: Code execution orchestration
      min_lines: 100
    - path: sandbox-service/src/executors/sandbox.js
      provides: Docker sandbox execution
      min_lines: 80
    - path: sandbox-service/Dockerfile.sandbox
      provides: Sandbox container definition
      min_lines: 30
  key_links:
    - from: execution.service.js
      to: sandbox.js
      via: HTTP API call to sandbox-service
      pattern: POST /execute with code, language, testCases
    - from: execution.controller.js
      to: execution.service.js
      via: Service method call
      pattern: executionService.runCode(code, language, testCases)
---

<objective>
Build secure code execution engine using Docker sandbox that runs code against 2 test cases with time/memory limits.

Purpose: Enable safe execution of user-submitted code with resource constraints and test case validation.

Output: Docker sandbox service, execution service, API endpoints for run and submit.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/services/execution.service.js
@E:/Projects/DevWars/sandbox-service/src/executors/sandbox.js
</context>

<tasks>

<task type="auto">
  <name>Create Docker sandbox configuration</name>
  <files>sandbox-service/Dockerfile.sandbox, sandbox-service/docker-compose.yml</files>
  <action>
    Create secure Docker sandbox configuration:
    
    1. Dockerfile.sandbox:
       - Base: node:18-alpine (minimal attack surface)
       - Create non-root user: sandbox-user
       - Install python3, openjdk11, golang, g++ for multi-language support
       - Set working directory /sandbox
       - Copy entrypoint script
       - USER sandbox-user (never run as root)
       - Security options:
         - No network access (--network none)
         - Read-only filesystem where possible
         - Limited syscalls via seccomp
    
    2. docker-compose.yml updates:
       - Add sandbox service with:
         - mem_limit: 256m
         - cpus: 0.5
         - pids_limit: 50
         - security_opt:
           - no-new-privileges:true
         - read_only: true
         - tmpfs:
           - /tmp:noexec,nosuid,size=50m
       - Mount volume for code files (tmpfs)
    
    3. Create entrypoint.sh:
       - Accepts: language, code file path, timeout
       - Executes code with timeout command
       - Captures stdout, stderr, exit code
       - Returns JSON with output, error, executionTime, memoryUsage
  </action>
  <verify>Dockerfile builds, docker-compose up starts sandbox service</verify>
  <done>Docker sandbox configured with security constraints</done>
</task>

<task type="auto">
  <name>Build code execution service</name>
  <files>backend/src/services/execution.service.js</files>
  <action>
    Create/update execution service with methods:
    
    1. executeCode(code, language, timeout = 2000)
       - Write code to temp file
       - Determine file extension by language
       - Call sandbox-service /execute endpoint
       - Return execution result
    
    2. runTestCases(code, language, testCases, timeout = 2000)
       - For each test case (2 total):
         - Create test runner script that:
           - Reads input from stdin OR function parameter
           - Executes user code
           - Captures output
         - Execute in sandbox with test case input
         - Compare actual output with expected (trim whitespace)
         - Store: passed (boolean), actualOutput, expectedOutput, executionTime, error
       - Return array of test results + summary:
         - totalTests: 2
         - passedTests: count
         - failedTests: count
         - results: detailed per-test breakdown
         - averageExecutionTime: ms
         - maxMemoryUsed: MB
    
    3. calculateComplexity(code, language)
       - Heuristic analysis (simplified for MVP):
         - Count loops (for, while) → time complexity estimate
         - Count data structures → space complexity estimate
       - Return: { timeComplexity: string, spaceComplexity: string }
    
    4. Security measures:
       - Timeout enforcement (2s hard limit)
       - Memory limit (256MB)
       - Process limit (50 max)
       - No network access
  </action>
  <verify>Service executes code, runs test cases, returns results</verify>
  <done>Execution service runs code against test cases securely</done>
</task>

<task type="auto">
  <name>Create execution API endpoints</name>
  <files>backend/src/modules/execution/execution.controller.js, backend/src/modules/execution/execution.routes.js</files>
  <action>
    Create execution controller and routes:
    
    1. execution.controller.js:
       - POST /api/v1/execution/run
         Body: { code: string, language: string, roomId?: string }
         - Validate code length (max 10000 chars)
         - Validate language (javascript, python, java, go, cpp)
         - If roomId provided, fetch test cases from room
         - Call executionService.runTestCases()
         - Return: { success, data: { results, summary } }
       
       - POST /api/v1/execution/submit
         Body: { code: string, language: string, roomId: string }
         - Validate user is room participant
         - Validate room status is 'active'
         - Run test cases
         - Calculate complexity
         - Store submission in room.submissions
         - Update player progress
         - Return: { success, data: { submission, passedTests, score } }
       
       - GET /api/v1/execution/languages
         Return: { success, data: { languages: ['javascript', 'python', 'java', 'go', 'cpp'] } }
    
    2. execution.routes.js:
       - Register routes with authenticate middleware
       - Add validation middleware for request bodies
    
    3. Register routes in app.js router
  </action>
  <verify>API endpoints accept code, return test results, handle submissions</verify>
  <done>Execution API endpoints created with validation</done>
</task>

<task type="auto">
  <name>Implement sandbox executor</name>
  <files>sandbox-service/src/executors/sandbox.js</files>
  <action>
    Update sandbox executor with security features:
    
    1. executeInSandbox(code, language, input, timeout = 2000)
       - Create temp directory for code execution
       - Write code to file with appropriate extension
       - Build Docker run command:
         ```
         docker run --rm \
           --network none \
           --memory=256m \
           --memory-swap=256m \
           --cpus=0.5 \
           --pids-limit=50 \
           --read-only \
           --security-opt=no-new-privileges:true \
           -v ${tempDir}:/sandbox:ro \
           sandbox-image \
           timeout ${timeout/1000}s node /sandbox/code.js
         ```
       - Execute with child_process.spawn
       - Capture stdout, stderr
       - Kill process if timeout exceeded
       - Cleanup temp directory
       - Return: { output, error, executionTime, killed }
    
    2. Language-specific command builders:
       - javascript: node
       - python: python3
       - java: javac + java
       - go: go run
       - cpp: g++ compile + run
    
    3. Error handling:
       - TimeoutError: Process exceeded time limit
       - MemoryError: Process exceeded memory limit
       - RuntimeError: Code threw exception
       - CompilationError: Failed to compile (java/cpp/go)
  </action>
  <verify>Sandbox executor runs code with constraints, handles errors</verify>
  <done>Docker sandbox executor with security limits implemented</done>
</task>

</tasks>

<verification>
- Docker sandbox runs with network isolation
- Time limit (2s) enforced and processes killed
- Memory limit (256MB) enforced
- Two test cases execute and compare output
- Infinite loops are terminated
- API endpoints return structured results
- Code execution is secure and isolated
</verification>

<success_criteria>
User code executes in isolated Docker container with 2-second timeout and 256MB memory limit. Two test cases run, outputs are compared, and detailed results are returned including pass/fail status, execution time, and memory usage.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-08-SUMMARY.md`
</output>
