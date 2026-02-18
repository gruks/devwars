/**
 * Execution Routes
 * API endpoints for code execution and submission
 */

const express = require('express');
const { authenticate } = require('../auth/auth.middleware.js');
const { 
  runCodeHandler, 
  submitCodeHandler, 
  getLanguagesHandler,
  validateCodeHandler 
} = require('./execution.controller.js');

const router = express.Router();

/**
 * @route   POST /api/v1/execution/run
 * @desc    Run code against test cases without saving
 * @access  Private
 * @body    { code: string, language: string, roomId?: string, testCases?: array }
 * @returns { success, data: { results[], summary{} } }
 */
router.post('/run', authenticate, runCodeHandler);

/**
 * @route   POST /api/v1/execution/submit
 * @desc    Submit code for match evaluation (saves submission)
 * @access  Private
 * @body    { code: string, language: string, roomId: string }
 * @returns { success, data: { submission{}, score, passedTests } }
 */
router.post('/submit', authenticate, submitCodeHandler);

/**
 * @route   GET /api/v1/execution/languages
 * @desc    Get list of supported programming languages
 * @access  Public
 * @returns { success, data: { languages: string[] } }
 */
router.get('/languages', getLanguagesHandler);

/**
 * @route   POST /api/v1/execution/validate
 * @desc    Validate code for security issues without executing
 * @access  Private
 * @body    { code: string, language?: string }
 * @returns { success, data: { valid: boolean, issues: string[] } }
 */
router.post('/validate', authenticate, validateCodeHandler);

module.exports = router;
