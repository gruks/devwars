---
phase: lobby-fix
plan: "05"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/modules/auth/auth.middleware.js
autonomous: false
gap_closure: true
must_haves:
  truths:
    - "Backend accepts JWT from cookies when Authorization header is missing"
    - "Authorization header takes precedence over cookie fallback"
    - "User session persists after closing and reopening browser"
    - "No retry loop causing UI freeze"
  artifacts:
    - path: "backend/src/modules/auth/auth.middleware.js"
      provides: "JWT authentication with cookie fallback"
      contains: "req.cookies?.accessToken"
  key_links:
    - from: "code-arena/src/lib/api.ts"
      to: "backend/src/modules/auth/auth.middleware.js"
      via: "cookies with withCredentials"
      pattern: "accessToken cookie"
---

<objective>
Fix session persistence by adding cookie fallback to auth middleware

Purpose: Backend currently ONLY accepts JWT in Authorization: Bearer header, but frontend uses cookie-based auth (withCredentials: true). This causes 401 errors on browser reopen, creating a retry loop that freezes the UI.

Output: Modified auth.middleware.js that reads accessToken from cookies as fallback
</objective>

<context>
@.planning/phases/lobby-fix/lobby-fix-UAT.md
@.planning/debug/auth-request-aborted.md
@backend/src/modules/auth/auth.middleware.js
@backend/src/modules/auth/auth.controller.js
</context>

<tasks>

<task type="auto">
  <name>Add cookie fallback to authenticate middleware</name>
  <files>backend/src/modules/auth/auth.middleware.js</files>
  <action>
1. In the `authenticate` function, after checking for Authorization header, add fallback to read from cookies:
   - Check `req.cookies?.accessToken` if no Authorization header
   - If token found in cookie, use it for verification
   
2. Keep existing Authorization header logic as PRIMARY (prioritize header if present)
3. Cookie fallback should ONLY be used if no Authorization header present

The cookie name is `accessToken` as set in auth.controller.js line 79.
  </action>
  <verify>
Build succeeds with no errors, middleware accepts both Authorization header and cookie-based auth
  </verify>
  <done>Auth middleware reads accessToken from cookies when Authorization header is not present</done>
</task>

<task type="auto">
  <name>Add cookie fallback to optionalAuth middleware</name>
  <files>backend/src/modules/auth/auth.middleware.js</files>
  <action>
In the `optionalAuth` function (lines 106-136), add the same cookie fallback logic for consistency:
- If no Authorization header, check `req.cookies?.accessToken`
- If token found, verify and attach user
- If no token in either location, continue without user (existing behavior)
  </action>
  <verify>
Build succeeds, optionalAuth works with both header and cookie
  </verify>
  <done>OptionalAuth middleware reads accessToken from cookies as fallback</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete session persistence fix (auth.middleware.js with cookie fallback)</what-built>
  <how-to-verify>
1. Start backend server: `npm run dev` in backend/
2. Start frontend: `npm run dev` in code-arena/
3. Register or login a user
4. Close browser tab completely
5. Reopen the app
6. Verify:
   - User stays logged in (no login prompt)
   - Console shows NO "Request aborted" errors
   - UI remains responsive (can type in inputs)
   - Single auth check request succeeds with 200
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- [ ] Backend accepts accessToken from cookies
- [ ] Authorization header still takes precedence
- [ ] Browser reopen maintains session without retry loop
- [ ] UI remains responsive during auth check
</verification>

<success_criteria>
User can close browser completely and reopen the app while staying logged in. Auth check succeeds with single request using cookies, no retry loop, UI remains responsive.
</success_criteria>

<output>
After completion, create `.planning/phases/lobby-fix/lobby-fix-05-SUMMARY.md`
</output>
