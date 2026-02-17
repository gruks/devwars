/**
 * Server entry point
 * Starts the HTTP server and handles process errors
 */

// Load config and logger first (before app to avoid circular deps)
const { env } = require('./config/env.js');
const { logger } = require('./utils/logger.js');
const { connectDB, disconnectDB } = require('./config/db.js');
const { connectRedis, disconnectRedis, setupRedisAdapter } = require('./config/redis.js');
const { app } = require('./app.js');
const PORT = env.PORT;

// Start server with database connection
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    logger.info('MongoDB connection established');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connection established');

    // Create HTTP server
    const httpServer = app.listen(PORT, () => {
      logger.info(` Server running on port http://localhost:${PORT}`);
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Health check: http://localhost:${PORT}/health`);
      logger.info(` Socket.io enabled for real-time features`);
    });

    // Initialize Socket.io with production config
    const { initializeSocket } = require('./modules/socket/index.js');
    const { Server } = require('socket.io');

    const io = new Server(httpServer, {
      cors: {
        origin: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:5173', 'http://localhost:8080'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
      }
    });

    // Setup Redis adapter for multi-server scaling
    await setupRedisAdapter(io);

    // Initialize socket handlers
    initializeSocket(io);

    return httpServer;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const server = startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err) => {
  logger.error('Unhandled Rejection:', err.message);
  logger.error(err.stack);

  // Graceful shutdown with database disconnection
  try {
    const s = await server;
    s.close(async () => {
      logger.info('HTTP server closed due to unhandled rejection');

      // Disconnect from databases
      await disconnectDB();
      logger.info('MongoDB connection closed');
      await disconnectRedis();
      logger.info('Redis connection closed');

      process.exit(1);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
  logger.error(err.stack);

  // Exit immediately - uncaught exceptions leave app in undefined state
  process.exit(1);
});

// Handle SIGTERM (e.g., from Docker, Kubernetes)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  try {
    const s = await server;
    s.close(async () => {
      logger.info('HTTP server closed');

      // Disconnect from databases
      await disconnectDB();
      logger.info('MongoDB connection closed');
      await disconnectRedis();
      logger.info('Redis connection closed');

      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  try {
    const s = await server;
    s.close(async () => {
      logger.info('HTTP server closed');

      // Disconnect from databases
      await disconnectDB();
      logger.info('MongoDB connection closed');
      await disconnectRedis();
      logger.info('Redis connection closed');

      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

module.exports = { server };
