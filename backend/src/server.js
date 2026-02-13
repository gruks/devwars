/**
 * Server entry point
 * Initializes database connections and starts HTTP server
 */

const app = require('./app');
const { connectDB, disconnectDB } = require('./src/config/db');
const { connectRedis, disconnectRedis } = require('./src/config/redis');
const { env } = require('./src/config/env');
const logger = require('./src/utils/logger');

let server;

/**
 * Start the server with database connections
 */
async function startServer() {
  try {
    logger.info('Starting server...', { environment: env.NODE_ENV });

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB connected');

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected');

    logger.info('All services connected, starting HTTP server...');

    // Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(`Server is running on http://localhost:${env.PORT}`, {
        port: env.PORT,
        environment: env.NODE_ENV,
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    
    // Attempt cleanup
    try {
      await disconnectDB();
      await disconnectRedis();
    } catch (cleanupError) {
      logger.error('Cleanup error during startup failure:', cleanupError);
    }
    
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Close HTTP server (stop accepting new connections)
  if (server) {
    logger.info('Closing HTTP server...');
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }

  // Disconnect from databases
  try {
    logger.info('Disconnecting from MongoDB...');
    await disconnectDB();
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
  }

  try {
    logger.info('Disconnecting from Redis...');
    await disconnectRedis();
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();
