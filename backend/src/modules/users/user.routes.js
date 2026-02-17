/**
 * User routes
 * Route definitions for user endpoints
 */

const express = require('express');
const { User } = require('./user.model.js');
const { Match } = require('../matches/match.model.js');
const { Question } = require('../questions/question.model.js');
const { authenticate } = require('../auth/auth.middleware.js');

const router = express.Router();

/**
 * @route   GET /api/v1/users/leaderboard
 * @desc    Get leaderboard rankings
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('username stats.rating stats.wins stats.losses stats.matchesPlayed')
      .sort({ 'stats.rating': -1 })
      .limit(limit);
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      rating: user.stats?.rating || 1000,
      wins: user.stats?.wins || 0,
      losses: user.stats?.losses || 0,
      matchesPlayed: user.stats?.matchesPlayed || 0,
    }));
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/:username
 * @desc    Get user by username
 * @access  Public
 */
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-refreshTokens -password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/:username/history
 * @desc    Get user's match history
 * @access  Public
 */
router.get('/:username/history', async (req, res) => {
  try {
    // Find user by username
    const user = await User.findOne({ username: req.params.username })
      .select('_id username');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Parse status filter (default to 'finished')
    const status = req.query.status || 'finished';

    // Build query to find matches where user is a player
    const query = {
      'players.playerId': user._id
    };

    // Add status filter if not 'all'
    if (status !== 'all') {
      query.status = status;
    }

    // Get total count for pagination
    const total = await Match.countDocuments(query);

    // Find matches with pagination
    const matches = await Match.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get all question IDs from matches to fetch question details
    const questionIds = [...new Set(matches.map(m => m.questionId?.toString()).filter(Boolean))];
    
    // Fetch question details
    const questions = await Question.find(
      { _id: { $in: questionIds } },
      { title: 1, difficulty: 1 }
    ).lean();

    // Create question lookup map
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Format history entries
    const history = matches.map(match => {
      // Find player's data in this match
      const player = match.players.find(
        p => p.playerId.toString() === user._id.toString()
      );

      // Find player's submission
      const submission = match.submissions.find(
        sub => sub.playerId.toString() === user._id.toString()
      );

      // Determine result (win/loss)
      let result = 'loss';
      if (match.winner && match.winner.playerId) {
        result = match.winner.playerId.toString() === user._id.toString() ? 'win' : 'loss';
      }

      // Get question details
      const question = questionMap.get(match.questionId?.toString()) || {};

      // Calculate duration if available
      let duration = 0;
      if (match.startTime && match.endTime) {
        duration = Math.floor((match.endTime - match.startTime) / 1000);
      } else if (submission?.solvedAt && match.startTime) {
        duration = Math.floor((submission.solvedAt - match.startTime) / 1000);
      }

      return {
        matchId: match._id.toString(),
        question: {
          title: question.title || 'Unknown Question',
          difficulty: question.difficulty || 'medium'
        },
        result,
        score: player?.score || submission?.score || 0,
        solvedAt: submission?.solvedAt || match.endTime || null,
        duration: duration > 0 ? duration : 0
      };
    });

    // Calculate pagination info
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching match history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match history',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/:username/stats
 * @desc    Get detailed user stats
 * @access  Public
 */
router.get('/:username/stats', async (req, res) => {
  try {
    // Find user by username (exclude password/refreshTokens)
    const user = await User.findOne({ username: req.params.username })
      .select('-password -refreshTokens');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get base stats from user model
    const wins = user.stats?.wins || 0;
    const losses = user.stats?.losses || 0;
    const matchesPlayed = user.stats?.matchesPlayed || 0;
    const rating = user.stats?.rating || 1000;

    // Calculate win rate as percentage
    let winRate = '0.0%';
    if (matchesPlayed > 0) {
      winRate = ((wins / matchesPlayed) * 100).toFixed(1) + '%';
    }

    // Determine tier based on rating
    let tier = 'bronze';
    if (rating >= 1600) {
      tier = 'platinum';
    } else if (rating >= 1300) {
      tier = 'gold';
    } else if (rating >= 1100) {
      tier = 'silver';
    }

    // Get match count (total finished matches)
    const matchCount = await Match.countDocuments({
      'players.playerId': user._id,
      status: 'finished'
    });

    res.json({
      success: true,
      data: {
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        stats: {
          wins,
          losses,
          matchesPlayed,
          rating,
          winRate,
          tier,
          matchCount
        },
        memberSince: user.createdAt,
        lastActiveAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error.message
    });
  }
});

module.exports = router;
