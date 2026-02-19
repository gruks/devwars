/**
 * Competition History Controller
 * Handles API endpoints for competition history
 */

const { CompetitionHistory } = require('./competitionHistory.model.js');
const { sendSuccess, sendError } = require('../../utils/helpers.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const mongoose = require('mongoose');

/**
 * Get competition history for current user
 * GET /api/v1/competition/history
 */
async function getHistory(req, res, next) {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Find competitions where user is a participant
    const query = { participants: userId };
    
    const [history, total] = await Promise.all([
      CompetitionHistory.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('winner', 'username avatar')
        .populate('participants', 'username avatar')
        .populate('problemId', 'title difficulty'),
      CompetitionHistory.countDocuments(query)
    ]);
    
    // Transform for frontend
    const transformedHistory = history.map(entry => {
      const myResult = entry.results.find(r => 
        r.userId.toString() === userId.toString()
      );
      const opponentResult = entry.results.find(r => 
        r.userId.toString() !== userId.toString()
      );
      const opponent = entry.participants.find(p => 
        p._id.toString() !== userId.toString()
      );
      
      return {
        _id: entry._id,
        roomId: entry.roomId,
        matchId: entry.matchId,
        problemTitle: entry.problemId?.title || 'Unknown Problem',
        problemDifficulty: entry.problemId?.difficulty || 'medium',
        opponent: opponent ? {
          _id: opponent._id,
          username: opponent.username,
          avatar: opponent.avatar
        } : null,
        result: entry.winner 
          ? (entry.winner._id.toString() === userId.toString() ? 'win' : 'loss')
          : 'draw',
        score: myResult?.score || 0,
        opponentScore: opponentResult?.score || 0,
        timeToSolve: myResult?.timeToSolve || 0,
        passedTestCases: myResult?.passedTestCases || 0,
        date: entry.createdAt,
        duration: entry.duration || 0,
        mlPrediction: entry.mlPrediction
      };
    });
    
    return sendSuccess(res, 'Competition history retrieved', {
      history: transformedHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific competition history entry
 * GET /api/v1/competition/history/:id
 */
async function getHistoryById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid competition ID', HTTP_STATUS.BAD_REQUEST);
    }
    
    const entry = await CompetitionHistory.findById(id)
      .populate('winner', 'username avatar')
      .populate('participants', 'username avatar')
      .populate('problemId', 'title difficulty description constraints examples');
    
    if (!entry) {
      return sendError(res, 'Competition not found', HTTP_STATUS.NOT_FOUND);
    }
    
    // Privacy check: only participants can view
    const isParticipant = entry.participants.some(p => 
      p._id.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return sendError(res, 'Competition not found', HTTP_STATUS.NOT_FOUND);
    }
    
    // Transform for frontend
    const myResult = entry.results.find(r => 
      r.userId.toString() === userId.toString()
    );
    const opponentResult = entry.results.find(r => 
      r.userId.toString() !== userId.toString()
    );
    const opponent = entry.participants.find(p => 
      p._id.toString() !== userId.toString()
    );
    
    const transformedEntry = {
      _id: entry._id,
      roomId: entry.roomId,
      matchId: entry.matchId,
      problem: entry.problemId,
      participants: entry.participants.map(p => ({
        _id: p._id,
        username: p.username,
        avatar: p.avatar,
        result: entry.winner 
          ? (entry.winner._id.toString() === p._id.toString() ? 'win' : 'loss')
          : 'draw'
      })),
      winner: entry.winner,
      results: entry.results,
      features: entry.features,
      mlPrediction: entry.mlPrediction,
      myResult,
      opponent: opponent ? {
        username: opponent.username,
        score: opponentResult?.score || 0,
        timeToSolve: opponentResult?.timeToSolve || 0,
        passedTestCases: opponentResult?.passedTestCases || 0
      } : null,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      duration: entry.duration,
      createdAt: entry.createdAt
    };
    
    return sendSuccess(res, 'Competition details retrieved', transformedEntry);
  } catch (error) {
    next(error);
  }
}

/**
 * Create competition history entry (internal use)
 * POST /api/v1/competition/history
 */
async function createHistory(req, res, next) {
  try {
    const { roomId, matchId, participants, winner, problemId, results, features, mlPrediction, startedAt, endedAt } = req.body;
    
    // Validate required fields
    if (!roomId || !matchId || !participants || participants.length === 0) {
      return sendError(res, 'Missing required fields', HTTP_STATUS.BAD_REQUEST);
    }
    
    const history = await CompetitionHistory.create({
      roomId,
      matchId,
      participants,
      winner,
      problemId,
      results,
      features,
      mlPrediction,
      startedAt,
      endedAt
    });
    
    return sendSuccess(res, 'Competition history created', { historyId: history._id }, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's match statistics
 * GET /api/v1/competition/stats
 */
async function getStats(req, res, next) {
  try {
    const userId = req.user._id;
    
    const competitions = await CompetitionHistory.find({ participants: userId });
    
    const stats = {
      total: competitions.length,
      wins: competitions.filter(c => c.winner?.toString() === userId.toString()).length,
      losses: competitions.filter(c => c.winner && c.winner.toString() !== userId.toString()).length,
      draws: competitions.filter(c => !c.winner).length
    };
    
    stats.winRate = stats.total > 0 
      ? Math.round((stats.wins / stats.total) * 100) 
      : 0;
    
    // Calculate average score
    const totalScore = competitions.reduce((sum, c) => {
      const myResult = c.results.find(r => r.userId.toString() === userId.toString());
      return sum + (myResult?.score || 0);
    }, 0);
    stats.avgScore = stats.total > 0 ? Math.round(totalScore / stats.total) : 0;
    
    return sendSuccess(res, 'Statistics retrieved', stats);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHistory,
  getHistoryById,
  createHistory,
  getStats
};
