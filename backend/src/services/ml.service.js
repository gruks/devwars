/**
 * ML Service Client
 * Connects to FastAPI ML service for competition winner prediction
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const mlApi = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Complexity string to score mapping per RESEARCH.md
const complexityScores = {
  'O(1)': 5,
  'O(log n)': 4,
  'O(n)': 3,
  'O(n log n)': 2,
  'O(n^2)': 1,
  'O(n²)': 1,
  'O(n^3)': 0,
  'O(2^n)': 0,
  'O(n!)': 0
};

/**
 * Parse complexity string to numeric score
 * @param {string} complexityString - Big-O complexity string
 * @returns {number} Score 0-5
 */
function parseComplexity(complexityString) {
  if (!complexityString) return 3; // Default to O(n)
  const score = complexityScores[complexityString.trim()];
  return score !== undefined ? score : 3;
}

/**
 * ML Service class for predicting competition winners
 */
class MLService {
  /**
   * Predict winner between two players
   * @param {Object} player1Features - Player 1 feature set
   * @param {Object} player2Features - Player 2 feature set
   * @returns {Promise<Object>} Prediction result
   */
  async predictWinner(player1Features, player2Features) {
    try {
      const response = await mlApi.post('/predict', {
        player1: player1Features,
        player2: player2Features
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('ML service prediction error:', error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * Check ML service health
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    try {
      const response = await mlApi.get('/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert submission data to ML features
   * @param {Object} submission - Submission data from room model
   * @param {Object} problem - Problem/question data
   * @returns {Object} ML feature set
   */
  convertSubmissionToFeatures(submission, problem) {
    return {
      time_complexity_score: parseComplexity(submission?.timeComplexity),
      space_complexity_score: parseComplexity(submission?.spaceComplexity),
      test_cases_passed: submission?.passedTestCases || 0,
      constraint_difficulty: problem?.difficultyRating || 3, // 1-5 scale
      time_to_solve: submission?.timeToSolve || 0
    };
  }

  /**
   * Predict winner for a room
   * @param {Object} room - Room with participants and submissions
   * @returns {Promise<Object>} Prediction result
   */
  async predictRoomWinner(room) {
    try {
      const submissions = room.submissions || [];
      const problem = room.problemId;

      if (submissions.length < 2) {
        return {
          success: false,
          error: 'Need both player submissions to predict'
        };
      }

      // Get player submissions (sorted by userId to ensure consistency)
      const sortedSubmissions = [...submissions].sort((a, b) => 
        a.userId.toString().localeCompare(b.userId.toString())
      );

      const player1Features = this.convertSubmissionToFeatures(
        sortedSubmissions[0],
        problem
      );
      const player2Features = this.convertSubmissionToFeatures(
        sortedSubmissions[1],
        problem
      );

      return await this.predictWinner(player1Features, player2Features);
    } catch (error) {
      console.error('Predict room winner error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MLService();
