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

/**
 * Cookie configuration for httpOnly cookies
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
};

/**
 * Calculate refresh token expiry in milliseconds
 * @param {boolean} rememberMe - Whether to extend session to 30 days
 * @returns {number} Expiry in milliseconds
 */
const getRefreshTokenExpiry = (rememberMe) => {
  // 30 days for remember me, 7 days otherwise
  const days = rememberMe ? 30 : 7;
  return days * 24 * 60 * 60 * 1000;
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

  // Set httpOnly cookies for tokens
  res.cookie('refreshToken', result.tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: getRefreshTokenExpiry(false),
  });
  res.cookie('accessToken', result.tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

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

  // Set httpOnly cookies for tokens
  const rememberMeBool = rememberMe === true || rememberMe === 'true';
  res.cookie('refreshToken', result.tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: getRefreshTokenExpiry(rememberMeBool),
  });
  res.cookie('accessToken', result.tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  logger.info(`User logged in: ${result.user.email}`);

  sendSuccess(res, 'Login successful', { user: result.user, rememberMe: rememberMeBool });
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from httpOnly cookie
  const refreshTokenFromCookie = req.cookies?.refreshToken;

  // Fallback to body for backwards compatibility
  const refreshTokenFromBody = req.body?.refreshToken;
  const refreshToken = refreshTokenFromCookie || refreshTokenFromBody;

  // Validate required field
  if (!refreshToken) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Please provide refresh token'
    });
  }

  // Call service
  const result = await authService.refreshToken(refreshToken);

  // Set new httpOnly cookies for refreshed tokens
  res.cookie('refreshToken', result.tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (use default from refresh)
  });
  res.cookie('accessToken', result.tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  sendSuccess(res, 'Token refreshed successfully', { user: result.user });
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  // Get refresh token from cookie (preferred) or body (fallback)
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  // Call service (works even without userId for "logout everywhere" effect)
  const result = await authService.logout(userId, refreshToken);

  // Clear httpOnly cookies
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
