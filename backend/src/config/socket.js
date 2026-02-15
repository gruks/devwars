/**
 * Socket.io configuration
 * Real-time events for lobby and rooms
 */

const { User } = require('../modules/users/user.model.js');
const { Room } = require('../modules/rooms/room.model.js');
const { registerGameHandlers } = require('../socket/handlers/game.handler.js');

// Store connected users: Map<socketId, { userId, username }>
const connectedUsers = new Map();

// Store socket to room mapping: Map<socketId, roomId>
const socketRooms = new Map();

/**
 * Initialize socket.io
 * @param {Object} io - Socket.io instance
 * @param {Function} sessionMiddleware - Express session middleware
 */
const initializeSocket = (io, sessionMiddleware) => {
  // Use session middleware with Socket.io
  // This attaches req.session to socket.request
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Authentication middleware using session
  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;

      if (session && session.userId) {
        const user = await User.findById(session.userId);

        if (user) {
          socket.user = {
            userId: user._id.toString(),
            username: user.username
          };
        }
      }

      next();
    } catch (error) {
      // Allow unauthenticated connections for public lobby
      console.error('Socket authentication error:', error);
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user?.username || 'Anonymous'})`);

    // Track connected user
    if (socket.user) {
      connectedUsers.set(socket.id, socket.user);
      io.emit('PLAYER_ONLINE', {
        userId: socket.user.userId,
        username: socket.user.username
      });
    }

    // Register game socket handlers
    registerGameHandlers(io, socket);

    // Join lobby
    socket.on('LOBBY_JOIN', async (data, callback) => {
      try {
        socket.join('lobby');

        // Get active room if any
        if (socket.user) {
          const rooms = await Room.find({
            'players.userId': socket.user.userId,
            status: { $ne: 'finished' }
          });

          if (rooms.length > 0) {
            socket.join(`room:${rooms[0]._id}`);
            socketRooms.set(socket.id, rooms[0]._id.toString());
          }
        }

        // Send lobby state
        const [activeRooms, stats] = await Promise.all([
          Room.find({ status: { $ne: 'finished' }, isPrivate: false })
            .sort({ createdAt: -1 })
            .limit(50),
          getLobbyStats()
        ]);

        callback?.({
          success: true,
          rooms: activeRooms,
          stats,
          onlineUsers: Array.from(connectedUsers.values())
        });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    // Create room
    socket.on('ROOM_CREATE', async (data, callback) => {
      try {
        if (!socket.user) {
          return callback?.({ success: false, error: 'Authentication required' });
        }

        const { name, mode, maxPlayers, isPrivate, difficulty, timer } = data;

        const room = await Room.create({
          name: name || `Room ${Date.now().toString(36).toUpperCase()}`,
          mode: mode || 'debug',
          maxPlayers: maxPlayers || 4,
          isPrivate: isPrivate || false,
          difficulty: difficulty || 'medium',
          timer: timer || 15,
          createdBy: socket.user.userId,
          players: [{
            userId: socket.user.userId,
            username: socket.user.username,
            isReady: true
          }]
        });

        await room.populate('players.userId', 'username');

        // Join socket to room
        socket.join(`room:${room._id}`);
        socketRooms.set(socket.id, room._id.toString());

        // Broadcast to lobby
        io.to('lobby').emit('ROOM_CREATED', { room });

        callback?.({ success: true, room });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    // Join room
    socket.on('ROOM_JOIN', async (data, callback) => {
      try {
        if (!socket.user) {
          return callback?.({ success: false, error: 'Authentication required' });
        }

        const { roomId } = data;

        const room = await Room.findById(roomId);

        if (!room) {
          return callback?.({ success: false, error: 'Room not found' });
        }

        if (!room.canJoin()) {
          return callback?.({ success: false, error: 'Room is not available' });
        }

        // Leave previous room if any
        const prevRoomId = socketRooms.get(socket.id);
        if (prevRoomId) {
          await leaveRoomInternal(io, socket, prevRoomId);
        }

        // Add to room
        await room.addPlayer(socket.user.userId, socket.user.username);
        await room.populate('players.userId', 'username');

        // Join socket to room
        socket.join(`room:${room._id}`);
        socketRooms.set(socket.id, room._id.toString());

        // Notify room
        io.to(`room:${room._id}`).emit('PLAYER_JOINED', {
          roomId: room._id,
          player: { userId: socket.user.userId, username: socket.user.username }
        });

        // Broadcast to lobby
        io.to('lobby').emit('ROOM_UPDATED', { room });

        callback?.({ success: true, room });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    // Leave room
    socket.on('ROOM_LEAVE', async (data, callback) => {
      try {
        if (!socket.user) {
          return callback?.({ success: false, error: 'Authentication required' });
        }

        const { roomId } = data;

        await leaveRoomInternal(io, socket, roomId);

        callback?.({ success: true });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    // Start match (host only)
    socket.on('MATCH_START', async (data, callback) => {
      try {
        if (!socket.user) {
          return callback?.({ success: false, error: 'Authentication required' });
        }

        const { roomId } = data;

        const room = await Room.findById(roomId);

        if (!room) {
          return callback?.({ success: false, error: 'Room not found' });
        }

        if (room.createdBy.toString() !== socket.user.userId) {
          return callback?.({ success: false, error: 'Only host can start match' });
        }

        if (room.players.length < 2) {
          return callback?.({ success: false, error: 'Need at least 2 players' });
        }

        await room.startMatch();

        io.to(`room:${room._id}`).emit('MATCH_STARTED', { roomId: room._id });
        io.to('lobby').emit('ROOM_UPDATED', { room });

        callback?.({ success: true, room });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      const user = connectedUsers.get(socket.id);
      const roomId = socketRooms.get(socket.id);

      // Remove from connected users
      if (user) {
        connectedUsers.delete(socket.id);
        io.emit('PLAYER_OFFLINE', { userId: user.userId, username: user.username });

        // Remove from room
        if (roomId) {
          try {
            await leaveRoomInternal(io, socket, roomId);
          } catch (error) {
            console.error('Error removing player from room on disconnect:', error);
          }
        }
      }

      socketRooms.delete(socket.id);
    });
  });

  return io;
};

/**
 * Helper: Leave room internally
 */
async function leaveRoomInternal(io, socket, roomId) {
  const room = await Room.findById(roomId);

  if (!room) return;

  // Remove player
  await room.removePlayer(socket.user.userId);

  // Notify room
  io.to(`room:${roomId}`).emit('PLAYER_LEFT', {
    roomId,
    userId: socket.user.userId,
    username: socket.user.username
  });

  // Leave socket from room
  socket.leave(`room:${roomId}`);
  socketRooms.delete(socket.id);

  // If room still exists, notify lobby
  const updatedRoom = await Room.findById(roomId);
  if (updatedRoom) {
    io.to('lobby').emit('ROOM_UPDATED', { room: updatedRoom });
  } else {
    io.to('lobby').emit('ROOM_DELETED', { roomId });
  }
}

/**
 * Helper: Get lobby stats
 */
async function getLobbyStats() {
  const [totalRooms, waitingRooms, playingRooms, totalPlayers] = await Promise.all([
    Room.countDocuments({ status: { $ne: 'finished' } }),
    Room.countDocuments({ status: 'waiting' }),
    Room.countDocuments({ status: 'playing' }),
    Room.aggregate([
      { $match: { status: { $ne: 'finished' } } },
      { $project: { playerCount: { $size: '$players' } } },
      { $group: { _id: null, total: { $sum: '$playerCount' } } }
    ])
  ]);

  return {
    totalRooms,
    waitingRooms,
    playingRooms,
    totalPlayers: totalPlayers[0]?.total || 0,
    onlineUsers: connectedUsers.size
  };
}

module.exports = { initializeSocket };
