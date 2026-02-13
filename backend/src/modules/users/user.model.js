/**
 * User Mongoose model
 * Defines user schema with authentication and profile fields
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env } = require('../../config/env.js');

/**
 * User schema definition
 */
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  avatar: {
    type: String,
    trim: true,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  stats: {
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    matchesPlayed: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 1000
    }
  },
  refreshTokens: [{
    type: String,
    select: false
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

/**
 * Pre-save hook to hash password before saving
 * Only hashes if password is modified (not on every save)
 */
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password with stored hash
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Override toJSON to remove sensitive fields
 * This ensures password and refresh tokens are never sent in responses
 */
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.refreshTokens;
  return user;
};

/**
 * Update user stats after a match
 * @param {boolean} won - Whether the user won the match
 */
userSchema.methods.updateStats = async function(won) {
  if (won) {
    this.stats.wins += 1;
    this.stats.rating += 10;
  } else {
    this.stats.losses += 1;
    this.stats.rating = Math.max(0, this.stats.rating - 10);
  }
  this.stats.matchesPlayed += 1;
  await this.save();
};

/**
 * Add refresh token to user's token list
 * @param {string} token - Refresh token to add
 */
userSchema.methods.addRefreshToken = async function(token) {
  this.refreshTokens.push(token);
  await this.save();
};

/**
 * Remove refresh token from user's token list
 * @param {string} token - Refresh token to remove
 */
userSchema.methods.removeRefreshToken = async function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t !== token);
  await this.save();
};

/**
 * Clear all refresh tokens (logout from all devices)
 */
userSchema.methods.clearRefreshTokens = async function() {
  this.refreshTokens = [];
  await this.save();
};

// Create the model
const User = mongoose.model('User', userSchema);

module.exports = { User };
