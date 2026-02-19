/**
 * Competition History Routes
 * API endpoints for competition history
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../auth/auth.middleware.js');
const competitionController = require('./competition.controller.js');

/**
 * GET /api/v1/competition/history
 * Get competition history for current user
 * Protected: requires authentication
 */
router.get('/history', authenticate, competitionController.getHistory);

/**
 * GET /api/v1/competition/history/:id
 * Get specific competition history entry
 * Protected: requires authentication, must be participant
 */
router.get('/history/:id', authenticate, competitionController.getHistoryById);

/**
 * POST /api/v1/competition/history
 * Create competition history entry (internal/system use)
 * Protected: requires authentication
 */
router.post('/history', authenticate, competitionController.createHistory);

/**
 * GET /api/v1/competition/stats
 * Get user's match statistics
 * Protected: requires authentication
 */
router.get('/stats', authenticate, competitionController.getStats);

module.exports = router;
