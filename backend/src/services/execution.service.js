/**
 * Execution Service
 * Wrapper for sandbox-service API to execute code in sandbox environment
 */

const axios = require('axios');
const { logger } = require('../utils/logger.js');

// Sandbox service configuration
const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT = 2000;
const MAX_CODE_LENGTH = 10000;

/**
 * Language mapping from our format to sandbox-service format
 * @type {Object.<string, string>}
 */
const LANGUAGE_MAP = {
  python: 'python',
  node: 'javascript',
  javascript: 'javascript',
  java: 'java',
  go: 'go',
  cpp: 'cpp'
};

/**
 * Supported languages
 */
const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'go', 'cpp'];

/**
 * Execute code in sandbox environment
 * @param {Object} params - Execution parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to execute
 * @param {string} [params.input=''] - Input for the code
 * @param {number} [params.timeout=2000] - Execution timeout in ms
 * @returns {Promise<Object>} Execution result
 */
const executeCode = async ({ language, code, input = '', timeout = DEFAULT_TIMEOUT }) => {
  try {
    // Validate inputs
    if (!language || !code) {
      return {
        success: false,
        output: '',
        error: 'Language and code are required',
        runtime: '0ms',
        memory: '0mb'
      };
    }

    if (code.length > MAX_CODE_LENGTH) {
      return {
        success: false,
        output: '',
        error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`,
        runtime: '0ms',
        memory: '0mb'
      };
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return {
        success: false,
        output: '',
        error: `Unsupported language: ${language}`,
        runtime: '0ms',
        memory: '0mb'
      };
    }

    // Map language to sandbox format
    const sandboxLanguage = LANGUAGE_MAP[language] || language;
    
    logger.info({ 
      language: sandboxLanguage, 
      codeLength: code.length,
      inputLength: input.length 
    }, 'Executing code in sandbox');

    // Submit job to sandbox service
    const response = await axios.post(
      `${SANDBOX_SERVICE_URL}/api/execute`,
      {
        language: sandboxLanguage,
        code,
        input,
        timeout: Math.min(timeout, 5000) // Cap at 5 seconds
      },
      {
        timeout: 5000, // Quick timeout for job submission
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // If job was queued, poll for result
    if (response.data.jobId) {
      const jobId = response.data.jobId;
      const maxAttempts = 10;
      const pollInterval = 500;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          const jobResult = await axios.get(
            `${SANDBOX_SERVICE_URL}/api/job/${jobId}`,
            { timeout: 3000 }
          );
          
          // Check if job completed (not waiting/active)
          const status = jobResult.data.status;
          if (status !== 'waiting' && status !== 'active' && status !== 'queued') {
            // Job completed (success or error)
            logger.info({
              status: jobResult.data.status,
              runtime: jobResult.data.runtime,
              memory: jobResult.data.memory
            }, 'Code execution completed');
            
            return {
              success: jobResult.data.status === 'success',
              output: jobResult.data.stdout || '',
              error: jobResult.data.stderr || '',
              runtime: jobResult.data.runtime,
              memory: jobResult.data.memory
            };
          }
        } catch (pollError) {
          // Continue polling on poll errors
          logger.warn({ error: pollError.message }, 'Polling job status');
        }
      }
      
      // Timeout waiting for result
      return {
        success: false,
        output: '',
        error: 'Execution timeout - job took too long',
        runtime: `${timeout}ms`,
        memory: '0mb'
      };
    }

    // Direct result (fallback for non-async responses)
    const result = response.data;

    logger.info({
      status: result.status,
      runtime: result.runtime,
      memory: result.memory
    }, 'Code execution completed');

    return {
      success: result.status === 'success',
      output: result.stdout || '',
      error: result.stderr || '',
      runtime: result.runtime,
      memory: result.memory
    };
  } catch (error) {
    logger.error({ 
      error: error.message,
      language,
      codeLength: code?.length 
    }, 'Code execution failed');

    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        output: '',
        error: 'Sandbox service unavailable. Please try again later.',
        runtime: '0ms',
        memory: '0mb'
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        success: false,
        output: '',
        error: 'Execution timeout. Code took too long to execute.',
        runtime: `${timeout}ms`,
        memory: '0mb'
      };
    }

    return {
      success: false,
      output: '',
      error: error.response?.data?.stderr || error.message || 'Execution failed',
      runtime: '0ms',
      memory: '0mb'
    };
  }
};

/**
 * Execute code with specific input
 * Wrapper around executeCode for convenience
 * @param {Object} params - Execution parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to execute
 * @param {string} params.input - Input for the code
 * @returns {Promise<Object>} Execution result
 */
const executeWithInput = async ({ language, code, input }) => {
  return executeCode({ language, code, input });
};

/**
 * Run test cases against submitted code
 * @param {Object} params - Parameters
 * @param {string} params.code - Code to execute
 * @param {string} params.language - Programming language
 * @param {Array} params.testCases - Array of test cases with input and expected output
 * @param {number} params.timeout - Timeout per test case in ms
 * @returns {Promise<Object>} Test results with summary
 */
const runTestCases = async ({ code, language, testCases, timeout = DEFAULT_TIMEOUT }) => {
  const results = [];
  let passedCount = 0;
  let totalExecutionTime = 0;
  let maxMemory = 0;

  logger.info({
    language,
    codeLength: code.length,
    testCaseCount: testCases?.length || 0
  }, 'Running test cases');

  // Process each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    try {
      // Execute code with test case input
      const executionResult = await executeCode({
        language,
        code,
        input: testCase.input || '',
        timeout
      });

      // Compare output (trim whitespace for comparison)
      const actualOutput = (executionResult.output || '').trim();
      const expectedOutput = (testCase.expectedOutput || '').trim();
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
        testCaseNumber: i + 1,
        passed,
        input: testCase.input || '',
        expectedOutput,
        actualOutput: executionResult.output || '',
        executionTime: executionResult.runtime,
        memory: executionResult.memory,
        error: executionResult.success ? null : executionResult.error
      });

      logger.debug({
        testCaseIndex: i,
        passed,
        input: testCase.input
      }, 'Test case evaluated');

    } catch (error) {
      logger.error({
        testCaseIndex: i,
        error: error.message
      }, 'Test case execution failed');

      results.push({
        testCaseNumber: i + 1,
        passed: false,
        input: testCase.input || '',
        expectedOutput: testCase.expectedOutput || '',
        actualOutput: '',
        executionTime: '0ms',
        memory: '0mb',
        error: error.message || 'Test case execution failed'
      });
    }
  }

  // Calculate summary
  const averageExecutionTime = testCases.length > 0 
    ? Math.round(totalExecutionTime / testCases.length) 
    : 0;

  const summary = {
    totalTests: testCases.length,
    passedTests: passedCount,
    failedTests: testCases.length - passedCount,
    results,
    averageExecutionTime: `${averageExecutionTime}ms`,
    maxMemoryUsed: `${maxMemory}mb`
  };

  logger.info({
    passed: passedCount,
    total: testCases.length,
    avgTime: averageExecutionTime
  }, 'Test cases completed');

  return summary;
};

/**
 * Calculate code complexity (heuristic analysis)
 * @param {string} code - Source code
 * @param {string} language - Programming language
 * @returns {Object} Complexity estimates
 */
const calculateComplexity = (code, language) => {
  // Time complexity estimation
  let timeComplexity = 'O(1)';
  
  // Count nested loops
  const forLoops = (code.match(/\bfor\s*\(/g) || []).length;
  const whileLoops = (code.match(/\bwhile\s*\(/g) || []).length;
  const nestedForMatch = code.match(/for\s*\([^{]*\{[^}]*for\s*\(/g) || [];
  const nestedWhileMatch = code.match(/while\s*\([^{]*\{[^}]*while\s*\(/g) || [];
  
  const nestedLoops = nestedForMatch.length + nestedWhileMatch.length;
  const totalLoops = forLoops + whileLoops;
  
  if (nestedLoops > 0 || totalLoops >= 3) {
    timeComplexity = 'O(n³)';
  } else if (totalLoops === 2) {
    timeComplexity = 'O(n²)';
  } else if (totalLoops === 1) {
    timeComplexity = 'O(n)';
  } else if (code.match(/\bmap\s*\(/i) || code.match(/\bfilter\s*\(/i) || code.match(/\breduce\s*\(/i)) {
    timeComplexity = 'O(n)';
  }
  
  // Space complexity estimation  
  let spaceComplexity = 'O(1)';
  
  // Check for array/list allocations
  const arrayAllocations = (code.match(/\[\s*\]/g) || []).length;
  const newArrayMatch = code.match(/new\s+Array\s*\(/g) || [];
  const newListMatch = code.match(/new\s+(List|Map|Set|Array)\s*\(/g) || [];
  const recursiveCalls = (code.match(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\1\s*\(/g) || []).length;
  
  if (recursiveCalls > 0) {
    spaceComplexity = 'O(n)';
  } else if (newArrayMatch.length > 1 || newListMatch.length > 0 || arrayAllocations > 2) {
    spaceComplexity = 'O(n)';
  } else if (arrayAllocations === 1) {
    spaceComplexity = 'O(n)';
  }
  
  logger.debug({
    language,
    timeComplexity,
    spaceComplexity,
    loops: totalLoops,
    nestedLoops
  }, 'Complexity analysis');
  
  return {
    timeComplexity,
    spaceComplexity
  };
};

/**
 * Validate code for security issues
 * @param {string} code - Source code
 * @param {string} language - Programming language
 * @returns {Object} Validation result
 */
const validateCode = (code, language) => {
  const issues = [];
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    { pattern: /eval\s*\(/, message: 'Use of eval() is not allowed' },
    { pattern: /Function\s*\(/, message: 'Dynamic function creation is not allowed' },
    { pattern: /import\s+os/, message: 'OS module import is not allowed' },
    { pattern: /require\s*\(\s*['"]os['"]\s*\)/, message: 'OS module import is not allowed' },
    { pattern: /import\s+subprocess/, message: 'Subprocess module import is not allowed' },
    { pattern: /exec\s*\(/, message: 'exec() is not allowed' },
    { pattern: /spawn\s*\(/, message: 'Process spawning is not allowed' },
  ];
  
  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      issues.push(message);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

module.exports = {
  executeCode,
  executeWithInput,
  runTestCases,
  calculateComplexity,
  validateCode,
  SUPPORTED_LANGUAGES,
  LANGUAGE_MAP
};
