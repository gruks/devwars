/**
 * Stats routes
 * Platform-wide statistics and analytics endpoints
 */

const express = require('express');
const { User } = require('../users/user.model.js');
const { Match } = require('../matches/match.model.js');

const router = express.Router();

/**
 * @route   GET /api/v1/stats/dashboard
 * @desc    Get global platform statistics
 * @access  Public
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Calculate time boundaries
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const last24Hours = new Date(now);
    last24Hours.setHours(now.getHours() - 24);
    
    // Run aggregation queries in parallel for efficiency
    const [
      totalUsers,
      totalMatches,
      activeToday,
      matchesToday,
      averageRatingResult,
      topPlayers
    ] = await Promise.all([
      // Total non-admin users
      User.countDocuments({ role: { $ne: 'admin' } }),
      
      // Total finished matches
      Match.countDocuments({ status: 'finished' }),
      
      // Users active in last 24 hours
      User.countDocuments({
        role: { $ne: 'admin' },
        updatedAt: { $gte: last24Hours }
      }),
      
      // Matches finished today
      Match.countDocuments({
        status: 'finished',
        endTime: { $gte: startOfDay }
      }),
      
      // Average rating across all users
      User.aggregate([
        { $match: { role: { $ne: 'admin' } } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$stats.rating' }
          }
        }
      ]),
      
      // Top 5 players by rating
      User.find({ role: { $ne: 'admin' } })
        .select('username stats.rating stats.wins stats.losses')
        .sort({ 'stats.rating': -1 })
        .limit(5)
        .lean()
    ]);
    
    // Calculate average rating (default to 1000 if no users)
    const averageRating = averageRatingResult.length > 0
      ? Math.round(averageRatingResult[0].avgRating)
      : 1000;
    
    // Format top players
    const formattedTopPlayers = topPlayers.map((player, index) => ({
      rank: index + 1,
      username: player.username,
      rating: player.stats?.rating || 1000,
      wins: player.stats?.wins || 0,
      losses: player.stats?.losses || 0
    }));
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalMatches,
        activeToday,
        matchesToday,
        averageRating,
        topPlayers: formattedTopPlayers
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

module.exports = router;
