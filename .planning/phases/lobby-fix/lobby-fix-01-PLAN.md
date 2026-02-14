---
phase: lobby-fix
plan: '01'
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/modules/auth/auth.controller.js
  - backend/src/modules/auth/auth.service.js
  - backend/src/modules/auth/auth.routes.js
  - backend/src/config/env.js
  - code-arena/src/lib/api.ts
  - code-arena/src/contexts/AuthContext.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - Users stay logged in across browser sessions (no repeated login)
    - Access tokens refresh automatically before expiry
    - Users can choose "remember me" for extended sessions
  artifacts:
    - path: backend/src/modules/auth/auth.controller.js
      provides: Cookie-based token handling
    - path: code-arena/src/contexts/AuthContext.tsx
      provides: Persistent session management with auto-refresh
    - path: code-arena/src/lib/api.ts
      provides: Cookie credentials and refresh logic
---

<objective>
Implement persistent session management so users don't have to login repeatedly. Use httpOnly cookies for refresh tokens and automatic token refresh.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/auth/auth.service.js
@E:/Projects/DevWars/backend/src/modules/auth/auth.controller.js
@E:/Projects/DevWars/code-arena/src/contexts/AuthContext.tsx
@E:/Projects/DevWars/code-arena/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Add cookie-based session to backend auth</name>
  <files>backend/src/modules/auth/auth.controller.js</files>
  <action>
    Update auth.controller.js login/register to set httpOnly cookies:
    - Set refreshToken as httpOnly cookie with 7-day expiry (or 30 days if "remember me")
    - Set accessToken as httpOnly cookie with 15-minute expiry
    - Add cookie options: secure in production, sameSite: 'lax'
    - Include "remember me" option in login to extend refresh token to 30 days
  </action>
  <verify>Login response sets cookies in headers, cookies are httpOnly</verify>
  <done>Backend sends httpOnly cookies on successful login/register</done>
</task>

<task type="auto">
  <name>Add cookie handling for token refresh</name>
  <files>backend/src/modules/auth/auth.controller.js, backend/src/modules/auth/auth.routes.js</files>
  <action>
    Update refresh endpoint to:
    - Read refreshToken from httpOnly cookie (not body)
    - Set new accessToken and refreshToken cookies on refresh
    - Handle logout by clearing cookies
    
    Add new route POST /auth/refresh that reads from cookie
  </action>
  <verify>POST /api/v1/auth/refresh with cookie returns new tokens in cookies</verify>
  <done>Token refresh works via httpOnly cookies</done>
</task>

<task type="auto">
  <name>Update frontend API for cookie credentials</name>
  <files>code-arena/src/lib/api.ts</files>
  <action>
    Update api.ts:
    - Change axios withCredentials to true (already set)
    - Remove manual localStorage token handling for access token
    - Add automatic refresh on 401 before expiry check
    - Keep localStorage for rememberMe preference only
    - Update setAuth/clearAuth to work with cookies
    
    Key changes:
    - getAccessToken: Try cookie first, fallback to localStorage for backwards compat
    - setAuth: Also set cookies via API call response
    - Add auto-refresh timer that refreshes token 1 minute before expiry
  </action>
  <verify>API calls include credentials: true, refresh works transparently</verify>
  <done>Frontend properly handles httpOnly cookies and auto-refresh</done>
</task>

<task type="auto">
  <name>Enhance AuthContext for session persistence</name>
  <files>code-arena/src/contexts/AuthContext.tsx</files>
  <action>
    Update AuthContext to:
    - Add "remember me" state that persists to localStorage
    - On login: if rememberMe is true, extend cookie expiry to 30 days
    - On app init: check for existing session via /auth/me (works with cookies)
    - Add periodic token check every 5 minutes to trigger refresh if needed
    - Store rememberMe preference in localStorage
  </action>
  <verify>User stays logged in after browser close, token refreshes automatically</verify>
  <done>Users don't need to login repeatedly</done>
</task>

</tasks>

<verification>
- Login stores httpOnly cookies
- Browser refresh maintains session
- Close and reopen browser maintains session (if remember me)
- Token refresh happens automatically before expiry
</verification>

<success_criteria>
Users stay logged in across browser sessions without manual re-login
</success_criteria>

<output>
After completion, create `.planning/phases/lobby-fix/lobby-fix-01-SUMMARY.md`
</output>
