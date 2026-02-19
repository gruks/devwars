# Project State

## Current Phase

**Phase**: 06-realtime-sync
**Status**: Complete - 3 of 3 plans complete
**Current Plan**: 06-03 Chat MongoDB Persistence ✓ Complete

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

### lobby-fix-05: Gap Closure - Cookie Auth Middleware ✓ Complete
- Cookie fallback added to authenticate middleware (req.cookies?.accessToken)
- Cookie fallback added to optionalAuth middleware
- Authorization header takes precedence over cookie fallback
- Enables session persistence after browser close/reopen

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
- [x] Cookie fallback in auth middleware (session persists after browser close)
- [x] Question MongoDB model with debug battle schema
- [x] Question CRUD API endpoints with filtering and pagination
- [x] Question seeding with 5 sample debug questions
- [x] Execution service wrapper for sandbox-service API
- [x] Testcase evaluation engine with output comparison
- [x] Code submission evaluation endpoint with score calculation
- [x] Detailed pass/fail results with runtime and memory metrics
- [x] Match MongoDB model with submissions and players
- [x] Match service with full lifecycle (create/start/submit/end)
- [x] Match API endpoints with host-only authorization
- [x] First blood detection and winner calculation
- [x] User stats updates on match completion
- [x] Game socket handlers with 6 real-time events (MATCH_START, CODE_UPDATE, PLAYER_SOLVED, MATCH_END, TIMER_SYNC)
- [x] Timer synchronization with 5-second intervals and auto-end on expiry
- [x] Room controller start-match endpoint with random question selection
- [x] Socket namespace integration (room:{roomId} format)
- [x] Profile API with match history endpoint (GET /users/:username/history)
- [x] User stats endpoint with computed winRate and tier (GET /users/:username/stats)
- [x] Enhanced profile endpoint with comprehensive stats data
- [x] Leaderboard filters (period: daily/weekly/monthly/all, tier: bronze/silver/gold/platinum)
- [x] Dashboard stats API with platform analytics (GET /stats/dashboard)
- [x] Real-time leaderboard updates via socket (LEADERBOARD_UPDATE event)
- [x] Socket.io Redis adapter for multi-server scaling
- [x] Cookie-based JWT socket authentication middleware
- [x] Domain:action event naming convention (lobby:join, room:create, match:start)
- [x] Modular socket structure with dedicated middleware and utilities
- [x] Production socket config (pingTimeout: 60000, connectionStateRecovery)
- [x] Lobby socket handlers (lobby:join, lobby:leave, lobby:stats)
- [x] Room socket handlers (room:create, room:join, room:leave, room:player_ready)
- [x] Socket error handling middleware with asyncHandler
- [x] Frontend SocketContext with auth-based connection
- [x] Lobby page with real-time socket updates
- [x] **Room chat handlers with 50-message in-memory cache**
- [x] **Room handlers with match start and host authorization**
- [x] **ChatPanel React component with real-time messaging**
- [x] **PlayerList React component with ready status toggle**
- [x] **Room page with socket-based real-time updates**
- [x] **ProblemPanel React component with LeetCode-style layout**
- [x] **CodeEditor with Monaco Editor integration and language selection**
- [x] **TestCasePanel for displaying pass/fail results**
- [x] **OpponentPanel for real-time competitor status**
- [x] **Timer component with synchronized countdown**
- [x] **Docker sandbox service with security constraints (256MB memory, 0.5 CPU, 50 pids)**
- [x] **Execution API endpoints (/run, /submit, /validate, /languages)**
- [x] **Test case evaluation with pass/fail results and complexity analysis**
- [x] **Code security validation (blocks eval, exec, subprocess)**

### Phase 06-realtime-sync: Real-time Sync

**Status**: Complete - 3 of 3 plans complete

**Completed Plans**:
1. ~~06-01 — Socket.io Foundation~~ ✓ Complete
2. ~~06-02 — Lobby & Room Handlers~~ ✓ Complete
3. ~~06-03 — Chat MongoDB Persistence~~ ✓ Complete

**Description**: Real-time sync with MongoDB persistence:
- Socket.io foundation with Redis adapter
- Lobby and room socket handlers
- Hybrid in-memory + MongoDB chat message persistence

### Phase frontend-integration: MongoDB Schema Updates

**Status**: In Progress - 4 of 7 plans complete

**Completed Plans**:
1. ~~frontend-integration-06 — MongoDB schemas (test cases, spectators, history)~~ ✓ Complete
2. ~~frontend-integration-07 — WebSocket room broadcasting~~ ✓ Complete
3. ~~frontend-integration-08 — Code Execution Engine~~ ✓ Complete
4. ~~frontend-integration-09 — Room page with Monaco editor & test cases~~ ✓ Complete

**Description**: MongoDB schema updates for LeetCode-style competitive coding:
- Room model with testCases array, spectators array, enhanced submissions with metrics
- CompetitionHistory model for private match results with participant privacy controls
- Match model with executionTime, memoryUsed, detailedTestResults, spectatorCount

### Phase 02-realtime: Real-time Socket Infrastructure

**Status**: Complete - 3 of 3 plans complete

**Completed Plans**:
1. ~~02-01 — Socket.io Foundation~~ ✓ Complete
2. ~~02-02 — Lobby Socket Handlers~~ ✓ Complete
3. ~~02-03 — Room Socket Handlers~~ ✓ Complete

**Description**: Production-ready Socket.io infrastructure with:
- Redis adapter for horizontal scaling
- Cookie-based JWT authentication middleware
- Domain:action event naming convention (lobby:join, room:create)
- Modular socket structure with dedicated middleware
- Production configuration (ping timeouts, state recovery)
- Lobby handlers with real-time room list updates
- Room handlers with join/leave/ready/chat events
- Chat system with 50-message in-memory cache
- Frontend SocketContext with auth-gated connections
- Error handling middleware for socket events

## What's Next

Phase frontend-integration is now in progress with 4 of 7 plans complete.
Ready for next plan: frontend-integration-10 (ML winner prediction)

## Progress

```
Phase 1: Foundation       [██████████] 100% (3/3 plans)
Phase 02-realtime         [██████████] 100% (3/3 plans) - Complete
Phase lobby-fix           [██████████] 100% (5/5 plans)
Phase 3: Game Engine      [██████████] 100% (5/5 plans)
Phase 4: Code Execution   [██████████] 100% (2/2 plans)
Phase 5: Stats & Ranking  [██████████] 100% (2/2 plans)
Phase frontend-integration [█████      ]  57% (4/7 plans)
Overall                   [████████   ]  86% (26/29 plans)
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
- [Phase 03-game-engine]: Match status flow: waiting -> active -> finished with host-only transitions — Prevents invalid state changes and ensures fair game control
- [Phase 01-foundation]: Server waits for both MongoDB and Redis before starting HTTP listener — Prevents race conditions and ensures data layer is ready before accepting requests
- [Phase 01-foundation]: Graceful shutdown closes HTTP server first, then database connections — Prevents new requests during shutdown while allowing in-flight requests to complete
- [Phase frontend-integration]: Relative feature differences for ML prediction — Uses player1 - player2 instead of raw features to handle varying problem difficulties
- [Phase frontend-integration]: Model auto-training on startup — If no serialized model exists, trains initial model when first prediction is requested
- [Phase frontend-integration]: Big-O complexity string to score mapping — O(1)=5 to O(n!)=0 mapping for time and space complexity scores in ML features

### 02-03 (Room Socket Handlers)

69. **In-memory message cache** (2026-02-18) - 50 messages per room stored in-memory sufficient for MVP without database persistence
70. **Auto-scroll chat behavior** (2026-02-18) - ChatPanel automatically scrolls to bottom on new messages for optimal UX
71. **System message styling** (2026-02-18) - System messages centered with muted background to distinguish from user chat
72. **Toast notifications for room events** (2026-02-18) - Player join/leave events show toast notifications for awareness

### 02-02 (Lobby Socket Handlers)

66. **SocketContext auth gating** (2026-02-18) - Socket connects only when user authenticated, disconnects on logout
67. **API fallback for sockets** (2026-02-18) - Lobby falls back to REST API polling when socket disconnected for resilience
68. **5-second disconnect grace period** (2026-02-18) - Allows reconnection without losing room state on brief disconnections

### 02-01 (Socket.io Foundation)

61. **Redis adapter for Socket.io** (2026-02-17) - Enables multi-server horizontal scaling using Redis pub/sub
62. **Cookie-based JWT over session-based** (2026-02-17) - Better for stateless horizontal scaling; reads accessToken from httpOnly cookies
63. **Domain:action event naming** (2026-02-17) - Clear organization: lobby:join, room:create, match:start - lowercase with colon separator

### frontend-integration-08 (Code Execution Engine)

73. **Docker sandbox isolation** (2026-02-18) - Uses Docker with memory (256MB), CPU (0.5), pids (50) limits, read-only filesystem, no-new-privileges security option
74. **Test case validation** (2026-02-18) - Runs 2 test cases, compares output with expected (trimmed whitespace), returns detailed results with pass/fail
75. **Complexity analysis** (2026-02-18) - Heuristic analysis: loop counting for time complexity, array allocations for space complexity
76. **Security validation** (2026-02-18) - Blocks dangerous patterns: eval, Function constructor, os/subprocess imports, exec/spawn at validation layer

### frontend-integration-09 (Room Page with Monaco Editor)

77. **Monaco Editor integration** (2026-02-18) - Used @monaco-editor/react for VS Code-like editing with syntax highlighting, IntelliSense, and error detection
78. **LocalStorage persistence** (2026-02-18) - Code and language preferences saved to localStorage for session continuity
79. **Real-time opponent sync** (2026-02-18) - Socket events for opponent code updates (first 100 chars), typing status, and test results
64. **Unauthenticated socket connections** (2026-02-17) - Allow public lobby viewing without login; auth only required for actions
65. **Production socket configuration** (2026-02-17) - 60s ping timeout, 25s ping interval, 2min connection recovery, websocket+polling transports

### 05-02 (Leaderboard Enhancements)

57. **Period filter field** (2026-02-17) - Uses `updatedAt` timestamp to filter by recent activity (daily/weekly/monthly)
58. **Tier rating thresholds** (2026-02-17) - Matched existing skill brackets: bronze <1100, silver 1100-1299, gold 1300-1599, platinum ≥1600
59. **Dashboard aggregation** (2026-02-17) - Parallel Promise.all for efficient statistics calculation
60. **Socket broadcast scope** (2026-02-17) - Global io.emit for LEADERBOARD_UPDATE to all connected clients

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

### 05-01 (Profile API)

52. **Tier thresholds** (2026-02-17) - Bronze <1100, Silver 1100-1299, Gold 1300-1599, Platinum 1600+. Aligns with existing skill level brackets used in lobby
53. **winRate calculation** (2026-02-17) - Calculated as (wins / matchesPlayed) * 100, formatted to 1 decimal place. Returns "0.0%" when no matches played
54. **Match history defaults** (2026-02-17) - Default to 'finished' matches only. Supports ?status=all to include waiting/active matches
55. **Pagination limits** (2026-02-17) - Default 20 items per page, max 100, using standard page/limit query params
56. **Duration calculation** (2026-02-17) - Uses match endTime if available, otherwise uses submission solvedAt. Falls back to 0

### 03-05 (Frontend Room Integration)

44. **Rejoin pattern** (2026-02-15) - Players who leave are kept in room.players array with departedAt timestamp, enabling rejoin if room is still waiting
45. **Active player counting** (2026-02-15) - playerCount and isFull virtuals now filter out departed players for accurate room capacity
46. **Match results endpoint** (2026-02-15) - Fetch from /lobby/rooms/:id/results which returns winner and player scores

### 04-01 (Code Execution Queue)

47. **BullMQ queue** (2026-02-17) - Used BullMQ for queue management with Redis backend for job processing
48. **Redis reconnection strategy** (2026-02-17) - Implemented exponential backoff for Redis reconnection stability

### 04-02 (Backend Integration)

49. **Async job processing** (2026-02-17) - Changed from blocking waitUntilFinished to async polling pattern for reliability
50. **Docker Compose orchestration** (2026-02-17) - Created compilers/docker-compose.yml for easy service startup
51. **Multi-language verification** (2026-02-17) - Verified all 5 languages work via API: JavaScript, Python, Java, Go, C++

### 03-04 (Real-time Game Socket Events)

39. **Socket event format** (2026-02-15) - Consistent `{ type, data }` structure for all socket events enables uniform frontend handling
40. **Timer sync frequency** (2026-02-15) - 5-second intervals balance real-time feel with network efficiency
41. **Auto-end on timer expiry** (2026-02-15) - Match automatically ends when timer reaches 0 without host action required
42. **Question selection** (2026-02-15) - Randomly select from available questions matching room difficulty
43. **Room namespace format** (2026-02-15) - Using `room:{roomId}` enables targeted broadcasts to specific rooms

### 03-03 (Match State Management)

35. **Match status flow** (2026-02-15) - Clear state machine: waiting → active → finished with host-only transitions for fairness
36. **Winner determination** (2026-02-15) - Highest score wins; earliest solve time breaks ties for competitive balance
37. **Submissions history** (2026-02-15) - Store full submission data with test results for replay, debugging, and analytics
38. **Host-only middleware** (2026-02-15) - Reusable middleware validates room creator for privileged match actions

### 03-02 (Execution Service and Evaluation)

30. **Language mapping** (2026-02-15) - Mapped internal language names to sandbox format: python->python, node/javascript->javascript, java->java, go->go, cpp->cpp
31. **Output comparison strategy** (2026-02-15) - Trim whitespace and use exact match to avoid false failures from trailing newlines
32. **Score calculation** (2026-02-15) - Percentage-based scoring: (passed / total) * 100, rounded to nearest integer
33. **Execution timeout** (2026-02-15) - 3000ms default for direct calls, 5000ms for testcase evaluation to account for overhead
34. **Error handling pattern** (2026-02-15) - Return structured error object { success: false, output, error, runtime, memory } instead of throwing for graceful degradation

### 03-01 (Question Model and API)

25. **Question ID format** (2026-02-15) - Used q-xxxxx format for human-readable identifiers via uuid-based generation in pre-validate hook
26. **Hidden solutions in list view** (2026-02-15) - Solutions and hints excluded from GET /questions to prevent cheating; full question available at GET /questions/:id
27. **Idempotent seeding pattern** (2026-02-15) - Seed operation clears existing debug questions before inserting samples for clean reset
28. **Multi-language question support** (2026-02-15) - Schema supports python, javascript, java, go, cpp, csharp, ruby, rust for future expansion
29. **Admin-only question management** (2026-02-15) - Create and seed endpoints require admin role via authorize('admin') middleware

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
- Real-time socket infrastructure complete with Redis adapter
- Ready for next phase (TBD)
- Future: Microservice extraction possible from module boundaries
- OAuth integration planned for future enhancement

## Last Session

- **Stopped At**: Completed 06-03-PLAN.md (Chat MongoDB Persistence)
- **Commits**: 1 commit (Message schema, chat persistence)
- **Duration**: 3 min
- **Completed**: 2026-02-19
