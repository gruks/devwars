/**
 * Socket.io initialization
 * Modular structure with middleware and handlers
 */

const { socketAuthMiddleware } = require('./middleware/auth.js');
const { EVENTS } = require('./utils/events.js');
const { logger } = require('../../utils/logger.js');

// Maps for tracking connections
const connectedUsers = new Map(); // socketId -> { userId, username }
const socketRooms = new Map();    // socketId -> roomId
const userSockets = new Map();    // userId -> socketId (for reconnection tracking)

/**
 * Initialize socket.io with all handlers
 * @param {Object} io - Socket.io instance
 */
const initializeSocket = (io) => {
  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connection errors
  io.on('connect_error', (err) => {
    logger.error('Socket connection error:', err.message);
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Track authenticated users
    if (socket.user) {
      connectedUsers.set(socket.id, socket.user);
      userSockets.set(socket.user.userId, socket.id);

      // Notify others this user is online
      socket.broadcast.emit(EVENTS.PLAYER.ONLINE, {
        userId: socket.user.userId,
        username: socket.user.username,
        timestamp: new Date().toISOString()
      });
    }

    // Send connected event
    socket.emit(EVENTS.SYSTEM.CONNECTED, {
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Handle ping/pong for connection health
    socket.on(EVENTS.SYSTEM.PING, (data, callback) => {
      if (typeof callback === 'function') {
        callback({ pong: true, timestamp: new Date().toISOString() });
      } else {
        socket.emit(EVENTS.SYSTEM.PONG, { timestamp: new Date().toISOString() });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id}, reason: ${reason}`);

      const user = connectedUsers.get(socket.id);

      if (user) {
        connectedUsers.delete(socket.id);
        userSockets.delete(user.userId);

        // Notify others this user is offline
        socket.broadcast.emit(EVENTS.PLAYER.OFFLINE, {
          userId: user.userId,
          username: user.username,
          timestamp: new Date().toISOString()
        });
      }

      socketRooms.delete(socket.id);
    });

    // TODO: Lobby and room handlers will be added in next plans
    // These will be imported from ./handlers/lobby.js and ./handlers/room.js
  });

  return io;
};

/**
 * Get connected users count
 */
const getOnlineUsers = () => Array.from(connectedUsers.values());

/**
 * Get connected users count
 */
const getOnlineCount = () => connectedUsers.size;

/**
 * Check if user is online
 */
const isUserOnline = (userId) => {
  for (const user of connectedUsers.values()) {
    if (user.userId === userId) return true;
  }
  return false;
};

module.exports = {
  initializeSocket,
  getOnlineUsers,
  getOnlineCount,
  isUserOnline,
  connectedUsers,
  socketRooms,
  userSockets
};
