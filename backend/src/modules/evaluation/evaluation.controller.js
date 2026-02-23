/**
 * Evaluation Controller
 * Handles testcase evaluation logic for code submissions
 * Enhanced with retry logic, timeout handling, memory limits, and robust error handling
 */

const { Question } = require('../questions/question.model.js');
const { executeCode, runTestCases, calculateComplexity } = require('../../services/execution.service.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { AppError } = require('../../utils/helpers.js');
const { logger } = require('../../utils/logger.js');

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const EVALUATION_CONFIG = {
  // Retry configuration
  retry: {
    maxAttempts: 3,
    baseDelay: 100, // ms
    maxDelay: 2000, // ms
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNRESET',
      'timeout',
      'temporary failure'
    ]
  },
  // Timeout configuration (ms)
  timeout: {
    default: 5000,
    longRunning: 10000,
    perTestCase: 3000
  },
  // Memory limits (MB)
  memory: {
    maxAllowed: 512,
    warningThreshold: 256,
    criticalThreshold: 384
  },
  // Parallel execution
  parallel: {
    maxConcurrent: 4,
    enabled: true
  },
  // Result comparison tolerance
  comparison: {
    floatTolerance: 1e-6,
    whitespaceSensitive: false
  }
};

// ============================================================================
// EXECUTION STATISTICS TRACKING
// ============================================================================

const executionStats = {
  totalEvaluations: 0,
  successfulEvaluations: 0,
  failedEvaluations: 0,
  totalTestCases: 0,
  averageExecutionTime: 0,
  retryCount: 0,
  cacheHits: 0,
  lastReset: Date.now()
};

// In-memory execution cache (simple implementation)
const executionCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key for execution
 */
const generateCacheKey = (language, code, input) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5')
    .update(`${language}:${code}:${input}`)
    .digest('hex');
  return hash.substring(0, 16);
};

/**
 * Get cached execution result
 */
const getCachedResult = (key) => {
  const cached = executionCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    executionStats.cacheHits++;
    return cached.result;
  }
  executionCache.delete(key);
  return null;
};

/**
 * Cache execution result
 */
const cacheResult = (key, result) => {
  // Cleanup old entries if cache is full
  if (executionCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = executionCache.keys().next().value;
    executionCache.delete(oldestKey);
  }
  executionCache.set(key, {
    result,
    timestamp: Date.now()
  });
};

// ============================================================================
// RETRY LOGIC AND ERROR HANDLING
// ============================================================================

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const calculateBackoffDelay = (attempt, baseDelay, maxDelay, multiplier) => {
  const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

/**
 * Determine if error is retryable
 */
const isRetryableError = (error) => {
  const errorMessage = String(error.message || error).toLowerCase();
  return EVALUATION_CONFIG.retry.retryableErrors.some(
    retryable => errorMessage.includes(retryable.toLowerCase())
  );
};

/**
 * Execute with retry logic
 */
const executeWithRetry = async (fn, options = {}) => {
  const {
    maxAttempts = EVALUATION_CONFIG.retry.maxAttempts,
    baseDelay = EVALUATION_CONFIG.retry.baseDelay,
    maxDelay = EVALUATION_CONFIG.retry.maxDelay,
    multiplier = EVALUATION_CONFIG.retry.backoffMultiplier,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      executionStats.retryCount++;

      // Don't retry on non-retryable errors
      if (!isRetryableError(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay, multiplier);

      logger.warn({
        attempt: attempt + 1,
        maxAttempts,
        delay,
        error: error.message
      }, 'Retrying after failure');

      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

// ============================================================================
// TIMEOUT HANDLING
// ============================================================================

/**
 * Execute with timeout
 */
const executeWithTimeout = async (promise, timeoutMs, errorMessage = 'Execution timeout') => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AppError(errorMessage, HTTP_STATUS.REQUEST_TIMEOUT));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// ============================================================================
// MEMORY LIMIT ENFORCEMENT
// ============================================================================

/**
 * Parse memory from execution result
 */
const parseMemory = (memoryString) => {
  if (!memoryString) return 0;
  const match = memoryString.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

/**
 * Check memory limit
 */
const checkMemoryLimit = (memoryMB, limits = EVALUATION_CONFIG.memory) => {
  if (memoryMB > limits.criticalThreshold) {
    return {
      allowed: false,
      level: 'critical',
      message: `Memory usage (${memoryMB}MB) exceeds critical threshold (${limits.criticalThreshold}MB)`
    };
  }
  if (memoryMB > limits.warningThreshold) {
    return {
      allowed: true,
      level: 'warning',
      message: `Memory usage (${memoryMB}MB) exceeds warning threshold (${limits.warningThreshold}MB)`
    };
  }
  return { allowed: true, level: 'ok', message: null };
};

// ============================================================================
// RESULT PROCESSING AND VALIDATION
// ============================================================================

/**
 * Normalize output for comparison
 */
const normalizeOutput = (output, options = {}) => {
  const { whitespaceSensitive = EVALUATION_CONFIG.comparison.whitespaceSensitive } = options;
  if (!output) return '';
  return whitespaceSensitive ? output : output.trim();
};

/**
 * Compare outputs with tolerance for floating-point
 */
const compareOutputs = (actual, expected, options = {}) => {
  const normalizedActual = normalizeOutput(actual, options);
  const normalizedExpected = normalizeOutput(expected, options);

  // Exact match
  if (normalizedActual === normalizedExpected) {
    return { passed: true, reason: 'exact match' };
  }

  // Try numeric comparison with tolerance
  const actualNum = parseFloat(normalizedActual);
  const expectedNum = parseFloat(normalizedExpected);

  if (!isNaN(actualNum) && !isNaN(expectedNum)) {
    const tolerance = options.floatTolerance || EVALUATION_CONFIG.comparison.floatTolerance;
    if (Math.abs(actualNum - expectedNum) <= tolerance) {
      return { passed: true, reason: 'numeric match within tolerance' };
    }
  }

  // Try JSON comparison
  try {
    const actualJson = JSON.parse(normalizedActual);
    const expectedJson = JSON.parse(normalizedExpected);
    if (JSON.stringify(actualJson) === JSON.stringify(expectedJson)) {
      return { passed: true, reason: 'JSON match' };
    }
  } catch (e) {
    // Not JSON, continue
  }

  return {
    passed: false,
    reason: normalizedActual !== normalizedExpected ? 'output mismatch' : 'format difference'
  };
};

/**
 * Validate execution result
 */
const validateExecutionResult = (result) => {
  const errors = [];

  if (!result) {
    errors.push('Execution result is null or undefined');
    return { valid: false, errors };
  }

  if (result.success === false && !result.error) {
    errors.push('Execution failed but no error message provided');
  }

  if (result.output === undefined) {
    errors.push('Execution result missing output property');
  }

  // Check for potential issues
  if (result.output && result.output.length > 100000) {
    logger.warn({ outputLength: result.output.length }, 'Unusually large output detected');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
};

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

/**
 * Categorize test case execution errors
 */
const categorizeError = (error, executionResult) => {
  const errorMessage = String(error.message || '').toLowerCase();

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return {
      category: 'timeout',
      severity: 'high',
      message: 'Test case execution exceeded time limit',
      recoverable: false
    };
  }

  // Memory errors
  if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
    return {
      category: 'memory',
      severity: 'critical',
      message: 'Test case exceeded memory limit',
      recoverable: false
    };
  }

  // Runtime errors in code
  if (executionResult?.error) {
    return {
      category: 'runtime',
      severity: 'medium',
      message: executionResult.error,
      recoverable: true,
      errorType: categorizeRuntimeError(executionResult.error)
    };
  }

  // Network/connection errors
  if (errorMessage.includes('connection') || errorMessage.includes('network')) {
    return {
      category: 'network',
      severity: 'high',
      message: 'Network or connection error during execution',
      recoverable: true
    };
  }

  // Unknown errors
  return {
    category: 'unknown',
    severity: 'medium',
    message: error.message || 'Unknown error occurred',
    recoverable: false
  }
};

/**
 * Categorize runtime errors
 */
const categorizeRuntimeError = (errorMessage) => {
  const msg = String(errorMessage).toLowerCase();

  if (msg.includes('referenceerror') || msg.includes('is not defined')) {
    return 'reference';
  }
  if (msg.includes('typeerror')) {
    return 'type';
  }
  if (msg.includes('syntaxerror')) {
    return 'syntax';
  }
  if (msg.includes('rangeerror')) {
    return 'range';
  }
  if (msg.includes('error')) {
    return 'generic';
  }
  return 'unknown';
};

// ============================================================================
// TEST CASE EXECUTION WITH RELIABILITY
// ============================================================================

/**
 * Execute a single test case with full reliability features
 */
const executeTestCaseReliably = async (testcase, index, language, code, options = {}) => {
  const {
    useCache = true,
    useRetry = true,
    timeout = EVALUATION_CONFIG.timeout.perTestCase,
    checkMemory = true
  } = options;

  const startTime = Date.now();

  // Generate cache key
  const cacheKey = useCache ? generateCacheKey(language, code, testcase.input) : null;

  // Check cache
  if (cacheKey) {
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      logger.debug({ testcaseIndex: index }, 'Using cached result');
      return {
        ...cachedResult,
        fromCache: true,
        executionTime: Date.now() - startTime
      };
    }
  }

  // Execute with retry if enabled
  const executeFn = async () => {
    return await executeWithTimeout(
      executeCode({
        language,
        code,
        input: testcase.input,
        timeout
      }),
      timeout + 1000, // Add buffer to timeout
      `Test case ${index + 1} execution timeout`
    );
  };

  let executionResult;
  if (useRetry) {
    executionResult = await executeWithRetry(executeFn, {
      onRetry: (attempt, error, delay) => {
        logger.warn({
          testcaseIndex: index,
          attempt,
          delay,
          error: error.message
        }, 'Retrying test case execution');
      }
    });
  } else {
    executionResult = await executeFn();
  }

  // Validate result
  const validation = validateExecutionResult(executionResult);
  if (!validation.valid) {
    logger.error({
      testcaseIndex: index,
      errors: validation.errors
    }, 'Invalid execution result');
  }

  // Check memory if enabled
  let memoryCheck = { allowed: true, level: 'ok', message: null };
  if (checkMemory) {
    const memoryMB = parseMemory(executionResult.memory);
    memoryCheck = checkMemoryLimit(memoryMB);
    if (!memoryCheck.allowed) {
      logger.error({
        testcaseIndex: index,
        memoryMB
      }, 'Memory limit exceeded');
    }
  }

  // Compare outputs
  const comparison = compareOutputs(
    executionResult.output,
    testcase.output,
    { floatTolerance: options.floatTolerance }
  );

  const timeMatch = executionResult.runtime?.match(/(\d+)/);
  const timeMS = timeMatch ? parseInt(timeMatch[1]) : Date.now() - startTime;

  const result = {
    passed: comparison.passed && !executionResult.error,
    input: testcase.input,
    expectedOutput: testcase.output,
    actual: executionResult.output || '',
    actualOutput: executionResult.output || '',
    error: executionResult.success ? null : (executionResult.error || null),
    runtime: executionResult.runtime,
    executionTime: timeMS,
    memory: executionResult.memory,
    memoryUsed: parseMemory(executionResult.memory),
    fromCache: false,
    comparisonReason: comparison.reason,
    memoryWarning: memoryCheck.level === 'warning' ? memoryCheck.message : null,
    memoryError: !memoryCheck.allowed ? memoryCheck.message : null,
    errorCategory: executionResult.error ? categorizeError(new Error(executionResult.error), executionResult) : null
  };

  // Cache result
  if (cacheKey && result.passed) {
    cacheResult(cacheKey, result);
  }

  return result;
};

// ============================================================================
// PARALLEL TEST CASE EXECUTION
// ============================================================================

/**
 * Execute test cases with parallel processing
 */
const executeTestCasesParallel = async (testcases, language, code, options = {}) => {
  const { maxConcurrent = EVALUATION_CONFIG.parallel.maxConcurrent } = options;

  const results = new Array(testcases.length);
  let completed = 0;

  // Process in batches
  for (let i = 0; i < testcases.length; i += maxConcurrent) {
    const batch = testcases.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (testcase, batchIndex) => {
      const index = i + batchIndex;
      try {
        results[index] = await executeTestCaseReliably(testcase, index, language, code, options);
      } catch (error) {
        logger.error({
          testcaseIndex: index,
          error: error.message
        }, 'Test case execution failed');
        results[index] = {
          passed: false,
          input: testcase.input,
          expectedOutput: testcase.output,
          actual: '',
          actualOutput: '',
          error: error.message,
          executionTime: 0,
          memory: '0mb',
          memoryUsed: 0,
          errorCategory: categorizeError(error, null)
        };
      }
      completed++;
    });

    await Promise.all(batchPromises);
  }

  return results;
};

// ============================================================================
// SEQUENTIAL TEST CASE EXECUTION (with reliability)
// ============================================================================

/**
 * Execute test cases sequentially with reliability features
 */
const executeTestCasesSequential = async (testcases, language, code, options = {}) => {
  const results = [];

  for (let i = 0; i < testcases.length; i++) {
    try {
      const result = await executeTestCaseReliable(testcases[i], i, language, code, options);
      results.push(result);
    } catch (error) {
      logger.error({
        testcaseIndex: i,
        error: error.message
      }, 'Test case execution failed');

      results.push({
        passed: false,
        input: testcases[i].input,
        expectedOutput: testcases[i].output,
        actual: '',
        actualOutput: '',
        error: error.message,
        executionTime: 0,
        memory: '0mb',
        memoryUsed: 0,
        errorCategory: categorizeError(error, null)
      });
    }
  }

  return results;
};

// Alias for backward compatibility
const executeTestCaseReliable = executeTestCaseReliably;

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

  executionStats.totalEvaluations++;

  const results = [];
  let passedCount = 0;
  let totalExecutionTime = 0;
  let maxMemory = 0;
  let errors = [];
  let warnings = [];

  // Choose execution strategy
  const useParallel = testcases.length > 3 && EVALUATION_CONFIG.parallel.enabled;
  const executionResults = useParallel
    ? await executeTestCasesParallel(testcases, language, code)
    : await executeTestCasesSequential(testcases, language, code);

  // Process results
  for (let i = 0; i < executionResults.length; i++) {
    const result = executionResults[i];

    if (result.passed) {
      passedCount++;
    }

    // Track metrics
    totalExecutionTime += result.executionTime || 0;
    maxMemory = Math.max(maxMemory, result.memoryUsed || 0);

    // Collect errors and warnings
    if (result.error) {
      errors.push({
        testcaseIndex: i,
        message: result.error,
        category: result.errorCategory?.category || 'unknown'
      });
    }

    if (result.memoryWarning) {
      warnings.push({
        testcaseIndex: i,
        message: result.memoryWarning
      });
    }

    // Build result object (strip internal fields for API response)
    results.push({
      passed: result.passed,
      input: result.input,
      expectedOutput: result.expectedOutput,
      actual: result.actual,
      actualOutput: result.actualOutput,
      error: result.error,
      runtime: result.runtime,
      executionTime: result.executionTime,
      memory: result.memory,
      memoryUsed: result.memoryUsed
    });

    logger.debug({
      testcaseIndex: i,
      passed: result.passed,
      input: result.input,
      comparison: result.comparisonReason
    }, 'Testcase evaluated');
  }

  // Update statistics
  if (passedCount === testcases.length) {
    executionStats.successfulEvaluations++;
  } else {
    executionStats.failedEvaluations++;
  }
  executionStats.totalTestCases += testcases.length;

  // Log summary
  logger.info({
    passed: passedCount,
    total: testcases.length,
    maxMemory,
    totalExecutionTime,
    errors: errors.length,
    warnings: warnings.length,
    executionStrategy: useParallel ? 'parallel' : 'sequential'
  }, 'Testcase evaluation completed');

  return {
    results,
    passedCount,
    totalCount: testcases.length,
    totalExecutionTime,
    maxMemory,
    errors,
    warnings,
    executionStrategy: useParallel ? 'parallel' : 'sequential'
  };
};

// ============================================================================
// ANALYTICS AND REPORTING
// ============================================================================

/**
 * Generate detailed analytics for test case execution
 */
const generateExecutionAnalytics = (results, totalExecutionTime) => {
  const analytics = {
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length
    },
    execution: {
      totalTime: totalExecutionTime,
      averageTime: results.length > 0
        ? Math.round(totalExecutionTime / results.length)
        : 0,
      minTime: results.length > 0
        ? Math.min(...results.map(r => r.executionTime || 0))
        : 0,
      maxTime: results.length > 0
        ? Math.max(...results.map(r => r.executionTime || 0))
        : 0
    },
    memory: {
      max: Math.max(...results.map(r => r.memoryUsed || 0)),
      average: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + (r.memoryUsed || 0), 0) / results.length)
        : 0
    },
    errors: {
      count: results.filter(r => r.error).length,
      types: {}
    }
  };

  // Categorize errors
  results.forEach(r => {
    if (r.error) {
      const category = r.errorCategory?.category || 'unknown';
      analytics.errors.types[category] = (analytics.errors.types[category] || 0) + 1;
    }
  });

  return analytics;
};

/**
 * Get execution statistics
 */
const getExecutionStats = () => {
  const stats = { ...executionStats };
  const uptime = Date.now() - stats.lastReset;

  return {
    ...stats,
    uptimeMs: uptime,
    successRate: stats.totalEvaluations > 0
      ? Math.round((stats.successfulEvaluations / stats.totalEvaluations) * 100)
      : 0,
    cacheHitRate: stats.totalEvaluations > 0
      ? Math.round((stats.cacheHits / stats.totalEvaluations) * 100)
      : 0
  };
};

/**
 * Reset execution statistics (admin only)
 */
const resetExecutionStats = () => {
  executionStats.totalEvaluations = 0;
  executionStats.successfulEvaluations = 0;
  executionStats.failedEvaluations = 0;
  executionStats.totalTestCases = 0;
  executionStats.retryCount = 0;
  executionStats.cacheHits = 0;
  executionStats.lastReset = Date.now();

  // Clear cache
  executionCache.clear();

  return { message: 'Statistics reset successfully' };
};

// ============================================================================
// DEBUGGING SUPPORT
// ============================================================================

/**
 * Generate detailed debugging information for failed test cases
 */
const generateDebugInfo = (testcase, result, code, language) => {
  const debugInfo = {
    testcase: {
      input: testcase.input,
      expectedOutput: testcase.output,
      isHidden: testcase.isHidden,
      description: testcase.description
    },
    execution: {
      actualOutput: result.actual,
      runtime: result.runtime,
      memory: result.memory,
      executionTime: result.executionTime,
      error: result.error
    },
    comparison: {
      passed: result.passed,
      reason: result.comparisonReason || 'unknown'
    },
    environment: {
      language,
      codeLength: code?.length
    }
  };

  // Add detailed error analysis if present
  if (result.errorCategory) {
    debugInfo.errorAnalysis = {
      category: result.errorCategory.category,
      severity: result.errorCategory.severity,
      message: result.errorCategory.message,
      recoverable: result.errorCategory.recoverable,
      errorType: result.errorCategory.errorType
    };
  }

  return debugInfo;
};

/**
 * Get execution configuration
 */
const getEvaluationConfig = () => {
  return {
    retry: {
      maxAttempts: EVALUATION_CONFIG.retry.maxAttempts,
      baseDelay: EVALUATION_CONFIG.retry.baseDelay,
      maxDelay: EVALUATION_CONFIG.retry.maxDelay,
      retryableErrors: EVALUATION_CONFIG.retry.retryableErrors
    },
    timeout: {
      default: EVALUATION_CONFIG.timeout.default,
      longRunning: EVALUATION_CONFIG.timeout.longRunning,
      perTestCase: EVALUATION_CONFIG.timeout.perTestCase
    },
    memory: {
      maxAllowed: EVALUATION_CONFIG.memory.maxAllowed,
      warningThreshold: EVALUATION_CONFIG.memory.warningThreshold,
      criticalThreshold: EVALUATION_CONFIG.memory.criticalThreshold
    },
    parallel: {
      maxConcurrent: EVALUATION_CONFIG.parallel.maxConcurrent,
      enabled: EVALUATION_CONFIG.parallel.enabled
    },
    comparison: {
      floatTolerance: EVALUATION_CONFIG.comparison.floatTolerance,
      whitespaceSensitive: EVALUATION_CONFIG.comparison.whitespaceSensitive
    }
  };
};

/**
 * Update evaluation configuration
 */
const updateEvaluationConfig = (updates) => {
  const allowedKeys = ['retry', 'timeout', 'memory', 'parallel', 'comparison'];

  for (const key of allowedKeys) {
    if (updates[key]) {
      Object.assign(EVALUATION_CONFIG[key], updates[key]);
    }
  }

  return { message: 'Configuration updated', config: getEvaluationConfig() };
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

  // Evaluate against all test cases (with reliability features)
  const { results, passedCount, totalCount, totalExecutionTime, maxMemory, errors, warnings, executionStrategy } = 
    await evaluateTestcases({
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

  // Generate analytics
  const analytics = generateExecutionAnalytics(results, totalExecutionTime);

  logger.info({
    questionId,
    score,
    passed: passedCount,
    total: totalCount,
    executionStrategy
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
    },
    // Enhanced metadata
    analytics,
    executionMetadata: {
      errors: errors,
      warnings: warnings,
      strategy: executionStrategy
    }
  };
};

/**
 * Evaluate code against custom test cases
 * @param {Object} params - Custom evaluation parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to evaluate
 * @param {Array} params.testcases - Custom array of test cases
 * @returns {Promise<Object>} Custom evaluation result with score
 */
const evaluateCustomTestcases = async ({ language, code, testcases }) => {
  logger.info({
    language,
    codeLength: code?.length,
    testcaseCount: testcases?.length,
    custom: true
  }, 'Starting custom test case evaluation');

  executionStats.totalEvaluations++;

  if (!testcases || !Array.isArray(testcases) || testcases.length === 0) {
    throw new AppError('At least one test case is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate test cases
  for (const tc of testcases) {
    if (!tc.input || !tc.output) {
      throw new AppError('Each test case must have input and output', HTTP_STATUS.BAD_REQUEST);
    }
  }

  // Evaluate with reliability features
  const { results, passedCount, totalCount, totalExecutionTime, maxMemory, errors, warnings, executionStrategy } = 
    await evaluateTestcases({
      language,
      code,
      testcases
    });

  // Calculate score
  const score = Math.round((passedCount / totalCount) * 100);

  // Generate analytics
  const analytics = generateExecutionAnalytics(results, totalExecutionTime);

  // Update statistics
  if (passedCount === totalCount) {
    executionStats.successfulEvaluations++;
  } else {
    executionStats.failedEvaluations++;
  }
  executionStats.totalTestCases += testcases.length;

  logger.info({
    score,
    passed: passedCount,
    total: totalCount,
    custom: true
  }, 'Custom test case evaluation completed');

  return {
    score,
    passedCount,
    totalCount,
    passedTests: passedCount,
    totalTests: totalCount,
    results,
    memoryUsed: maxMemory,
    executionTime: totalExecutionTime,
    analytics,
    executionMetadata: {
      errors: errors,
      warnings: warnings,
      strategy: executionStrategy
    }
  };
};

/**
 * HTTP handler for evaluating custom test cases
 * POST /api/v1/evaluation/evaluate-custom
 */
const evaluateCustomTestcasesHandler = async (req, res) => {
  try {
    const { code, language, testcases } = req.body;

    // Validate required fields
    if (!code || !language || !testcases) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields: code, language, and testcases are required'
      });
    }

    const result = await evaluateCustomTestcases({ code, language, testcases });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Custom test case evaluation failed');

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to evaluate custom test cases',
      error: error.message
    });
  }
};

/**
 * Get evaluation statistics
 * GET /api/v1/evaluation/stats
 */
const getEvaluationStatsHandler = async (req, res) => {
  try {
    const stats = getExecutionStats();
    const cacheSize = executionCache.size;

    res.json({
      success: true,
      data: {
        ...stats,
        cacheSize
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get evaluation stats');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get evaluation statistics',
      error: error.message
    });
  }
};

/**
 * Get evaluation configuration
 * GET /api/v1/evaluation/config
 */
const getEvaluationConfigHandler = async (req, res) => {
  try {
    res.json({
      success: true,
      data: getEvaluationConfig()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get evaluation config');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get evaluation configuration',
      error: error.message
    });
  }
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
  evaluateCustomTestcases,
  evaluateSolutionHandler,
  evaluateCustomTestcasesHandler,
  getEvaluationStatsHandler,
  getEvaluationConfigHandler,
  // Export utilities for testing and debugging
  generateExecutionAnalytics,
  generateDebugInfo,
  getExecutionStats,
  getEvaluationConfig,
  compareOutputs,
  checkMemoryLimit,
  categorizeError,
  // Export configuration for external modification
  EVALUATION_CONFIG
};
