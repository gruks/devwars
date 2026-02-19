/**
 * Socket.io initialization
 * Modular structure with middleware and handlers
 */

const cookie = require('cookie');
const { socketAuthMiddleware } = require('./middleware/auth.js');
const { EVENTS } = require('./utils/events.js');
const { logger } = require('../../utils/logger.js');
const { registerLobbyHandlers } = require('./handlers/lobby.js');
const { registerRoomHandlers } = require('./handlers/room.js');
const { registerChatHandlers } = require('./handlers/chat.js');
const { registerCompetitionHandlers } = require('../../socket/handlers/competition.handlers.js');

// Maps for tracking connections
const connectedUsers = new Map(); // socketId -> { userId, username }
const socketRooms = new Map();    // socketId -> roomId
const userSockets = new Map();    // userId -> socketId (for reconnection tracking)

/**
 * Initialize socket.io with all handlers
 * @param {Object} io - Socket.io instance
 * @param {Function} sessionMiddleware - Express session middleware (optional)
 */
const initializeSocket = (io, sessionMiddleware) => {
  // Apply session middleware first if provided
  if (sessionMiddleware) {
    io.use((socket, next) => {
      // Parse cookies from handshake headers
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      logger.debug('[Socket] Cookies parsed:', Object.keys(cookies));
      
      // Manually set cookie header on request for session middleware
      socket.request.headers.cookie = socket.handshake.headers.cookie || '';
      
      sessionMiddleware(socket.request, {}, (err) => {
        if (err) {
          logger.error('[Socket] Session middleware error:', err);
        } else {
          logger.debug('[Socket] Session after middleware:', socket.request.session?.userId);
        }
        next(err);
      });
    });
  } else {
    logger.warn('[Socket] No session middleware provided');
  }

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

    // Register handlers
    registerLobbyHandlers(io, socket, connectedUsers);
    const { socketRooms: roomSockets } = registerRoomHandlers(io, socket, connectedUsers);
    registerChatHandlers(io, socket);
    registerCompetitionHandlers(io, socket, connectedUsers);
    
    // Merge room socket tracking
    for (const [key, value] of roomSockets.entries()) {
      socketRooms.set(key, value);
    }
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
