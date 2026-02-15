/**
 * Match Routes
 * API endpoints for match operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middlewares/auth.js');
const matchController = require('./match.controller.js');
const { Room } = require('../rooms/room.model.js');
const { logger } = require('../../utils/logger.js');

/**
 * Middleware to check if user is room host
 */
const requireHost = async (req, res, next) => {
  try {
    const { Room } = require('../rooms/room.model.js');
    const matchId = req.params.id;
    const { Match } = require('./match.model.js');
    
    // Get the match to find the room
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Get the room
    const room = await Room.findById(match.roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the host
    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    const roomCreatorId = room.createdBy?.toString();
    
    if (userId !== roomCreatorId) {
      logger.warn({ userId, roomCreatorId, roomId: room._id }, 'Host check failed');
      return res.status(403).json({
        success: false,
        message: 'Only the room host can perform this action'
      });
    }

    next();
  } catch (error) {
    logger.error({ error: error.message }, 'Host check failed');
    next(error);
  }
};

/**
 * @route   POST /api/v1/matches
 * @desc    Create a new match
 * @access  Protected (Host only)
 */
router.post('/', authenticate, matchController.createMatch);

/**
 * @route   GET /api/v1/matches/:id
 * @desc    Get match by ID
 * @access  Protected
 */
router.get('/:id', authenticate, matchController.getMatchById);

/**
 * @route   POST /api/v1/matches/:id/start
 * @desc    Start a match
 * @access  Protected (Host only)
 */
router.post('/:id/start', authenticate, requireHost, matchController.startMatch);

/**
 * @route   POST /api/v1/matches/:id/submit
 * @desc    Submit code for a match
 * @access  Protected
 */
router.post('/:id/submit', authenticate, matchController.submitCode);

/**
 * @route   POST /api/v1/matches/:id/end
 * @desc    End a match
 * @access  Protected (Host only)
 */
router.post('/:id/end', authenticate, requireHost, matchController.endMatch);

/**
 * @route   GET /api/v1/matches/:id/results
 * @desc    Get match results
 * @access  Protected
 */
router.get('/:id/results', authenticate, matchController.getMatchResults);

module.exports = router;
