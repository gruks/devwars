/**
 * Evaluation Controller
 * Handles testcase evaluation logic for code submissions
 */

const { Question } = require('../questions/question.model.js');
const { executeCode } = require('../../services/execution.service.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { AppError } = require('../../utils/helpers.js');
const { logger } = require('../../utils/logger.js');

/**
 * Evaluate code against multiple test cases
 * @param {Object} params - Evaluation parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to evaluate
 * @param {Array} params.testcases - Array of test cases with input/output
 * @returns {Promise<Object>} Evaluation results
 */
const evaluateTestcases = async ({ language, code, testcases }) => {
  logger.info({
    language,
    codeLength: code?.length,
    testcaseCount: testcases?.length
  }, 'Starting testcase evaluation');

  const results = [];
  let passedCount = 0;

  for (let i = 0; i < testcases.length; i++) {
    const testcase = testcases[i];
    
    try {
      // Execute code with testcase input
      const executionResult = await executeCode({
        language,
        code,
        input: testcase.input,
        timeout: 5000 // 5 second timeout for testcases
      });

      // Compare output (trim whitespace for comparison)
      const actualOutput = (executionResult.output || '').trim();
      const expectedOutput = (testcase.output || '').trim();
      const passed = actualOutput === expectedOutput;

      if (passed) {
        passedCount++;
      }

      results.push({
        passed,
        input: testcase.input,
        expected: testcase.output,
        actual: executionResult.output,
        error: executionResult.success ? null : executionResult.error,
        runtime: executionResult.runtime,
        memory: executionResult.memory
      });

      logger.debug({
        testcaseIndex: i,
        passed,
        input: testcase.input
      }, 'Testcase evaluated');

    } catch (error) {
      logger.error({
        testcaseIndex: i,
        error: error.message
      }, 'Testcase evaluation failed');

      results.push({
        passed: false,
        input: testcase.input,
        expected: testcase.output,
        actual: '',
        error: error.message || 'Evaluation failed',
        runtime: '0ms',
        memory: '0mb'
      });
    }
  }

  logger.info({
    passed: passedCount,
    total: testcases.length
  }, 'Testcase evaluation completed');

  return {
    results,
    passedCount,
    totalCount: testcases.length
  };
};

/**
 * Evaluate a solution for a specific question
 * @param {Object} params - Solution parameters
 * @param {string} params.questionId - Question ID
 * @param {string} params.code - Submitted code
 * @returns {Promise<Object>} Evaluation result with score
 */
const evaluateSolution = async ({ questionId, code }) => {
  logger.info({ questionId, codeLength: code?.length }, 'Evaluating solution');

  // Find the question
  const question = await Question.findOne({ id: questionId });
  
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  if (!question.testcases || question.testcases.length === 0) {
    throw new AppError('Question has no test cases', HTTP_STATUS.BAD_REQUEST);
  }

  // Evaluate against all test cases
  const { results, passedCount, totalCount } = await evaluateTestcases({
    language: question.language,
    code,
    testcases: question.testcases
  });

  // Calculate score as percentage
  const score = Math.round((passedCount / totalCount) * 100);

  logger.info({
    questionId,
    score,
    passed: passedCount,
    total: totalCount
  }, 'Solution evaluation completed');

  return {
    questionId,
    score,
    totalTests: totalCount,
    passedTests: passedCount,
    results
  };
};

/**
 * HTTP handler for evaluating a solution
 * POST /api/v1/evaluation/evaluate
 */
const evaluateSolutionHandler = async (req, res) => {
  try {
    const { questionId, code } = req.body;

    // Validate required fields
    if (!questionId || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields: questionId and code are required'
      });
    }

    const result = await evaluateSolution({ questionId, code });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Solution evaluation failed');

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to evaluate solution',
      error: error.message
    });
  }
};

module.exports = {
  evaluateTestcases,
  evaluateSolution,
  evaluateSolutionHandler
};
