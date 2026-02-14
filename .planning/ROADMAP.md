# DevWars Project Roadmap

## Project Overview

**Goal**: Build a production-ready competitive coding battle platform with React frontend and Node.js backend

**Current State**: Backend Phase 1 complete, Frontend (code-arena) UI exists but not connected

**Target State**: Full-stack MVP with auth-connected frontend, real-time lobby, battle system

## Phase Breakdown

### Phase 0: Frontend Integration

**Goal**: Connect code-arena React frontend to backend APIs

**Duration**: ~1 plan

**Delivers**:
- Axios API client with auth interceptors
- AuthContext for state management
- Login/Signup pages connected to backend
- Protected routes for authenticated areas

**Plans**:
- [ ] frontend-integration-01 — Connect frontend to backend auth

---

### Phase 1: Foundation (Infrastructure & Auth)

**Goal**: Establish the core infrastructure with database, authentication, and project structure

**Duration**: ~3 plans

**Delivers**:
- Database connection (MongoDB)
- Redis configuration
- Environment configuration
- Logger utility
- Error handling middleware
- JWT authentication system
- User model and service
- Auth routes (login, register, refresh)

**Plans**:
- [x] 01-01 — Project setup and configuration
- [x] 01-02 — Database and Redis connections
- [x] 01-03 — Authentication system
- [ ] 01-04 — Gap closure: Wire database connections into server lifecycle

---

### Phase 2: Real-time Foundation (Socket.io & Lobby)

**Goal**: Implement real-time communication infrastructure and lobby system

**Duration**: ~2 plans

**Delivers**:
- Socket.io server setup
- Socket authentication middleware
- Lobby system (rooms list, player status)
- Room creation and joining
- Basic socket events (LOBBY_JOIN, ROOM_CREATE, ROOM_JOIN, ROOM_LEAVE)

**Plans**:
- [ ] 02-01 — Socket.io setup and authentication
- [ ] 02-02 — Lobby and room management

---

### Phase 3: Game Engine (Debug Battle)

**Goal**: Build the core game mechanics and battle system

**Duration**: ~3 plans

**Delivers**:
- Debug battle engine
- Buggy code repository
- Test case system
- Timer synchronization
- Match state management
- Socket events (MATCH_START, CODE_UPDATE, CODE_SUBMIT, PLAYER_SOLVED, MATCH_END)

**Plans**:
- [ ] 03-01 — Battle engine and game logic
- [ ] 03-02 — Match state management
- [ ] 03-03 — Game socket events and synchronization

---

### Phase 4: Code Execution (Docker Workers)

**Goal**: Implement secure code execution with Docker isolation

**Duration**: ~2 plans

**Delivers**:
- Docker execution environment
- BullMQ queue setup
- Code execution worker
- Security constraints (no network, timeouts, memory limits)
- Execution results handling
- Socket event (EXEC_RESULT)

**Plans**:
- [ ] 04-01 — Docker setup and queue system
- [ ] 04-02 — Code execution worker and integration

---

### Phase 5: Stats & Ranking

**Goal**: Complete the API with profile, leaderboard, and dashboard

**Duration**: ~2 plans

**Delivers**:
- Profile API (user stats, match history)
- Leaderboard API (rankings, filters)
- Dashboard stats API
- Leaderboard update socket event
- Scoring service

**Plans**:
- [ ] 05-01 — Profile and user stats
- [ ] 05-02 — Leaderboard and dashboard

---

## Success Criteria

### MVP Complete When:

1. **Authentication**: Users can register, login, and maintain sessions
2. **Real-time**: Socket connections work with authentication
3. **Lobby**: Users can see rooms and join them
4. **Battle**: Debug battles run end-to-end with code submission
5. **Execution**: Code runs safely in Docker containers
6. **Results**: Winners determined, scores recorded
7. **Stats**: Profiles and leaderboards display correctly

### Technical Requirements:

- All API endpoints documented and functional
- Socket events follow defined protocol
- Docker execution has security constraints
- Database properly indexed for queries
- Error handling consistent across modules
