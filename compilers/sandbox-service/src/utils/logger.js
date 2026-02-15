import pino from 'pino';
import { config } from '../config/config.js';

export const logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport: config.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.ip
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});