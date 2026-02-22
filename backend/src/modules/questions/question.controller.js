/**
 * Question controller
 * HTTP handlers for question endpoints
 */

const { Question } = require('./question.model.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { logger } = require('../../utils/logger.js');
const { AppError } = require('../../utils/helpers.js');
const mongoose = require('mongoose');

// ============================================================================
// TEST CASE VALIDATION MIDDLEWARE AND UTILITIES
// ============================================================================

/**
 * Test case validation constraints
 */
const TESTCASE_CONSTRAINTS = {
  input: { maxLength: 10000, minLength: 1 },
  output: { maxLength: 10000, minLength: 1 },
  description: { maxLength: 500, minLength: 0 }
};

/**
 * Validate a single test case with comprehensive checks
 * @param {Object} testcase - Test case to validate
 * @param {number} index - Test case index for error messages
 * @returns {Object} { valid: boolean, errors: string[] }
 */
const validateTestcaseStructure = (testcase, index = 0) => {
  const errors = [];
  const prefix = `Test case ${index + 1}`;

  // Validate input
  if (!testcase.input || typeof testcase.input !== 'string') {
    errors.push(`${prefix}: input is required and must be a string`);
  } else if (testcase.input.length < TESTCASE_CONSTRAINTS.input.minLength) {
    errors.push(`${prefix}: input must be at least ${TESTCASE_CONSTRAINTS.input.minLength} character`);
  } else if (testcase.input.length > TESTCASE_CONSTRAINTS.input.maxLength) {
    errors.push(`${prefix}: input exceeds maximum length of ${TESTCASE_CONSTRAINTS.input.maxLength} characters`);
  }

  // Validate output
  if (!testcase.output || typeof testcase.output !== 'string') {
    errors.push(`${prefix}: output is required and must be a string`);
  } else if (testcase.output.length < TESTCASE_CONSTRAINTS.output.minLength) {
    errors.push(`${prefix}: output must be at least ${TESTCASE_CONSTRAINTS.output.minLength} character`);
  } else if (testcase.output.length > TESTCASE_CONSTRAINTS.output.maxLength) {
    errors.push(`${prefix}: output exceeds maximum length of ${TESTCASE_CONSTRAINTS.output.maxLength} characters`);
  }

  // Validate description (optional)
  if (testcase.description !== undefined) {
    if (typeof testcase.description !== 'string') {
      errors.push(`${prefix}: description must be a string`);
    } else if (testcase.description.length > TESTCASE_CONSTRAINTS.description.maxLength) {
      errors.push(`${prefix}: description exceeds maximum length of ${TESTCASE_CONSTRAINTS.description.maxLength} characters`);
    }
  }

  // Validate isHidden (optional)
  if (testcase.isHidden !== undefined && typeof testcase.isHidden !== 'boolean') {
    errors.push(`${prefix}: isHidden must be a boolean`);
  }

  // Check for JSON compatibility (warn if looks like JSON but fails)
  if (testcase.output && testcase.output.trim().startsWith('{')) {
    try {
      JSON.parse(testcase.output);
    } catch (e) {
      logger.debug({ output: testcase.output.substring(0, 50) }, 'Output looks like JSON but failed parsing');
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate an array of test cases with comprehensive checks
 * @param {Array} testcases - Array of test cases
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
const validateTestcasesArray = (testcases) => {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(testcases)) {
    errors.push('Test cases must be an array');
    return { valid: false, errors, warnings };
  }

  if (testcases.length === 0) {
    errors.push('At least one test case is required');
    return { valid: false, errors, warnings };
  }

  if (testcases.length > 100) {
    warnings.push(`Large number of test cases (${testcases.length}). Consider reducing for performance.`);
  }

  // Track input/output pairs for uniqueness
  const seenPairs = new Set();

  for (let i = 0; i < testcases.length; i++) {
    const result = validateTestcaseStructure(testcases[i], i);
    if (!result.valid) {
      errors.push(...result.errors);
    }

    // Check for duplicate input/output pairs
    const pairKey = `${testcases[i].input}|||${testcases[i].output}`;
    if (seenPairs.has(pairKey)) {
      warnings.push(`Test case ${i + 1}: Duplicate input/output pair detected`);
    }
    seenPairs.add(pairKey);
  }

  // Check for at least one visible test case
  const visibleCount = testcases.filter(tc => !tc.isHidden).length;
  if (visibleCount === 0) {
    warnings.push('No visible test cases - all test cases are hidden');
  }

  return { valid: errors.length === 0, errors, warnings };
};

/**
 * Detect test case format (named parameters or simple)
 * @param {Object} testcase - Test case to validate
 * @returns {Object} { valid: boolean, type: string }
 */
const detectTestcaseFormat = (testcase) => {
  if (testcase.params !== undefined || testcase.args !== undefined || testcase.stdin !== undefined) {
    return { valid: true, type: 'named' };
  }
  if (testcase.input !== undefined && testcase.output !== undefined) {
    return { valid: true, type: 'simple' };
  }
  return { valid: false, type: 'unknown' };
};

/**
 * Convert test case to standardized format
 * @param {Object} testcase - Test case in any format
 * @returns {Object} Standardized test case
 */
const standardizeTestcaseFormat = (testcase) => {
  const standardized = {
    input: '',
    output: '',
    isHidden: Boolean(testcase.isHidden),
    description: testcase.description || ''
  };

  // Handle named parameter format
  if (testcase.params) {
    standardized.input = Array.isArray(testcase.params) ? testcase.params.join(', ') : String(testcase.params);
  } else if (testcase.args) {
    standardized.input = Array.isArray(testcase.args) ? testcase.args.join(', ') : String(testcase.args);
  } else if (testcase.stdin) {
    standardized.input = testcase.stdin;
  } else if (testcase.input) {
    standardized.input = testcase.input;
  }

  // Handle output
  if (testcase.expected !== undefined) {
    standardized.output = String(testcase.expected);
  } else if (testcase.stdout) {
    standardized.output = testcase.stdout;
  } else if (testcase.output) {
    standardized.output = testcase.output;
  }

  return standardized;
};

/**
 * Test case validation middleware for routes
 */
const testCaseValidationMiddleware = (req, res, next) => {
  const { testcases } = req.body;

  if (!testcases) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Test cases are required'
    });
  }

  const validation = validateTestcasesArray(testcases);

  if (!validation.valid) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Test case validation failed',
      errors: validation.errors
    });
  }

  // Add warnings to request for logging
  if (validation.warnings.length > 0) {
    logger.warn({ warnings: validation.warnings }, 'Test case validation warnings');
    req.testCaseWarnings = validation.warnings;
  }

  // Standardize test cases
  req.body.testcases = testcases.map(standardizeTestcaseFormat);

  next();
};

// ============================================================================
// TEST CASE STATISTICS AND ANALYTICS
// ============================================================================

/**
 * Calculate test case coverage statistics
 * @param {Array} testcases - Array of test cases
 * @returns {Object} Coverage statistics
 */
const calculateTestCaseCoverage = (testcases) => {
  if (!testcases || testcases.length === 0) {
    return { total: 0, visible: 0, hidden: 0, coveragePercentage: 0 };
  }

  const total = testcases.length;
  const visible = testcases.filter(tc => !tc.isHidden).length;
  const hidden = testcases.filter(tc => tc.isHidden).length;

  return {
    total,
    visible,
    hidden,
    coveragePercentage: Math.round((visible / total) * 100)
  };
};

/**
 * Analyze test case difficulty distribution
 * @param {Array} testcases - Array of test cases
 * @returns {Object} Difficulty distribution based on input complexity
 */
const analyzeTestCaseDifficulty = (testcases) => {
  return {
    simple: testcases.filter(tc => (tc.input || '').length < 20).length,
    medium: testcases.filter(tc => {
      const len = (tc.input || '').length;
      return len >= 20 && len < 100;
    }).length,
    complex: testcases.filter(tc => (tc.input || '').length >= 100).length
  };
};

/**
 * Generate test case quality score
 * @param {Array} testcases - Array of test cases
 * @returns {Object} Quality metrics
 */
const calculateTestCaseQuality = (testcases) => {
  if (!testcases || testcases.length === 0) {
    return {
      score: 0,
      hasVisible: false,
      hasHidden: false,
      hasDescriptions: false,
      hasUniquePairs: false
    };
  }

  const coverage = calculateTestCaseCoverage(testcases);
  const uniquePairs = new Set(testcases.map(tc => `${tc.input}|||${tc.output}`));
  const hasUniquePairs = uniquePairs.size === testcases.length;
  const hasDescriptions = testcases.some(tc => tc.description && tc.description.length > 0);

  let score = 0;
  if (testcases.length >= 3) score += 25;
  if (coverage.hidden > 0) score += 25;
  if (hasDescriptions) score += 25;
  if (hasUniquePairs) score += 25;

  return {
    score,
    hasVisible: coverage.visible > 0,
    hasHidden: coverage.hidden > 0,
    hasDescriptions,
    hasUniquePairs,
    uniquePairCount: uniquePairs.size,
    totalCount: testcases.length
  };
};

/**
 * Get test case statistics for a question
 * GET /api/v1/questions/:questionId/test-cases/stats
 */
const getTestCaseStats = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findOne({ id: questionId })
      .select('testcases title')
      .lean();

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    const testcases = question.testcases || [];
    const coverage = calculateTestCaseCoverage(testcases);
    const difficulty = analyzeTestCaseDifficulty(testcases);
    const quality = calculateTestCaseQuality(testcases);

    // Calculate average input/output length
    const avgInputLength = testcases.length > 0
      ? Math.round(testcases.reduce((sum, tc) => sum + (tc.input?.length || 0), 0) / testcases.length)
      : 0;
    const avgOutputLength = testcases.length > 0
      ? Math.round(testcases.reduce((sum, tc) => sum + (tc.output?.length || 0), 0) / testcases.length)
      : 0;

    res.json({
      success: true,
      data: {
        questionId,
        questionTitle: question.title,
        coverage,
        difficultyDistribution: difficulty,
        quality,
        averageLengths: {
          input: avgInputLength,
          output: avgOutputLength
        }
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get test case stats');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get test case statistics',
      error: error.message
    });
  }
};

// ============================================================================
// TEST CASE MAINTENANCE UTILITIES
// ============================================================================

/**
 * Clean up invalid or duplicate test cases
 * @param {Array} testcases - Array of test cases
 * @returns {Object} { cleaned: Array, removed: number, reason: string }
 */
const cleanupTestCases = (testcases) => {
  if (!Array.isArray(testcases)) {
    return { cleaned: [], removed: 0, reason: 'Not an array' };
  }

  const seen = new Set();
  const cleaned = [];
  let removed = 0;

  for (const tc of testcases) {
    // Skip invalid test cases
    if (!tc.input || !tc.output) {
      removed++;
      continue;
    }

    // Skip duplicates
    const pairKey = `${tc.input}|||${tc.output}`;
    if (seen.has(pairKey)) {
      removed++;
      continue;
    }

    seen.add(pairKey);
    cleaned.push({
      input: String(tc.input),
      output: String(tc.output),
      isHidden: Boolean(tc.isHidden),
      description: tc.description ? String(tc.description).substring(0, 500) : ''
    });
  }

  return {
    cleaned,
    removed,
    reason: removed > 0 ? `Removed ${removed} invalid or duplicate test cases` : 'No cleanup needed'
  };
};

/**
 * Standardize test case format for consistency
 * @param {Array} testcases - Array of test cases
 * @returns {Array} Standardized test cases
 */
const standardizeTestCases = (testcases) => {
  if (!Array.isArray(testcases)) return [];
  
  return testcases.map(tc => ({
    input: String(tc.input || '').slice(0, TESTCASE_CONSTRAINTS.input.maxLength),
    output: String(tc.output || '').slice(0, TESTCASE_CONSTRAINTS.output.maxLength),
    isHidden: Boolean(tc.isHidden),
    description: tc.description ? String(tc.description).slice(0, TESTCASE_CONSTRAINTS.description.maxLength) : ''
  }));
};

// ============================================================================
// TEST CASE SECURITY MEASURES
// ============================================================================

/**
 * Sanitize test case input to prevent injection
 * @param {string} input - Raw input
 * @returns {string} Sanitized input
 */
const sanitizeTestCaseInput = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, TESTCASE_CONSTRAINTS.input.maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Remove control characters
};

/**
 * Rate limiter for test case operations (simple in-memory implementation)
 */
const testCaseOperationTracker = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max operations per window

const checkTestCaseRateLimit = (userId) => {
  if (!userId) return true; // No rate limit for unauthenticated
  
  const now = Date.now();
  const key = `tc_rate_${userId}`;
  
  if (!testCaseOperationTracker.has(key)) {
    testCaseOperationTracker.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const tracker = testCaseOperationTracker.get(key);
  
  if (now > tracker.resetAt) {
    tracker.count = 1;
    tracker.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  if (tracker.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  tracker.count++;
  return true;
};

// Cleanup old rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of testCaseOperationTracker.entries()) {
      if (now > value.resetAt) {
        testCaseOperationTracker.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW);
}

// ============================================================================
// TEST CASE RETRIEVAL OPTIMIZATIONS
// ============================================================================

/**
 * Format test case for API response with filtering
 * @param {Object} testcase - Test case
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted test case
 */
const formatTestCaseResponse = (testcase, options = {}) => {
  const { includeHidden = false, includeOutput = false, maxLength = null } = options;
  
  if (!includeHidden && testcase.isHidden) {
    return { input: testcase.input, isHidden: true };
  }

  const result = {
    input: maxLength ? testcase.input?.slice(0, maxLength) : testcase.input,
    isHidden: testcase.isHidden || false,
    description: testcase.description || ''
  };

  if (includeOutput) {
    result.output = maxLength ? testcase.output?.slice(0, maxLength) : testcase.output;
  }

  return result;
};

/**
 * Get paginated test cases
 * @param {Array} testcases - All test cases
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} Paginated test cases
 */
const paginateTestCases = (testcases, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const total = testcases.length;
  const pages = Math.ceil(total / limit);
  
  return {
    testcases: testcases.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1
    }
  };
};

/**
 * Filter test cases by various criteria
 * @param {Array} testcases - All test cases
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered test cases
 */
const filterTestCases = (testcases, filters = {}) => {
  let filtered = [...testcases];
  
  if (filters.isHidden !== undefined) {
    filtered = filtered.filter(tc => tc.isHidden === filters.isHidden);
  }
  
  if (filters.minInputLength !== undefined) {
    filtered = filtered.filter(tc => (tc.input?.length || 0) >= filters.minInputLength);
  }
  
  if (filters.maxInputLength !== undefined) {
    filtered = filtered.filter(tc => (tc.input?.length || 0) <= filters.maxInputLength);
  }
  
  if (filters.hasDescription !== undefined) {
    filtered = filtered.filter(tc => 
      filters.hasDescription ? Boolean(tc.description) : !tc.description
    );
  }
  
  return filtered;
};

// ============================================================================
// ENHANCED SEED QUESTIONS WITH VALIDATION
// ============================================================================

/**
 * Enhanced sample debug questions with comprehensive test cases
 * Each question now includes hidden test cases for better evaluation
 */
const enhancedSampleQuestions = [
  // Easy
  {
    mode: 'debug',
    title: 'Fix the Sum Function',
    description: 'There\'s a bug in this simple addition function. Find and fix it!',
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function sum(a, b) {
  return a + b + 1; // Bug: extra +1
}`,
    solution: `function sum(a, b) {
  return a + b;
}`,
    testcases: [
      { input: 'sum(1, 2)', output: '3', isHidden: false, description: 'Basic positive numbers' },
      { input: 'sum(5, 5)', output: '10', isHidden: false, description: 'Equal positive numbers' },
      { input: 'sum(-1, 1)', output: '0', isHidden: false, description: 'Negative and positive' },
      { input: 'sum(0, 0)', output: '0', isHidden: true, description: 'Zero values' },
      { input: 'sum(100, 200)', output: '300', isHidden: true, description: 'Larger numbers' }
    ],
    hints: ['Check the return statement carefully', 'Is there an extra operation?'],
    tags: ['basics', 'functions'],
    timeLimit: 120000,
    memoryLimit: 128
  },
  // Medium 1
  {
    mode: 'debug',
    title: 'Fix Array Filtering',
    description: 'This function should filter even numbers from an array, but it\'s not working correctly.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 1); // Bug: checking odd instead of even
}`,
    solution: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 0);
}`,
    testcases: [
      { input: 'filterEven([1, 2, 3, 4, 5, 6])', output: '[2, 4, 6]', isHidden: false, description: 'Mixed array' },
      { input: 'filterEven([2, 4, 6])', output: '[2, 4, 6]', isHidden: false, description: 'All even' },
      { input: 'filterEven([1, 3, 5])', output: '[]', isHidden: false, description: 'All odd' },
      { input: 'filterEven([])', output: '[]', isHidden: true, description: 'Empty array' },
      { input: 'filterEven([0, 2, 4])', output: '[0, 2, 4]', isHidden: true, description: 'Zero included' }
    ],
    hints: ['Check the modulo condition', 'Should the remainder be 0 or 1 for even numbers?'],
    tags: ['arrays', 'filtering'],
    timeLimit: 180000,
    memoryLimit: 128
  },
  // Medium 2
  {
    mode: 'debug',
    title: 'Fix Palindrome Check',
    description: 'This function should check if a string is a palindrome, but it has a bug.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function isPalindrome(str) {
  const reversed = str.split('').reverse();
  return str === reversed; // Bug: comparing string to array
}`,
    solution: `function isPalindrome(str) {
  const reversed = str.split('').reverse().join('');
  return str === reversed;
}`,
    testcases: [
      { input: "isPalindrome('radar')", output: 'true', isHidden: false, description: 'Simple palindrome' },
      { input: "isPalindrome('hello')", output: 'false', isHidden: false, description: 'Non-palindrome' },
      { input: "isPalindrome('a')", output: 'true', isHidden: false, description: 'Single character' },
      { input: "isPalindrome('racecar')", output: 'true', isHidden: true, description: 'Classic palindrome' },
      { input: "isPalindrome('')", output: 'true', isHidden: true, description: 'Empty string' }
    ],
    hints: ['Check what type split() returns', 'Do you need to convert it back?'],
    tags: ['strings', 'algorithms'],
    timeLimit: 180000,
    memoryLimit: 128
  },
  // Hard 1
  {
    mode: 'debug',
    title: 'Fix Recursive Fibonacci',
    description: 'This recursive Fibonacci implementation is too slow for larger numbers. Fix the performance issue.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2); // Bug: exponential time complexity
}`,
    solution: `function fibonacci(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}`,
    testcases: [
      { input: 'fibonacci(5)', output: '5', isHidden: false, description: 'Small number' },
      { input: 'fibonacci(10)', output: '55', isHidden: false, description: 'Medium number' },
      { input: 'fibonacci(20)', output: '6765', isHidden: false, description: 'Larger number' },
      { input: 'fibonacci(0)', output: '0', isHidden: true, description: 'Zero edge case' },
      { input: 'fibonacci(1)', output: '1', isHidden: true, description: 'One edge case' },
      { input: 'fibonacci(30)', output: '832040', isHidden: true, description: 'Large number' }
    ],
    hints: ['The function recalculates the same values many times', 'Can you store and reuse results?'],
    tags: ['recursion', 'memoization', 'algorithms'],
    timeLimit: 300000,
    memoryLimit: 256
  },
  // Hard 2
  {
    mode: 'debug',
    title: 'Fix Deep Clone',
    description: 'This deep clone function has issues with circular references and certain data types.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const cloned = {};
  for (let key in obj) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned; // Bug: no circular reference handling
}`,
    solution: `function deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (Array.isArray(obj)) {
    const cloned = [];
    seen.set(obj, cloned);
    obj.forEach((item, i) => {
      cloned[i] = deepClone(item, seen);
    });
    return cloned;
  }
  const cloned = {};
  seen.set(obj, cloned);
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key], seen);
    }
  }
  return cloned;
}`,
    testcases: [
      { input: 'deepClone({a: 1, b: {c: 2}})', output: '{a: 1, b: {c: 2}}', isHidden: false, description: 'Nested object' },
      { input: 'deepClone([1, [2, 3]])', output: '[1, [2, 3]]', isHidden: false, description: 'Nested array' },
      { input: 'deepClone({x: 1})', output: '{x: 1}', isHidden: false, description: 'Simple object' },
      { input: 'deepClone(null)', output: 'null', isHidden: true, description: 'Null value' },
      { input: 'deepClone(42)', output: '42', isHidden: true, description: 'Primitive number' }
    ],
    hints: ['What happens with circular references?', 'Consider using a WeakMap to track seen objects'],
    tags: ['objects', 'recursion', 'advanced'],
    timeLimit: 300000,
    memoryLimit: 256
  }
];

/**
 * Enhanced seed questions with validation and cleanup
 * POST /api/v1/questions/seed-enhanced
 */
const seedQuestionsEnhanced = async (req, res) => {
  try {
    // Delete existing debug questions
    await Question.deleteMany({ mode: 'debug' });

    // Validate and clean each question's test cases
    const validatedQuestions = enhancedSampleQuestions.map(q => {
      const validation = validateTestcasesArray(q.testcases);
      
      if (!validation.valid) {
        logger.warn({ 
          question: q.title, 
          errors: validation.errors 
        }, 'Question has invalid test cases during seeding');
      }

      // Clean and standardize test cases
      const cleaned = cleanupTestCases(q.testcases);
      
      return {
        ...q,
        testcases: cleaned.cleaned,
        testCaseCleanup: { removed: cleaned.removed, reason: cleaned.reason }
      };
    });

    // Insert validated questions
    const questions = await Question.insertMany(validatedQuestions);

    // Log seeding results
    logger.info({ 
      count: questions.length,
      questions: questions.map(q => ({ id: q.id, title: q.title, testcases: q.testcases.length }))
    }, 'Questions seeded successfully');

    res.json({
      success: true,
      message: `Successfully seeded ${questions.length} debug questions with validated test cases`,
      data: {
        count: questions.length,
        questions: questions.map(q => ({ 
          id: q.id, 
          title: q.title, 
          difficulty: q.difficulty,
          testcases: {
            total: q.testcases.length,
            visible: q.testcases.filter(tc => !tc.isHidden).length,
            hidden: q.testcases.filter(tc => tc.isHidden).length
          }
        }))
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to seed questions');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to seed questions',
      error: error.message
    });
  }
};

/**
 * Get all test cases for a question with filtering and pagination
 * GET /api/v1/questions/:questionId/test-cases
 */
const getQuestions = async (req, res) => {
  try {
    const {
      mode = 'debug',
      difficulty,
      language,
      search,
      isActive = 'true',
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Mode filter
    if (mode) filter.mode = mode;

    // Difficulty filter
    if (difficulty) filter.difficulty = difficulty;

    // Language filter
    if (language) filter.language = language;

    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Search by title or description
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ difficulty: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-solution -hints') // Don't send solution/hints in list view
        .lean(),
      Question.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: questions,
      meta: {
        total,
        page: pageNum,
        pages,
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};

/**
 * Get question by ID
 * GET /api/v1/questions/:id
 */
const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findOne({ id })
      .populate('author', 'username');

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch question',
      error: error.message
    });
  }
};

/**
 * Create a new question
 * POST /api/v1/questions
 */
const createQuestion = async (req, res) => {
  try {
    const {
      mode = 'debug',
      title,
      description,
      language,
      difficulty,
      starterCode,
      solution,
      testcases,
      hints = [],
      timeLimit = 300000,
      memoryLimit = 256,
      tags = []
    } = req.body;

    // Validate required fields
    const requiredFields = ['title', 'description', 'language', 'difficulty', 'starterCode', 'solution', 'testcases'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate language
    const validLanguages = ['python', 'javascript', 'java', 'cpp', 'csharp', 'ruby', 'rust'];
    if (!validLanguages.includes(language)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Invalid language. Must be one of: ${validLanguages.join(', ')}`
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard', 'extreme'];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`
      });
    }

    // Validate testcases
    if (!Array.isArray(testcases) || testcases.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'At least one test case is required'
      });
    }

    // Validate each testcase
    for (const tc of testcases) {
      if (!tc.input || !tc.output) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Each test case must have input and output'
        });
      }
    }

    const question = await Question.create({
      mode,
      title,
      description,
      language,
      difficulty,
      starterCode,
      solution,
      testcases,
      hints,
      timeLimit,
      memoryLimit,
      tags,
      author: req.user?._id || null,
      isActive: true
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Question created successfully',
      data: question
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create question',
      error: error.message
    });
  }
};

/**
 * Sample debug questions for seeding
 */
const sampleQuestions = [
  // Easy
  {
    mode: 'debug',
    title: 'Fix the Sum Function',
    description: 'There\'s a bug in this simple addition function. Find and fix it!',
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function sum(a, b) {
  return a + b + 1; // Bug: extra +1
}`,
    solution: `function sum(a, b) {
  return a + b;
}`,
    testcases: [
      { input: 'sum(1, 2)', output: '3' },
      { input: 'sum(5, 5)', output: '10' },
      { input: 'sum(-1, 1)', output: '0' }
    ],
    hints: ['Check the return statement carefully', 'Is there an extra operation?'],
    tags: ['basics', 'functions'],
    timeLimit: 120000, // 2 minutes
    memoryLimit: 128
  },
  // Medium 1
  {
    mode: 'debug',
    title: 'Fix Array Filtering',
    description: 'This function should filter even numbers from an array, but it\'s not working correctly.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 1); // Bug: checking odd instead of even
}`,
    solution: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 0);
}`,
    testcases: [
      { input: 'filterEven([1, 2, 3, 4, 5, 6])', output: '[2, 4, 6]' },
      { input: 'filterEven([2, 4, 6])', output: '[2, 4, 6]' },
      { input: 'filterEven([1, 3, 5])', output: '[]' }
    ],
    hints: ['Check the modulo condition', 'Should the remainder be 0 or 1 for even numbers?'],
    tags: ['arrays', 'filtering'],
    timeLimit: 180000, // 3 minutes
    memoryLimit: 128
  },
  // Medium 2
  {
    mode: 'debug',
    title: 'Fix Palindrome Check',
    description: 'This function should check if a string is a palindrome, but it has a bug.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function isPalindrome(str) {
  const reversed = str.split('').reverse();
  return str === reversed; // Bug: comparing string to array
}`,
    solution: `function isPalindrome(str) {
  const reversed = str.split('').reverse().join('');
  return str === reversed;
}`,
    testcases: [
      { input: "isPalindrome('radar')", output: 'true' },
      { input: "isPalindrome('hello')", output: 'false' },
      { input: "isPalindrome('a')", output: 'true' }
    ],
    hints: ['Check what type split() returns', 'Do you need to convert it back?'],
    tags: ['strings', 'algorithms'],
    timeLimit: 180000, // 3 minutes
    memoryLimit: 128
  },
  // Hard 1
  {
    mode: 'debug',
    title: 'Fix Recursive Fibonacci',
    description: 'This recursive Fibonacci implementation is too slow for larger numbers. Fix the performance issue.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2); // Bug: exponential time complexity
}`,
    solution: `function fibonacci(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}`,
    testcases: [
      { input: 'fibonacci(5)', output: '5' },
      { input: 'fibonacci(10)', output: '55' },
      { input: 'fibonacci(20)', output: '6765' }
    ],
    hints: ['The function recalculates the same values many times', 'Can you store and reuse results?'],
    tags: ['recursion', 'memoization', 'algorithms'],
    timeLimit: 300000, // 5 minutes
    memoryLimit: 256
  },
  // Hard 2
  {
    mode: 'debug',
    title: 'Fix Deep Clone',
    description: 'This deep clone function has issues with circular references and certain data types.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const cloned = {};
  for (let key in obj) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned; // Bug: no circular reference handling
}`,
    solution: `function deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (Array.isArray(obj)) {
    const cloned = [];
    seen.set(obj, cloned);
    obj.forEach((item, i) => {
      cloned[i] = deepClone(item, seen);
    });
    return cloned;
  }
  const cloned = {};
  seen.set(obj, cloned);
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key], seen);
    }
  }
  return cloned;
}`,
    testcases: [
      { input: 'deepClone({a: 1, b: {c: 2}})', output: '{a: 1, b: {c: 2}}' },
      { input: 'deepClone([1, [2, 3]])', output: '[1, [2, 3]]' },
      { input: 'deepClone({x: 1})', output: '{x: 1}' }
    ],
    hints: ['What happens with circular references?', 'Consider using a WeakMap to track seen objects'],
    tags: ['objects', 'recursion', 'advanced'],
    timeLimit: 300000, // 5 minutes
    memoryLimit: 256
  }
];

/**
 * Seed questions with sample data
 * POST /api/v1/questions/seed
 */
const seedQuestions = async (req, res) => {
  try {
    // Delete existing debug questions
    await Question.deleteMany({ mode: 'debug' });

    // Insert sample questions
    const questions = await Question.insertMany(sampleQuestions);

    res.json({
      success: true,
      message: `Successfully seeded ${questions.length} debug questions`,
      data: {
        count: questions.length,
        questions: questions.map(q => ({ id: q.id, title: q.title, difficulty: q.difficulty }))
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to seed questions',
      error: error.message
    });
  }
};

/**
 * Get all test cases for a question (seeded + custom)
 * GET /api/v1/questions/:questionId/test-cases
 */
const getTestCases = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user?._id;

    const question = await Question.findOne({ id: questionId })
      .select('testcases customTestcases')
      .lean();

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Separate seeded and custom test cases
    const seededTestcases = question.testcases || [];
    const customTestcases = (question.customTestcases || []).map(tc => ({
      ...tc,
      isCustom: true,
      _id: tc._id.toString(),
      canEdit: userId && tc.userId.toString() === userId.toString(),
      canDelete: userId && tc.userId.toString() === userId.toString()
    }));

    res.json({
      success: true,
      data: {
        seeded: seededTestcases,
        custom: customTestcases,
        totalSeeded: seededTestcases.length,
        totalCustom: customTestcases.length
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch test cases',
      error: error.message
    });
  }
};

/**
 * Add custom test case to a question
 * POST /api/v1/questions/:questionId/test-cases
 */
const addCustomTestcase = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { input, output, isHidden = false, description = '' } = req.body;

    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required to add custom test cases'
      });
    }

    // Validate required fields
    if (!input || input.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Test case input is required'
      });
    }

    if (!output || output.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Test case output is required'
      });
    }

    // Validate input/output length
    if (input.length > 5000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Input cannot exceed 5000 characters'
      });
    }

    if (output.length > 5000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Output cannot exceed 5000 characters'
      });
    }

    if (description.length > 500) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Description cannot exceed 500 characters'
      });
    }

    const question = await Question.findOne({ id: questionId });

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Create custom test case
    const customTestcase = {
      userId: req.user._id,
      input: input.trim(),
      output: output.trim(),
      isHidden: Boolean(isHidden),
      description: description.trim()
    };

    // Add to customTestcases array
    if (!question.customTestcases) {
      question.customTestcases = [];
    }
    question.customTestcases.push(customTestcase);
    await question.save();

    // Return the newly created test case
    const created = question.customTestcases[question.customTestcases.length - 1];

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Custom test case added successfully',
      data: {
        ...created.toObject(),
        isCustom: true,
        _id: created._id.toString(),
        canEdit: true,
        canDelete: true
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add custom test case',
      error: error.message
    });
  }
};

/**
 * Update custom test case
 * PUT /api/v1/questions/:questionId/test-cases/:testcaseId
 */
const updateCustomTestcase = async (req, res) => {
  try {
    const { questionId, testcaseId } = req.params;
    const { input, output, isHidden, description } = req.body;

    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required to update custom test cases'
      });
    }

    const question = await Question.findOne({ id: questionId });

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Find custom test case
    const testcaseIndex = question.customTestcases.findIndex(
      tc => tc._id.toString() === testcaseId
    );

    if (testcaseIndex === -1) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Custom test case not found'
      });
    }

    // Verify ownership
    const testcase = question.customTestcases[testcaseIndex];
    if (testcase.userId.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'You can only edit your own test cases'
      });
    }

    // Validate and update fields
    if (input !== undefined) {
      if (input.trim() === '') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Test case input cannot be empty'
        });
      }
      if (input.length > 5000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Input cannot exceed 5000 characters'
        });
      }
      question.customTestcases[testcaseIndex].input = input.trim();
    }

    if (output !== undefined) {
      if (output.trim() === '') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Test case output cannot be empty'
        });
      }
      if (output.length > 5000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Output cannot exceed 5000 characters'
        });
      }
      question.customTestcases[testcaseIndex].output = output.trim();
    }

    if (isHidden !== undefined) {
      question.customTestcases[testcaseIndex].isHidden = Boolean(isHidden);
    }

    if (description !== undefined) {
      if (description.length > 500) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Description cannot exceed 500 characters'
        });
      }
      question.customTestcases[testcaseIndex].description = description.trim();
    }

    await question.save();

    res.json({
      success: true,
      message: 'Custom test case updated successfully',
      data: {
        ...question.customTestcases[testcaseIndex].toObject(),
        isCustom: true,
        _id: question.customTestcases[testcaseIndex]._id.toString(),
        canEdit: true,
        canDelete: true
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update custom test case',
      error: error.message
    });
  }
};

/**
 * Delete custom test case
 * DELETE /api/v1/questions/:questionId/test-cases/:testcaseId
 */
const deleteCustomTestcase = async (req, res) => {
  try {
    const { questionId, testcaseId } = req.params;

    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required to delete custom test cases'
      });
    }

    const question = await Question.findOne({ id: questionId });

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Find custom test case
    const testcaseIndex = question.customTestcases.findIndex(
      tc => tc._id.toString() === testcaseId
    );

    if (testcaseIndex === -1) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Custom test case not found'
      });
    }

    // Verify ownership
    const testcase = question.customTestcases[testcaseIndex];
    if (testcase.userId.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'You can only delete your own test cases'
      });
    }

    // Remove test case
    question.customTestcases.splice(testcaseIndex, 1);
    await question.save();

    res.json({
      success: true,
      message: 'Custom test case deleted successfully'
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete custom test case',
      error: error.message
    });
  }
};

/**
 * Validate test case format
 * POST /api/v1/test-cases/validate
 */
const validateTestcase = async (req, res) => {
  try {
    const { input, output } = req.body;

    const errors = [];

    // Validate input
    if (!input || input.trim() === '') {
      errors.push({ field: 'input', message: 'Input is required' });
    } else if (input.length > 5000) {
      errors.push({ field: 'input', message: 'Input cannot exceed 5000 characters' });
    }

    // Validate output
    if (!output || output.trim() === '') {
      errors.push({ field: 'output', message: 'Output is required' });
    } else if (output.length > 5000) {
      errors.push({ field: 'output', message: 'Output cannot exceed 5000 characters' });
    }

    // Try to parse as JSON to check validity (if it's meant to be JSON)
    try {
      if (input.trim()) {
        JSON.parse(input.trim());
      }
    } catch (e) {
      // Not JSON, that's okay for simple string inputs
    }

    try {
      if (output.trim()) {
        JSON.parse(output.trim());
      }
    } catch (e) {
      // Not JSON, that's okay for simple string outputs
    }

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to validate test case',
      error: error.message
    });
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  seedQuestions,
  seedQuestionsEnhanced,
  getTestCases,
  getTestCaseStats,
  addCustomTestcase,
  updateCustomTestcase,
  deleteCustomTestcase,
  validateTestcase,
  // Export utilities for external use
  validateTestcasesArray,
  calculateTestCaseCoverage,
  calculateTestCaseQuality,
  cleanupTestCases,
  standardizeTestCases,
  formatTestCaseResponse,
  filterTestCases,
  paginateTestCases,
  testCaseValidationMiddleware,
  checkTestCaseRateLimit
};
