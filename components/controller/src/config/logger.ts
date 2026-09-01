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
 *
 * ВАЖНО: redactionFormat обязан стоять ПОСЛЕ winston.format.splat(). splat() при
 * сообщении без %-токенов делает Object.assign(info, ...исходный meta) из info[SPLAT],
 * повторно вмёрживая сырой meta-объект поверх полей info. Если редактировать ДО splat(),
 * эта повторная сборка затрёт маскировку исходными значениями (поймано тестом 8.8).
 */
const RESERVED_LOG_FIELDS = new Set(['level', 'message', 'timestamp', 'context', 'ms', 'splat']);
const redactionFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (RESERVED_LOG_FIELDS.has(key)) continue;
    info[key] = isSensitiveLogKey(key) ? REDACTED : redactSensitive(info[key]);
  }
  return info;
});

/** Имя сервиса в структурированных логах (компонент канонически зовётся coopback). */
const SERVICE_NAME = 'coopback';

/**
 * Story 9.12: добавляет поле `service` в структурированный (JSON) вывод. В dev не
 * применяется — pretty-строка не засоряется служебным полем.
 */
const serviceFormat = winston.format((info) => {
  info.service = SERVICE_NAME;
  return info;
});

/**
 * Story 9.12: единая цепочка форматов, ветвящаяся по среде.
 * - production: структурированный JSON (`timestamp/level/message/service/request_id/
 *   ...metadata`) для агрегации любым docker-logs-сборщиком; без colorize (ANSI в JSON
 *   недопустим).
 * - dev/test: человекочитаемый printf (с colorize) — поведение разработки не меняется.
 *
 * Инвариант 8.8: redactionFormat() обязан стоять ПОСЛЕ splat() (splat повторно
 * вмёрживает сырой meta из info[SPLAT]); JSON/printf-сериализация — строго ПОСЛЕ
 * redaction, поэтому секреты не утекают ни в JSON, ни в pretty.
 */
export function buildLogFormat(isProduction: boolean): winston.Logform.Format {
  const prefix = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    enumerateErrorFormat(),
    ...(isProduction ? [] : [winston.format.colorize()]),
    winston.format.splat(),
    redactionFormat(),
  ];

  if (isProduction) {
    return winston.format.combine(...prefix, serviceFormat(), winston.format.json());
  }

  return winston.format.combine(
    ...prefix,
    winston.format.printf(({ timestamp, level, message, context, meta, ...restMeta }) => {
      // Проверяем, является ли meta строкой
      const contextString = typeof meta === 'string' ? `[${meta}]` : context ? `[${context}]` : '';
      const metaString = typeof meta === 'object' && meta && Object.keys(meta).length ? ` - ${JSON.stringify(meta)}` : '';
      const additionalMetaString = Object.keys(restMeta).length ? ` - ${JSON.stringify(restMeta)}` : '';

      return `${timestamp} ${level}: ${contextString} ${message}${metaString}${additionalMetaString}`;
    })
  );
}

const logger = winston.createLogger({
  // Уровень задаётся переменной LOG_LEVEL (по умолчанию info на проде, debug в
  // разработке). Успешные HTTP-запросы morgan пишет в debug, поэтому на проде их
  // в логе нет вообще — чтобы разобрать инцидент с таймаутами, LOG_LEVEL=debug
  // поднимается в docker-compose плейбука без пересборки образа.
  level: config.log_level,
  format: buildLogFormat(config.env === 'production'),
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
