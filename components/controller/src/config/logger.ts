import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from './config';
import { isSensitiveLogKey, redactSensitive, REDACTED } from './log-redaction';

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

/**
 * Story 8.7: маскирует sensitive-значения в meta лог-события до сериализации
 * (NFR9, защита в глубину). Служебные поля winston (level/message/timestamp/
 * context/ms/splat) не трогаем — чистим только пользовательский meta (own
 * string-ключи и их вложенность через redactSensitive). message-строку не
 * трогаем (риск порчи; интерполированный секрет в message ловит ESLint-правило).
 */
const RESERVED_LOG_FIELDS = new Set(['level', 'message', 'timestamp', 'context', 'ms', 'splat']);
const redactionFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (RESERVED_LOG_FIELDS.has(key)) continue;
    info[key] = isSensitiveLogKey(key) ? REDACTED : redactSensitive(info[key]);
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    enumerateErrorFormat(),
    redactionFormat(),
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
    // При генерации схемы (build-time codegen) файловые транспорты не подключаем:
    // процесс запускается из-под пользователя рядом с работающим контейнером, чей logs/
    // принадлежит root, — запись туда падает с EACCES. На рантайм не влияет (флаг ставится только в codegen).
    ...(process.env.CONTROLLER_SCHEMA_GEN
      ? []
      : [
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
        ]),
    new winston.transports.Console({
      stderrLevels: ['error'],
      level: config.env === 'development' ? 'debug' : 'info',
    }),
  ],
});

export default logger;
