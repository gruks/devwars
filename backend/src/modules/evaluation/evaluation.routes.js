/**
 * Evaluation Routes
 * API endpoints for code evaluation and testcase validation
 */

const express = require('express');
const { authenticate } = require('../auth/auth.middleware.js');
const { evaluateSolutionHandler } = require('./evaluation.controller.js');

const router = express.Router();

/**
 * @route   POST /api/v1/evaluation/evaluate
 * @desc    Evaluate submitted code against question test cases
 * @access  Private
 * @body    { questionId: string, code: string }
 * @returns { questionId, score, totalTests, passedTests, results[] }
 */
router.post('/evaluate', authenticate, evaluateSolutionHandler);

module.exports = router;
