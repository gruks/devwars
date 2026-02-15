import { Worker } from 'bullmq';
import { connection } from '../queue/queue.js';
import { dockerRunner } from '../docker/runner.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

const worker = new Worker(
  'execution-queue',
  async (job) => {
    const { language, code, input, timeout } = job.data;

    logger.info(
      { jobId: job.id, language, attempt: job.attemptsMade },
      '🛠️ Processing execution job'
    );

    try {
      const result = await dockerRunner.executeCode({
        language,
        code,
        input,
        timeout
      });

      logger.info({ jobId: job.id, status: result.status }, '✅ Job completed');
      return result;

    } catch (error) {
      logger.error(
        { jobId: job.id, error: error.message },
        '❌ Job failed'
      );
      throw error;
    }
  },
  {
    connection,
    concurrency: config.MAX_CONCURRENT_JOBS,
    limiter: {
      max: config.MAX_CONCURRENT_JOBS,
      duration: 1000
    }
  }
);

worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, '✨ Job completed successfully');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, error: err.message }, '⚠️ Job failed');
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, '❌ Worker error');
});

logger.info(
  { concurrency: config.MAX_CONCURRENT_JOBS },
  '💪 Worker started'
);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully');
  await worker.close();
  process.exit(0);
});