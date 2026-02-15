import { executionQueue } from '../queue/queue.js';
import { logger } from '../utils/logger.js';

const SUPPORTED_LANGUAGES = ['python', 'javascript', 'cpp', 'java', 'go'];
const MAX_CODE_LENGTH = 10000;
const MAX_INPUT_LENGTH = 1000;

export default async function executionRoutes(fastify, options) {
  fastify.post('/execute', {
    schema: {
      body: {
        type: 'object',
        required: ['language', 'code'],
        properties: {
          language: { 
            type: 'string',
            enum: SUPPORTED_LANGUAGES
          },
          code: { 
            type: 'string',
            minLength: 1,
            maxLength: MAX_CODE_LENGTH
          },
          input: { 
            type: 'string',
            maxLength: MAX_INPUT_LENGTH
          },
          timeout: { 
            type: 'number',
            minimum: 100,
            maximum: 5000,
            default: 2000
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { language, code, input = '', timeout = 2000 } = request.body;

      fastify.log.info({ language, codeLength: code.length }, '📝 Received execution request');

      try {
        const job = await executionQueue.add('execute-code', {
          language,
          code,
          input,
          timeout
        });

        fastify.log.info({ jobId: job.id }, '✅ Job queued');

        const result = await job.waitUntilFinished(executionQueue.events);

        return reply.code(200).send(result);

      } catch (error) {
        fastify.log.error({ error: error.message }, '❌ Execution request failed');
        
        return reply.code(500).send({
          status: 'error',
          stdout: '',
          stderr: error.message || 'Internal server error',
          runtime: '0ms',
          memory: '0mb'
        });
      }
    }
  });

  fastify.get('/languages', async (request, reply) => {
    return {
      supported: SUPPORTED_LANGUAGES,
      count: SUPPORTED_LANGUAGES.length
    };
  });

  fastify.get('/queue/stats', async (request, reply) => {
    const [waiting, active, completed, failed] = await Promise.all([
      executionQueue.getWaitingCount(),
      executionQueue.getActiveCount(),
      executionQueue.getCompletedCount(),
      executionQueue.getFailedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active
    };
  });
}