/**
 * Question routes
 * API endpoints for question management
 */

const express = require('express');
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  seedQuestions
} = require('./question.controller.js');

// Import auth middleware
const { authenticate, authorize } = require('../auth/auth.middleware.js');

const router = express.Router();

/**
 * @route   GET /api/v1/questions
 * @desc    Get all questions with filtering
 * @access  Public
 * @query   mode, difficulty, language, search, isActive, page, limit
 */
router.get('/', getQuestions);

/**
 * @route   GET /api/v1/questions/:id
 * @desc    Get question by ID
 * @access  Public
 * @param   id - Question ID
 */
router.get('/:id', getQuestionById);

/**
 * @route   POST /api/v1/questions
 * @desc    Create new question
 * @access  Private (Admin only)
 * @body    mode, title, description, language, difficulty, starterCode, solution, testcases, hints, timeLimit, memoryLimit, tags
 */
router.post('/', authenticate, authorize('admin'), createQuestion);

/**
 * @route   POST /api/v1/questions/seed
 * @desc    Seed database with sample questions
 * @access  Private (Admin only)
 */
router.post('/seed', authenticate, authorize('admin'), seedQuestions);

module.exports = router;
