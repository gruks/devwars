/**
 * Express application configuration
 * Exports configured app without starting server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./src/config/env');

const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes placeholder
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DevWars API',
    version: '1.0.0',
    status: 'operational',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: env.isDevelopment ? err.message : 'Internal server error',
    ...(env.isDevelopment && { stack: err.stack }),
  });
});

module.exports = app;
