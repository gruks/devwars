# Phase 02: Real-time Foundation - Research Document

**Date**: 2026-02-14
**Phase**: 02-realtime
**Goal**: Implement Socket.io server, authentication, Redis adapter, and lobby system

---

## Executive Summary

Based on analysis of the existing codebase and Socket.io best practices, this document outlines what needs to be known to successfully plan and implement Phase 02. The existing codebase already has a basic Socket.io setup with JWT authentication and room management, but needs enhancements for production readiness.

---

## 1. Socket.io Setup Guide

### Current State Analysis
The existing codebase already has Socket.io initialized in `server.js`:
- Server created with Express HTTP server
- CORS configured for development origins
- Basic Socket.io instance created

**Current Implementation** (`backend/src/server.js`):
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:8080'],
    credentials: true
  }
});
```

### Required Enhancements

#### 1.1 Production Configuration
- **Ping timeouts**: Configure for detecting disconnected clients
  ```javascript
  {
    pingTimeout: 60000,      // 60 seconds
    pingInterval: 25000,     // 25 seconds
    transports: ['websocket', 'polling'] // Fallback support
  }
  ```

- **Connection state recovery**: Enable for seamless reconnections
  ```javascript
  {
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true
    }
  }
  ```

#### 1.2 CORS Alignment
The Socket.io CORS must match Express CORS exactly:
```javascript
const corsOptions = {
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Use same options for both Express and Socket.io
app.use(cors(corsOptions));
const io = new Server(httpServer, { cors: corsOptions });
```

---

## 2. Authentication Middleware Pattern

### Current State Analysis
The existing implementation in `socket.js` uses token from `handshake.auth` or `handshake.query`:
```javascript
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    // ... verify token
  } catch (error) {
    next(); // Allows unauthenticated connections
  }
});
```

### Critical Gap: Cookie-Based Authentication
**Problem**: The system uses httpOnly cookies for JWT (set in `auth.controller.js`), but Socket.io middleware doesn't read cookies.

**Solution**: Access cookies via `socket.handshake.headers.cookie`:
```javascript
const cookie = require('cookie');

io.use(async (socket, next) => {
  try {
    // Parse cookies from handshake headers
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = cookies.accessToken;
    
    if (!token) {
      // Allow unauthenticated for public lobby viewing
      return next();
    }
    
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive) {
      socket.user = {
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      };
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Let client handle re-auth
      return next(new Error('Token expired'));
    }
    next(); // Allow unauthenticated
  }
});
```

### Authentication Flow
1. Client connects with httpOnly cookies (automatically sent by browser)
2. Server extracts `accessToken` from cookies in handshake
3. JWT verified against `JWT_SECRET`
4. User attached to socket or connection rejected
5. For protected events, check `socket.user` exists

---

## 3. Redis Adapter Configuration

### Why Redis Adapter?
- **Multi-server scaling**: Events broadcast across all server instances
- **Shared state**: Room memberships synchronized across cluster
- **Production requirement**: Essential for horizontal scaling

### Installation
```bash
npm install @socket.io/redis-adapter
```

### Configuration
```javascript
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

async function setupRedisAdapter(io) {
  const pubClient = createClient({ 
    url: env.REDIS_URL 
  });
  const subClient = pubClient.duplicate();
  
  await Promise.all([
    pubClient.connect(),
    subClient.connect()
  ]);
  
  io.adapter(createAdapter(pubClient, subClient));
  
  console.log('Redis adapter connected');
  
  // Handle Redis errors
  pubClient.on('error', (err) => console.error('Redis pub error:', err));
  subClient.on('error', (err) => console.error('Redis sub error:', err));
}
```

### Integration Point
Modify `server.js` to initialize adapter:
```javascript
const io = new Server(httpServer, { /* config */ });

// Setup Redis adapter before initializing socket handlers
await setupRedisAdapter(io);

initializeSocket(io);
```

### Load Balancer Requirements
When using multiple servers with Redis adapter:
- **Sticky sessions required**: Client must connect to same server
- Nginx example:
  ```nginx
  upstream socket_nodes {
    ip_hash;  # Sticky sessions
    server localhost:3000;
    server localhost:3001;
  }
  ```

---

## 4. Room Management Patterns

### Socket.io Rooms vs Application Rooms

**Socket.io Rooms** (server-side only):
- Ephemeral channels for broadcasting
- Created with `socket.join('room-name')`
- Deleted when last socket leaves
- Pattern: `room:${roomId}` for game rooms, `lobby` for lobby

**Application Rooms** (MongoDB persistence):
- Long-lived game sessions
- Store in `Room` model with player arrays
- Survive server restarts
- Need manual cleanup of empty rooms

### Current Implementation Analysis
The existing code mixes both:
```javascript
// Good: Socket.io room for broadcasting
socket.join(`room:${room._id}`);

// Good: MongoDB room for persistence
const room = await Room.create({ ... });
```

### Best Practices

#### 4.1 Room Naming Convention
```javascript
// Game rooms
`room:${roomId}`          // e.g., room:507f1f77bcf86cd799439011

// User-specific rooms
`user:${userId}`          // For direct messages/notifications

// System rooms
'lobby'                   // Public lobby
'admin'                   // Admin notifications
```

#### 4.2 Room Lifecycle Management
```javascript
// On player join
socket.on('ROOM_JOIN', async (data, callback) => {
  const { roomId } = data;
  
  // 1. Validate room exists and is joinable
  const room = await Room.findById(roomId);
  if (!room || !room.canJoin()) {
    return callback({ success: false, error: 'Room not available' });
  }
  
  // 2. Leave previous room if any
  const prevRoom = socketRooms.get(socket.id);
  if (prevRoom) {
    await leaveRoom(socket, prevRoom);
  }
  
  // 3. Update database
  await room.addPlayer(socket.user.userId, socket.user.username);
  
  // 4. Join Socket.io room
  socket.join(`room:${roomId}`);
  socketRooms.set(socket.id, roomId);
  
  // 5. Broadcast to room
  socket.to(`room:${roomId}`).emit('PLAYER_JOINED', { 
    userId: socket.user.userId,
    username: socket.user.username
  });
  
  // 6. Broadcast to lobby
  io.to('lobby').emit('ROOM_UPDATED', { room });
  
  callback({ success: true, room });
});

// On disconnect - cleanup
socket.on('disconnect', async () => {
  const roomId = socketRooms.get(socket.id);
  if (roomId) {
    await leaveRoom(socket, roomId);
  }
});
```

#### 4.3 Handling Empty Rooms
```javascript
// In room model (already implemented)
roomSchema.methods.removePlayer = function(userId) {
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  
  // Auto-delete empty rooms
  if (this.players.length === 0) {
    return this.deleteOne();
  }
  
  // Transfer host if needed
  if (this.createdBy.toString() === userId.toString()) {
    this.createdBy = this.players[0].userId;
  }
  
  return this.save();
};
```

---

## 5. Event Protocol Definition

### Naming Convention
Use **domain:action** pattern for consistency:

```javascript
const EVENTS = {
  // Lobby domain
  LOBBY: {
    JOIN: 'lobby:join',
    LEAVE: 'lobby:leave',
    ROOM_LIST: 'lobby:room_list',
    STATS: 'lobby:stats'
  },
  
  // Room domain
  ROOM: {
    CREATE: 'room:create',
    JOIN: 'room:join',
    LEAVE: 'room:leave',
    UPDATE: 'room:update',
    DELETE: 'room:delete',
    PLAYER_JOINED: 'room:player_joined',
    PLAYER_LEFT: 'room:player_left',
    PLAYER_READY: 'room:player_ready',
    CHAT_MESSAGE: 'room:chat_message'
  },
  
  // Match domain
  MATCH: {
    START: 'match:start',
    STARTED: 'match:started',
    END: 'match:end',
    ENDED: 'match:ended',
    STATE_UPDATE: 'match:state_update'
  },
  
  // Player domain
  PLAYER: {
    ONLINE: 'player:online',
    OFFLINE: 'player:offline',
    STATUS_CHANGE: 'player:status_change'
  },
  
  // System domain
  SYSTEM: {
    ERROR: 'system:error',
    PING: 'system:ping',
    PONG: 'system:pong'
  }
};
```

### Event Structure

#### Client → Server (Actions)
```typescript
interface ClientEvent {
  event: string;
  payload: any;
  callback?: (response: ServerResponse) => void;
}

interface ServerResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}
```

#### Server → Client (Events)
```typescript
interface ServerEvent {
  event: string;
  payload: any;
  timestamp: string;
}
```

### Event Implementations

#### LOBBY_JOIN
```javascript
socket.on(EVENTS.LOBBY.JOIN, async (data, callback) => {
  try {
    socket.join('lobby');
    
    const [rooms, stats] = await Promise.all([
      Room.find({ status: { $ne: 'finished' }, isPrivate: false })
        .sort({ createdAt: -1 })
        .limit(50),
      getLobbyStats()
    ]);
    
    callback({
      success: true,
      data: { rooms, stats, onlineUsers: getOnlineUsers() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    callback({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

#### ROOM_CREATE
```javascript
socket.on(EVENTS.ROOM.CREATE, async (data, callback) => {
  try {
    if (!socket.user) {
      throw new Error('Authentication required');
    }
    
    const room = await Room.create({
      ...data,
      createdBy: socket.user.userId,
      players: [{
        userId: socket.user.userId,
        username: socket.user.username,
        isReady: true
      }]
    });
    
    socket.join(`room:${room._id}`);
    socketRooms.set(socket.id, room._id.toString());
    
    io.to('lobby').emit(EVENTS.ROOM.CREATED, {
      room,
      timestamp: new Date().toISOString()
    });
    
    callback({ success: true, data: { room } });
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});
```

---

## 6. Error Handling Strategies

### Socket-level Error Handling

#### 6.1 Middleware Errors
```javascript
io.use(async (socket, next) => {
  try {
    // Authentication logic
    next();
  } catch (error) {
    next(new Error(`Authentication failed: ${error.message}`));
  }
});

// Handle connection errors
io.on('connection_error', (err) => {
  console.error('Connection error:', err.req, err.code, err.message, err.context);
});
```

#### 6.2 Event Handler Wrapper
```javascript
const asyncHandler = (fn) => (socket, ...args) => {
  Promise.resolve(fn(socket, ...args)).catch((error) => {
    console.error('Socket event error:', error);
    
    // Emit error to client
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      callback({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
    
    // Log error
    logger.error('Socket event error', {
      error: error.message,
      socketId: socket.id,
      userId: socket.user?.userId,
      stack: error.stack
    });
  });
};

// Usage
socket.on(EVENTS.ROOM.JOIN, asyncHandler(async (socket, data, callback) => {
  // Handler logic
}));
```

#### 6.3 Graceful Degradation
```javascript
socket.on(EVENTS.ROOM.JOIN, async (data, callback) => {
  try {
    // Operation
  } catch (error) {
    // Determine error type
    if (error.name === 'ValidationError') {
      return callback({
        success: false,
        error: 'Invalid room data',
        details: error.errors
      });
    }
    
    if (error.name === 'CastError') {
      return callback({
        success: false,
        error: 'Invalid room ID format'
      });
    }
    
    // Unknown error - don't expose details
    logger.error('Unexpected error in ROOM_JOIN', error);
    callback({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});
```

### Reconnection Strategy

#### Client-Side Reconnection
Socket.io handles automatic reconnection with these defaults:
- `reconnection`: true
- `reconnectionAttempts`: Infinity
- `reconnectionDelay`: 1000ms
- `reconnectionDelayMax`: 5000ms

#### Server-Side Handling
```javascript
// Track reconnection attempts
const connectionAttempts = new Map();

io.use((socket, next) => {
  const clientId = socket.handshake.auth.clientId;
  
  if (clientId) {
    const attempts = connectionAttempts.get(clientId) || 0;
    
    if (attempts > 10) {
      return next(new Error('Too many reconnection attempts'));
    }
    
    connectionAttempts.set(clientId, attempts + 1);
    
    // Reset counter after successful connection
    socket.on('disconnect', () => {
      setTimeout(() => {
        connectionAttempts.delete(clientId);
      }, 60000); // Reset after 1 minute
    });
  }
  
  next();
});
```

### Disconnection Handling
```javascript
socket.on('disconnect', async (reason) => {
  console.log(`Socket ${socket.id} disconnected: ${reason}`);
  
  // Reasons: 'client namespace disconnect', 'server namespace disconnect', 
  //          'ping timeout', 'transport close', 'transport error'
  
  const roomId = socketRooms.get(socket.id);
  
  if (roomId && socket.user) {
    // Don't immediately remove - wait for potential reconnection
    setTimeout(async () => {
      // Check if user reconnected with different socket
      const isReconnected = Array.from(connectedUsers.values())
        .some(u => u.userId === socket.user.userId);
      
      if (!isReconnected) {
        await leaveRoomInternal(socket, roomId);
      }
    }, 5000); // 5 second grace period
  }
  
  connectedUsers.delete(socket.id);
  socketRooms.delete(socket.id);
});
```

---

## 7. Integration with Existing Code

### File Structure
```
backend/src/
├── config/
│   ├── socket.js          # Current: Main socket config (REFACTOR)
│   └── redis.js           # NEW: Redis client setup
├── modules/
│   └── socket/
│       ├── index.js       # NEW: Socket.io initialization
│       ├── middleware/
│       │   ├── auth.js    # NEW: Socket authentication
│       │   └── error.js   # NEW: Error handling wrapper
│       ├── handlers/
│       │   ├── lobby.js   # NEW: Lobby event handlers
│       │   ├── room.js    # NEW: Room event handlers
│       │   └── connection.js # NEW: Connection/disconnection
│       └── utils/
│           ├── events.js  # NEW: Event constants
│           └── rooms.js   # NEW: Room management helpers
```

### Refactoring Strategy

#### Step 1: Extract Event Constants
Create `backend/src/modules/socket/utils/events.js`:
```javascript
module.exports = {
  LOBBY: { JOIN: 'lobby:join', ... },
  ROOM: { CREATE: 'room:create', ... },
  // ... all events
};
```

#### Step 2: Create Modular Handlers
Split `socket.js` into focused handler files:
- `lobby.js`: LOBBY_JOIN, lobby stats
- `room.js`: ROOM_CREATE, ROOM_JOIN, ROOM_LEAVE
- `match.js`: MATCH_START
- `connection.js`: disconnect handling

#### Step 3: Update Authentication
Modify auth middleware to use cookies:
```javascript
// In backend/src/modules/socket/middleware/auth.js
const cookie = require('cookie');

module.exports = async (socket, next) => {
  // Read from cookies instead of auth.token
  const cookies = cookie.parse(socket.handshake.headers.cookie || '');
  // ... rest of auth logic
};
```

#### Step 4: Add Redis Adapter
```javascript
// In server.js
const { setupRedisAdapter } = require('./config/redis');

const io = new Server(httpServer, { /* config */ });
await setupRedisAdapter(io);
```

### Backward Compatibility
The existing socket.js implementation already provides:
- Basic event handling ✓
- Room management ✓
- User tracking ✓

**Minimal changes needed**:
1. Add cookie parsing to auth middleware
2. Install and configure Redis adapter
3. Extract event names to constants
4. Add error handling wrapper

---

## 8. Security Considerations

### Authentication
- Always verify JWT in socket handshake
- Use httpOnly cookies (not query params)
- Check `socket.user` exists for protected events
- Validate all user inputs

### Authorization
- Verify user is room member before allowing room actions
- Only host can start match
- Prevent joining private rooms without invite code

### Rate Limiting
Consider implementing socket-level rate limiting:
```javascript
const rateLimit = new Map();

io.use((socket, next) => {
  const key = socket.handshake.address;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute
  
  const attempts = rateLimit.get(key) || [];
  const recentAttempts = attempts.filter(t => t > windowStart);
  
  if (recentAttempts.length > 100) {
    return next(new Error('Rate limit exceeded'));
  }
  
  recentAttempts.push(now);
  rateLimit.set(key, recentAttempts);
  
  next();
});
```

---

## Summary

### What's Already Done
- Socket.io server initialized with Express
- Basic JWT authentication (needs cookie support)
- Room management (MongoDB + Socket.io rooms)
- Event handlers for lobby and rooms
- User tracking (connectedUsers map)

### What Needs to be Added
1. **Redis Adapter**: For multi-server scaling
2. **Cookie Auth**: Read JWT from httpOnly cookies
3. **Event Constants**: Domain:action naming convention
4. **Error Handling**: Comprehensive error strategy
5. **Reconnection Logic**: Grace period for disconnects
6. **Production Config**: Ping timeouts, state recovery

### Key Decisions to Make
1. Room naming format: `room:${id}` vs other pattern
2. Grace period for disconnections: 5 seconds? 30 seconds?
3. Event naming: `lobby:join` vs `LOBBY_JOIN`
4. Error exposure: Detailed errors vs generic messages in production

### Estimated Effort
- **Socket.io setup**: Already done, minor tweaks needed
- **Redis adapter**: 2-3 hours (including testing)
- **Cookie auth**: 1-2 hours (modify middleware)
- **Event refactoring**: 2-3 hours (extract constants)
- **Error handling**: 2 hours (add wrappers)
- **Testing**: 3-4 hours (multi-server, reconnection)

**Total**: ~12-15 hours

---

## References

- [Socket.io Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Socket.io Middlewares](https://socket.io/docs/v4/middlewares/)
- [Socket.io Rooms](https://socket.io/docs/v4/rooms/)
- [Handling Disconnections](https://socket.io/docs/v4/tutorial/handling-disconnections)
- [JWT with Socket.io](https://socket.io/how-to/use-with-jwt)
