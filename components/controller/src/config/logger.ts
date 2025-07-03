import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from './config';

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    enumerateErrorFormat(),
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, context, meta, ...restMeta }) => {
      // Проверяем, является ли meta строкой
      const contextString = typeof meta === 'string' ? `[${meta}]` : context ? `[${context}]` : '';
      const metaString = typeof meta === 'object' && meta && Object.keys(meta).length ? ` - ${JSON.stringify(meta)}` : '';
      const additionalMetaString = Object.keys(restMeta).length ? ` - ${JSON.stringify(restMeta)}` : '';

      return `${timestamp} ${level}: ${contextString} ${message}${metaString}${additionalMetaString}`;
    })
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info',
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
    new winston.transports.Console({
      stderrLevels: ['error'],
      level: 'info',
    }),
  ],
});

export default logger;
