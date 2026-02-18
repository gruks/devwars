/**
 * Execution Controller
 * Handles code execution and test case evaluation
 */

const { Room } = require('../rooms/room.model.js');
const { Match } = require('../matches/match.model.js');
const { Question } = require('../questions/question.model.js');
const executionService = require('../../services/execution.service.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { AppError } = require('../../utils/helpers.js');
const { logger } = require('../../utils/logger.js');

const MAX_CODE_LENGTH = 10000;
const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'go', 'cpp'];

/**
 * Validate execution request
 */
const validateExecutionRequest = (code, language) => {
  const errors = [];
  
  if (!code || typeof code !== 'string') {
    errors.push('Code is required');
  } else if (code.length > MAX_CODE_LENGTH) {
    errors.push(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
  }
  
  if (!language) {
    errors.push('Language is required');
  } else if (!SUPPORTED_LANGUAGES.includes(language)) {
    errors.push(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  
  return errors;
};

/**
 * POST /api/v1/execution/run
 * Run code against test cases (without saving submission)
 */
const runCodeHandler = async (req, res) => {
  try {
    const { code, language, roomId, testCases } = req.body;
    
    // Validate request
    const errors = validateExecutionRequest(code, language);
    if (errors.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: errors.join(', ')
      });
    }
    
    // Get test cases
    let testCasesToRun = testCases;
    
    // If roomId provided, fetch test cases from room
    if (roomId && !testCases) {
      const room = await Room.findOne({ inviteCode: roomId }).populate('currentQuestion');
      
      if (!room) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Room not found'
        });
      }
      
      if (!room.currentQuestion || !room.currentQuestion.testcases) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No test cases available for this room'
        });
      }
      
      testCasesToRun = room.currentQuestion.testcases;
    }
    
    // If no test cases provided, run code with empty input
    if (!testCasesToRun || testCasesToRun.length === 0) {
      testCasesToRun = [{ input: '', expectedOutput: '' }];
    }
    
    // Run test cases
    logger.info({
      userId: req.user?.id,
      language,
      testCaseCount: testCasesToRun.length,
      roomId
    }, 'Running code execution');
    
    const result = await executionService.runTestCases({
      code,
      language,
      testCases: testCasesToRun,
      timeout: 2000
    });
    
    res.json({
      success: true,
      data: {
        results: result.results,
        summary: {
          totalTests: result.totalTests,
          passedTests: result.passedTests,
          failedTests: result.failedTests,
          averageExecutionTime: result.averageExecutionTime,
          maxMemoryUsed: result.maxMemoryUsed
        }
      }
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Code execution failed');
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to execute code',
      error: error.message
    });
  }
};

/**
 * POST /api/v1/execution/submit
 * Submit code for a match (saves submission and updates scores)
 */
const submitCodeHandler = async (req, res) => {
  try {
    const { code, language, roomId } = req.body;
    const userId = req.user?.id;
    
    // Validate request
    const errors = validateExecutionRequest(code, language);
    if (errors.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: errors.join(', ')
      });
    }
    
    if (!roomId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Room ID is required for submission'
      });
    }
    
    // Find room
    const room = await Room.findOne({ inviteCode: roomId });
    
    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is in room
    const player = room.players.find(p => 
      p.userId?.toString() === userId || p.userId === userId
    );
    
    if (!player) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this room'
      });
    }
    
    // Check room status
    if (room.status !== 'active') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Room is not active. Match must be in progress to submit.'
      });
    }
    
    // Get test cases from room's question
    if (!room.currentQuestion) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No question assigned to this match'
      });
    }
    
    const question = await Question.findOne({ id: room.currentQuestion });
    
    if (!question || !question.testcases || question.testcases.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No test cases available for evaluation'
      });
    }
    
    // Run test cases
    logger.info({
      userId,
      roomId,
      language,
      testCaseCount: question.testcases.length
    }, 'Submitting code for evaluation');
    
    const result = await executionService.runTestCases({
      code,
      language,
      testCases: question.testcases,
      timeout: 2000
    });
    
    // Calculate score (percentage)
    const passedTests = result.passedTests;
    const totalTests = result.totalTests;
    const score = Math.round((passedTests / totalTests) * 100);
    
    // Calculate complexity
    const complexity = executionService.calculateComplexity(code, language);
    
    // Create submission object
    const submission = {
      userId,
      code,
      language,
      score,
      passedTests,
      totalTests,
      testResults: result.results,
      complexity,
      submittedAt: new Date()
    };
    
    // Add to room submissions
    room.submissions = room.submissions || [];
    room.submissions.push(submission);
    
    // Update player progress
    if (player) {
      player.submissions = player.submissions || [];
      player.submissions.push({
        questionId: question.id,
        code,
        score,
        submittedAt: new Date()
      });
      
      // Update solved status if all tests passed
      if (score === 100) {
        player.solved = player.solved || [];
        if (!player.solved.includes(question.id)) {
          player.solved.push(question.id);
        }
      }
    }
    
    await room.save();
    
    // Check if match should end (all players solved or time expired)
    const allSolved = room.players.every(p => 
      p.solved?.includes(question.id) || p.departedAt
    );
    
    res.json({
      success: true,
      data: {
        submission: {
          id: submission._id || Date.now(),
          userId,
          code,
          language,
          score,
          passedTests,
          totalTests,
          complexity,
          submittedAt: submission.submittedAt
        },
        passedTests,
        totalTests,
        score,
        allTestsPassed: score === 100,
        matchComplete: allSolved
      }
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Code submission failed');
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to submit code',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/execution/languages
 * Get list of supported languages
 */
const getLanguagesHandler = (req, res) => {
  res.json({
    success: true,
    data: {
      languages: SUPPORTED_LANGUAGES
    }
  });
};

/**
 * POST /api/v1/execution/validate
 * Validate code for security issues (without executing)
 */
const validateCodeHandler = async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Code is required'
      });
    }
    
    if (language && !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Unsupported language: ${language}`
      });
    }
    
    const validation = executionService.validateCode(code, language || 'javascript');
    
    res.json({
      success: true,
      data: {
        valid: validation.valid,
        issues: validation.issues
      }
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Code validation failed');
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to validate code',
      error: error.message
    });
  }
};

module.exports = {
  runCodeHandler,
  submitCodeHandler,
  getLanguagesHandler,
  validateCodeHandler
};
