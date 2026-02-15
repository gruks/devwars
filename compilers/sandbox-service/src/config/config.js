import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  DOCKER_SOCKET: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  EXECUTION_TIMEOUT: parseInt(process.env.EXECUTION_TIMEOUT) || 2000,
  CPU_LIMIT: parseFloat(process.env.CPU_LIMIT) || 0.5,
  MEMORY_LIMIT: process.env.MEMORY_LIMIT || '128m',
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS) || 10,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

export const RUNNER_IMAGES = {
  python: 'sandbox-python-runner:latest',
  javascript: 'sandbox-node-runner:latest',
  cpp: 'sandbox-cpp-runner:latest',
  java: 'sandbox-java-runner:latest',
  go: 'sandbox-go-runner:latest'
};

export const LANGUAGE_CONFIGS = {
  python: {
    image: RUNNER_IMAGES.python,
    command: ['python3', '-c'],
    fileExtension: '.py'
  },
  javascript: {
    image: RUNNER_IMAGES.javascript,
    command: ['node', '-e'],
    fileExtension: '.js'
  },
  cpp: {
    image: RUNNER_IMAGES.cpp,
    command: ['/bin/sh', '-c'],
    compile: 'g++ -o /tmp/program /tmp/code.cpp && /tmp/program',
    fileExtension: '.cpp'
  },
  java: {
    image: RUNNER_IMAGES.java,
    command: ['/bin/sh', '-c'],
    compile: 'javac /tmp/Main.java && java -cp /tmp Main',
    fileExtension: '.java'
  },
  go: {
    image: RUNNER_IMAGES.go,
    command: ['/bin/sh', '-c'],
    compile: 'go run /tmp/code.go',
    fileExtension: '.go'
  }
};