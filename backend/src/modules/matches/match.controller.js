/**
 * Match Controller
 * HTTP handlers for match operations
 */

const matchService = require('./match.service.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { AppError } = require('../../utils/helpers.js');
const { logger } = require('../../utils/logger.js');

/**
 * Create a new match
 * POST /api/v1/matches
 */
const createMatch = async (req, res, next) => {
  try {
    const { roomId, questionId, timerDuration } = req.body;

    // Validate required fields
    if (!roomId || !questionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields: roomId and questionId are required'
      });
    }

    const match = await matchService.createMatch({
      roomId,
      questionId,
      timerDuration
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Match created successfully',
      data: match
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create match');
    next(error);
  }
};

/**
 * Start a match
 * POST /api/v1/matches/:id/start
 */
const startMatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const match = await matchService.startMatch(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Match started successfully',
      data: match
    });
  } catch (error) {
    logger.error({ error: error.message, matchId: req.params.id }, 'Failed to start match');
    next(error);
  }
};

/**
 * Submit code for a match
 * POST /api/v1/matches/:id/submit
 */
const submitCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const playerId = req.user?._id || req.user?.id;

    if (!playerId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!code || typeof code !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Code is required and must be a string'
      });
    }

    const result = await matchService.submitCode(id, playerId, code);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Code submitted successfully',
      data: result
    });
  } catch (error) {
    logger.error({ error: error.message, matchId: req.params.id }, 'Failed to submit code');
    next(error);
  }
};

/**
 * End a match
 * POST /api/v1/matches/:id/end
 */
const endMatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await matchService.endMatch(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Match ended successfully',
      data: result
    });
  } catch (error) {
    logger.error({ error: error.message, matchId: req.params.id }, 'Failed to end match');
    next(error);
  }
};

/**
 * Get match results
 * GET /api/v1/matches/:id/results
 */
const getMatchResults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const results = await matchService.getMatchResults(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error({ error: error.message, matchId: req.params.id }, 'Failed to get match results');
    next(error);
  }
};

/**
 * Get match by ID
 * GET /api/v1/matches/:id
 */
const getMatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchById(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: match
    });
  } catch (error) {
    logger.error({ error: error.message, matchId: req.params.id }, 'Failed to get match');
    next(error);
  }
};

module.exports = {
  createMatch,
  startMatch,
  submitCode,
  endMatch,
  getMatchResults,
  getMatchById
};
