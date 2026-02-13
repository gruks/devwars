/**
 * API Routes
 * Aggregates all module routes
 */

const express = require('express');
const { sendSuccess } = require('./utils/helpers.js');
const { HTTP_STATUS } = require('./utils/constants.js');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  sendSuccess(res, 'Server is healthy', {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * API documentation redirect
 * GET /api/v1/docs
 */
router.get('/docs', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'API Documentation',
    endpoints: {
      health: 'GET /api/v1/health',
      docs: 'GET /api/v1/docs'
    },
    note: 'Full documentation coming soon'
  });
});

/**
 * Module routes will be mounted here in future plans:
 * 
 * router.use('/auth', require('./modules/auth/auth.routes'));
 * router.use('/users', require('./modules/users/user.routes'));
 * router.use('/games', require('./modules/games/game.routes'));
 * router.use('/lobby', require('./modules/lobby/lobby.routes'));
 * router.use('/rooms', require('./modules/rooms/room.routes'));
 * router.use('/leaderboard', require('./modules/leaderboard/leaderboard.routes'));
 * router.use('/challenges', require('./modules/challenges/challenge.routes'));
 * router.use('/spectator', require('./modules/spectator/spectator.routes'));
 * router.use('/tournaments', require('./modules/tournaments/tournament.routes'));
 * router.use('/notifications', require('./modules/notifications/notification.routes'));
 */

module.exports = router;
