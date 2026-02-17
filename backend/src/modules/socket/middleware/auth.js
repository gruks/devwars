/**
 * Socket.io authentication middleware
 * Reads JWT from httpOnly cookies
 */

const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { User } = require('../../users/user.model.js');
const { env } = require('../../../config/env.js');
const { logger } = require('../../../utils/logger.js');

/**
 * Socket authentication middleware
 * Extracts JWT from httpOnly cookie and attaches user to socket
 * Allows unauthenticated connections for public lobby viewing
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Parse cookies from handshake headers
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = cookies.accessToken;

    if (!token) {
      // Allow unauthenticated connections for public lobby
      return next();
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId);

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
    if (error.name === 'TokenExpiredError') {
      logger.debug(`Token expired for socket ${socket.id}`);
      // Let client handle re-auth, don't block connection
      return next();
    }

    if (error.name === 'JsonWebTokenError') {
      logger.debug(`Invalid token for socket ${socket.id}`);
      return next();
    }

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
