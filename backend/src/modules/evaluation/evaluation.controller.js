/**
 * Evaluation Controller
 * Handles testcase evaluation logic for code submissions
 */

const { Question } = require('../questions/question.model.js');
const { executeCode, runTestCases, calculateComplexity } = require('../../services/execution.service.js');
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
  let totalExecutionTime = 0;
  let maxMemory = 0;

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

      // Parse memory usage
      const memoryMatch = executionResult.memory?.match(/(\d+)/);
      const memoryMB = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      maxMemory = Math.max(maxMemory, memoryMB);

      // Parse execution time
      const timeMatch = executionResult.runtime?.match(/(\d+)/);
      const timeMS = timeMatch ? parseInt(timeMatch[1]) : 0;
      totalExecutionTime += timeMS;

      results.push({
        passed,
        input: testcase.input,
        expectedOutput: testcase.output,
        actual: executionResult.output,
        actualOutput: executionResult.output, // Frontend expects this
        error: executionResult.success ? null : executionResult.error,
        runtime: executionResult.runtime,
        executionTime: timeMS,
        memory: executionResult.memory,
        memoryUsed: memoryMB
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
        expectedOutput: testcase.output,
        actual: '',
        actualOutput: '',
        error: error.message || 'Evaluation failed',
        runtime: '0ms',
        executionTime: 0,
        memory: '0mb',
        memoryUsed: 0
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
    totalCount: testcases.length,
    totalExecutionTime,
    maxMemory
  };
};

/**
 * Calculate code quality metrics
 * @param {string} code - Source code
 * @param {string} language - Programming language
 * @param {Object} testResults - Test execution results
 * @returns {Object} Code quality metrics
 */
const calculateCodeQuality = (code, language, testResults) => {
  const lines = code.split('\n').length;
  const chars = code.length;
  
  // Calculate complexity
  const complexity = calculateComplexity(code, language);
  
  // Simple quality metrics
  let maintainability = 100;
  let security = 100;
  let performance = 100;
  let bestPractices = 100;
  let bugs = 0;
  const suggestions = [];

  // Check for common issues
  if (code.includes('eval(')) {
    security -= 30;
    suggestions.push('Avoid using eval() - it can be a security risk');
  }
  
  if (code.includes('var ')) {
    bestPractices -= 10;
    suggestions.push('Consider using const or let instead of var');
  }
  
  if (code.includes('==') && !code.includes('===')) {
    bestPractices -= 10;
    suggestions.push('Consider using strict equality (===) instead of (==)');
  }
  
  // Check line length
  const longLines = code.split('\n').filter(line => line.length > 120).length;
  if (longLines > 0) {
    maintainability -= longLines * 5;
    suggestions.push('Consider breaking up long lines for better readability');
  }

  // Check for console.log in production code (not a test)
  const consoleLogs = (code.match(/console\.log/g) || []).length;
  if (consoleLogs > 3) {
    maintainability -= 5;
    suggestions.push('Multiple console.log statements - consider removing debug output');
  }

  // Adjust based on test pass rate
  if (testResults.passedCount < testResults.totalCount) {
    bugs = testResults.totalCount - testResults.passedCount;
    maintainability -= bugs * 10;
  }

  // Ensure minimum scores
  maintainability = Math.max(0, Math.min(100, maintainability));
  security = Math.max(0, Math.min(100, security));
  performance = Math.max(0, Math.min(100, performance));
  bestPractices = Math.max(0, Math.min(100, bestPractices));

  const overall = Math.round((maintainability + security + performance + bestPractices) / 4);

  return {
    overall,
    maintainability,
    security,
    performance,
    bestPractices,
    bugs,
    suggestions
  };
};

/**
 * Evaluate a solution for a specific question
 * @param {Object} params - Solution parameters
 * @param {string} params.questionId - Question ID
 * @param {string} params.code - Submitted code
 * @param {string} params.language - Programming language (optional, uses question default)
 * @returns {Promise<Object>} Evaluation result with score
 */
const evaluateSolution = async ({ questionId, code, language }) => {
  logger.info({ questionId, codeLength: code?.length, language }, 'Evaluating solution');

  // Find the question - try both custom id field and MongoDB _id
  let question = await Question.findOne({ id: questionId });
  
  if (!question) {
    // Try finding by MongoDB ObjectId
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(questionId)) {
        question = await Question.findById(questionId);
      }
    } catch (e) {
      // Not a valid ObjectId, continue
    }
  }
  
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  if (!question.testcases || question.testcases.length === 0) {
    throw new AppError('Question has no test cases', HTTP_STATUS.BAD_REQUEST);
  }

  // Use provided language or question's language
  const evalLanguage = language || question.language;

  // Evaluate against all test cases
  const { results, passedCount, totalCount, totalExecutionTime, maxMemory } = await evaluateTestcases({
    language: evalLanguage,
    code,
    testcases: question.testcases
  });

  // Calculate score as percentage
  const score = Math.round((passedCount / totalCount) * 100);

  // Calculate code quality
  const codeQuality = calculateCodeQuality(code, evalLanguage, { passedCount, totalCount });

  // Get complexity
  const complexity = calculateComplexity(code, evalLanguage);

  logger.info({
    questionId,
    score,
    passed: passedCount,
    total: totalCount
  }, 'Solution evaluation completed');

  return {
    questionId,
    score,
    passedCount,
    totalCount,
    passedTests: passedCount,
    totalTests: totalCount,
    results,
    memoryUsed: maxMemory,
    executionTime: totalExecutionTime,
    codeQuality,
    complexity: {
      time: complexity.timeComplexity,
      space: complexity.spaceComplexity
    },
    securityAnalysis: {
      overall: codeQuality.security,
      vulnerabilities: []
    },
    bestPracticesAnalysis: {
      overall: codeQuality.bestPractices,
      recommendations: codeQuality.suggestions.map(s => ({
        description: s,
        importance: 'medium',
        suggestion: s
      }))
    },
    performanceAnalysis: {
      tips: []
    }
  };
};

/**
 * HTTP handler for evaluating a solution
 * POST /api/v1/evaluation/evaluate
 */
const evaluateSolutionHandler = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;

    // Validate required fields
    if (!questionId || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields: questionId and code are required'
      });
    }

    const result = await evaluateSolution({ questionId, code, language });

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
