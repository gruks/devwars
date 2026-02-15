/**
 * Auth middleware
 * Session-based authentication and role authorization
 */

const { User } = require('../users/user.model.js');
const { AppError } = require('../../middlewares/error.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { logger } = require('../../utils/logger.js');

/**
 * Authenticate request using Session
 * Verifies session and attaches user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Check if user is authenticated via session
    if (!req.session || !req.session.userId) {
      throw new AppError('Access denied. Please login.', HTTP_STATUS.UNAUTHORIZED);
    }

    // Find user by ID from session
    const user = await User.findById(req.session.userId);

    if (!user) {
      // Clear invalid session
      req.session.destroy();
      throw new AppError('User not found. Please login again.', HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account deactivated', HTTP_STATUS.UNAUTHORIZED);
    }

    // Attach user to request object
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize request based on user roles
 * Returns middleware that checks if user's role is in allowed roles
 * @param  {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Must be called after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED));
    }

    // Check if user role is in allowed roles
    if (!roles.includes(req.user.role)) {
      logger.warn(`Authorization failed: User ${req.user._id} with role '${req.user.role}' attempted to access resource requiring ${roles.join(', ')}`);
      return next(new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN));
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user to request if session is valid, but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
