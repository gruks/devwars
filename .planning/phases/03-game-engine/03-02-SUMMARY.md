---
phase: 03-game-engine
plan: "02"
subsystem: api
tags: [sandbox, evaluation, code-execution, testing]

# Dependency graph
requires:
  - phase: 03-game-engine
    plan: "01"
    provides: [Question model with testcases]
provides:
  - Execution service wrapper for sandbox-service
  - Testcase evaluation engine
  - Code submission evaluation endpoint
  - Detailed pass/fail results with runtime metrics
affects:
  - 03-03
  - game-engine
  - submission-evaluation

# Tech tracking
tech-stack:
  added: [axios]
  patterns:
    - "Service layer pattern for external API integration"
    - "Controller pattern for business logic"
    - "Testcase evaluation with output comparison"

key-files:
  created:
    - backend/src/services/execution.service.js
    - backend/src/modules/evaluation/evaluation.controller.js
    - backend/src/modules/evaluation/evaluation.routes.js
  modified:
    - backend/src/routes.js

key-decisions:
  - "Language mapping: python->python, node/javascript->javascript, java->java, go->go, cpp->cpp"
  - "Output comparison: trimmed whitespace with exact match"
  - "Score calculation: percentage of passed tests (passed/total * 100)"
  - "Default timeout: 3000ms for execution, 5000ms for testcases"
  - "Connection error handling: returns structured error object instead of throwing"

patterns-established:
  - "Execution service: Wrapper for external sandbox API with error mapping"
  - "Evaluation controller: Async testcase iteration with detailed result tracking"
  - "Result format: { passed, input, expected, actual, error?, runtime, memory }"

# Metrics
duration: 3m
completed: 2026-02-15
---

# Phase 3 Plan 2: Execution Service and Evaluation Engine Summary

**Code execution wrapper for sandbox-service with testcase evaluation engine and protected evaluation endpoint returning detailed pass/fail results with runtime metrics.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T14:40:00Z
- **Completed:** 2026-02-15T14:43:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Execution service wrapper for sandbox-service API with language mapping
- Testcase evaluation engine comparing output against expected results
- Protected evaluation endpoint at /api/v1/evaluation/evaluate
- Detailed results with pass/fail status, runtime, and memory metrics
- Comprehensive error handling for connection failures and timeouts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Execution Service** - `a54b530` (feat)
2. **Task 2: Create Evaluation Controller** - `27017ca` (feat)
3. **Task 3: Create Evaluation Routes** - `73d42ae` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `backend/src/services/execution.service.js` - Wrapper for sandbox-service API with executeCode() and executeWithInput()
- `backend/src/modules/evaluation/evaluation.controller.js` - Evaluation logic with evaluateTestcases() and evaluateSolution()
- `backend/src/modules/evaluation/evaluation.routes.js` - Express routes for evaluation endpoints
- `backend/src/routes.js` - Added evaluation routes registration

## API Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /api/v1/evaluation/evaluate | Protected | Evaluate code submission against question test cases |

### Request Body
```json
{
  "questionId": "q-xxxxx",
  "code": "function sum(a, b) { return a + b; }"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "questionId": "q-xxxxx",
    "score": 100,
    "totalTests": 3,
    "passedTests": 3,
    "results": [
      {
        "passed": true,
        "input": "sum(1, 2)",
        "expected": "3",
        "actual": "3",
        "error": null,
        "runtime": "45ms",
        "memory": "12mb"
      }
    ]
  }
}
```

## Execution Service Features

- **Language Mapping:** Maps internal language names to sandbox format (node → javascript)
- **Error Handling:** 
  - Connection refused: Returns "Sandbox service unavailable"
  - Timeout: Returns "Execution timeout" with configured timeout
  - Generic errors: Returns error message from response or exception
- **Logging:** Winston logging for execution requests and results
- **Configuration:** Supports SANDBOX_SERVICE_URL env variable (default: http://localhost:3000)

## Evaluation Controller Features

- **Testcase Iteration:** Executes code against each testcase sequentially
- **Output Comparison:** Trims whitespace, uses exact match comparison
- **Result Tracking:** Tracks passed count, total count, and per-testcase details
- **Error Resilience:** Continues evaluation even if individual testcases fail
- **Score Calculation:** Percentage-based scoring (passed/total * 100)

## Decisions Made

- **Language Mapping:** Used explicit mapping object to handle different naming conventions (node vs javascript)
- **Output Trimming:** Trim whitespace for comparison to avoid false failures from trailing newlines
- **Timeout Strategy:** 3s default for direct execution, 5s for testcases (allows for overhead)
- **Error Format:** Consistent error object with success flag, output, error message, runtime, and memory
- **Question Lookup:** Uses Question model from 03-01 to find testcases by question ID

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

Sandbox service should be running at http://localhost:3000 (configurable via SANDBOX_SERVICE_URL env variable).

## Next Phase Readiness

- Execution service ready for 03-03 (Match State Management)
- Code can be evaluated against testcases with detailed results
- Evaluation endpoint available for match submission handling
- Ready for real-time game state updates with submission results

---
*Phase: 03-game-engine*
*Completed: 2026-02-15*
