/**
 * Execution Service
 * Wrapper for sandbox-service API to execute code in sandbox environment
 */

const axios = require('axios');
const { logger } = require('../utils/logger.js');

// Sandbox service configuration
const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT = 3000;

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
 * Execute code in sandbox environment
 * @param {Object} params - Execution parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to execute
 * @param {string} [params.input=''] - Input for the code
 * @param {number} [params.timeout=3000] - Execution timeout in ms
 * @returns {Promise<Object>} Execution result
 */
const executeCode = async ({ language, code, input = '', timeout = DEFAULT_TIMEOUT }) => {
  try {
    // Map language to sandbox format
    const sandboxLanguage = LANGUAGE_MAP[language] || language;
    
    logger.info({ 
      language: sandboxLanguage, 
      codeLength: code.length,
      inputLength: input.length 
    }, 'Executing code in sandbox');

    const response = await axios.post(
      `${SANDBOX_SERVICE_URL}/api/execute`,
      {
        language: sandboxLanguage,
        code,
        input,
        timeout
      },
      {
        timeout: timeout + 1000, // Add buffer for network overhead
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

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

module.exports = {
  executeCode,
  executeWithInput
};
