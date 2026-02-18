/**
 * Match Mongoose model
 * Defines match schema for debug battle game state management
 */

const mongoose = require('mongoose');

/**
 * Test result schema for individual test case results
 */
const testResultSchema = new mongoose.Schema({
  passed: {
    type: Boolean,
    required: true
  },
  input: {
    type: String,
    default: ''
  },
  expected: {
    type: String,
    default: ''
  },
  actual: {
    type: String,
    default: ''
  },
  executionTime: {
    type: Number, // in milliseconds
    default: 0
  }
}, { _id: false });

/**
 * Enhanced test result schema with detailed execution metrics
 */
const enhancedTestResultSchema = new mongoose.Schema({
  testCaseIndex: {
    type: Number,
    min: 0,
    default: 0
  },
  passed: {
    type: Boolean,
    required: true
  },
  actualOutput: {
    type: String,
    default: ''
  },
  expectedOutput: {
    type: String,
    default: ''
  },
  executionTime: {
    type: Number, // in milliseconds
    default: 0
  }
}, { _id: false });

/**
 * Submission schema for player code submissions
 */
const submissionSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  code: {
    type: String,
    default: ''
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  solvedAt: {
    type: Date
  },
  testResults: {
    type: [testResultSchema],
    default: []
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  // Execution metrics
  executionTime: {
    type: Number, // in milliseconds
    default: 0
  },
  memoryUsed: {
    type: Number, // in MB
    default: 0
  },
  // Enhanced test results with detailed metrics
  detailedTestResults: {
    type: [enhancedTestResultSchema],
    default: []
  }
}, { _id: false });

/**
 * Player in match schema
 */
const playerSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  solvedAt: {
    type: Date
  }
}, { _id: false });

/**
 * Match schema
 * Tracks game state for debug battle matches
 */
const matchSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: [true, 'Question ID is required']
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting',
    index: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  timerDuration: {
    type: Number, // in seconds, default 15 minutes
    default: 900,
    min: 60,
    max: 3600
  },
  submissions: {
    type: [submissionSchema],
    default: []
  },
  players: {
    type: [playerSchema],
    default: []
  },
  winner: {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: {
      type: String
    }
  },
  // Number of spectators viewing this match (synced from room)
  spectatorCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for elapsed time
matchSchema.virtual('elapsedTime').get(function() {
  if (!this.startTime) return 0;
  const end = this.endTime || new Date();
  return Math.floor((end - this.startTime) / 1000); // in seconds
});

// Virtual for remaining time
matchSchema.virtual('remainingTime').get(function() {
  if (!this.startTime || this.status !== 'active') return 0;
  const elapsed = this.elapsedTime;
  return Math.max(0, this.timerDuration - elapsed);
});

// Virtual for player count
matchSchema.virtual('playerCount').get(function() {
  return this.players.length;
});

// Virtual for submission count
matchSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

// Method to check if match is active
matchSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to check if match is finished
matchSchema.methods.isFinished = function() {
  return this.status === 'finished';
};

// Method to get player submission
matchSchema.methods.getPlayerSubmission = function(playerId) {
  return this.submissions.find(
    sub => sub.playerId.toString() === playerId.toString()
  );
};

// Method to get player info
matchSchema.methods.getPlayer = function(playerId) {
  return this.players.find(
    p => p.playerId.toString() === playerId.toString()
  );
};

// Method to update spectator count (synced from room)
matchSchema.methods.updateSpectatorCount = function(count) {
  this.spectatorCount = Math.max(0, count);
  return this.save();
};

// Method to calculate scores based on test results
matchSchema.methods.calculateScores = function() {
  if (!this.submissions || this.submissions.length === 0) {
    return this.players.map(p => ({ playerId: p.playerId, score: 0 }));
  }
  
  const results = [];
  
  this.submissions.forEach(submission => {
    const player = this.players.find(
      p => p.playerId.toString() === submission.playerId.toString()
    );
    
    if (player) {
      // Calculate score based on test results
      const testResults = submission.detailedTestResults || submission.testResults || [];
      const passedCount = testResults.filter(t => t.passed).length;
      const totalCount = testResults.length || 1;
      
      // Score is percentage of passed test cases
      const score = Math.round((passedCount / totalCount) * 100);
      
      // Update player's score
      player.score = score;
      
      // If solved (passed all tests), record solve time
      if (passedCount === totalCount && submission.solvedAt && this.startTime) {
        player.solvedAt = submission.solvedAt;
      }
      
      results.push({
        playerId: submission.playerId,
        score: score,
        passedCount: passedCount,
        totalCount: totalCount
      });
    }
  });
  
  return this.save().then(() => results);
};

// Indexes for efficient querying
matchSchema.index({ roomId: 1, status: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ 'submissions.playerId': 1 });
matchSchema.index({ 'players.playerId': 1 });
matchSchema.index({ createdAt: -1 });

// Create the model
const Match = mongoose.model('Match', matchSchema);

module.exports = { Match, submissionSchema, playerSchema, testResultSchema };
