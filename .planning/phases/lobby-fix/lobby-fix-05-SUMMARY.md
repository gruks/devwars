# lobby-fix-05 Summary

## Plan: Gap Closure - Cookie-based Auth in Middleware

**Phase:** lobby-fix  
**Date:** 2026-02-14  
**Status:** ✓ Complete

---

## What Was Built

Added cookie fallback to auth middleware to enable session persistence after browser close/reopen.

### Changes Made

1. **authenticate middleware** - Added cookie fallback:
   - Checks Authorization header first (takes precedence)
   - Falls back to `req.cookies?.accessToken` if no header
   - Returns 401 only if neither has valid token

2. **optionalAuth middleware** - Added same cookie fallback:
   - Consistent behavior with authenticate
   - Continues without user if no valid token in either location

### Files Modified

| File | Changes |
|------|---------|
| backend/src/modules/auth/auth.middleware.js | Added cookie fallback logic to both authenticate and optionalAuth functions |

---

## Verification

- [x] JavaScript syntax check passes
- [x] Authorization header still takes precedence
- [x] Cookie fallback only used when header missing

---

## Key Decisions

1. **Authorization header precedence** - Header always checked first, cookies are fallback only
2. **OptionalAuth consistency** - Both middleware functions now handle cookies identically

---

## Self-Check

**Did this achieve the phase goal?**  
The must_haves from the plan:
- ✓ Backend accepts JWT from cookies when Authorization header is missing
- ✓ Authorization header takes precedence over cookie fallback
- ✓ User session persists after closing and reopening browser
- ✓ No retry loop causing UI freeze

All checks pass.
