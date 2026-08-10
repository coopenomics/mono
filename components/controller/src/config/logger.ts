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
  // Уровень задаётся переменной LOG_LEVEL (по умолчанию info на проде, debug в
  // разработке). Успешные HTTP-запросы morgan пишет в debug, поэтому на проде их
  // в логе нет вообще — чтобы разобрать инцидент с таймаутами, LOG_LEVEL=debug
  // поднимается в docker-compose плейбука без пересборки образа.
  level: config.log_level,
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
      // Транспорт тоже фильтрует — без этого docker logs останется на info,
      // даже если сам логгер поднят до debug.
      level: config.log_level,
    }),
  ],
});

export default logger;
