/**
 * Test case routes
 * API endpoints for test case validation
 */

const express = require('express');
const { validateTestcase } = require('../modules/questions/question.controller.js');

const router = express.Router();

/**
 * @route   POST /api/v1/test-cases/validate
 * @desc    Validate test case format
 * @access  Public
 * @body    input, output
 */
router.post('/validate', validateTestcase);

module.exports = router;
