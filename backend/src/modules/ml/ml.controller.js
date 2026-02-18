/**
 * ML Controller
 * Handles ML prediction endpoints
 */

const mlService = require('../../services/ml.service');
const Room = require('../rooms/room.model');
const CompetitionHistory = require('../competition/competitionHistory.model');

/**
 * Predict winner for a room
 */
exports.predictWinner = async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room ID is required' });
    }

    // Fetch room with submissions
    const room = await Room.findById(roomId)
      .populate('participants', 'username')
      .populate('problemId');

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Get both player submissions
    const submissions = room.submissions || [];
    if (submissions.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Need both player submissions to predict'
      });
    }

    // Sort submissions by userId for consistent player1/player2
    const sortedSubmissions = [...submissions].sort((a, b) =>
      a.userId.toString().localeCompare(b.userId.toString())
    );

    const player1Submission = sortedSubmissions[0];
    const player2Submission = sortedSubmissions[1];

    // Convert to features
    const player1Features = mlService.convertSubmissionToFeatures(
      player1Submission,
      room.problemId
    );
    const player2Features = mlService.convertSubmissionToFeatures(
      player2Submission,
      room.problemId
    );

    // Get prediction from ML service
    const prediction = await mlService.predictWinner(
      player1Features,
      player2Features
    );

    if (!prediction.success) {
      return res.status(500).json(prediction);
    }

    // Save prediction to CompetitionHistory if exists
    try {
      await CompetitionHistory.findOneAndUpdate(
        { roomId: room.roomId },
        {
          mlPrediction: {
            predictedWinner: prediction.data.winner === 'player1'
              ? room.participants[0]._id
              : room.participants[1]._id,
            confidence: prediction.data.confidence,
            modelVersion: prediction.data.model_version,
            featureImportance: prediction.data.feature_importance
          }
        },
        { upsert: false, new: true }
      );
    } catch (historyError) {
      console.warn('Failed to save prediction to history:', historyError.message);
      // Don't fail the prediction if history save fails
    }

    res.json({
      success: true,
      data: prediction.data
    });
  } catch (error) {
    console.error('Predict winner error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get ML service health
 */
exports.getHealth = async (req, res) => {
  try {
    const health = await mlService.getHealth();
    if (health.success) {
      res.json(health);
    } else {
      res.status(503).json({
        success: false,
        error: 'ML service unavailable',
        details: health.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
