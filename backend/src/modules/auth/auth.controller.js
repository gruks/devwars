/**
 * Auth controller
 * HTTP handlers for authentication endpoints
 */

const authService = require('./auth.service.js');
const { asyncHandler } = require('../../utils/helpers.js');
const { sendSuccess } = require('../../utils/helpers.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { logger } = require('../../utils/logger.js');
const { env } = require('../../config/env.js');
const { User } = require('../users/user.model.js');

/**
 * Cookie configuration for httpOnly cookies
 * Note: sameSite 'none' requires secure=true, but in development we use 'lax'
 * For production with HTTPS, use 'none' for better cross-origin support
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction, // Must be true for sameSite: 'none'
  sameSite: env.isProduction ? 'none' : 'lax', // 'none' for cross-origin, 'lax' for dev
  path: '/', // Explicit path to ensure cookies are sent with all requests
};

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Please provide username, email, and password'
    });
  }

  // Validate field types
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid input data types'
    });
  }

  // Validate field lengths
  if (username.length < 3 || username.length > 30) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Username must be between 3 and 30 characters'
    });
  }

  if (password.length < 6) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  // Call service
  const result = await authService.register({ username, email, password });

  // Store user info in session
  req.session.userId = result.user._id;
  req.session.email = result.user.email;
  req.session.save();

  logger.info(`User registered: ${result.user.email}`);

  sendSuccess(res, 'User registered successfully', { user: result.user }, HTTP_STATUS.CREATED);
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  // Validate field types
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid input data types'
    });
  }

  // Call service
  const result = await authService.login({ email, password });

  // Store user info in session
  const rememberMeBool = rememberMe === true || rememberMe === 'true';
  req.session.userId = result.user._id;
  req.session.email = result.user.email;

  if (rememberMeBool) {
    // Extend session life if rememberMe is selected
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  req.session.save();

  logger.info(`User logged in: ${result.user.email}`);

  sendSuccess(res, 'Login successful', { user: result.user, rememberMe: rememberMeBool });
});

/**
 * Refresh/Verify Session
 * POST /api/v1/auth/refresh
 * Used by frontend as a heartbeat/session check
 */
const refreshToken = asyncHandler(async (req, res) => {
  // If user has a valid session, just confirm it's still alive
  if (req.session && req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user && user.isActive) {
      return sendSuccess(res, 'Session is valid', { user });
    }
  }

  // If no session, return 401
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({
    success: false,
    message: 'Authentication required'
  });
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  // Call service
  const result = await authService.logout(userId);

  // Clear session
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
    }
  });

  // Clear legacy/security cookies
  res.clearCookie('connect.sid', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  res.clearCookie('accessToken', COOKIE_OPTIONS);

  if (userId) {
    logger.info(`User logged out: ${userId}`);
  }

  sendSuccess(res, result.message);
});

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  sendSuccess(res, 'User profile retrieved', { user });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe
};
