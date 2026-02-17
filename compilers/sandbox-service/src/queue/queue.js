import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

// Create Redis connection with reconnection strategy
const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.info({ attempt: times, delay }, '🔄 Redis reconnecting');
    return delay;
  },
  reconnectOnError(err) {
    logger.error({ error: err.message }, '❌ Redis reconnect on error');
    return true;
  }
});

connection.on('connect', () => {
  logger.info({ host: config.REDIS_HOST, port: config.REDIS_PORT }, '✅ Redis connected');
});

connection.on('error', (err) => {
  logger.error({ error: err.message }, '❌ Redis connection error');
});

connection.on('ready', () => {
  logger.info('🚀 Redis ready');
});

connection.on('close', () => {
  logger.warn('🔌 Redis connection closed');
});

// Create execution queue
const executionQueue = new Queue('execution-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  }
});

executionQueue.on('error', (err) => {
  logger.error({ error: err.message }, '❌ Queue error');
});

logger.info(
  { queueName: 'execution-queue' },
  '📋 Queue initialized'
);

export { connection, executionQueue };
