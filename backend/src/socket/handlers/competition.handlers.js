/**
 * Competition socket handlers
 * Handles real-time competition events between players
 */
const { Room } = require('../../modules/rooms/room.model.js');
const { Match } = require('../../modules/matches/match.model.js');
const { EVENTS } = require('../../modules/socket/utils/events.js');
const { asyncHandler } = require('../../modules/socket/middleware/error.js');
const { logger } = require('../../utils/logger.js');

// Track active timers per room
const roomTimers = new Map(); // roomId -> { intervalId, startTime, duration }

// Event names for competition
const COMPETITION_EVENTS = {
  JOIN_ROOM: 'competition:join_room',
  CODE_UPDATE: 'competition:code_update',
  RUN_CODE: 'competition:run_code',
  SUBMIT_CODE: 'competition:submit_code',
  TIMER_SYNC: 'competition:timer_sync',
  SPECTATOR_JOIN: 'competition:spectator_join',
  SPECTATOR_LEAVE: 'competition:spectator_leave',
  PROGRESS_UPDATE: 'competition:progress_update',
  START_MATCH: 'competition:start_match',

  // Outgoing events
  PLAYER_JOINED: 'opponent:joined',
  OPPONENT_CODE_UPDATE: 'opponent:code_update',
  OPPONENT_RUNNING: 'opponent:running',
  OPPONENT_SUBMITTED: 'opponent:submitted',
  TIMER_UPDATE: 'timer_update',
  SPECTATOR_COUNT: 'spectator_count',
  OPPONENT_PROGRESS: 'opponent:progress',
  RUN_RESULT: 'run:result',
  MATCH_TIMEOUT: 'match:timeout',
  RECONNECTED: 'reconnected',
  ROOM_STATE_SYNC: 'room:state_sync',
  ERROR: 'room:error'
};

/**
 * Register competition event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 * @param {Map} connectedUsers - Map of connected users
 */
const registerCompetitionHandlers = (io, socket, connectedUsers) => {
  /**
   * competition:join_room
   * Join a room for competition and receive current state
   */
  socket.on(COMPETITION_EVENTS.JOIN_ROOM, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;

    // Find room
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify user is participant or spectator
    const isParticipant = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );
    const isSpectator = room.spectators?.some(
      s => s.userId.toString() === socket.user.userId
    );

    if (!isParticipant && !isSpectator) {
      // Add as spectator if not a participant
      if (!room.spectators) {
        room.spectators = [];
      }
      room.spectators.push({
        userId: socket.user.userId,
        username: socket.user.username,
        joinedAt: new Date()
      });
      await room.save();
    }

    // Join socket to room namespace
    socket.join(`room:${roomId}`);
    
    // Store room reference on socket
    socket.roomId = roomId;

    // Get current room state
    const roomState = {
      roomId: room._id.toString(),
      name: room.name,
      status: room.status,
      mode: room.mode,
      difficulty: room.difficulty,
      timer: room.timer,
      participants: room.players.map(p => ({
        userId: p.userId?.toString(),
        username: p.username,
        isReady: p.isReady,
        isHost: room.createdBy?.toString() === p.userId?.toString()
      })),
      spectators: (room.spectators || []).map(s => ({
        userId: s.userId?.toString(),
        username: s.username
      })),
      currentProblem: room.currentProblem ? {
        id: room.currentProblem._id?.toString(),
        title: room.currentProblem.title,
        difficulty: room.currentProblem.difficulty
      } : null,
      matchStartedAt: room.matchStartedAt,
      timeRemaining: calculateTimeRemaining(room)
    };

    // Emit current state to joining socket
    socket.emit(COMPETITION_EVENTS.ROOM_STATE_SYNC, roomState);

    // Broadcast player joined to others in room
    socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.PLAYER_JOINED, {
      userId: socket.user.userId,
      username: socket.user.username,
      isParticipant,
      timestamp: new Date().toISOString()
    });

    // Broadcast spectator count update
    const spectatorCount = (room.spectators || []).length;
    io.to(`room:${roomId}`).emit(COMPETITION_EVENTS.SPECTATOR_COUNT, {
      count: spectatorCount,
      roomId
    });

    logger.info(`User ${socket.user.username} joined competition room ${roomId}`);

    const response = {
      success: true,
      data: { roomState },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:code_update
   * Broadcast code updates to opponent in real-time
   */
  socket.on(COMPETITION_EVENTS.CODE_UPDATE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, codeSnippet } = data;

    // Validate user is participant
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const isParticipant = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );

    if (!isParticipant) {
      throw new Error('Only participants can send code updates');
    }

    // Save last code snapshot to room
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );
    if (player) {
      player.lastCodeSnapshot = codeSnippet || '';
      await room.save();
    }

    // Broadcast to opponent (excluding sender)
    socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.OPPONENT_CODE_UPDATE, {
      userId: socket.user.userId,
      username: socket.user.username,
      codeSnippet: codeSnippet ? codeSnippet.substring(0, 100) : '',
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:run_code
   * Execute code and broadcast result to sender only
   */
  socket.on(COMPETITION_EVENTS.RUN_CODE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, code, language } = data;

    // Validate user is participant
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const isParticipant = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );

    if (!isParticipant) {
      throw new Error('Only participants can run code');
    }

    // Broadcast that this player is running
    socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.OPPONENT_RUNNING, {
      userId: socket.user.userId,
      username: socket.user.username,
      timestamp: new Date().toISOString()
    });

    // TODO: Call execution service via Plan-08
    // For now, emit placeholder result
    const result = {
      success: true,
      output: 'Code execution placeholder - integration with execution service needed',
      testResults: [],
      executionTime: 0,
      memoryUsed: 0
    };

    // Send result only to sender
    socket.emit(COMPETITION_EVENTS.RUN_RESULT, {
      ...result,
      userId: socket.user.userId,
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:submit_code
   * Submit code, lock editor, check for match end
   */
  socket.on(COMPETITION_EVENTS.SUBMIT_CODE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, code, language } = data;

    // Validate user is participant
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const isParticipant = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );

    if (!isParticipant) {
      throw new Error('Only participants can submit code');
    }

    // Update player as submitted
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );
    if (player) {
      player.isSubmitted = true;
      player.submittedAt = new Date();
      player.lastCodeSnapshot = code;
      await room.save();
    }

    // Broadcast opponent submitted to other player
    socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.OPPONENT_SUBMITTED, {
      userId: socket.user.userId,
      username: socket.user.username,
      timestamp: new Date().toISOString()
    });

    // Check if both players submitted
    const allSubmitted = room.players.every(p => p.isSubmitted);
    if (allSubmitted && room.status === 'active') {
      // Both submitted - end match
      await endMatch(io, room);
    }

    const response = {
      success: true,
      data: { submitted: true },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:start_match
   * Start the competition timer
   */
  socket.on(COMPETITION_EVENTS.START_MATCH, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;

    // Validate host
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.createdBy?.toString() !== socket.user.userId) {
      throw new Error('Only host can start the match');
    }

    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Start the match
    room.status = 'active';
    room.matchStartedAt = new Date();
    
    // Reset player states
    room.players.forEach(p => {
      p.isReady = false;
      p.isSubmitted = false;
      p.submittedAt = null;
    });
    
    await room.save();

    // Start server-authoritative timer
    startTimer(io, room);

    // Broadcast match started
    io.to(`room:${roomId}`).emit(EVENTS.MATCH.STARTED, {
      roomId: room._id.toString(),
      matchId: room.currentMatchId,
      startedAt: room.matchStartedAt,
      timer: room.timer,
      timestamp: new Date().toISOString()
    });

    logger.info(`Match started in room ${roomId}`);

    const response = {
      success: true,
      data: { startedAt: room.matchStartedAt, timer: room.timer },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:spectator_join
   * Handle spectator joining
   */
  socket.on(COMPETITION_EVENTS.SPECTATOR_JOIN, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Add spectator
    if (!room.spectators) {
      room.spectators = [];
    }

    const existingSpectator = room.spectators.find(
      s => s.userId?.toString() === socket.user.userId
    );

    if (!existingSpectator) {
      room.spectators.push({
        userId: socket.user.userId,
        username: socket.user.username,
        joinedAt: new Date()
      });
      await room.save();
    }

    // Broadcast spectator count
    const spectatorCount = room.spectators.length;
    io.to(`room:${roomId}`).emit(COMPETITION_EVENTS.SPECTATOR_COUNT, {
      count: spectatorCount,
      roomId
    });

    const response = {
      success: true,
      data: { spectatorCount },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:spectator_leave
   * Handle spectator leaving
   */
  socket.on(COMPETITION_EVENTS.SPECTATOR_LEAVE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId } = data;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Remove spectator
    if (room.spectators) {
      room.spectators = room.spectators.filter(
        s => s.userId?.toString() !== socket.user.userId
      );
      await room.save();
    }

    // Broadcast spectator count
    const spectatorCount = room.spectators.length;
    io.to(`room:${roomId}`).emit(COMPETITION_EVENTS.SPECTATOR_COUNT, {
      count: spectatorCount,
      roomId
    });

    const response = {
      success: true,
      data: { spectatorCount },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * competition:progress_update
   * Broadcast progress updates to opponent
   */
  socket.on(COMPETITION_EVENTS.PROGRESS_UPDATE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, progress, passedTestCases, totalTestCases } = data;

    // Validate user is participant
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const isParticipant = room.players.some(
      p => p.userId.toString() === socket.user.userId
    );

    if (!isParticipant) {
      throw new Error('Only participants can send progress updates');
    }

    // Update player progress in room
    const player = room.players.find(
      p => p.userId.toString() === socket.user.userId
    );
    if (player) {
      player.progress = progress;
      await room.save();
    }

    // Broadcast to opponent
    socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.OPPONENT_PROGRESS, {
      userId: socket.user.userId,
      username: socket.user.username,
      progress,
      passedTestCases,
      totalTestCases,
      timestamp: new Date().toISOString()
    });

    const response = {
      success: true,
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
    const roomId = socket.roomId;
    if (roomId && socket.user) {
      // Notify room about disconnect
      socket.to(`room:${roomId}`).emit(COMPETITION_EVENTS.PLAYER_LEFT, {
        userId: socket.user.userId,
        username: socket.user.username,
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Start server-authoritative timer for a room
 */
function startTimer(io, room) {
  // Clear existing timer if any
  if (roomTimers.has(room._id.toString())) {
    clearInterval(roomTimers.get(room._id.toString()).intervalId);
  }

  const startTime = Date.now();
  const duration = (room.timer || 15) * 60 * 1000; // Convert minutes to ms

  const intervalId = setInterval(async () => {
    try {
      const remainingTime = duration - (Date.now() - startTime);
      
      if (remainingTime <= 0) {
        // Timer expired - end match
        clearInterval(intervalId);
        roomTimers.delete(room._id.toString());

        // Broadcast timeout
        io.to(`room:${room._id.toString()}`).emit(COMPETITION_EVENTS.MATCH_TIMEOUT, {
          roomId: room._id.toString(),
          timestamp: new Date().toISOString()
        });

        // End match
        await endMatch(io, room);
        
        logger.info(`Match timeout in room ${room._id}`);
      } else {
        // Broadcast timer update every second
        io.to(`room:${room._id.toString()}`).emit(COMPETITION_EVENTS.TIMER_UPDATE, {
          remainingTime,
          totalTime: duration,
          roomId: room._id.toString()
        });
      }
    } catch (error) {
      logger.error('Timer error:', error);
    }
  }, 1000);

  roomTimers.set(room._id.toString(), { intervalId, startTime, duration });
}

/**
 * Stop timer for a room
 */
function stopTimer(roomId) {
  const timer = roomTimers.get(roomId);
  if (timer) {
    clearInterval(timer.intervalId);
    roomTimers.delete(roomId);
  }
}

/**
 * Calculate remaining time for a room
 */
function calculateTimeRemaining(room) {
  if (!room.matchStartedAt || room.status !== 'active') {
    return (room.timer || 15) * 60 * 1000;
  }

  const duration = (room.timer || 15) * 60 * 1000;
  const elapsed = Date.now() - new Date(room.matchStartedAt).getTime();
  return Math.max(0, duration - elapsed);
}

/**
 * End match and determine winner
 */
async function endMatch(io, room) {
  // Stop timer
  stopTimer(room._id.toString());

  // Determine winner based on submissions
  const players = room.players;
  
  // Calculate scores (simplified - based on submission time and status)
  let winner = null;
  if (players[0]?.isSubmitted && players[1]?.isSubmitted) {
    // Both submitted - earliest wins
    const time1 = players[0].submittedAt ? new Date(players[0].submittedAt).getTime() : Infinity;
    const time2 = players[1].submittedAt ? new Date(players[1].submittedAt).getTime() : Infinity;
    
    if (time1 < time2) {
      winner = players[0].userId;
    } else if (time2 < time1) {
      winner = players[1].userId;
    }
  } else if (players[0]?.isSubmitted) {
    winner = players[0].userId;
  } else if (players[1]?.isSubmitted) {
    winner = players[1].userId;
  }

  // Update room status
  room.status = 'finished';
  room.matchEndedAt = new Date();
  await room.save();

  // Broadcast match end
  io.to(`room:${room._id.toString()}`).emit(EVENTS.MATCH.ENDED, {
    roomId: room._id.toString(),
    winner: winner?.toString(),
    endedAt: room.matchEndedAt,
    players: players.map(p => ({
      userId: p.userId?.toString(),
      username: p.username,
      isSubmitted: p.isSubmitted,
      submittedAt: p.submittedAt
    })),
    timestamp: new Date().toISOString()
  });

  logger.info(`Match ended in room ${room._id}, winner: ${winner}`);
}

module.exports = {
  registerCompetitionHandlers,
  COMPETITION_EVENTS,
  startTimer,
  stopTimer
};
