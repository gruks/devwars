/**
 * Auth service layer
 * Business logic for authentication operations
 */

const { User } = require('../users/user.model.js');
const { AppError } = require('../../middlewares/error.js');
const { HTTP_STATUS } = require('../../utils/constants.js');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @returns {Promise<Object>} { user }
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

  return {
    user: user.toJSON()
  };
};

/**
 * Login user with email and password
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - Email address
 * @param {string} credentials.password - Password
 * @returns {Promise<Object>} { user }
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

  return {
    user: user.toJSON()
  };
};

/**
 * Logout user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { success: true }
 */
const logout = async (userId) => {
  // Session handling is done in the controller
  return { success: true, message: 'Logged out successfully' };
};

/**
 * Logout user from all devices
 * Note: With sessions, this might require clearing all sessions for a user ID from the session store
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { success: true }
 */
const logoutAll = async (userId) => {
  // Note: Implementation depends on session store capabilities
  return { success: true, message: 'Logged out from all devices' };
};

module.exports = {
  register,
  login,
  logout,
  logoutAll
};
