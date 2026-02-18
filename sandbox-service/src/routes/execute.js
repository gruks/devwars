/**
 * Execute Routes
 * API endpoints for code execution
 */

const { executeInSandbox } = require('../executors/sandbox.js');

/**
 * Supported languages and their configurations
 */
const SUPPORTED_LANGUAGES = {
  javascript: { ext: 'js', cmd: 'node' },
  node: { ext: 'js', cmd: 'node' },
  python: { ext: 'py', cmd: 'python3' },
  python3: { ext: 'py', cmd: 'python3' },
  java: { ext: 'java', cmd: 'javac' },
  go: { ext: 'go', cmd: 'go' },
  cpp: { ext: 'cpp', cmd: 'g++' },
  c++: { ext: 'cpp', cmd: 'g++' }
};

/**
 * Validate execution request
 */
const validateRequest = (body) => {
  const { language, code, timeout } = body;
  
  if (!language) {
    return { valid: false, error: 'Language is required' };
  }
  
  if (!SUPPORTED_LANGUAGES[language]) {
    return { valid: false, error: `Unsupported language: ${language}. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}` };
  }
  
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Code is required and must be a string' };
  }
  
  if (code.length > 10000) {
    return { valid: false, error: 'Code exceeds maximum length of 10000 characters' };
  }
  
  const timeoutVal = timeout || 2000;
  if (timeoutVal > 5000) {
    return { valid: false, error: 'Timeout cannot exceed 5000ms' };
  }
  
  if (timeoutVal < 100) {
    return { valid: false, error: 'Timeout must be at least 100ms' };
  }
  
  return { valid: true };
};

/**
 * POST /api/execute
 * Execute code in sandbox
 */
const executeHandler = async (req, res) => {
  try {
    const { language, code, input = '', timeout = 2000 } = req.body;
    
    // Validate request
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Execute code in sandbox
    const result = await executeInSandbox({
      language,
      code,
      input,
      timeout
    });
    
    // Return result
    res.json({
      success: result.success,
      stdout: result.output || '',
      stderr: result.error || '',
      runtime: result.executionTime,
      memory: result.memoryUsage,
      status: result.killed ? 'timeout' : (result.success ? 'success' : 'error'),
      killed: result.killed || false
    });
    
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Execution failed',
      message: error.message
    });
  }
};

/**
 * GET /health
 * Health check endpoint
 */
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'sandbox-service'
  });
};

module.exports = {
  executeHandler,
  healthHandler,
  SUPPORTED_LANGUAGES
};
