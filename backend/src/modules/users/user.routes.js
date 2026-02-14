/**
 * User routes
 * Route definitions for user endpoints
 */

const express = require('express');
const { User } = require('./user.model.js');
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

module.exports = router;
