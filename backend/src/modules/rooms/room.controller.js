/**
 * Room controller
 * HTTP handlers for room endpoints
 */

const { Room } = require('./room.model.js');
const { User } = require('../users/user.model.js');

/**
 * Get all active rooms
 * GET /api/v1/lobby/rooms
 */
const getRooms = async (req, res) => {
  try {
    const { mode, status, isPrivate, limit = 50, offset = 0 } = req.query;
    
    const filter = {};
    
    // Only show public rooms by default
    if (isPrivate === 'false' || isPrivate === undefined) {
      filter.isPrivate = false;
    }
    
    if (mode) filter.mode = mode;
    if (status) filter.status = status;
    
    const rooms = await Room.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('createdBy', 'username');
    
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
    
    const room = await Room.create({
      name: name || `Room ${Date.now().toString(36).toUpperCase()}`,
      mode,
      maxPlayers,
      isPrivate,
      difficulty,
      timer,
      createdBy: userId,
      players: [{ userId, username, isReady: true }]
    });
    
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
    
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    if (!room.canJoin()) {
      return res.status(400).json({
        success: false,
        message: 'Room is not available to join'
      });
    }
    
    // Check if already in room
    const alreadyIn = room.players.some(p => p.userId.toString() === userId.toString());
    if (alreadyIn) {
      return res.status(400).json({
        success: false,
        message: 'Already in this room'
      });
    }
    
    await room.addPlayer(userId, username);
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
    
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    await room.removePlayer(userId);
    
    res.json({
      success: true,
      message: 'Left room successfully'
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

module.exports = {
  getRooms,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  getLobbyStats
};
