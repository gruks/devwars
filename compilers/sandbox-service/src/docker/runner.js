import Docker from 'dockerode';
import { config, LANGUAGE_CONFIGS } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { getResourceLimits, containerSecurityOpts } from '../security/limits.js';

const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

export class DockerRunner {
  constructor() {
    this.docker = docker;
  }

  async executeCode({ language, code, input = '', timeout = config.EXECUTION_TIMEOUT }) {
    const startTime = Date.now();
    const langConfig = LANGUAGE_CONFIGS[language];

    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    let container = null;
    let timedOut = false;

    try {
      const createOptions = this.buildContainerOptions(langConfig, code, input);
      
      logger.info({ language, timeout }, '🐳 Creating container');
      container = await this.docker.createContainer(createOptions);

      await container.start();
      logger.info({ containerId: container.id }, '▶️ Container started');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          timedOut = true;
          reject(new Error('Execution timeout'));
        }, timeout);
      });

      const execPromise = container.wait();

      await Promise.race([execPromise, timeoutPromise]);

      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false
      });

      const output = this.parseLogs(logs);
      const runtime = Date.now() - startTime;

      const stats = await container.stats({ stream: false });
      const memoryUsage = Math.round(stats.memory_stats.usage / (1024 * 1024));

      logger.info({ runtime, memoryUsage, language }, '✅ Execution completed');

      return {
        status: 'success',
        stdout: output.stdout,
        stderr: output.stderr,
        runtime: `${runtime}ms`,
        memory: `${memoryUsage}mb`
      };

    } catch (error) {
      const runtime = Date.now() - startTime;
      
      if (timedOut) {
        logger.warn({ language, timeout }, '⏱️ Execution timeout');
        return {
          status: 'timeout',
          stdout: '',
          stderr: `Execution exceeded timeout of ${timeout}ms`,
          runtime: `${runtime}ms`,
          memory: '0mb'
        };
      }

      logger.error({ error: error.message, language }, '❌ Execution error');
      return {
        status: 'error',
        stdout: '',
        stderr: error.message,
        runtime: `${runtime}ms`,
        memory: '0mb'
      };

    } finally {
      if (container) {
        try {
          await container.stop({ t: 0 });
          await container.remove({ force: true });
          logger.info({ containerId: container.id }, '🧹 Container cleaned up');
        } catch (cleanupError) {
          logger.error({ error: cleanupError.message }, '⚠️ Container cleanup failed');
        }
      }
    }
  }

  buildContainerOptions(langConfig, code, input) {
    let cmd;
    let initCmd = '';

    if (langConfig.compile) {
      let fileName;
      const ext = langConfig.fileExtension;
      if (langConfig.fileExtension === '.java') {
        fileName = 'Main';
      } else if (langConfig.fileExtension === '.go') {
        fileName = 'main';
      } else {
        fileName = 'code';
      }
      initCmd = `echo '${code.replace(/'/g, "'\\''")}' > /tmp/${fileName}${ext} && `;
      cmd = [langConfig.command[0], langConfig.command[1], initCmd + langConfig.compile];
    } else {
      cmd = [...langConfig.command, code];
    }

    return {
      Image: langConfig.image,
      Cmd: cmd,
      Tty: false,
      AttachStdin: !!input,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: !!input,
      StdinOnce: true,
      NetworkDisabled: true,
      User: 'root',
      WorkingDir: '/tmp',
      HostConfig: {
        AutoRemove: false,
        NetworkMode: 'none'
      }
    };
  }

  parseLogs(buffer) {
    let stdout = '';
    let stderr = '';

    let offset = 0;
    while (offset < buffer.length) {
      const header = buffer.slice(offset, offset + 8);
      if (header.length < 8) break;

      const streamType = header[0];
      const size = header.readUInt32BE(4);
      const payload = buffer.slice(offset + 8, offset + 8 + size).toString('utf8');

      if (streamType === 1) {
        stdout += payload;
      } else if (streamType === 2) {
        stderr += payload;
      }

      offset += 8 + size;
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  }

  async checkDockerConnection() {
    try {
      await this.docker.ping();
      logger.info('✅ Docker connection verified');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, '❌ Docker connection failed');
      return false;
    }
  }

  async pullRunnerImages() {
    const images = Object.values(LANGUAGE_CONFIGS).map(cfg => cfg.image);
    const uniqueImages = [...new Set(images)];

    for (const image of uniqueImages) {
      try {
        await this.docker.pull(image);
        logger.info({ image }, '📥 Runner image pulled');
      } catch (error) {
        logger.warn({ image, error: error.message }, '⚠️ Failed to pull image');
      }
    }
  }
}

export const dockerRunner = new DockerRunner();