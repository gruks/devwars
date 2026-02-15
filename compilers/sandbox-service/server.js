import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import { config } from './src/config/config.js';
import { logger } from './src/utils/logger.js';
import executionRoutes from './src/api/routes.js';

const fastify = Fastify({
  logger: logger,
  requestTimeout: 30000,
  bodyLimit: 1048576
});

const schema = {
  type: 'object',
  required: ['PORT', 'REDIS_HOST'],
  properties: {
    PORT: { type: 'number', default: 3000 },
    NODE_ENV: { type: 'string', default: 'development' },
    REDIS_HOST: { type: 'string' },
    REDIS_PORT: { type: 'number', default: 6379 }
  }
};

fastify.register(fastifyEnv, {
  confKey: 'config',
  schema: schema,
  dotenv: true
});

fastify.register(executionRoutes, { prefix: '/api' });

fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'sandbox-service',
    timestamp: Date.now(),
    uptime: process.uptime()
  };
});

const start = async () => {
  try {
    const port = config.PORT || 3000;
    const host = '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    fastify.log.info(`🚀 Sandbox Service running on http://${host}:${port}`);
    fastify.log.info(`📊 Health check: http://${host}:${port}/health`);
    fastify.log.info(`⚡ Execute API: http://${host}:${port}/api/execute`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, closing server gracefully');
  await fastify.close();
  process.exit(0);
});

start();