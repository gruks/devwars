/**
 * Room controller
 * HTTP handlers for room endpoints
 */

const { Room } = require('./room.model.js');
const { User } = require('../users/user.model.js');
const { Question } = require('../questions/question.model.js');
const matchService = require('../matches/match.service.js');

/**
 * Get all active rooms
 * GET /api/v1/lobby/rooms
 */
const getRooms = async (req, res) => {
  try {
    const { mode, status, isPrivate, search, limit = 50, offset = 0 } = req.query;
    
    const filter = {};
    
    // Only show public rooms by default
    if (isPrivate === 'false' || isPrivate === undefined) {
      filter.isPrivate = false;
    }
    
    // Only show non-finished rooms by default
    if (!status) {
      filter.status = { $ne: 'finished' };
    } else {
      filter.status = status;
    }
    
    // Mode filter: debug, bug-hunt, code-golf
    if (mode) filter.mode = mode;
    
    // Search by room name or invite code
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { inviteCode: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    const rooms = await Room.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('createdBy', 'username')
      .populate('players.userId', 'username');
    
    const total = await Room.countDocuments(filter);
    
    res.json({
      success: true,
      data: rooms,
      meta: { total, limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
};

/**
 * Generate random 6-character room code
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Validate game mode
 */
const VALID_MODES = ['debug', 'bug-hunt', 'code-golf'];

/**
 * Validate difficulty
 */
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'];

/**
 * Validate timer values (in minutes)
 */
const VALID_TIMERS = [10, 15, 20, 30];

/**
 * Determine skill level based on user rating
 * @param {number} rating - User's rating
 * @returns {string} skillLevel - beginner, intermediate, advanced, or expert
 */
const determineSkillLevel = (rating) => {
  if (rating >= 1600) return 'expert';
  if (rating >= 1300) return 'advanced';
  if (rating >= 1000) return 'intermediate';
  return 'beginner';
};

/**
 * Create a new room
 * POST /api/v1/lobby/rooms
 */
const createRoom = async (req, res) => {
  try {
    const { 
      name, 
      mode = 'debug', 
      maxPlayers = 4, 
      isPrivate = false, 
      difficulty = 'medium',
      timer = 15
    } = req.body;
    
    const userId = req.user?._id;
    const username = req.user?.username;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to create a room'
      });
    }
    
    // Validate mode
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`
      });
    }
    
    // Validate maxPlayers
    const maxPlayersNum = parseInt(maxPlayers);
    if (isNaN(maxPlayersNum) || maxPlayersNum < 2 || maxPlayersNum > 6) {
      return res.status(400).json({
        success: false,
        message: 'maxPlayers must be between 2 and 6'
      });
    }
    
    // Validate difficulty
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}`
      });
    }
    
    // Validate timer
    const timerNum = parseInt(timer);
    if (!VALID_TIMERS.includes(timerNum)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timer. Must be one of: ${VALID_TIMERS.join(', ')} minutes`
      });
    }
    
    // Auto-generate name if not provided
    const roomName = name?.trim() || `Room-${generateRoomCode()}`;
    
    // Validate name length
    if (roomName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Room name cannot exceed 50 characters'
      });
    }
    
    // Fetch user to get their rating for skill level
    const user = await User.findById(userId).select('stats.rating');
    const userRating = user?.stats?.rating || 1000;
    const skillLevel = determineSkillLevel(userRating);
    
    let room;
    let retries = 0;
    const maxRetries = 3;
    
    // Try to create room with unique invite code
    while (retries < maxRetries) {
      try {
        room = await Room.create({
          name: roomName,
          mode,
          maxPlayers: maxPlayersNum,
          isPrivate: Boolean(isPrivate),
          difficulty,
          timer: timerNum,
          skillLevel,
          createdBy: userId,
          players: [{ userId, username, isReady: true }]
        });
        break; // Success
      } catch (error) {
        // Check if error is duplicate invite code
        if (error.code === 11000 && error.message?.includes('inviteCode')) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('Failed to generate unique invite code after multiple attempts');
          }
          // Retry with new invite code (auto-generated by schema)
          continue;
        }
        throw error; // Other errors
      }
    }
    
    await room.populate('createdBy', 'username');
    await room.populate('players.userId', 'username');
    
    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
      error: error.message
    });
  }
};

/**
 * Get room by ID or invite code
 * GET /api/v1/lobby/rooms/:identifier
 */
const getRoom = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by invite code
    let room = await Room.findById(identifier)
      .populate('createdBy', 'username')
      .populate('players.userId', 'username');
    
    if (!room) {
      room = await Room.findOne({ inviteCode: identifier.toUpperCase() })
        .populate('createdBy', 'username')
        .populate('players.userId', 'username');
    }
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room',
      error: error.message
    });
  }
};

/**
 * Join a room
 * POST /api/v1/lobby/rooms/:id/join
 */
const joinRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const username = req.user?.username;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to join a room'
      });
    }
    
    // Find room
    const room = await Room.findById(id);
    
    // Check room exists
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check room status is waiting
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: `Cannot join room: ${room.status === 'playing' ? 'Game in progress' : 'Game has ended'}`
      });
    }
    
    // Check room is not full
    if (room.playerCount >= room.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Room is full'
      });
    }
    
    // Check user not already in room
    const alreadyIn = room.players.some(p => p.userId.toString() === userId.toString() && !p.departedAt);
    
    // Check if user previously departed and can rejoin (room still waiting)
    const departedPlayer = room.players.find(p => 
      p.userId.toString() === userId.toString() && p.departedAt
    );
    
    if (departedPlayer) {
      // Rejoin: clear departedAt, update lastActiveAt
      departedPlayer.departedAt = undefined;
      departedPlayer.lastActiveAt = new Date();
      departedPlayer.isReady = true;
      await room.save();
      
      await room.populate('createdBy', 'username');
      await room.populate('players.userId', 'username');
      
      return res.json({
        success: true,
        message: 'Rejoined room successfully',
        data: room
      });
    }
    
    if (alreadyIn) {
      return res.status(400).json({
        success: false,
        message: 'Already in this room'
      });
    }
    
    // Add player to room with joinedAt timestamp
    room.players.push({ 
      userId, 
      username, 
      isReady: false,
      joinedAt: new Date()
    });
    
    await room.save();
    
    // Populate and return updated room
    await room.populate('createdBy', 'username');
    await room.populate('players.userId', 'username');
    
    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to join room',
      error: error.message
    });
  }
};

/**
 * Leave a room
 * POST /api/v1/lobby/rooms/:id/leave
 */
const leaveRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find room
    const room = await Room.findById(id);
    
    // Check room exists
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check user is in room
    const isPlayerInRoom = room.players.some(p => p.userId.toString() === userId.toString());
    if (!isPlayerInRoom) {
      return res.status(400).json({
        success: false,
        message: 'You are not in this room'
      });
    }
    
    // Log departure timestamp for the leaving player (keep in array for rejoin support)
    const player = room.players.find(p => p.userId.toString() === userId.toString());
    if (player) {
      player.departedAt = new Date();
    }
    
    // Keep departed player in array for rejoin support - don't remove them
    // But if host leaves, transfer host to next active player
    
    // If host leaves, assign new host to first remaining active player
    if (room.createdBy.toString() === userId.toString()) {
      const activePlayers = room.players.filter(p => 
        p.userId.toString() !== userId.toString() && !p.departedAt
      );
      if (activePlayers.length > 0) {
        room.createdBy = activePlayers[0].userId;
      }
    }
    
    // If room has no active players (all departed), delete it
    const hasActivePlayers = room.players.some(p => !p.departedAt);
    if (!hasActivePlayers) {
      await room.deleteOne();
      return res.json({
        success: true,
        message: 'Left room successfully (room deleted)'
      });
    }
    
    await room.save();
    
    // Populate and return updated room
    await room.populate('createdBy', 'username');
    await room.populate('players.userId', 'username');
    
    res.json({
      success: true,
      message: 'Left room successfully',
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to leave room',
      error: error.message
    });
  }
};

/**
 * Get lobby stats
 * GET /api/v1/lobby/stats
 */
const getLobbyStats = async (req, res) => {
  try {
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
    
    res.json({
      success: true,
      data: {
        totalRooms,
        waitingRooms,
        playingRooms,
        totalPlayers: totalPlayers[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lobby stats',
      error: error.message
    });
  }
};

/**
 * Start a match
 * POST /api/v1/lobby/rooms/:id/start
 */
const startMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Only host can start match
    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only room host can start the match'
      });
    }
    
    // Check room status
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: `Match cannot be started from ${room.status} status`
      });
    }
    
    // Need at least 2 players
    if (room.players.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Need at least 2 players to start'
      });
    }
    
    // Start the match using model method
    await room.startMatch();
    await room.populate('createdBy', 'username');
    await room.populate('players.userId', 'username');
    
    // Broadcast to all players via socket (if socket service available)
    if (req.io) {
      req.io.to(`room:${id}`).emit('MATCH_STARTED', {
        type: 'MATCH_STARTED',
        data: {
          roomId: id,
          startedAt: room.startedAt,
          players: room.players
        }
      });
      req.io.to('lobby').emit('ROOM_UPDATED', { room });
    }
    
    res.json({
      success: true,
      message: 'Match started successfully',
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start match',
      error: error.message
    });
  }
};

/**
 * End a match
 * POST /api/v1/lobby/rooms/:id/end
 */
const endMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerId, results } = req.body || {};
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Only host or system can end match
    const isHost = room.createdBy.toString() === userId.toString();
    const isSystem = req.user?.role === 'system' || req.user?.role === 'admin';
    
    if (!isHost && !isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Only room host or system can end the match'
      });
    }
    
    // Check room status - allow ending from playing or waiting (for testing)
    if (room.status !== 'playing' && room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: `Cannot end match from ${room.status} status`
      });
    }
    
    // End the match using model method
    try {
      await room.endMatch();
    } catch (err) {
      // If endMatch fails, just set status to finished manually
      room.status = 'finished';
      room.finishedAt = new Date();
      await room.save();
    }
    
    // Update player stats if results provided
    if (results && Array.isArray(results)) {
      for (const result of results) {
        const { userId: playerId, score, isWinner } = result;
        
        const player = await User.findById(playerId);
        if (player) {
          if (!player.stats) {
            player.stats = { wins: 0, losses: 0, matchesPlayed: 0, rating: 1000 };
          }
          
          // Update matches played
          player.stats.matchesPlayed = (player.stats.matchesPlayed || 0) + 1;
          
          if (isWinner || playerId.toString() === winnerId?.toString()) {
            player.stats.wins = (player.stats.wins || 0) + 1;
            // Increase rating for winner
            player.stats.rating = (player.stats.rating || 1000) + 25;
          } else {
            player.stats.losses = (player.stats.losses || 0) + 1;
            // Decrease rating for loser (min 100)
            player.stats.rating = Math.max(100, (player.stats.rating || 1000) - 15);
          }
          
          await player.save();
        }
      }
    }
    
    await room.populate('createdBy', 'username');
    await room.populate('players.userId', 'username');
    
    // Broadcast to all players via socket (if socket service available)
    if (req.io) {
      req.io.to(`room-${id}`).emit('match-ended', {
        roomId: id,
        finishedAt: room.finishedAt,
        winnerId,
        results
      });
    }
    
    res.json({
      success: true,
      message: 'Match ended successfully',
      data: {
        room,
        winnerId,
        results
      }
    });
  } catch (error) {
    console.error('Error ending match:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to end match',
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Start a full game match with question
 * POST /api/v1/lobby/rooms/:id/start-match
 */
const startGameMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    logger.debug(`startGameMatch called with roomId: ${id}, userId: ${userId}`);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const room = await Room.findById(id);
    logger.debug(`Room lookup result: ${room ? `Found: ${room.name}, status: ${room.status}, isPrivate: ${room.isPrivate}` : 'Not found'}`);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can start match
    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only room host can start the match'
      });
    }

    // Check room status
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: `Match cannot be started from ${room.status} status`
      });
    }

    // Need at least 2 players
    if (room.players.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Need at least 2 players to start'
      });
    }

    // Randomly select a question matching room settings
    const questions = await Question.find({
      mode: 'debug',
      difficulty: room.difficulty,
      isActive: true
    });

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions available for this difficulty level'
      });
    }

    const question = questions[Math.floor(Math.random() * questions.length)];

    // Calculate timer duration from room settings (convert minutes to seconds)
    const timerDuration = room.timer * 60;

    // Update room status to playing
    await room.startMatch();

    // Create and start match via service
    const match = await matchService.createMatch({
      roomId: id,
      questionId: question._id,
      timerDuration
    });

    await matchService.startMatch(match._id);

    // Broadcast match start via socket (if io available)
    if (req.io) {
      const timerEndTime = new Date(Date.now() + timerDuration * 1000).toISOString();
      
      req.io.to(`room-${id}`).emit('game:match_start', {
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
        timerDuration,
        timerEndTime
      });

      // Also broadcast to lobby
      req.io.to('lobby').emit('ROOM_UPDATED', { room });
    }

    res.json({
      success: true,
      message: 'Match started successfully',
      data: {
        matchId: match._id,
        question: {
          id: question.id,
          title: question.title,
          description: question.description,
          starterCode: question.starterCode
        },
        timerDuration
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start match',
      error: error.message
    });
  }
};

/**
 * Get match results
 * GET /api/v1/lobby/rooms/:id/results
 */
const getMatchResults = async (req, res) => {
  try {
    const { id } = req.params;
    
    const room = await Room.findById(id)
      .populate('createdBy', 'username')
      .populate('players.userId', 'username stats');
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Only return results for finished matches
    if (room.status !== 'finished' && room.status !== 'playing') {
      return res.status(400).json({
        success: false,
        message: 'Match has not started yet'
      });
    }
    
    // Calculate match duration
    const duration = room.startedAt && room.finishedAt
      ? Math.round((room.finishedAt - room.startedAt) / 1000) // in seconds
      : room.startedAt
        ? Math.round((Date.now() - room.startedAt) / 1000)
        : null;
    
    res.json({
      success: true,
      data: {
        roomId: room._id,
        name: room.name,
        mode: room.mode,
        status: room.status,
        startedAt: room.startedAt,
        finishedAt: room.finishedAt,
        duration,
        players: room.players.map(p => ({
          userId: p.userId._id,
          username: p.userId.username,
          stats: p.userId.stats,
          joinedAt: p.joinedAt,
          isReady: p.isReady
        })),
        winner: room.winner
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match results',
      error: error.message
    });
  }
};

module.exports = {
  getRooms,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  getLobbyStats,
  startMatch,
  startGameMatch,
  endMatch,
  getMatchResults
};
