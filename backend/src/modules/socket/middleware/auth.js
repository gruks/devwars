/**
 * Socket.io authentication middleware
 * Reads session from httpOnly cookie
 */

const { User } = require('../../users/user.model.js');
const { logger } = require('../../../utils/logger.js');

/**
 * Socket authentication middleware
 * Extracts session from cookie and attaches user to socket
 * Uses express-session for authentication
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Session is available via socket.request.session
    // Express-session stores session data on the request object
    const session = socket.request.session;
    
    logger.debug(`[Socket Auth] Session exists: ${!!session}, userId: ${session?.userId}`);
    
    if (!session || !session.userId) {
      // Allow unauthenticated connections for public lobby
      logger.debug(`[Socket Auth] No session or userId - allowing anonymous`);
      return next();
    }

    // Find user by session userId
    const user = await User.findById(session.userId);
    
    logger.debug(`[Socket Auth] Found user: ${user?.username}`);

    if (user && user.isActive !== false) {
      // Attach user to socket
      socket.user = {
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      };

      logger.debug(`Socket authenticated: ${socket.user.username} (${socket.id})`);
    }

    next();
  } catch (error) {
    // Log unexpected errors but don't block connection
    logger.error('Socket auth error:', error);
    next();
  }
};

/**
 * Require authentication middleware
 * Use this wrapper for protected events
 * @param {Object} socket - Socket instance
 * @returns {Object} User object
 * @throws {Error} If not authenticated
 */
const requireAuth = (socket) => {
  if (!socket.user) {
    throw new Error('Authentication required');
  }
  return socket.user;
};

module.exports = { socketAuthMiddleware, requireAuth };
