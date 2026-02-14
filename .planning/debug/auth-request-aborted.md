---
status: investigating
trigger: "Auth check failed - frontend sending multiple requests, user cannot type, AxiosError: Request aborted. I deleted a null file after which the problem began."
created: 2026-02-14T21:45:00Z
updated: 2026-02-14T21:45:00Z
---

## Current Focus
hypothesis: Auth mismatch between frontend (cookie-based) and backend (JWT header-based) causing 401 loop
test: Compare auth implementation in frontend api.ts vs backend auth.middleware.js
expecting: Find mismatch that causes repeated auth failures
next_action: Verify root cause and document solution

## Symptoms
expected: User registers/logs in, closes browser, reopens app, stays logged in via cookies
actual: Multiple auth requests sent, "Request aborted" error, user cannot type (UI frozen)
errors: AxiosError: Request aborted, console shows "Auth check failed"
reproduction: User reopens app after closing browser - auth check fails repeatedly
started: After user "deleted a null file" - likely exposed existing auth mismatch

## Evidence
- timestamp: 2026-02-14T21:46:00Z
  checked: code-arena/src/lib/api.ts (frontend API config)
  found: Uses withCredentials: true (cookie-based auth), comment says "Tokens are in httpOnly cookies, browser sends them automatically"
  implication: Frontend expects cookies to be sent automatically

- timestamp: 2026-02-14T21:47:00Z
  checked: backend/src/modules/auth/auth.middleware.js (backend auth middleware)
  found: Only accepts JWT in Authorization header - checks req.headers.authorization and requires "Bearer " prefix
  implication: Backend does NOT read cookies for authentication

- timestamp: 2026-02-14T21:48:00Z
  checked: backend/src/modules/auth/auth.controller.js (login/register)
  found: Sets httpOnly cookies (accessToken, refreshToken) but middleware ignores them
  implication: Cookie is set but never used for authentication

- timestamp: 2026-02-14T21:49:00Z
  checked: code-arena/src/contexts/AuthContext.tsx (auth check logic)
  found: checkAuth() calls authApi.getMe() which sends request without JWT in header
  implication: Every auth check returns 401 because backend rejects cookie-only requests

## Eliminated
- hypothesis: Missing import due to deleted file
  evidence: Build succeeds, no TypeScript errors, all imports resolve
  timestamp: 2026-02-14T21:45:00Z

- hypothesis: AbortController causing cancelled requests
  evidence: No AbortController found in codebase
  timestamp: 2026-02-14T21:45:00Z

## Resolution
root_cause: |
  CRITICAL AUTH MISMATCH: Frontend uses cookie-based auth (withCredentials: true) but
  backend auth.middleware.js ONLY accepts JWT in Authorization: Bearer <token> header.
  The backend completely ignores cookies for authentication.
  
  Flow causing issue:
  1. User reopens app, AuthProvider mounts
  2. checkAuth() calls authApi.getMe() - sends cookies but NO Authorization header
  3. Backend middleware rejects with 401 (no Bearer token)
  4. Response interceptor tries to refresh token (also fails - no cookie reading)
  5. Creates loop of failed requests -> "Request aborted"
  6. UI becomes unresponsive due to rapid retry loop
  
  The "deleted a null file" likely exposed this pre-existing bug by removing
  some workaround or null return that was masking the issue.

fix: |
  Option 1 (Recommended): Update backend middleware to read accessToken from cookies
  - Modify auth.middleware.js to check req.cookies.accessToken as fallback
  - Add sameSite: 'none' for cross-origin if needed
  
  Option 2: Update frontend to send JWT in Authorization header
  - Extract token from cookie response and send in header
  - Requires frontend changes to api.ts interceptor

files_changed: []
