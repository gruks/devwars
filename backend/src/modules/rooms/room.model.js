/**
 * Room Mongoose model
 * Defines room schema for multiplayer matches
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../utils/logger.js');

/**
 * Test case schema for LeetCode-style problems
 */
const testCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true
  },
  output: {
    type: String,
    required: true
  },
  isHidden: {
    type: Boolean,
    default: true
  }
}, { _id: false });

/**
 * Enhanced submission schema with detailed metrics
 */
const enhancedSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timeToSolve: {
    type: Number, // in seconds
    default: 0
  },
  timeComplexity: {
    type: String, // e.g., "O(n)"
    default: 'O(1)'
  },
  spaceComplexity: {
    type: String, // e.g., "O(1)"
    default: 'O(1)'
  },
  passedTestCases: {
    type: Number,
    min: 0,
    max: 2,
    default: 0
  },
  totalTestCases: {
    type: Number,
    default: 2
  },
  codeSnapshot: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Player in room schema
 */
const playerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  isReady: {
    type: Boolean,
    default: false
  },
  departedAt: {
    type: Date
  }
}, { _id: false });

/**
 * Room schema
 */
const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    maxlength: [50, 'Room name cannot exceed 50 characters'],
    default: function() {
      return `Room ${this.inviteCode?.slice(0, 6)}`;
    }
  },
  mode: {
    type: String,
    enum: ['debug', 'bug-hunt', 'code-golf'],
    default: 'debug'
  },
  players: [playerSchema],
  maxPlayers: {
    type: Number,
    min: [2, 'Minimum 2 players required'],
    max: [6, 'Maximum 6 players allowed'],
    default: 4
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  skillLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate'
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  inviteCode: {
    type: String,
    unique: true,
    default: function() {
      return uuidv4().slice(0, 8).toUpperCase();
    }
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extreme'],
    default: 'medium'
  },
  timer: {
    type: Number, // in minutes
    default: 15
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  finishedAt: {
    type: Date
  },
  // LeetCode-style test cases for competitive coding
  testCases: {
    type: [testCaseSchema],
    default: []
  },
  // Spectators viewing the match
  spectators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Enhanced submissions with detailed metrics
  submissions: {
    type: [enhancedSubmissionSchema],
    default: []
  },
  // Match progress percentage (0-100)
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Reference to the match (for competition history)
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  // Problem being solved (for reference)
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for player count (only active players)
roomSchema.virtual('playerCount').get(function() {
  return this.players.filter(p => !p.departedAt).length;
});

// Virtual for isFull (only active players)
roomSchema.virtual('isFull').get(function() {
  return this.playerCount >= this.maxPlayers;
});

// Virtual for spectator count
roomSchema.virtual('spectatorCount').get(function() {
  return this.spectators ? this.spectators.length : 0;
});

// Check if room is joinable
roomSchema.methods.canJoin = function() {
  return this.status === 'waiting' && !this.isFull;
};

// Add player to room
roomSchema.methods.addPlayer = function(userId, username) {
  if (!this.canJoin()) {
    throw new Error('Room is not available to join');
  }
  
  // Check if player already in room
  const alreadyIn = this.players.some(p => p.userId.toString() === userId.toString());
  if (alreadyIn) {
    throw new Error('Player already in room');
  }
  
  this.players.push({ userId, username });
  return this.save();
};

// Remove player from room
roomSchema.methods.removePlayer = function(userId) {
  // Log departure timestamp for the leaving player
  const player = this.players.find(p => p.userId.toString() === userId.toString());
  if (player) {
    player.departedAt = new Date();
  }
  
  const isHostLeaving = this.createdBy.toString() === userId.toString();
  
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  
  // If host left, delete the room (close it)
  if (isHostLeaving) {
    logger.info(`Host left, deleting room: ${this._id}`);
    return this.deleteOne();
  }
  
  // If room is empty, delete it
  if (this.players.length === 0) {
    return this.deleteOne();
  }
  
  // If host left (but we handled that above), assign new host
  // This is now unreachable since host leaving deletes the room
  return this.save();
};

// Update player activity timestamp
roomSchema.methods.updatePlayerActivity = function(userId) {
  const player = this.players.find(p => p.userId.toString() === userId.toString());
  if (player) {
    player.lastActiveAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Start match
roomSchema.methods.startMatch = function() {
  if (this.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }
  
  this.status = 'playing';
  this.startedAt = new Date();
  return this.save();
};

// End match
roomSchema.methods.endMatch = function() {
  this.status = 'finished';
  this.finishedAt = new Date();
  return this.save();
};

// Add spectator to room
roomSchema.methods.addSpectator = function(userId) {
  const userIdStr = userId.toString();
  
  // Check if already a spectator
  const alreadySpectating = this.spectators.some(s => s.toString() === userIdStr);
  if (alreadySpectating) {
    return Promise.resolve(this);
  }
  
  // Check if user is already a player (players can't spectate)
  const isPlayer = this.players.some(p => p.userId.toString() === userIdStr);
  if (isPlayer) {
    throw new Error('Players cannot spectate their own match');
  }
  
  this.spectators.push(userId);
  return this.save();
};

// Remove spectator from room
roomSchema.methods.removeSpectator = function(userId) {
  const userIdStr = userId.toString();
  this.spectators = this.spectators.filter(s => s.toString() !== userIdStr);
  return this.save();
};

// Calculate match progress based on submissions
roomSchema.methods.calculateProgress = function() {
  if (!this.submissions || this.submissions.length === 0) {
    this.progress = 0;
    return this.progress;
  }
  
  // Calculate average progress across all submissions
  let totalProgress = 0;
  this.submissions.forEach(sub => {
    const subProgress = (sub.passedTestCases / sub.totalTestCases) * 100;
    totalProgress += subProgress;
  });
  
  this.progress = Math.round(totalProgress / this.submissions.length);
  return this.progress;
};

// Index for faster queries
roomSchema.index({ status: 1, isPrivate: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ 'players.userId': 1 });
roomSchema.index({ spectators: 1 });

// Index for cleanup queries
roomSchema.index({ status: 1, createdAt: 1, 'players.departedAt': 1, 'players.lastActiveAt': 1 });

// Virtual for room age in days
roomSchema.virtual('ageInDays').get(function() {
  const diffTime = Math.abs(new Date() - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for cleanup eligibility
roomSchema.virtual('isEligibleForCleanup').get(function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // Room is eligible if:
  // - Status is 'finished'
  // - Created more than 1 day ago
  // - All players have departed (no active players)
  // - All players inactive for at least 1 day
  if (this.status !== 'finished') return false;
  if (this.createdAt > oneDayAgo) return false;
  
  // Check if all players have departed and are inactive
  const allPlayersDeparted = this.players.every(p => p.departedAt);
  const allPlayersInactive = this.players.every(p => {
    if (!p.lastActiveAt) return false;
    const lastActiveTime = p.lastActiveAt.getTime();
    const oneDayAgoTime = oneDayAgo.getTime();
    return lastActiveTime < oneDayAgoTime;
  });
  
  return allPlayersDeparted && allPlayersInactive;
});

// Static method for finding rooms eligible for cleanup
roomSchema.statics.findRoomsEligibleForCleanup = async function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  try {
    const eligibleRooms = await this.find({
      status: 'finished',
      createdAt: { $lt: oneDayAgo },
      'players.departedAt': { $exists: true }, // All players have departed
      'players.lastActiveAt': { $lt: oneDayAgo } // All players inactive for 1+ day
    }).exec();
    
    return eligibleRooms;
  } catch (error) {
    throw new Error(`Error finding rooms for cleanup: ${error.message}`);
  }
};

// Static method for bulk cleanup
roomSchema.statics.cleanupOldRooms = async function() {
  const eligibleRooms = await this.findRoomsEligibleForCleanup();
  
  if (eligibleRooms.length === 0) {
    return { cleanedUp: 0, totalRooms: 0 };
  }
  
  const cleanupPromises = eligibleRooms.map(room => room.deleteOne());
  
  try {
    const results = await Promise.allSettled(cleanupPromises);
    
    const successfulCleanups = results.filter(r => r.status === 'fulfilled').length;
    const failedCleanups = results.filter(r => r.status === 'rejected').length;
    
    return {
      cleanedUp: successfulCleanups,
      failed: failedCleanups,
      totalRooms: eligibleRooms.length,
      cleanedRoomIds: eligibleRooms.filter((_, index) => results[index].status === 'fulfilled')
        .map(room => room._id)
    };
  } catch (error) {
    throw new Error(`Error cleaning up old rooms: ${error.message}`);
  }
};

// Pre-remove hook for cleanup logging
roomSchema.post('remove', function(doc) {
  logger.info(`Room ${doc._id} (${doc.name}) was removed from database`);
});

// Create the model
const Room = mongoose.model('Room', roomSchema);

/**
 * Chat message schema for persistent chat storage
 */
const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['text', 'system', 'action'],
    default: 'text'
  }
}, { 
  timestamps: true 
});

// Compound index for efficient querying by room and time
messageSchema.index({ roomId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = { Room, Message, playerSchema, testCaseSchema, enhancedSubmissionSchema };
