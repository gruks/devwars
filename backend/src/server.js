/**
 * Server entry point
 * Starts the HTTP server and handles process errors
 */

// Load config and logger first (before app to avoid circular deps)
const { env } = require('./config/env.js');
const { logger } = require('./utils/logger.js');
const { connectDB } = require('./config/db.js');
const { app } = require('./app.js');

const PORT = env.PORT;

// Start server with database connection
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    logger.info('Database connection established');
    
    // Then start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(` Server running on port http://localhost:${PORT}`);
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Health check: http://localhost:${PORT}/health`);
    });
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const server = startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
  logger.error(err.stack);
  
  // Graceful shutdown
  server.close(() => {
    logger.info('Server closed due to unhandled rejection');
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
  logger.error(err.stack);
  
  // Exit immediately - uncaught exceptions leave app in undefined state
  process.exit(1);
});

// Handle SIGTERM (e.g., from Docker, Kubernetes)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { server };
