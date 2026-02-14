---
phase: frontend-integration
plan: '01'
type: execute
wave: 1
depends_on: []
files_modified:
  - code-arena/package.json
  - code-arena/src/lib/api.ts
  - code-arena/src/contexts/AuthContext.tsx
  - code-arena/src/pages/Login.tsx
  - code-arena/src/pages/Signup.tsx
  - code-arena/src/components/ProtectedRoute.tsx
  - code-arena/src/App.tsx
autonomous: true

must_haves:
  truths:
    - User can register with username, email, password
    - User can login with email, password
    - User session persists across page refreshes
    - Unauthenticated users are redirected to login
    - Logged-in users can access app pages
  artifacts:
    - path: code-arena/src/lib/api.ts
      provides: Axios client with auth interceptors
      min_lines: 40
    - path: code-arena/src/contexts/AuthContext.tsx
      provides: Auth state and methods (login, logout, register)
      min_lines: 80
    - path: code-arena/src/pages/Login.tsx
      provides: Connected to backend login endpoint
      exports: Login component
    - path: code-arena/src/pages/Signup.tsx
      provides: Connected to backend register endpoint
      exports: Signup component
  key_links:
    - from: Login.tsx
      to: /api/v1/auth/login
      via: AuthContext.login()
      pattern: POST with {email, password}
    - from: Signup.tsx
      to: /api/v1/auth/register
      via: AuthContext.register()
      pattern: POST with {username, email, password}
    - from: ProtectedRoute.tsx
      to: AuthContext
      via: useAuth() hook
      pattern: redirects to /login if !user
---

<objective>
Connect the code-arena React frontend to the DevWars Express backend for authentication.

Purpose: Enable user registration, login, and session management between frontend and backend.

Output: Functional auth flow - users can register, login, and access protected routes.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/auth/auth.routes.js
@E:/Projects/DevWars/backend/src/modules/auth/auth.controller.js
@E:/Projects/DevWars/code-arena/src/pages/Login.tsx
@E:/Projects/DevWars/code-arena/src/pages/Signup.tsx
@E:/Projects/DevWars/code-arena/src/App.tsx
</context>

<tasks>

<task type="auto">
  <name>Install axios and create API client</name>
  <files>code-arena/package.json, code-arena/src/lib/api.ts</files>
  <action>
    1. Install axios: `npm install axios` in code-arena directory
    2. Create `code-arena/src/lib/api.ts` with:
       - Base axios instance pointing to `http://localhost:3000/api/v1`
       - Request interceptor to add Authorization header with accessToken
       - Response interceptor to handle 401 errors and token refresh
       - Helper functions: getAuth, setAuth, clearAuth for token management in localStorage
       - Type definitions for API response format: {success, message, data}
  </action>
  <verify>npm list axios shows axios installed, api.ts exports axios instance</verify>
  <done>API client configured with token handling</done>
</task>

<task type="auto">
  <name>Create AuthContext for state management</name>
  <files>code-arena/src/contexts/AuthContext.tsx</files>
  <action>
    Create `code-arena/src/contexts/AuthContext.tsx` with:
    - AuthContext with user, isLoading, isAuthenticated states
    - login(email, password) - calls POST /auth/login, stores tokens, sets user
    - register(username, email, password) - calls POST /auth/register, stores tokens, sets user
    - logout() - calls POST /auth/logout, clears tokens, resets state
    - checkAuth() - calls GET /auth/me to restore session on app load
    - Use localStorage for token persistence (accessToken, refreshToken)
    - Wrap with React Context Provider
  </action>
  <verify>AuthContext exports AuthProvider and useAuth hook</verify>
  <done>Auth state managed globally with login/logout/register functionality</done>
</task>

<task type="auto">
  <name>Connect Login page to backend</name>
  <files>code-arena/src/pages/Login.tsx</files>
  <action>
    Update Login.tsx:
    - Import useAuth hook and useNavigate
    - Add React.useState for email, password, error, isLoading
    - Update form onSubmit to call auth.login(email, password)
    - On success: navigate to /app/dashboard
    - On error: display error message in form
    - Add loading state to button during login
    - Use toast/sonner for success/error notifications
  </action>
  <verify>Login form submits to backend, returns user on success</verify>
  <done>Login page fully connected to backend auth endpoint</done>
</task>

<task type="auto">
  <name>Connect Signup page to backend</name>
  <files>code-arena/src/pages/Signup.tsx</files>
  <action>
    Update Signup.tsx:
    - Import useAuth hook and useNavigate
    - Add React.useState for username, email, password, error, isLoading
    - Update form onSubmit to call auth.register(username, email, password)
    - On success: navigate to /app/dashboard
    - On error: display error message in form
    - Add loading state to button during registration
    - Use toast/sonner for success/error notifications
  </action>
  <verify>Signup form submits to backend, returns user on success</verify>
  <done>Signup page fully connected to backend register endpoint</done>
</task>

<task type="auto">
  <name>Add ProtectedRoute component</name>
  <files>code-arena/src/components/ProtectedRoute.tsx</files>
  <action>
    Create `code-arena/src/components/ProtectedRoute.tsx`:
    - Props: children (ReactNode)
    - Use useAuth hook to check isAuthenticated
    - If not authenticated: navigate to /login with returnUrl
    - If authenticated: render children
    - Show loading spinner while checking auth state
  </action>
  <verify>ProtectedRoute exports component that redirects to /login when not authenticated</verify>
  <done>Protected routes block unauthenticated access</done>
</task>

<task type="auto">
  <name>Update App.tsx with auth and protected routes</name>
  <files>code-arena/src/App.tsx</files>
  <action>
    Update App.tsx:
    - Import AuthProvider from AuthContext
    - Wrap entire app with AuthProvider in QueryClientProvider
    - Wrap app routes with BrowserRouter (already exists)
    - Add ProtectedRoute wrapper around app routes (/app/*)
    - Public routes (marketing, login, signup) remain unprotected
  </action>
  <verify>App renders with AuthProvider, app routes are protected</verify>
  <done>Auth context integrated into app, protected routes working</done>
</task>

</tasks>

<verification>
- Backend running on port 3000
- Frontend dev server running
- Register new user through UI → user created in database
- Login with registered user → redirected to /app/dashboard
- Refresh page → remain logged in (session persists)
- Access /app/dashboard without login → redirected to /login
- Click logout → redirected to home, session cleared
</verification>

<success_criteria>
Users can register and login through the frontend UI. Sessions persist across page refreshes. Protected routes redirect unauthenticated users to login.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/{phase}-01-SUMMARY.md`
</output>
