/**
 * Question Mongoose model
 * Defines question schema for debug battle game mode
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Custom test case schema
 * User-created test cases for practice and debugging
 */
const customTestcaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  input: {
    type: String,
    required: [true, 'Test case input is required'],
    trim: true,
    maxlength: [5000, 'Input cannot exceed 5000 characters']
  },
  output: {
    type: String,
    required: [true, 'Test case output is required'],
    trim: true,
    maxlength: [5000, 'Output cannot exceed 5000 characters']
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Test case schema
 * Defines input/output pairs for testing solutions
 */
const testcaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: [true, 'Test case input is required'],
    trim: true
  },
  output: {
    type: String,
    required: [true, 'Test case output is required'],
    trim: true
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

/**
 * Question schema
 * Stores debug battle questions with buggy starter code and solutions
 */
const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    index: true
  },
  mode: {
    type: String,
    enum: ['debug', 'bug-hunt', 'code-golf'],
    default: 'debug',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Question title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Question description is required'],
    trim: true
  },
  language: {
    type: String,
    enum: ['python', 'javascript', 'java', 'cpp', 'csharp', 'ruby', 'rust'],
    required: [true, 'Programming language is required'],
    index: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extreme'],
    required: [true, 'Difficulty level is required'],
    index: true
  },
  starterCode: {
    type: String,
    required: [true, 'Starter code with bugs is required'],
    trim: true
  },
  solution: {
    type: String,
    required: [true, 'Working solution is required'],
    trim: true
  },
  testcases: {
    type: [testcaseSchema],
    validate: {
      validator: function(v) {
        return v && v.length >= 1;
      },
      message: 'At least one test case is required'
    }
  },
  // Custom test cases created by users for practice
  customTestcases: {
    type: [customTestcaseSchema],
    default: []
  },
  hints: {
    type: [String],
    default: []
  },
  timeLimit: {
    type: Number, // in milliseconds
    default: 300000, // 5 minutes default
    min: [60000, 'Time limit must be at least 1 minute'],
    max: [1800000, 'Time limit cannot exceed 30 minutes']
  },
  memoryLimit: {
    type: Number, // in MB
    default: 256,
    min: [64, 'Memory limit must be at least 64MB'],
    max: [2048, 'Memory limit cannot exceed 2048MB']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  tags: {
    type: [String],
    default: []
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  timesPlayed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Pre-validate hook to generate id if not provided
 * Uses uuid format: q-xxxxx
 */
questionSchema.pre('validate', async function() {
  if (!this.id) {
    // Generate short unique ID: q-xxxxx format
    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    this.id = `q-${uuid.slice(0, 5)}`;
  }
});

// Virtual for average solve time (placeholder for future implementation)
questionSchema.virtual('averageSolveTime').get(function() {
  // This could be calculated from match data in the future
  return null;
});

// Index for efficient querying
questionSchema.index({ mode: 1, difficulty: 1, language: 1, isActive: 1 });
questionSchema.index({ difficulty: 1, language: 1 });
questionSchema.index({ tags: 1 });
// Index for custom test cases by user and question
questionSchema.index({ 'customTestcases.userId': 1, 'customTestcases.createdAt': -1 });

// Create the model
const Question = mongoose.model('Question', questionSchema);

module.exports = { Question, testcaseSchema, customTestcaseSchema };
