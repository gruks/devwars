/**
 * Sandbox Service
 * Express server for secure code execution
 */

const express = require('express');
const { executeHandler, healthHandler } = require('./routes/execute.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/health', healthHandler);
app.post('/api/execute', executeHandler);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Sandbox service running on port ${PORT}`);
  });
}

module.exports = app;
