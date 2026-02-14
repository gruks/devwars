/**
 * Auth service layer
 * Business logic for authentication operations
 */

const jwt = require('jsonwebtoken');
const { User } = require('../users/user.model.js');
const { env } = require('../../config/env.js');
const { AppError } = require('../../middlewares/error.js');
const { HTTP_STATUS } = require('../../utils/constants.js');

/**
 * Generate access and refresh tokens
 * @param {string} userId - User ID to encode in tokens
 * @returns {Object} { accessToken, refreshToken }
 */
const generateTokens = (userId) => {
  // Access token - short lived
  const accessToken = jwt.sign(
    { userId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  // Refresh token - longer lived
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @returns {Promise<Object>} { user, tokens }
 * @throws {AppError} 409 if email or username already exists
 */
const register = async ({ username, email, password }) => {
  // Check if email already exists
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
  }

  // Check if username already exists
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new AppError('Username already taken', HTTP_STATUS.CONFLICT);
  }

  // Create new user (password will be hashed by pre-save hook)
  const user = await User.create({
    username,
    email,
    password
  });

  // Generate tokens
  const tokens = generateTokens(user._id.toString());

  // Save refresh token to user
  await user.addRefreshToken(tokens.refreshToken);

  return {
    user: user.toJSON(),
    tokens
  };
};

/**
 * Login user with email and password
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - Email address
 * @param {string} credentials.password - Password
 * @returns {Promise<Object>} { user, tokens }
 * @throws {AppError} 401 if credentials invalid
 * @throws {AppError} 403 if user inactive
 */
const login = async ({ email, password }) => {
  // Find user by email with password field included
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  // Compare passwords
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account deactivated', HTTP_STATUS.FORBIDDEN);
  }

  // Generate tokens
  const tokens = generateTokens(user._id.toString());

  // Save refresh token to user
  await user.addRefreshToken(tokens.refreshToken);

  return {
    user: user.toJSON(),
    tokens
  };
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Current refresh token
 * @returns {Promise<Object>} { tokens, user }
 * @throws {AppError} 401 if token invalid or expired
 */
const refreshToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token required', HTTP_STATUS.UNAUTHORIZED);
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired', HTTP_STATUS.UNAUTHORIZED);
    }
    throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED);
  }

  // Verify it's a refresh token type
  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid token type', HTTP_STATUS.UNAUTHORIZED);
  }

  // Find user with refresh tokens
  const user = await User.findById(decoded.userId).select('+refreshTokens');
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.UNAUTHORIZED);
  }

  // Check if token exists in user's refresh tokens
  if (!user.refreshTokens.includes(refreshToken)) {
    throw new AppError('Refresh token revoked', HTTP_STATUS.UNAUTHORIZED);
  }

  // Remove old refresh token (token rotation)
  await user.removeRefreshToken(refreshToken);

  // Generate new tokens
  const tokens = generateTokens(user._id.toString());

  // Save new refresh token
  await user.addRefreshToken(tokens.refreshToken);

  return { tokens, user: user.toJSON() };
};

/**
 * Logout user by invalidating refresh token
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token to invalidate
 * @returns {Promise<Object>} { success: true }
 */
const logout = async (userId, refreshToken) => {
  const user = await User.findById(userId).select('+refreshTokens');
  
  if (user) {
    // Remove the specific refresh token
    await user.removeRefreshToken(refreshToken);
  }

  return { success: true, message: 'Logged out successfully' };
};

/**
 * Logout user from all devices
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { success: true }
 */
const logoutAll = async (userId) => {
  const user = await User.findById(userId).select('+refreshTokens');
  
  if (user) {
    // Clear all refresh tokens
    await user.clearRefreshTokens();
  }

  return { success: true, message: 'Logged out from all devices' };
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  generateTokens
};
