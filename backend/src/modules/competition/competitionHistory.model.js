/**
 * CompetitionHistory Mongoose model
 * Stores private match results accessible only to participants
 */

const mongoose = require('mongoose');

/**
 * Result schema for individual player results
 */
const resultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  timeToSolve: {
    type: Number, // in seconds
    default: 0
  },
  passedTestCases: {
    type: Number,
    min: 0,
    max: 2,
    default: 0
  },
  timeComplexity: {
    type: String,
    default: 'O(1)'
  },
  spaceComplexity: {
    type: String,
    default: 'O(1)'
  }
}, { _id: false });

/**
 * ML feature schema for prediction features
 */
const featureSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timeComplexityScore: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  spaceComplexityScore: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  testCasesPassed: {
    type: Number,
    min: 0,
    max: 2,
    default: 0
  },
  constraintDifficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  timeToSolve: {
    type: Number, // in seconds
    default: 0
  }
}, { _id: false });

/**
 * ML prediction schema
 */
const mlPredictionSchema = new mongoose.Schema({
  predictedWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  modelVersion: {
    type: String,
    default: 'v1.0'
  }
}, { _id: false });

/**
 * CompetitionHistory schema
 * Stores completed competition data with privacy controls
 */
const competitionHistorySchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  // Only these users can view this competition history
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  },
  results: {
    type: [resultSchema],
    default: []
  },
  // ML features used for prediction
  features: {
    type: [featureSchema],
    default: []
  },
  // ML prediction data
  mlPrediction: {
    type: mlPredictionSchema,
    default: null
  },
  startedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for competition duration
competitionHistorySchema.virtual('duration').get(function() {
  if (!this.startedAt || !this.endedAt) return 0;
  return Math.floor((this.endedAt - this.startedAt) / 1000); // in seconds
});

// Virtual for participant count
competitionHistorySchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.length : 0;
});

// Static method: find competitions for a specific user
competitionHistorySchema.statics.findForUser = function(userId) {
  return this.find({ participants: userId })
    .sort({ createdAt: -1 })
    .populate('winner', 'username')
    .populate('participants', 'username');
};

// Static method: find recent competitions
competitionHistorySchema.statics.findRecent = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('winner', 'username')
    .populate('participants', 'username');
};

// Static method: find competitions between two users
competitionHistorySchema.statics.findHeadToHead = function(userId1, userId2) {
  return this.find({
    participants: { $all: [userId1, userId2] }
  })
    .sort({ createdAt: -1 })
    .populate('winner', 'username')
    .populate('participants', 'username');
};

// Index for efficient querying by participants (privacy control)
competitionHistorySchema.index({ participants: 1 });
// Index for sorting by date
competitionHistorySchema.index({ createdAt: -1 });
// Index for querying by match ID
competitionHistorySchema.index({ matchId: 1 });
// Compound index for user queries
competitionHistorySchema.index({ participants: 1, createdAt: -1 });

// Create the model
const CompetitionHistory = mongoose.model('CompetitionHistory', competitionHistorySchema);

module.exports = { CompetitionHistory, resultSchema, featureSchema, mlPredictionSchema };
