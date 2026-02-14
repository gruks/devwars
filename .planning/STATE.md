# Project State

## Current Phase

**Phase**: lobby-fix
**Status**: Complete - 4 of 4 plans complete

## Phase Plans

### lobby-fix-01: Persistent Session Management ✓ Complete
- Cookie-based authentication with httpOnly tokens
- Automatic token refresh (5-min intervals)
- Remember me functionality (30-day sessions)
- Frontend AuthContext with session persistence

### lobby-fix-02: Create Room Flow ✓ Complete
- Create room endpoint with comprehensive validation
- Auto-generated room names with random 6-char codes
- Skill level auto-detection based on user rating
- Frontend room creation with validation and error handling
- Duplicate invite code retry logic

### lobby-fix-03: Room Lifecycle and Timestamps ✓ Complete
- Player join timestamp tracking (joinedAt, lastActiveAt, departedAt)
- Match start endpoint with host authorization
- Match end endpoint with player stats updates
- Match results endpoint with duration calculation
- Frontend status badges (waiting/playing/finished)
- Relative time display for room creation

### lobby-fix-04: Lobby Functionality ✓ Complete
- Room listing with mode/status/search filtering
- Join room endpoint with validation (exists, waiting, not full, not joined)
- Leave room endpoint with host transfer and empty room deletion
- Lobby auto-refresh polling with graceful error handling
- Frontend refresh after successful join

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
- [x] Room creation endpoint with input validation
- [x] Auto-generated room names (Room-{6char})
- [x] Skill level detection (beginner→expert based on rating)
- [x] Frontend room creation form with validation
- [x] Player timestamp tracking (joinedAt, lastActiveAt, departedAt)
- [x] Match start/end endpoints with authorization
- [x] Player stats updates on match completion (wins/losses/rating)
- [x] Frontend room status display (waiting/playing/finished)
- [x] Room filtering by mode, status, and search
- [x] Join/leave room with proper validation
- [x] Lobby auto-refresh with 5-second polling
- [x] Host transfer on leave
- [x] Empty room auto-deletion

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
Phase lobby-fix        [██████████] 100% (4/4 plans)
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

### lobby-fix-04 (Lobby Functionality)

19. **Lobby room filtering** (2026-02-14) - Default to non-finished rooms only; support mode, status, and search filters via query params
20. **Search implementation** (2026-02-14) - Case-insensitive regex search on room name and invite code
21. **Join validation** (2026-02-14) - Validate room exists, status is waiting, not at capacity, user not already joined
22. **Host transfer logic** (2026-02-14) - When host leaves, first remaining player becomes new host
23. **Empty room cleanup** (2026-02-14) - Rooms are deleted when last player leaves to keep database clean
24. **Polling error handling** (2026-02-14) - Silent fail on polling errors to maintain UX without disruption

### lobby-fix-03 (Room Lifecycle)

16. **Player activity tracking** (2026-02-14) - Added lastActiveAt for activity monitoring and departedAt for audit trail when players leave
17. **Match authorization** (2026-02-14) - Only room host can start match; host or system can end match
18. **Rating adjustment formula** (2026-02-14) - +25 points for win, -15 points for loss, minimum rating 100

### lobby-fix-02 (Create Room Flow)

12. **Skill level thresholds** (2026-02-14) - Rating brackets: >=1600 expert, >=1300 advanced, >=1000 intermediate, <1000 beginner
13. **Room name auto-generation** (2026-02-14) - Format "Room-{6 random alphanumeric chars}" when name not provided
14. **Double validation strategy** (2026-02-14) - Frontend for UX, backend for security
15. **Invite code collision handling** (2026-02-14) - Retry up to 3 times on duplicate code before failing

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

- **Stopped At**: Completed lobby-fix-04-PLAN.md (Lobby Functionality)
- **Commits**: 5 atomic commits + 1 submodule reference commit
- **Duration**: 15 minutes
- **Completed**: 2026-02-14
