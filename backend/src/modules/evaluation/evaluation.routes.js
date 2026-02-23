/**
 * Evaluation Routes
 * API endpoints for code evaluation and testcase validation
 */

const express = require('express');
const { authenticate } = require('../auth/auth.middleware.js');
const {
  evaluateSolutionHandler,
  evaluateCustomTestcasesHandler,
  getEvaluationStatsHandler,
  getEvaluationConfigHandler
} = require('./evaluation.controller.js');

const router = express.Router();

/**
 * @route   POST /api/v1/evaluation/evaluate
 * @desc    Evaluate submitted code against question test cases
 * @access  Private
 * @body    { questionId: string, code: string }
 * @returns { questionId, score, totalTests, passedTests, results[], analytics }
 */
router.post('/evaluate', authenticate, evaluateSolutionHandler);

/**
 * @route   POST /api/v1/evaluation/evaluate-custom
 * @desc    Evaluate code against custom test cases
 * @access  Private
 * @body    { code: string, language: string, testcases: [{ input, output }] }
 * @returns { score, totalTests, passedTests, results[], analytics }
 */
router.post('/evaluate-custom', authenticate, evaluateCustomTestcasesHandler);

/**
 * @route   GET /api/v1/evaluation/stats
 * @desc    Get evaluation statistics
 * @access  Public
 * @returns { totalEvaluations, successfulEvaluations, successRate, cacheHits, cacheHitRate }
 */
router.get('/stats', getEvaluationStatsHandler);

/**
 * @route   GET /api/v1/evaluation/config
 * @desc    Get evaluation configuration
 * @access  Public
 * @returns { retry, timeout, memory, parallel, comparison }
 */
router.get('/config', getEvaluationConfigHandler);

module.exports = router;
