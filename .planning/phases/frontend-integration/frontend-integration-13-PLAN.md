---
phase: frontend-integration
plan: '13'
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes.js
autonomous: true
gap_closure: true

must_haves:
  truths:
    - "ML service integrated with backend API"
  artifacts:
    - path: "backend/src/routes.js"
      provides: "Main router with ML routes registered"
  key_links:
    - from: "backend/src/routes.js"
      to: "backend/src/modules/ml/ml.routes.js"
      via: "router.use('/ml', ...)"
      pattern: "router\\.use\\('/ml'"
---

<objective>
Fix 1 gap: Register ML routes in backend/src/routes.js to make /api/v1/ml/* endpoints accessible.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
# Gap from VERIFICATION.md:

**Gap**: ML Routes Not Registered (BLOCKER)

The ML service files exist:
- backend/src/modules/ml/ml.routes.js (18 lines)
- backend/src/modules/ml/ml.controller.js (123 lines, substantive)

However, the routes are NOT registered in backend/src/routes.js, making /api/v1/ml/* endpoints inaccessible.

**Root Cause**: Missing route registration in backend/src/routes.js

**Fix**: Add router.use('/ml', require('./modules/ml/ml.routes.js')); to routes.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register ML routes in backend/src/routes.js</name>
  <files>backend/src/routes.js</files>
  <action>
    Add ML routes registration to routes.js after line 125 (execution routes) and before line 127 (future module routes section).

    Add:
    ```javascript
    /**
     * ML routes
     * POST /api/v1/ml/predict-winner - Predict match winner (protected)
     * GET /api/v1/ml/health - ML service health check
     */
    router.use('/ml', require('./modules/ml/ml.routes.js'));
    ```
  </action>
  <verify>
    Check backend/src/routes.js now includes: router.use('/ml', require('./modules/ml/ml.routes.js'))
  </verify>
  <done>
    ML endpoints accessible at /api/v1/ml/*
  </done>
</task>

</tasks>

<verification>
After fix:
- Check: grep "router.use('/ml'" backend/src/routes.js
- Expected: Line found with ml.routes.js
</verification>

<success_criteria>
Gap closed: ML service integrated with backend API - routes now registered
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-13-SUMMARY.md`
</output>
