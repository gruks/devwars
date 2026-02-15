/**
 * Express application configuration
 * Sets up middleware and routes
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

// Load environment config first (triggers dotenv)
const { env } = require('./config/env.js');
const { logger } = require('./utils/logger.js');
const { errorHandler, notFoundHandler } = require('./middlewares/error.js');
const routes = require('./routes.js');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
app.use(cors({
  origin: env.isDevelopment ? allowedOrigins.length > 0 ? allowedOrigins : true : allowedOrigins,
  credentials: true
}));

// Cookie parsing middleware
app.use(cookieParser());
// Session middleware
const sessionMiddleware = session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
  cookie: {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
});

app.use(sessionMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logging
app.use(morgan('dev', { stream: logger.stream }));

// API routes
app.use('/api/v1', routes);

// Health check endpoint (also available at root)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to DevWars API',
    documentation: '/api/v1/docs',
    health: '/health'
  });
});

// 404 handler - must be before error handler
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

module.exports = { app, sessionMiddleware };
