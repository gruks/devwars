/**
 * Environment configuration module
 * Loads and validates environment variables
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env file from backend root
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

/**
 * Required environment variables
 * These must be present or the app will throw an error
 */
const requiredVars = [
  'NODE_ENV'
];

/**
 * Environment variable schema with defaults
 */
const envSchema = {
  // Server configuration
  PORT: { default: 3000, parser: Number },
  NODE_ENV: { default: 'development', parser: String },
  ALLOWED_ORIGINS: { default: '', parser: String },

  // Database
  MONGODB_URI: { default: 'mongodb://localhost:27017/devwars', parser: String },
  REDIS_URL: { default: 'redis://localhost:6379', parser: String },

  // Authentication
  JWT_SECRET: { default: 'dev-jwt-secret-change-in-production', parser: String },
  JWT_REFRESH_SECRET: { default: 'dev-refresh-secret-change-in-production', parser: String },
  JWT_EXPIRES_IN: { default: '15m', parser: String },
  JWT_REFRESH_EXPIRES_IN: { default: '7d', parser: String },
  SESSION_SECRET: { default: 'dev-session-secret-change-in-production', parser: String },

  // Security
  BCRYPT_ROUNDS: { default: 10, parser: Number },

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: { default: 15 * 60 * 1000, parser: Number }, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: { default: 100, parser: Number },
};

/**
 * Validate and parse environment variables
 * @returns {Object} Parsed environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnv() {
  const env = {};
  const missing = [];

  // Check required variables
  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file or set these variables in your environment.`
    );
  }

  // Parse and apply defaults
  for (const [key, config] of Object.entries(envSchema)) {
    const rawValue = process.env[key];

    if (rawValue === undefined || rawValue === '') {
      env[key] = config.default;
    } else if (config.parser === Number) {
      const parsed = parseInt(rawValue, 10);
      if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number, got: ${rawValue}`);
      }
      env[key] = parsed;
    } else if (config.parser === Boolean) {
      env[key] = rawValue === 'true' || rawValue === '1';
    } else {
      env[key] = rawValue;
    }
  }

  // Add isDevelopment and isProduction helpers
  env.isDevelopment = env.NODE_ENV === 'development';
  env.isProduction = env.NODE_ENV === 'production';
  env.isTest = env.NODE_ENV === 'test';

  return Object.freeze(env);
}

// Export validated environment
const env = validateEnv();

module.exports = { env, validateEnv };
