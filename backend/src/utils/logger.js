// Simple logger utility
// Wraps console with log levels and formatting

const env = require('./env');

const isDev = env.NODE_ENV === 'development';

const logger = {
  info: (message, ...args) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`, ...args);
  },
  
  error: (message, error, ...args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, error?.message || '', ...args);
    if (isDev && error?.stack) {
      console.error(error.stack);
    }
  },
  
  warn: (message, ...args) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${message}`, ...args);
  },
  
  debug: (message, ...args) => {
    if (isDev) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] DEBUG: ${message}`, ...args);
    }
  }
};

module.exports = logger;
