/**
 * Lobby event handlers
 */
const { Room } = require('../../rooms/room.model.js');
const { EVENTS } = require('../utils/events.js');
const { asyncHandler } = require('../middleware/error.js');
const { logger } = require('../../../utils/logger.js');

/**
 * Register lobby event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 * @param {Map} connectedUsers - Map of connected users
 */
const registerLobbyHandlers = (io, socket, connectedUsers) => {
  /**
   * Join lobby
   * Client sends: { }
   * Server responds via callback: { success, data: { rooms, stats, onlineUsers } }
   */
  socket.on(EVENTS.LOBBY.JOIN, asyncHandler(async (data, callback) => {
    // Join lobby room
    socket.join('lobby');
    logger.debug(`Socket ${socket.id} joined lobby`);

    // If user is authenticated, check for active room
    let activeRoom = null;
    if (socket.user) {
      const userRooms = await Room.find({
        'players.userId': socket.user.userId,
        status: { $ne: 'finished' }
      }).limit(1);

      if (userRooms.length > 0) {
        activeRoom = userRooms[0];
        socket.join(`room:${activeRoom._id}`);
      }
    }

    // Fetch lobby data
    const [rooms, stats] = await Promise.all([
      Room.find({ status: { $ne: 'finished' }, isPrivate: false })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      getLobbyStats()
    ]);

    logger.debug(`Sending ${rooms.length} rooms to socket ${socket.id}`);

    const onlineUsers = Array.from(connectedUsers.values());

    // Send response
    const response = {
      success: true,
      data: {
        rooms,
        stats,
        onlineUsers,
        activeRoom: activeRoom ? { id: activeRoom._id.toString(), name: activeRoom.name } : null
      },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    } else {
      socket.emit(EVENTS.LOBBY.ROOM_LIST, response);
    }
  }));

  /**
   * Leave lobby
   */
  socket.on(EVENTS.LOBBY.LEAVE, asyncHandler(async (data, callback) => {
    socket.leave('lobby');
    logger.debug(`Socket ${socket.id} left lobby`);

    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    }
  }));

  /**
   * Get lobby stats
   */
  socket.on(EVENTS.LOBBY.STATS, asyncHandler(async (data, callback) => {
    const stats = await getLobbyStats();
    const onlineUsers = Array.from(connectedUsers.values());

    const response = {
      success: true,
      data: { stats, onlineUsers },
      timestamp: new Date().toISOString()
    };

    if (typeof callback === 'function') {
      callback(response);
    } else {
      socket.emit(EVENTS.LOBBY.STATS, response);
    }
  }));
};

/**
 * Get lobby statistics
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
    totalPlayers: totalPlayers[0]?.total || 0
  };
}

module.exports = { registerLobbyHandlers, getLobbyStats };
