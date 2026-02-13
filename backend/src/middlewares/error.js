/**
 * Error handling middleware
 * Centralized error handling for Express application
 */

const { env } = require('../config/env.js');
const { logger } = require('../utils/logger.js');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants.js');

/**
 * Custom Application Error class
 * For operational errors that we expect and can handle
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle specific MongoDB/Mongoose errors
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'value';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, HTTP_STATUS.CONFLICT);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(val => val.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () =>
  new AppError(ERROR_MESSAGES.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);

const handleJWTExpiredError = () =>
  new AppError(ERROR_MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);

/**
 * Send error response in development
 * Includes full error details and stack trace
 */
const sendErrorDev = (err, res) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode
  });
  
  res.status(err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

/**
 * Send error response in production
 * Limits information exposure
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted errors: send message to client
  if (err.isOperational) {
    logger.warn('Operational error:', err.message);
    
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  } else {
    // Programming or unknown errors: don't leak error details
    logger.error('Unexpected error:', {
      message: err.message,
      stack: err.stack
    });
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR
    });
  }
};

/**
 * Global error handling middleware
 * This should be the last middleware in the stack
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';
  
  // Log request details for context
  logger.error(`${req.method} ${req.originalUrl} - Error ${err.statusCode}: ${err.message}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  if (env.isDevelopment) {
    // Transform known error types for better messages even in dev
    let error = { ...err, message: err.message };
    
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    sendErrorDev(error, res);
  } else {
    // Production error handling
    let error = { ...err, message: err.message };
    
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    sendErrorProd(error, res);
  }
};

/**
 * 404 Not Found handler
 * For routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Cannot find ${req.originalUrl} on this server`,
    HTTP_STATUS.NOT_FOUND
  );
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler
};
