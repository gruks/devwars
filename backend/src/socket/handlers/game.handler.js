/**
 * Game Socket Handler
 * Real-time game event handlers for debug battle matches
 */

const { Room } = require('../../modules/rooms/room.model.js');
const { Match } = require('../../modules/matches/match.model.js');
const { Question } = require('../../modules/questions/question.model.js');
const { User } = require('../../modules/users/user.model.js');
const matchService = require('../../modules/matches/match.service.js');
const { AppError } = require('../../utils/helpers.js');
const { logger } = require('../../utils/logger.js');

// Track active match timers: Map<roomId, timerInterval>
const activeTimers = new Map();

/**
 * Register game socket event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
const registerGameHandlers = (io, socket) => {
  // Authenticate socket using user data from session middleware
  const authenticateSocket = () => {
    if (!socket.user) {
      throw new AppError('Authentication required', 401);
    }
    return socket.user;
  };

  /**
   * Event: match:start
   * Start a new match with a question
   */
  socket.on('match:start', async (data, callback) => {
    try {
      const user = authenticateSocket();
      const { roomId, questionId, timerDuration = 900 } = data;

      logger.info({ roomId, userId: user.userId }, 'Match start requested');

      // Validate room exists and user is host
      const room = await Room.findById(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      if (room.createdBy.toString() !== user.userId) {
        return callback?.({ success: false, error: 'Only room host can start match' });
      }

      if (room.status !== 'waiting') {
        return callback?.({ success: false, error: 'Room is not in waiting status' });
      }

      // Update room status to playing
      await room.startMatch();

      // Get question for the match
      let question;
      if (questionId) {
        question = await Question.findById(questionId);
      } else {
        // Randomly select a question matching room settings
        const questions = await Question.find({
          mode: 'debug',
          difficulty: room.difficulty,
          isActive: true
        });
        if (questions.length === 0) {
          return callback?.({ success: false, error: 'No questions available for this difficulty' });
        }
        question = questions[Math.floor(Math.random() * questions.length)];
      }

      if (!question) {
        return callback?.({ success: false, error: 'Question not found' });
      }

      // Create match using match service
      const match = await matchService.createMatch({
        roomId,
        questionId: question._id,
        timerDuration
      });

      // Start the match
      await matchService.startMatch(match._id);

      // Store matchId in socket data
      socket.data = socket.data || {};
      socket.data.matchId = match._id.toString();
      socket.data.roomId = roomId;

      // Join room namespace
      socket.join(`room:${roomId}`);

      // Broadcast MATCH_START to all players in room
      const timerEndTime = new Date(Date.now() + timerDuration * 1000).toISOString();
      
      io.to(`room:${roomId}`).emit('MATCH_START', {
        type: 'MATCH_START',
        data: {
          matchId: match._id,
          question: {
            id: question.id,
            title: question.title,
            description: question.description,
            starterCode: question.starterCode,
            testcases: question.testcases.map(tc => ({
              input: tc.input,
              output: tc.output
            }))
          },
          timerEndTime,
          timerDuration
        }
      });

      // Start timer synchronization
      startTimerSync(io, roomId, match._id, timerDuration);

      callback?.({
        success: true,
        data: {
          matchId: match._id,
          question: {
            id: question.id,
            title: question.title,
            description: question.description,
            starterCode: question.starterCode
          },
          timerEndTime
        }
      });

      logger.info({ matchId: match._id, roomId }, 'Match started successfully');
    } catch (error) {
      logger.error({ error: error.message }, 'Match start failed');
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * Event: match:code-update
   * Broadcast code updates to other players (excluding sender)
   */
  socket.on('match:code-update', async (data, callback) => {
    try {
      const user = authenticateSocket();
      const { roomId, code } = data;

      // Broadcast to room excluding sender
      socket.to(`room:${roomId}`).emit('CODE_UPDATE', {
        type: 'CODE_UPDATE',
        data: {
          playerId: user.userId,
          username: user.username,
          code,
          timestamp: new Date().toISOString()
        }
      });

      callback?.({ success: true });
    } catch (error) {
      logger.error({ error: error.message }, 'Code update failed');
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * Event: match:submit
   * Submit code solution for evaluation
   */
  socket.on('match:submit', async (data, callback) => {
    try {
      const user = authenticateSocket();
      const { roomId, code } = data;

      logger.info({ roomId, userId: user.userId }, 'Code submission received');

      // Find active match for this room
      const match = await Match.findOne({
        roomId,
        status: 'active'
      });

      if (!match) {
        return callback?.({ success: false, error: 'No active match found' });
      }

      // Submit code using match service
      const result = await matchService.submitCode(match._id, user.userId, code);

      // Broadcast PLAYER_SOLVED event
      io.to(`room:${roomId}`).emit('PLAYER_SOLVED', {
        type: 'PLAYER_SOLVED',
        data: {
          playerId: user.userId,
          username: user.username,
          score: result.score,
          passedTests: result.passedTests,
          totalTests: result.totalTests,
          isFirstBlood: result.isFirstBlood,
          timestamp: new Date().toISOString()
        }
      });

      // Check if all players have solved or if someone got 100%
      const allSolved = match.players.every(p => p.score === 100);
      const hasWinner = result.score === 100;

      // If match should end, trigger it
      if (allSolved || (hasWinner && result.isFirstBlood)) {
        // Optional: Auto-end if everyone solved or first blood achieved
        // For now, let host manually end or timer expire
      }

      callback?.({
        success: true,
        data: result
      });

      logger.info({
        matchId: match._id,
        userId: user.userId,
        score: result.score,
        isFirstBlood: result.isFirstBlood
      }, 'Code submission processed');
    } catch (error) {
      logger.error({ error: error.message }, 'Code submission failed');
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * Event: match:end
   * End the match and broadcast results
   */
  socket.on('match:end', async (data, callback) => {
    try {
      const user = authenticateSocket();
      const { roomId } = data;

      logger.info({ roomId, userId: user.userId }, 'Match end requested');

      // Validate room and host
      const room = await Room.findById(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      if (room.createdBy.toString() !== user.userId) {
        return callback?.({ success: false, error: 'Only room host can end match' });
      }

      // Find active match
      const match = await Match.findOne({
        roomId,
        status: { $in: ['waiting', 'active'] }
      });

      if (!match) {
        return callback?.({ success: false, error: 'No active match found' });
      }

      // End match using match service
      const results = await matchService.endMatch(match._id);

      // Stop timer
      stopTimerSync(roomId);

      // End room match
      await room.endMatch();

      // Broadcast MATCH_END to all players
      io.to(`room:${roomId}`).emit('MATCH_END', {
        type: 'MATCH_END',
        data: {
          matchId: match._id,
          results: results.players,
          winner: results.winner,
          duration: results.duration,
          timestamp: new Date().toISOString()
        }
      });

      // Broadcast to lobby that room is finished
      io.to('lobby').emit('ROOM_UPDATED', { room });

      callback?.({
        success: true,
        data: results
      });

      logger.info({ matchId: match._id, winner: results.winner }, 'Match ended successfully');
    } catch (error) {
      logger.error({ error: error.message }, 'Match end failed');
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * Event: match:timer-sync
   * Get current timer state
   */
  socket.on('match:timer-sync', async (data, callback) => {
    try {
      const { roomId } = data;

      const match = await Match.findOne({
        roomId,
        status: 'active'
      });

      if (!match) {
        return callback?.({ success: false, error: 'No active match found' });
      }

      const remainingTime = match.remainingTime;
      const isPaused = false; // Timer pausing not implemented yet

      callback?.({
        success: true,
        data: {
          type: 'TIMER_SYNC',
          data: {
            remainingTime,
            isPaused,
            totalDuration: match.timerDuration,
            elapsedTime: match.elapsedTime
          }
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Timer sync failed');
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * Handle socket disconnect - clean up
   */
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id, user: socket.user?.username }, 'Game socket disconnected');
  });
};

/**
 * Start timer synchronization for a match
 * Broadcasts remaining time every 5 seconds
 */
const startTimerSync = (io, roomId, matchId, duration) => {
  // Clear any existing timer for this room
  stopTimerSync(roomId);

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  const timerInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

      // Broadcast timer sync
      io.to(`room:${roomId}`).emit('TIMER_SYNC', {
        type: 'TIMER_SYNC',
        data: {
          remainingTime,
          isPaused: false,
          totalDuration: duration,
          elapsedTime: Math.floor((now - startTime) / 1000)
        }
      });

      // Check if timer expired
      if (remainingTime <= 0) {
        // Auto-end match
        clearInterval(timerInterval);
        activeTimers.delete(roomId);

        const match = await Match.findById(matchId);
        if (match && match.status === 'active') {
          const results = await matchService.endMatch(matchId);
          
          io.to(`room:${roomId}`).emit('MATCH_END', {
            type: 'MATCH_END',
            data: {
              matchId,
              results: results.players,
              winner: results.winner,
              duration: results.duration,
              reason: 'timer_expired',
              timestamp: new Date().toISOString()
            }
          });

          // Update room status
          const room = await Room.findById(roomId);
          if (room) {
            await room.endMatch();
            io.to('lobby').emit('ROOM_UPDATED', { room });
          }

          logger.info({ matchId }, 'Match auto-ended due to timer expiry');
        }
      }
    } catch (error) {
      logger.error({ error: error.message, roomId }, 'Timer sync error');
    }
  }, 5000); // Sync every 5 seconds

  activeTimers.set(roomId, timerInterval);
  logger.info({ roomId, matchId, duration }, 'Timer sync started');
};

/**
 * Stop timer synchronization for a room
 */
const stopTimerSync = (roomId) => {
  const existingTimer = activeTimers.get(roomId);
  if (existingTimer) {
    clearInterval(existingTimer);
    activeTimers.delete(roomId);
    logger.info({ roomId }, 'Timer sync stopped');
  }
};

module.exports = { registerGameHandlers };
