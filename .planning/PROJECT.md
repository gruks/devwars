# DevWars Backend

A competitive coding battle platform backend built with Node.js, Express, Socket.io, and Docker-based code execution.

## Vision

DevWars is a real-time coding competition platform where developers battle head-to-head by debugging and fixing buggy code. The fastest, most accurate coder wins.

## Core Features (MVP)

- **Authentication**: JWT-based auth with OAuth support
- **Lobby System**: Player status, public/private rooms, quick match
- **Room System**: Real-time game rooms with state synchronization
- **Debug Battle Engine**: Code debugging challenges with test cases
- **Code Execution**: Docker-isolated code running with security constraints
- **Leaderboard**: Player rankings and stats
- **Profile**: User stats and match history

## Technical Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Real-time | Socket.io |
| Database | MongoDB (Mongoose) |
| Cache | Redis |
| Queue | BullMQ |
| Auth | JWT + Passport.js |
| Execution | Docker containers |
| Validation | Joi or Zod |

## Architecture Principles

1. **Modular Design**: Feature-based module structure
2. **Service Layer**: Business logic separated from controllers
3. **Socket Layer**: Dedicated socket event handlers
4. **Worker Isolation**: Code execution in Docker workers
5. **Queue-based**: Async processing via BullMQ

## Project Structure

```
devwars-backend/
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app setup
│   ├── config/                # Configuration (db, redis, env)
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication
│   │   ├── users/             # User management
│   │   ├── lobby/             # Lobby system
│   │   ├── room/              # Room management
│   │   ├── game/              # Game engine
│   │   └── leaderboard/       # Rankings
│   ├── sockets/               # Socket.io handlers
│   ├── services/              # Shared services
│   ├── workers/               # Background workers
│   ├── queues/                # BullMQ queues
│   ├── middlewares/           # Express middlewares
│   └── utils/                 # Utilities
├── docker/                    # Docker configurations
└── docker-compose.yml         # Local development stack
```

## MVP Scope

### Pages Supported
- Landing → public API
- Login → auth service
- Dashboard → stats API
- Lobby → matchmaking API
- Room → real-time system
- Debug Battle → game engine
- Profile → user service
- Leaderboard → ranking system

## Database Collections (MVP)

- `users` - User accounts and profiles
- `matches` - Match records and results
- `rooms` - Active game rooms
- `submissions` - Code submissions
- `scores` - Player scores
- `leaderboard` - Rankings
- `stats` - Aggregated statistics
