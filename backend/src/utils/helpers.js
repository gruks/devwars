/**
 * Utility helpers
 * Common functions used across the application
 */

const { HTTP_STATUS } = require('./constants.js');

/**
 * Async handler wrapper for Express routes
 * Eliminates need for try/catch in every async route
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Standard API response formatter
 * @param {Object} options
 * @param {boolean} options.success - Whether the request was successful
 * @param {string} options.message - Human-readable message
 * @param {*} options.data - Response data (optional)
 * @param {Object} options.meta - Metadata like pagination (optional)
 * @returns {Object} Formatted response object
 */
const formatResponse = ({ success = true, message = '', data = null, meta = null }) => {
  const response = {
    success,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (meta !== null) {
    response.meta = meta;
  }
  
  return response;
};

/**
 * Success response helper
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code
 */
const sendSuccess = (res, message = 'Success', data = null, statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json(formatResponse({
    success: true,
    message,
    data
  }));
};

/**
 * Error response helper
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} errors - Additional error details
 */
const sendError = (res, message = 'Error', statusCode = HTTP_STATUS.BAD_REQUEST, errors = null) => {
  const response = formatResponse({
    success: false,
    message
  });
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Generate a random ID
 * @param {number} length - Length of the ID
 * @returns {string} Random alphanumeric string
 */
const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sanitize user input
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Parse pagination parameters
 * @param {Object} query - Request query object
 * @param {number} defaultLimit - Default items per page
 * @param {number} maxLimit - Maximum items per page
 * @returns {Object} { page, limit, skip }
 */
const parsePagination = (query, defaultLimit = 10, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

/**
 * Calculate pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

/**
 * Delay/Promise wrapper for setTimeout
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after ms
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

module.exports = {
  asyncHandler,
  formatResponse,
  sendSuccess,
  sendError,
  generateId,
  sanitizeInput,
  parsePagination,
  getPaginationMeta,
  sleep,
  deepClone
};
