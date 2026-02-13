/**
 * Redis connection module
 * Handles Redis client lifecycle with proper error handling and reconnection
 */

const redis = require('redis');
const { env } = require('./env');
const logger = require('../utils/logger');

// Create Redis client instance
const redisClient = redis.createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max 3 second delay
      const delay = Math.min(retries * 50, 3000);
      logger.debug(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
    connectTimeout: 10000, // 10 seconds
  },
});

// Set up event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err.message);
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

redisClient.on('end', () => {
  logger.info('Redis client connection closed');
});

/**
 * Connect to Redis
 * @returns {Promise<void>}
 */
async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info('Redis connection established', {
        url: env.REDIS_URL.replace(/:\/\/.*@/, '://***@'), // Hide credentials in logs
      });
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Disconnect from Redis
 * @returns {Promise<void>}
 */
async function disconnectRedis() {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
}

/**
 * Get Redis client health status
 * @returns {Object} Health status object
 */
function getRedisHealth() {
  return {
    connected: redisClient.isOpen,
    ready: redisClient.isReady,
  };
}

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing Redis connection...');
  await disconnectRedis();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing Redis connection...');
  await disconnectRedis();
});

module.exports = {
  redisClient,
  connectRedis,
  disconnectRedis,
  getRedisHealth,
};
