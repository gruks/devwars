/**
 * Auth middleware
 * JWT verification and role authorization
 */

const jwt = require('jsonwebtoken');
const { User } = require('../users/user.model.js');
const { env } = require('../../config/env.js');
const { AppError } = require('../../middlewares/error.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { logger } = require('../../utils/logger.js');

/**
 * Authenticate request using JWT
 * Verifies access token and attaches user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;

    // Check if header exists and has Bearer format
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Authorization header takes precedence
      token = authHeader.split(' ')[1];
    } else {
      // Fallback to cookie-based auth (for browser sessions)
      token = req.cookies?.accessToken;
    }

    if (!token) {
      throw new AppError('Access token required', HTTP_STATUS.UNAUTHORIZED);
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expired', HTTP_STATUS.UNAUTHORIZED);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', HTTP_STATUS.UNAUTHORIZED);
      }
      throw new AppError('Token verification failed', HTTP_STATUS.UNAUTHORIZED);
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.UNAUTHORIZED);
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
 * @example
 * router.get('/admin', authenticate, authorize('admin'), adminHandler);
 * router.get('/mod', authenticate, authorize('admin', 'moderator'), modHandler);
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
 * Attaches user to request if token is valid, but doesn't require it
 * Useful for endpoints that work for both authenticated and anonymous users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header first
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Fallback to cookie-based auth (for browser sessions)
      token = req.cookies?.accessToken;
    }

    if (!token) {
      // No token provided, continue without user
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId);

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Token invalid, continue without user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
