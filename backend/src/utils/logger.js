/**
 * Winston logger configuration
 * Provides formatted logging with timestamps
 */

const winston = require('winston');
const { env } = require('../config/env.js');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development (colorized)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    if (stack) {
      msg += `\n${stack}`;
    }
    
    return msg;
  })
);

// Create transports array
const transports = [
  // Console transport
  new winston.transports.Console({
    format: env.isDevelopment ? consoleFormat : logFormat,
    level: env.isDevelopment ? 'debug' : 'info'
  })
];

// Add file transports in production
if (env.isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'devwars-api' },
  transports,
  // Don't exit on uncaught errors
  exitOnError: false
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = { logger };
