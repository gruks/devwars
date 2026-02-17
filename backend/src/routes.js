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
      docs: 'GET /api/v1/docs',
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout (protected)',
        me: 'GET /api/v1/auth/me (protected)'
      }
    },
    note: 'Full documentation coming soon'
  });
});

/**
 * Auth routes
 * POST /api/v1/auth/register - Register new user
 * POST /api/v1/auth/login - Login user
 * POST /api/v1/auth/refresh - Refresh access token
 * POST /api/v1/auth/logout - Logout user (protected)
 * GET /api/v1/auth/me - Get current user (protected)
 */
router.use('/auth', require('./modules/auth/auth.routes.js'));

/**
 * User routes
 * GET /api/v1/users/leaderboard - Get leaderboard
 * GET /api/v1/users/:username - Get user by username
 */
router.use('/users', require('./modules/users/user.routes.js'));

/**
 * Lobby/Room routes
 * GET /api/v1/lobby/rooms - Get all rooms
 * POST /api/v1/lobby/rooms - Create room (protected)
 * GET /api/v1/lobby/rooms/:id - Get room
 * POST /api/v1/lobby/rooms/:id/join - Join room (protected)
 * POST /api/v1/lobby/rooms/:id/leave - Leave room (protected)
 * GET /api/v1/lobby/stats - Get lobby stats
 */
router.use('/lobby', require('./modules/rooms/room.routes.js'));

/**
 * Question routes
 * GET /api/v1/questions - Get all questions
 * GET /api/v1/questions/:id - Get question by ID
 * POST /api/v1/questions - Create question (admin)
 * POST /api/v1/questions/seed - Seed questions (admin)
 */
router.use('/questions', require('./modules/questions/question.routes.js'));

/**
 * Evaluation routes
 * POST /api/v1/evaluation/evaluate - Evaluate code submission (protected)
 */
router.use('/evaluation', require('./modules/evaluation/evaluation.routes.js'));

/**
 * Match routes
 * POST /api/v1/matches - Create match (protected, host)
 * GET /api/v1/matches/:id - Get match (protected)
 * POST /api/v1/matches/:id/start - Start match (protected, host)
 * POST /api/v1/matches/:id/submit - Submit code (protected)
 * POST /api/v1/matches/:id/end - End match (protected, host)
 * GET /api/v1/matches/:id/results - Get results (protected)
 */
router.use('/matches', require('./modules/matches/match.routes.js'));

/**
 * Stats routes
 * GET /api/v1/stats/dashboard - Get global platform statistics
 */
router.use('/stats', require('./modules/stats/stats.routes.js'));

/**
 * Future module routes:
 * 
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
