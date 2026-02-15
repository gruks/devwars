# DevWars Authentication Error Diagnosis & Fixes

## 🔴 Problem Summary

The application was experiencing authentication failures with the following errors:
```
Error: Access token required
GET /api/v1/auth/me 401 (Unauthorized)
POST /api/v1/auth/refresh 400 (Bad Request)
```

## 🔍 Root Causes Identified

### 1. **Cookie Transmission Issues**
- **Issue**: Cookies weren't being properly sent between frontend and backend
- **Cause**: `sameSite: 'lax'` cookie setting can block cookies in certain cross-origin scenarios
- **Impact**: Access tokens stored in httpOnly cookies weren't reaching the backend

### 2. **Missing Cookie Path**
- **Issue**: No explicit path set for cookies
- **Cause**: Cookies without explicit paths may not be sent with all requests
- **Impact**: Some API endpoints might not receive authentication cookies

### 3. **CORS Configuration Mismatch**
- **Issue**: Vite dev server runs on port 8080, but CORS was only configured for 5173
- **Cause**: `vite.config.ts` sets `port: 8080`, but `.env` only had `http://localhost:5173`
- **Impact**: CORS errors preventing cookie transmission

## ✅ Fixes Applied

### Fix 1: Updated Cookie Configuration
**File**: `backend/src/modules/auth/auth.controller.js`

**Changes**:
```javascript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax', // Better cross-origin support
  path: '/', // Explicit path for all requests
};
```

**Rationale**:
- `path: '/'` ensures cookies are sent with ALL API requests
- `sameSite: 'lax'` for development (works with localhost)
- `sameSite: 'none'` for production (required for cross-origin with HTTPS)

### Fix 2: Enhanced Debugging
**File**: `backend/src/modules/auth/auth.middleware.js`

**Changes**:
- Added detailed cookie debugging to show which cookies are received
- Helps diagnose future authentication issues

### Fix 3: CORS Configuration Update
**File**: `backend/.env` & `backend/src/server.js`

**Changes**:
- Updated `.env` to include port 8080
- Updated `server.js` to properly parse `ALLOWED_ORIGINS`
- Ensures Socket.io CORS matches Express CORS

### Fix 4: Socket.io Critical Fixes
**File**: `backend/src/config/socket.js`

**Changes**:
1. Fixed `ReferenceError: io is not defined` by passing `io` instance to helper functions
2. Added cookie parsing to `io.use()` middleware to support authentication via httpOnly cookies

## 🧪 Testing Steps

To verify the fixes work:

1. **Restart the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Restart the frontend**:
   ```bash
   cd code-arena
   npm run dev
   ```

3. **Test authentication flow**:
   - Navigate to `http://localhost:8080`
   - Try to register a new user
   - Check browser DevTools → Application → Cookies
   - You should see `accessToken` and `refreshToken` cookies
   - The `/api/v1/auth/me` endpoint should return 200 OK

4. **Check backend logs**:
   - Look for `[DEBUG authenticate]` messages
   - Should show: `accessToken in cookies: YES`

## 📊 Architecture Overview

### Cookie-Based Authentication Flow

```
┌─────────────┐                    ┌─────────────┐
│   Frontend  │                    │   Backend   │
│ (Port 8080) │                    │ (Port 3000) │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. POST /auth/login             │
       │  { email, password }             │
       ├─────────────────────────────────►│
       │                                  │
       │  2. Set-Cookie: accessToken      │
       │     Set-Cookie: refreshToken     │
       │◄─────────────────────────────────┤
       │                                  │
       │  3. GET /auth/me                 │
       │  Cookie: accessToken=...         │
       ├─────────────────────────────────►│
       │                                  │
       │  4. Verify JWT from cookie       │
       │     Return user data             │
       │◄─────────────────────────────────┤
       │                                  │
```

### Key Components

**Backend**:
- `auth.controller.js` - Sets httpOnly cookies on login/register
- `auth.middleware.js` - Reads cookies and verifies JWT
- `cookie-parser` - Parses cookies from requests
- CORS configured with `credentials: true`

**Frontend**:
- `api.ts` - Axios instance with `withCredentials: true`
- `AuthContext.tsx` - Manages auth state
- Automatic token refresh on 401 errors
- No manual token storage (cookies are httpOnly)

## 🔒 Security Features

1. **httpOnly Cookies**: Prevents XSS attacks (JavaScript can't access tokens)
2. **Secure Flag**: Ensures cookies only sent over HTTPS in production
3. **SameSite**: Prevents CSRF attacks
4. **CORS**: Restricts which origins can make authenticated requests
5. **Short-lived Access Tokens**: 15 minutes (reduces exposure window)
6. **Refresh Token Rotation**: New tokens issued on refresh

## 🐛 Common Issues & Solutions

### Issue: "Access token required" error
**Solution**: 
- Check browser cookies (DevTools → Application → Cookies)
- Verify `withCredentials: true` in frontend API calls
- Check CORS configuration includes your frontend origin

### Issue: Cookies not being set
**Solution**:
- Verify `cookie-parser` middleware is loaded before routes
- Check `sameSite` setting matches your environment
- Ensure `secure: false` in development (or use HTTPS)

### Issue: Refresh token fails
**Solution**:
- Check refresh token exists in cookies
- Verify refresh token hasn't expired
- Check backend logs for JWT verification errors

## 📝 Additional Notes

### Development vs Production

**Development** (current setup):
- `sameSite: 'lax'` - Works with localhost
- `secure: false` - Works with HTTP
- CORS allows `http://localhost:*`

**Production** (recommended):
- `sameSite: 'none'` - Required for cross-origin
- `secure: true` - Required for `sameSite: 'none'`
- CORS allows specific production domains only
- Use HTTPS for both frontend and backend

### Token Lifetimes

- **Access Token**: 15 minutes (short-lived for security)
- **Refresh Token**: 7 days (default) or 30 days (with "Remember Me")
- **Auto-refresh**: Every 5 minutes (frontend)

## 🚀 Next Steps

1. **Test the fixes** by restarting both servers
2. **Monitor logs** for any remaining authentication errors
3. **Check browser DevTools** to verify cookies are being set
4. **Test all auth flows**: register, login, logout, token refresh
5. **Consider adding** automated tests for authentication

## 📚 Related Files

- `backend/src/modules/auth/auth.controller.js` - Cookie management
- `backend/src/modules/auth/auth.middleware.js` - Token verification
- `backend/src/modules/auth/auth.routes.js` - Auth endpoints
- `backend/src/app.js` - Middleware configuration
- `code-arena/src/lib/api.ts` - Frontend API client
- `code-arena/src/contexts/AuthContext.tsx` - Auth state management
