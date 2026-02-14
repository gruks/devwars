# Project State

## Current Phase

**Phase**: lobby-fix
**Status**: In Progress - 1 of N plans complete

## Phase Plans

### lobby-fix-01: Persistent Session Management ✓ Complete
- Cookie-based authentication with httpOnly tokens
- Automatic token refresh (5-min intervals)
- Remember me functionality (30-day sessions)
- Frontend AuthContext with session persistence

## What's Been Built

- [x] Basic Express server with security middleware (helmet, cors)
- [x] Project folder structure with src/ directory
- [x] Environment configuration with validation (env.js)
- [x] Winston logging with colorized output (logger.js)
- [x] Constants module with HTTP status, socket events, game constants
- [x] Helper utilities: asyncHandler, response formatters
- [x] Error handling middleware with AppError class
- [x] MongoDB connection module with mongoose
- [x] Redis connection module with reconnection strategy
- [x] Server lifecycle management (startup/shutdown)
- [x] Graceful shutdown handling for all connections
- [x] User Mongoose model with password hashing and stats
- [x] JWT authentication system with bcrypt
- [x] Auth service layer with token rotation
- [x] Protected route middleware with role authorization
- [x] Auth endpoints: register, login, refresh, logout, me
- [x] Cookie-based session management (httpOnly tokens)
- [x] Automatic token refresh (5-minute intervals)
- [x] Remember me functionality (30-day extended sessions)

## What's Next

### Phase 1: Foundation

**Status**: ✓ All plans complete

**Completed Plans**:
1. ~~01-01 — Project setup and configuration~~ ✓ Complete
2. ~~01-02 — Database and Redis connections~~ ✓ Complete
3. ~~01-03 — Authentication system~~ ✓ Complete

**Next Phase**: Ready to begin Phase 2 (Core Features)

## Progress

```
Phase 1: Foundation    [██████████] 100% (3/3 plans)
Phase lobby-fix        [░░░░░░░░░░]   0% (1/N plans)
Overall                [░░░░░░░░░░]   0% (1/4+ plans)
```

## Decisions

### Locked Decisions

| Decision | Value | Context |
|----------|-------|---------|
| Runtime | Node.js | User specification |
| Framework | Express.js | User specification |
| Database | MongoDB | For flexible document structure |
| Cache | Redis | For sessions and real-time state |
| ORM | Mongoose | Schema validation, middleware, built-in CRUD |
| Real-time | Socket.io | Industry standard for Node.js |
| Queue | BullMQ | Redis-based, Node-native |
| Auth | JWT | Stateless, scalable |
| Execution | Docker | Security isolation |

### Recent Decisions (01-01)

| Decision | Value | Rationale |
|----------|-------|-----------|
| dotenv version | 16.5.0 | Avoid v17 injection log spam |
| App/Server separation | Yes | app.js configures, server.js starts |
| Error pattern | AppError class | Distinguishes operational vs programming errors |
| Response format | Standard envelope | { success, message, data?, meta? } |

### Pending Decisions

| Topic | Options | When to Decide |
|-------|---------|----------------|
| OAuth providers | Google, GitHub, Discord | Phase 2+ (future enhancement) |
| Test framework | Jest vs Mocha | Phase 2 |
| Frontend framework | React, Vue, Svelte | Phase 2 |

## Recent Decisions

### lobby-fix-01 (Session Management)

9. **httpOnly cookies for tokens** (2026-02-14) - Protect against XSS by storing tokens in httpOnly cookies instead of localStorage
10. **Token refresh interval** (2026-02-14) - Auto-refresh tokens every 5 minutes during active sessions to prevent expiry
11. **Remember me sessions** (2026-02-14) - 30-day sessions when remember me enabled, 7-day standard sessions

### 01-03 (Authentication)

5. **bcryptjs over bcrypt** (2026-02-13) - Pure JavaScript password hashing for easier deployment without native dependencies
6. **Token rotation** (2026-02-13) - Refresh tokens are single-use for enhanced security; each refresh issues new token pair
7. **Service layer pattern** (2026-02-13) - Separated business logic from HTTP handling for better testability and maintainability
8. **Password field protection** (2026-02-13) - Used `select: false` and custom `toJSON()` to ensure passwords never exposed in API responses

### Previous Decisions

1. **ORM: Mongoose** (2026-02-13) - Chose mongoose over native driver for schema validation, middleware support, and built-in CRUD methods
2. **Server waits for databases** (2026-02-13) - Server startup waits for MongoDB and Redis connections before accepting HTTP requests
3. **Graceful shutdown pattern** (2026-02-13) - HTTP server closes first (drains connections), then database connections
4. **dotenv v16.5.0** (2026-02-13) - Chose stable v16 over v17 to avoid injection log messages

## Blockers

None currently.

## Notes

- User provided comprehensive architecture document
- Targeting MVP with modular structure
- Database connections established and tested
- Foundation infrastructure complete with logging, errors, env config
- Authentication system complete with JWT, bcrypt, and role-based access
- Ready for Phase 2: Core Features (lobby, rooms, matches, challenges)
- Future: Microservice extraction possible from module boundaries
- OAuth integration planned for future enhancement

## Last Session

- **Stopped At**: Completed lobby-fix-01-PLAN.md (Persistent Session Management)
- **Commits**: 4 atomic commits + 2 submodule reference commits
- **Duration**: 4 minutes
- **Completed**: 2026-02-14
