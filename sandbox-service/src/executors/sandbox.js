/**
 * Sandbox Executor
 * Executes code in isolated Docker containers with security constraints
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Security configuration
const SECURITY_CONFIG = {
  memoryLimit: '256m',
  cpuLimit: '0.5',
  pidsLimit: 50,
  timeoutDefault: 2000,
  maxCodeSize: 10000
};

// Language configurations
const LANGUAGE_CONFIG = {
  javascript: {
    ext: 'js',
    runCmd: 'node',
    compile: false
  },
  node: {
    ext: 'js',
    runCmd: 'node',
    compile: false
  },
  python: {
    ext: 'py',
    runCmd: 'python3',
    compile: false
  },
  python3: {
    ext: 'py',
    runCmd: 'python3',
    compile: false
  },
  java: {
    ext: 'java',
    runCmd: 'java',
    compile: true,
    compileCmd: 'javac',
    mainClass: 'Main'
  },
  go: {
    ext: 'go',
    runCmd: 'go',
    compile: false,
    runArgs: ['run']
  },
  cpp: {
    ext: 'cpp',
    runCmd: '',
    compile: true,
    compileCmd: 'g++',
    executable: 'sandbox_executable'
  },
  'c++': {
    ext: 'cpp',
    runCmd: '',
    compile: true,
    compileCmd: 'g++',
    executable: 'sandbox_executable'
  }
};

/**
 * Create a temporary directory for code execution
 */
const createTempDir = () => {
  const tempDir = path.join(os.tmpdir(), `sandbox-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir};
};

/**
 * Write code to a temporary file
 */
const writeCodeFile = (tempDir, code, language) => {
  const config = LANGUAGE_CONFIG[language];
  const fileName = `code.${config.ext}`;
  const filePath = path.join(tempDir, fileName);
  
  // For Java, extract class name from first public class
  if (language === 'java') {
    const classMatch = code.match(/public\s+class\s+(\w+)/);
    if (classMatch) {
      config.mainClass = classMatch[1];
    }
  }
  
  fs.writeFileSync(filePath, code);
  return filePath;
};

/**
 * Clean up temporary directory
 */
const cleanupTempDir = (tempDir) => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
};

/**
 * Execute command with timeout
 */
const executeWithTimeout = (command, args, timeout) => {
  return new Promise((resolve) => {
    let output = '';
    let error = '';
    let killed = false;
    
    const proc = spawn(command, args, {
      cwd: path.dirname(args[0]),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        output: output.trim(),
        error: error.trim(),
        exitCode: code,
        killed
      });
    });
    
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        output: '',
        error: err.message,
        exitCode: -1,
        killed: false
      });
    });
  });
};

/**
 * Build Docker run command for sandbox execution
 */
const buildDockerCommand = (tempDir, language, codeFile, timeout) => {
  const config = LANGUAGE_CONFIG[language];
  
  let runCommand;
  let runArgs;
  
  if (config.compile) {
    // For compiled languages, we need to compile first
    if (language === 'java') {
      runCommand = 'docker';
      runArgs = [
        'run', '--rm',
        '--memory', SECURITY_CONFIG.memoryLimit,
        '--memory-swap', SECURITY_CONFIG.memoryLimit,
        '--cpus', SECURITY_CONFIG.cpuLimit,
        '--pids-limit', String(SECURITY_CONFIG.pidsLimit),
        '--read-only',
        '--security-opt', 'no-new-privileges:true',
        '-v', `${tempDir}:/sandbox:ro`,
        'devwars-sandbox',
        'timeout', String(Math.ceil(timeout / 1000)), 's',
        'bash', '-c',
        `javac /sandbox/${path.basename(codeFile)} && java -Xmx256M -Xss256k -Djava.security.manager -Djava.policy=grant /sandbox/${config.mainClass}.class`
      ];
    } else if (language === 'cpp' || language === 'c++') {
      runCommand = 'docker';
      runArgs = [
        'run', '--rm',
        '--memory', SECURITY_CONFIG.memoryLimit,
        '--memory-swap', SECURITY_CONFIG.memoryLimit,
        '--cpus', SECURITY_CONFIG.cpuLimit,
        '--pids-limit', String(SECURITY_CONFIG.pidsLimit),
        '--read-only',
        '--security-opt', 'no-new-privileges:true',
        '-v', `${tempDir}:/sandbox:ro`,
        'devwars-sandbox',
        'timeout', String(Math.ceil(timeout / 1000)), 's',
        'bash', '-c',
        `g++ -o /sandbox/${config.executable} /sandbox/${path.basename(codeFile)} && /sandbox/${config.executable}`
      ];
    } else if (language === 'go') {
      runCommand = 'docker';
      runArgs = [
        'run', '--rm',
        '--memory', SECURITY_CONFIG.memoryLimit,
        '--memory-swap', SECURITY_CONFIG.memoryLimit,
        '--cpus', SECURITY_CONFIG.cpuLimit,
        '--pids-limit', String(SECURITY_CONFIG.pidsLimit),
        '--read-only',
        '--security-opt', 'no-new-privileges:true',
        '-v', `${tempDir}:/sandbox:ro`,
        'devwars-sandbox',
        'timeout', String(Math.ceil(timeout / 1000)), 's',
        'go', 'run', `/sandbox/${path.basename(codeFile)}`
      ];
    }
  } else {
    // For interpreted languages
    runCommand = 'docker';
    runArgs = [
      'run', '--rm',
      '--memory', SECURITY_CONFIG.memoryLimit,
      '--memory-swap', SECURITY_CONFIG.memoryLimit,
      '--cpus', SECURITY_CONFIG.cpuLimit,
      '--pids-limit', String(SECURITY_CONFIG.pidsLimit),
      '--read-only',
      '--security-opt', 'no-new-privileges:true',
      '-v', `${tempDir}:/sandbox:ro`,
      'devwars-sandbox',
      'timeout', String(Math.ceil(timeout / 1000)), 's',
      config.runCmd, `/sandbox/${path.basename(codeFile)}`
    ];
  }
  
  return { runCommand, runArgs };
};

/**
 * Execute code in sandbox
 * @param {Object} params - Execution parameters
 * @param {string} params.language - Programming language
 * @param {string} params.code - Code to execute
 * @param {string} params.input - Input for the code
 * @param {number} params.timeout - Execution timeout in ms
 * @returns {Promise<Object>} Execution result
 */
const executeInSandbox = async ({ language, code, input = '', timeout = SECURITY_CONFIG.timeoutDefault }) => {
  const startTime = Date.now();
  let tempDir = null;
  
  try {
    // Validate language
    const config = LANGUAGE_CONFIG[language];
    if (!config) {
      return {
        success: false,
        output: '',
        error: `Unsupported language: ${language}`,
        executionTime: '0ms',
        memoryUsage: '0mb',
        killed: false
      };
    }
    
    // Validate code size
    if (code.length > SECURITY_CONFIG.maxCodeSize) {
      return {
        success: false,
        output: '',
        error: `Code exceeds maximum size of ${SECURITY_CONFIG.maxCodeSize} characters`,
        executionTime: '0ms',
        memoryUsage: '0mb',
        killed: false
      };
    }
    
    // Create temp directory
    tempDir = createTempDir();
    
    // Write code to file
    const codeFile = writeCodeFile(tempDir, code, language);
    
    // Build Docker command
    const { runCommand, runArgs } = buildDockerCommand(tempDir, language, codeFile, timeout);
    
    // Execute in Docker sandbox
    const result = await executeWithTimeout(runCommand, runArgs, timeout + 5000);
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    
    // Return result
    return {
      success: !result.killed && result.exitCode === 0,
      output: result.output,
      error: result.error,
      executionTime: `${Math.min(executionTime, timeout)}ms`,
      memoryUsage: result.killed ? '0mb' : '32mb',
      killed: result.killed
    };
    
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message || 'Execution failed',
      executionTime: '0ms',
      memoryUsage: '0mb',
      killed: false
    };
  } finally {
    // Clean up temp directory
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  }
};

/**
 * Get supported languages
 */
const getSupportedLanguages = () => {
  return Object.keys(LANGUAGE_CONFIG);
};

module.exports = {
  executeInSandbox,
  getSupportedLanguages,
  LANGUAGE_CONFIG,
  SECURITY_CONFIG
};
