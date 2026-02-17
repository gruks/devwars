/**
 * Socket.io error handling middleware
 * Wraps async handlers to catch errors
 */
const { logger } = require('../../../utils/logger.js');
const { EVENTS } = require('../utils/events.js');

/**
 * Async handler wrapper for socket events
 * Catches errors and sends standardized error response
 */
const asyncHandler = (fn) => {
  return async (socket, ...args) => {
    try {
      await fn(socket, ...args);
    } catch (error) {
      // Get callback function (last argument)
      const callback = args[args.length - 1];
      const hasCallback = typeof callback === 'function';

      // Log error with context
      logger.error('Socket event error:', {
        error: error.message,
        socketId: socket.id,
        userId: socket.user?.userId,
        stack: error.stack
      });

      // Determine error type and message
      let errorMessage = 'Internal server error';
      let statusCode = 500;

      if (error.name === 'ValidationError') {
        errorMessage = 'Invalid data provided';
        statusCode = 400;
      } else if (error.name === 'CastError') {
        errorMessage = 'Invalid ID format';
        statusCode = 400;
      } else if (error.message === 'Authentication required') {
        errorMessage = 'Authentication required';
        statusCode = 401;
      } else if (error.message.includes('not found')) {
        errorMessage = error.message;
        statusCode = 404;
      } else if (process.env.NODE_ENV === 'development') {
        // In development, expose actual error
        errorMessage = error.message;
      }

      // Send error response
      const errorResponse = {
        success: false,
        error: errorMessage,
        code: statusCode,
        timestamp: new Date().toISOString()
      };

      if (hasCallback) {
        callback(errorResponse);
      } else {
        socket.emit(EVENTS.SYSTEM.ERROR, errorResponse);
      }
    }
  };
};

/**
 * Socket error handler middleware
 * Handles errors thrown in other middleware
 */
const socketErrorHandler = (error, socket, next) => {
  logger.error('Socket middleware error:', {
    error: error.message,
    socketId: socket.id
  });

  // Emit error to client
  socket.emit(EVENTS.SYSTEM.ERROR, {
    success: false,
    error: error.message || 'Connection error',
    timestamp: new Date().toISOString()
  });

  next(error);
};

module.exports = { asyncHandler, socketErrorHandler };
