/**
 * Room Mongoose model
 * Defines room schema for multiplayer matches
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for player count
roomSchema.virtual('playerCount').get(function() {
  return this.players.length;
});

// Virtual for isFull
roomSchema.virtual('isFull').get(function() {
  return this.players.length >= this.maxPlayers;
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
  
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  
  // If room is empty, delete it
  if (this.players.length === 0) {
    return this.deleteOne();
  }
  
  // If host left, assign new host
  if (this.createdBy.toString() === userId.toString() && this.players.length > 0) {
    this.createdBy = this.players[0].userId;
  }
  
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

// Index for faster queries
roomSchema.index({ status: 1, isPrivate: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ 'players.userId': 1 });

// Create the model
const Room = mongoose.model('Room', roomSchema);

module.exports = { Room, playerSchema };
