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
      throw new Error('Authentication required');
    }

    const { name, mode, maxPlayers, isPrivate, difficulty, timer } = data;

    // Create room
    const room = await Room.create({
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
    });

    await room.populate('players.userId', 'username rating');

    // Join socket to room
    socket.join(`room:${room._id}`);
    socketRooms.set(socket.id, room._id.toString());

    logger.info(`Room created: ${room.name} (${room._id}) by ${socket.user.username}`);

    // Broadcast to lobby
    io.to('lobby').emit(EVENTS.ROOM.CREATED, {
      room: room.toObject(),
      timestamp: new Date().toISOString()
    });

    // Send response
    const response = {
      success: true,
      data: { room: room.toObject() },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
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

    const { roomId } = data;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Join the room socket namespace
    socket.join(`room:${roomId}`);

    // Check if user is already in the room
    const isPlayerInRoom = room.players.some(
      p => p.userId.toString() === socket.user.userId && !p.departedAt
    );

    // Add player if not already in
    if (!isPlayerInRoom) {
      try {
        await room.addPlayer(socket.user.userId, socket.user.username);
      } catch (err) {
        // Player might already be in, that's okay
        logger.debug(`Player ${socket.user.username} already in room or error: ${err.message}`);
      }
    }

    // Notify other players
    socket.to(`room:${roomId}`).emit(EVENTS.ROOM.PLAYER_JOINED, {
      player: {
        userId: socket.user.userId,
        username: socket.user.username,
        isReady: false
      },
      timestamp: new Date().toISOString()
    });

    logger.info(`${socket.user.username} joined room ${room.name}`);

    const response = {
      success: true,
      data: { room: room.toObject() },
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

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Leave the room socket namespace
    socket.leave(`room:${roomId}`);

    // Mark player as departed
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );
    if (player) {
      player.departedAt = new Date();
      await room.save();
    }

    // Notify other players
    socket.to(`room:${roomId}`).emit(EVENTS.ROOM.PLAYER_LEFT, {
      player: {
        userId: socket.user.userId,
        username: socket.user.username
      },
      timestamp: new Date().toISOString()
    });

    // Update lobby
    io.to('lobby').emit(EVENTS.ROOM.UPDATE, {
      room: room.toObject(),
      timestamp: new Date().toISOString()
    });

    logger.info(`${socket.user.username} left room ${room.name}`);

    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * Player ready toggle
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

    // Update player's ready status
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );

    if (!player) {
      throw new Error('You are not in this room');
    }

    player.isReady = isReady;
    await room.save();

    // Notify all players in room
    io.to(`room:${roomId}`).emit(EVENTS.ROOM.PLAYER_READY, {
      player: {
        userId: socket.user.userId,
        username: socket.user.username,
        isReady
      },
      timestamp: new Date().toISOString()
    });

    logger.debug(`${socket.user.username} is ${isReady ? 'ready' : 'not ready'} in room ${room.name}`);

    const response = {
      success: true,
      data: { player: { userId: socket.user.userId, isReady } },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

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
      room: room.toObject(),
      timestamp: new Date().toISOString()
    });

    logger.info(`Match started in room ${room.name} by ${socket.user.username}`);

    const response = {
      success: true,
      data: { room: room.toObject() },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));
};

module.exports = { registerRoomHandlers };
