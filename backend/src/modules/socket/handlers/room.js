/**
 * Room event handlers
 */
const { Room } = require('../../rooms/room.model.js');
const { EVENTS } = require('../utils/events.js');
const { asyncHandler } = require('../middleware/error.js');
const { logger } = require('../../../utils/logger.js');

// Track socket to room mapping (shared with other handlers)
const socketRooms = new Map(); // socketId -> roomId

/**
 * Format room data for client
 * Ensures consistent player data structure (userId as string, not object)
 */
function formatRoomForClient(room) {
  const roomObj = room.toObject ? room.toObject() : room;
  
  // Format players to ensure userId is always a string
  if (roomObj.players) {
    roomObj.players = roomObj.players.map(player => ({
      ...player,
      userId: player.userId?._id?.toString() || player.userId?.toString() || player.userId
    }));
  }
  
  // Ensure createdBy is a string
  if (roomObj.createdBy) {
    roomObj.createdBy = roomObj.createdBy._id?.toString() || roomObj.createdBy.toString();
  }
  
  return roomObj;
}

/**
 * Register room event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 * @param {Map} connectedUsers - Map of connected users
 */
const registerRoomHandlers = (io, socket, connectedUsers) => {
  /**
   * Create new room
   * Requires authentication
   */
  socket.on(EVENTS.ROOM.CREATE, asyncHandler(async (data, callback) => {
    // Require authentication
    if (!socket.user) {
      logger.error('Room creation failed: User not authenticated');
      throw new Error('Authentication required');
    }

    const { name, mode, maxPlayers, isPrivate, difficulty, timer } = data;

    // Log room creation attempt for debugging
    logger.info(`[ROOM CREATE] User: ${socket.user.username} (${socket.user.userId}), Name: ${name || 'unnamed'}, isPrivate: ${isPrivate}`);

    try {
      // Create room
      const roomData = {
        name: name || `Room-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        mode: mode || 'debug',
        maxPlayers: maxPlayers || 4,
        isPrivate: isPrivate || false,
        difficulty: difficulty || 'medium',
        timer: timer || 15,
        createdBy: socket.user.userId,
        players: [{
          userId: socket.user.userId,
          username: socket.user.username,
          isReady: true,
          joinedAt: new Date()
        }]
      };
      
      logger.debug(`[ROOM CREATE] Creating room with data:`, JSON.stringify(roomData));
      
      const room = await Room.create(roomData);

      // Verify room was saved
      const savedRoom = await Room.findById(room._id);
      if (!savedRoom) {
        throw new Error('Room was not saved to database');
      }

      logger.debug(`Room saved to MongoDB: ${room._id}, inviteCode: ${room.inviteCode}`);
      await room.populate('players.userId', 'username rating');
      
      logger.info(`Room created: ${room.name} (${room._id}) by ${socket.user.username}, isPrivate: ${room.isPrivate}, status: ${room.status}`);

      // Join socket to room
      socket.join(`room:${room._id}`);
      socketRooms.set(socket.id, room._id.toString());

      // Broadcast to lobby - include room count in lobby for debugging
      const lobbyRoom = io.sockets.adapter.rooms.get('lobby');
      const lobbyCount = lobbyRoom ? lobbyRoom.size : 0;
      logger.debug(`Broadcasting room:created to lobby (${lobbyCount} clients), room ID: ${room._id}, isPrivate: ${room.isPrivate}`);
      io.to('lobby').emit(EVENTS.ROOM.CREATED, {
        room: formatRoomForClient(room),
        timestamp: new Date().toISOString()
      });
      logger.info(`Room ${room.name} created and broadcast to lobby`);

      // Send response
      const response = {
        success: true,
        data: { room: formatRoomForClient(room) },
        timestamp: new Date().toISOString()
      };

      if (typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      // Handle unique constraint violation (duplicate inviteCode)
      if (error.code === 11000) {
        logger.error(`Duplicate inviteCode generated for room creation, retrying...`);
        
        try {
          // Retry once with new inviteCode
          const retryRoom = await Room.create({
            name: name || `Room-${Date.now().toString(36).toUpperCase().slice(-6)}`,
            mode: mode || 'debug',
            maxPlayers: maxPlayers || 4,
            isPrivate: isPrivate || false,
            difficulty: difficulty || 'medium',
            timer: timer || 15,
            createdBy: socket.user.userId,
            inviteCode: `Room-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5)}`,
            players: [{
              userId: socket.user.userId,
              username: socket.user.username,
              isReady: true,
              joinedAt: new Date()
            }]
          });
          
          await retryRoom.populate('players.userId', 'username rating');
          
          // Join socket to room
          socket.join(`room:${retryRoom._id}`);
          socketRooms.set(socket.id, retryRoom._id.toString());
          
          // Broadcast to lobby
          io.to('lobby').emit(EVENTS.ROOM.CREATED, {
            room: formatRoomForClient(retryRoom),
            timestamp: new Date().toISOString()
          });
          
          const response = {
            success: true,
            data: { room: formatRoomForClient(retryRoom) },
            timestamp: new Date().toISOString()
          };
          
          if (typeof callback === 'function') {
            callback(response);
          }
          return;
        } catch (retryError) {
          logger.error(`Failed to create room after retry: ${retryError.message}`);
          // Fall through to error response
        }
      }
      
      logger.error(`Error creating room: ${error.message}`);
      const response = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      if (typeof callback === 'function') {
        callback(response);
      }
    }
  }));

  /**
   * Join existing room
   * Requires authentication
   */
  socket.on(EVENTS.ROOM.JOIN, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, inviteCode } = data;

    logger.debug(`User ${socket.user.username} attempting to join room. roomId: ${roomId}, inviteCode: ${inviteCode}`);

    // Find room by _id OR inviteCode
    let room = null;
    if (roomId) {
      room = await Room.findById(roomId);
    } else if (inviteCode) {
      room = await Room.findOne({ inviteCode: inviteCode.toUpperCase() });
    }
    
    if (!room) {
      logger.error(`Room not found. roomId: ${roomId}, inviteCode: ${inviteCode}`);
      throw new Error('Room not found. Please check the room ID or invite code.');
    }

    logger.debug(`Room found: ${room.name}, status: ${room.status}, isPrivate: ${room.isPrivate}, players: ${room.players.length}`);

    // Check if already in room FIRST (handles React StrictMode double-mount)
    const isAlreadyInRoom = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );
    
    if (isAlreadyInRoom) {
      logger.info(`User ${socket.user.username} already in room ${room.name}, returning existing room data`);
      // Just return success - they're already in the room
      await room.populate('players.userId', 'username rating');
      socket.join(`room:${room._id}`);
      socketRooms.set(socket.id, room._id.toString());
      
      const response = {
        success: true,
        data: { room: formatRoomForClient(room) },
        timestamp: new Date().toISOString()
      };
      if (typeof callback === 'function') {
        callback(response);
      }
      return;
    }

    // Check if can join (only for new players)
    if (!room.canJoin()) {
      throw new Error('Room is not available for joining');
    }

    // Leave previous room if any
    const prevRoomId = socketRooms.get(socket.id);
    if (prevRoomId && prevRoomId !== roomId) {
      await leaveRoomInternal(io, socket, prevRoomId);
    }

    // Add player to room
    await room.addPlayer(socket.user.userId, socket.user.username);

    await room.populate('players.userId', 'username rating');

    // Join socket to room
    socket.join(`room:${room._id}`);
    socketRooms.set(socket.id, room._id.toString());

    logger.info(`Player ${socket.user.username} joined room ${room.name}`);

    // Notify room of new player
    socket.to(`room:${room._id}`).emit(EVENTS.ROOM.PLAYER_JOINED, {
      roomId: room._id.toString(),
      player: {
        userId: socket.user.userId,
        username: socket.user.username
      },
      timestamp: new Date().toISOString()
    });

    // Broadcast room update to lobby
    io.to('lobby').emit(EVENTS.ROOM.UPDATE, {
      room: formatRoomForClient(room),
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
      data: { room: formatRoomForClient(room) },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * Leave room
   */
  socket.on(EVENTS.ROOM.LEAVE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;
    await leaveRoomInternal(io, socket, roomId);

    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * Toggle player ready status
   */
  socket.on(EVENTS.ROOM.PLAYER_READY, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, isReady } = data;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Update player ready status
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );

    if (!player) {
      throw new Error('You are not in this room');
    }

    player.isReady = isReady ?? !player.isReady;
    await room.save();

    // Notify room
    io.to(`room:${room._id}`).emit(EVENTS.ROOM.PLAYER_READY, {
      roomId: room._id.toString(),
      player: {
        userId: socket.user.userId,
        username: socket.user.username,
        isReady: player.isReady
      },
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
      data: { isReady: player.isReady },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * Handle disconnect - cleanup
   */
  socket.on('disconnect', () => {
    const roomId = socketRooms.get(socket.id);
    if (roomId && socket.user) {
      // Grace period before removing (allow reconnection)
      setTimeout(async () => {
        // Check if user reconnected with different socket
        let isReconnected = false;
        for (const [sid, user] of connectedUsers.entries()) {
          if (user.userId === socket.user.userId && sid !== socket.id) {
            isReconnected = true;
            break;
          }
        }

        if (!isReconnected) {
          try {
            await leaveRoomInternal(io, socket, roomId, true);
          } catch (error) {
            logger.error('Error in disconnect cleanup:', error);
          }
        }
      }, 5000); // 5 second grace period
    }
    socketRooms.delete(socket.id);
  });

  /**
   * Start match (host only)
   */
  socket.on(EVENTS.MATCH.START, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify host
    if (room.createdBy.toString() !== socket.user.userId) {
      throw new Error('Only the host can start the match');
    }

    // Check minimum players
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Check all players are ready (except in casual mode)
    const notReadyPlayers = room.players.filter(p => !p.isReady);
    if (notReadyPlayers.length > 0) {
      throw new Error('All players must be ready to start');
    }

    // Start the match
    await room.startMatch();

    // Send system message
    if (socket.sendSystemMessage) {
      socket.sendSystemMessage(roomId, 'Match is starting!');
    }

    // Broadcast to room
    io.to(`room:${room._id}`).emit(EVENTS.MATCH.STARTED, {
      roomId: room._id.toString(),
      matchId: room.currentMatchId,
      startedAt: room.matchStartedAt,
      timestamp: new Date().toISOString()
    });

    // Broadcast to lobby
    io.to('lobby').emit(EVENTS.ROOM.UPDATE, {
      room: formatRoomForClient(room),
      timestamp: new Date().toISOString()
    });

    logger.info(`Match started in room ${room.name} by ${socket.user.username}`);

    const response = {
      success: true,
      data: { room: formatRoomForClient(room) },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  return { socketRooms };
};

/**
 * Internal helper: Leave room
 */
async function leaveRoomInternal(io, socket, roomId, isDisconnect = false) {
  const room = await Room.findById(roomId);
  if (!room) return;

  const userId = socket.user?.userId;
  if (!userId) return;

  // Remove player from room
  await room.removePlayer(userId);

  // Notify room
  io.to(`room:${roomId}`).emit(EVENTS.ROOM.PLAYER_LEFT, {
    roomId,
    player: {
      userId,
      username: socket.user.username
    },
    timestamp: new Date().toISOString()
  });

  // Leave socket from room
  socket.leave(`room:${roomId}`);

  // Check if room still exists
  const updatedRoom = await Room.findById(roomId);
  if (updatedRoom) {
    await updatedRoom.populate('players.userId', 'username rating');
    io.to('lobby').emit(EVENTS.ROOM.UPDATE, {
      room: formatRoomForClient(updatedRoom),
      timestamp: new Date().toISOString()
    });
  } else {
    // Room was deleted (empty)
    io.to('lobby').emit(EVENTS.ROOM.DELETE, {
      roomId,
      timestamp: new Date().toISOString()
    });
  }

  if (!isDisconnect) {
    logger.info(`Player ${socket.user.username} left room ${room.name || roomId}`);
  }
}

module.exports = { registerRoomHandlers };
