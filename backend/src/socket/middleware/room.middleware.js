/**
 * Room middleware for socket connections
 * Handles room validation, state synchronization, and reconnection
 */
const { Room } = require('../../modules/rooms/room.model.js');
const { logger } = require('../../../utils/logger.js');

/**
 * Middleware to validate room access for socket connections
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next middleware function
 */
async function validateRoomAccess(socket, next) {
  try {
    const roomId = socket.handshake.query.roomId;

    // If no roomId, allow connection (can view lobby)
    if (!roomId) {
      return next();
    }

    // Verify room exists
    const room = await Room.findById(roomId);
    if (!room) {
      logger.warn(`Room not found: ${roomId}`);
      return next(new Error('Room not found'));
    }

    // Check user is participant or spectator (if authenticated)
    if (socket.user) {
      const isParticipant = room.players.some(
        p => p.userId?.toString() === socket.user.userId
      );
      const isSpectator = room.spectators?.some(
        s => s.userId?.toString() === socket.user.userId
      );

      // Attach room to socket for later use
      socket.room = {
        id: room._id.toString(),
        name: room.name,
        status: room.status,
        isParticipant,
        isSpectator,
        isHost: room.createdBy?.toString() === socket.user.userId
      };

      logger.debug(`User ${socket.user.username} validated for room ${roomId}`);
    }

    next();
  } catch (error) {
    logger.error('Room validation error:', error);
    next(error);
  }
}

/**
 * Sync room state on connection
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 */
async function syncRoomState(io, socket) {
  try {
    if (!socket.room || !socket.room.id) {
      return;
    }

    const roomId = socket.room.id;

    // Fetch full room state
    const room = await Room.findById(roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    // Build comprehensive room state
    const roomState = {
      // Basic info
      roomId: room._id.toString(),
      name: room.name,
      status: room.status,
      mode: room.mode,
      difficulty: room.difficulty,
      timer: room.timer,
      inviteCode: room.inviteCode,
      isPrivate: room.isPrivate,

      // Participants with detailed info
      participants: room.players.map(p => ({
        userId: p.userId?.toString(),
        username: p.username,
        isReady: p.isReady,
        isHost: room.createdBy?.toString() === p.userId?.toString(),
        isSubmitted: p.isSubmitted,
        joinedAt: p.joinedAt,
        lastActiveAt: p.lastActiveAt,
        lastCodeSnapshot: p.lastCodeSnapshot,
        progress: p.progress
      })),

      // Spectators
      spectators: (room.spectators || []).map(s => ({
        userId: s.userId?.toString(),
        username: s.username,
        joinedAt: s.joinedAt
      })),

      // Match info
      currentProblem: room.currentProblem ? {
        id: room.currentProblem._id?.toString(),
        title: room.currentProblem.title,
        difficulty: room.currentProblem.difficulty,
        description: room.currentProblem.description,
        testCases: room.currentProblem.testCases?.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isPublic: tc.isPublic
        }))
      } : null,

      // Timing
      matchStartedAt: room.matchStartedAt,
      matchEndedAt: room.matchEndedAt,
      timeRemaining: calculateTimeRemaining(room),

      // Metadata
      createdBy: room.createdBy?.toString(),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };

    // Emit full state to socket
    socket.emit('room:state_sync', roomState);

    // Store state on socket for reference
    socket.roomState = roomState;

    logger.debug(`Room state synced for ${roomId} to socket ${socket.id}`);
  } catch (error) {
    logger.error('Room state sync error:', error);
    socket.emit('room:error', { message: 'Failed to sync room state' });
  }
}

/**
 * Handle reconnection - restore room state
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 */
async function handleReconnection(io, socket) {
  try {
    if (!socket.user) {
      return;
    }

    const userId = socket.user.userId;

    // Find room user was in
    const room = await Room.findOne({
      'players.userId': userId,
      status: { $in: ['waiting', 'active'] }
    });

    if (!room) {
      logger.debug(`No active room found for user ${userId} on reconnect`);
      return;
    }

    const roomId = room._id.toString();

    // Check if user was already connected (prevent duplicate)
    const existingSocket = io.sockets.sockets.get(socket.id);
    if (!existingSocket) {
      return;
    }

    // Get player's last code snapshot
    const player = room.players.find(
      p => p.userId?.toString() === userId
    );

    // Calculate current timer value
    const timeRemaining = calculateTimeRemaining(room);

    // Emit reconnected event with sync data
    socket.emit('reconnected', {
      roomId,
      roomName: room.name,
      status: room.status,
      lastCodeSnapshot: player?.lastCodeSnapshot || '',
      timeRemaining,
      matchStartedAt: room.matchStartedAt,
      currentProblem: room.currentProblem ? {
        id: room.currentProblem._id?.toString(),
        title: room.currentProblem.title
      } : null,
      participants: room.players.map(p => ({
        userId: p.userId?.toString(),
        username: p.username,
        isSubmitted: p.isSubmitted,
        progress: p.progress
      })),
      timestamp: new Date().toISOString()
    });

    // Update player's last active timestamp
    if (player) {
      player.lastActiveAt = new Date();
      await room.save();
    }

    logger.info(`User ${socket.user.username} reconnected to room ${roomId}`);
  } catch (error) {
    logger.error('Reconnection handling error:', error);
  }
}

/**
 * Calculate remaining time for a room
 * @param {Object} room - Room document
 */
function calculateTimeRemaining(room) {
  if (!room.matchStartedAt || room.status !== 'active') {
    return (room.timer || 15) * 60 * 1000; // Default to full time
  }

  const duration = (room.timer || 15) * 60 * 1000;
  const elapsed = Date.now() - new Date(room.matchStartedAt).getTime();
  return Math.max(0, duration - elapsed);
}

/**
 * Middleware to require room membership
 * Use after validateRoomAccess
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next middleware function
 */
function requireRoomMembership(socket, next) {
  if (!socket.room) {
    return next(new Error('Room context not initialized'));
  }

  if (!socket.room.isParticipant && !socket.room.isSpectator) {
    return next(new Error('You are not a member of this room'));
  }

  next();
}

/**
 * Middleware to require host privileges
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next middleware function
 */
function requireHost(socket, next) {
  if (!socket.room) {
    return next(new Error('Room context not initialized'));
  }

  if (!socket.room.isHost) {
    return next(new Error('Only host can perform this action'));
  }

  next();
}

module.exports = {
  validateRoomAccess,
  syncRoomState,
  handleReconnection,
  requireRoomMembership,
  requireHost,
  calculateTimeRemaining
};
