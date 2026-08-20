import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { PLACEHOLDER_ENV_DEFAULTS } from './placeholder-env';

// Файл настроек лежит в корне пакета, а глубина текущего файла зависит от
// режима запуска: в исходниках это `src/config`, в сборке — `dist/src/config`.
// Поэтому поднимаемся вверх, пока не найдём .env, и не привязываемся к числу
// уровней
const envPath = (() => {
  let dir = __dirname;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(__dirname, '../../.env');
})();

dotenv.config({ path: envPath });

/** Устанавливается через `scripts/register-schema-gen-env.cjs` (-r) перед запуском generate-schema */
const isSchemaGeneration = process.env.CONTROLLER_SCHEMA_GEN === '1';

/**
 * Идентификатор основной сети Коопеномики.
 *
 * NODE_ENV различить контуры не может: в шаблоне docker-compose плейбука он
 * жёстко выставлен в `production` и на тестовом узле, и на боевом. Единственный
 * параметр, который реально приходит из inventory разным, — CHAIN_ID.
 */
const MAINNET_CHAIN_ID = '6e37f9ac0f0ea717bfdbf57d1dd5d7f0e2d773227d9659a63bbf86eec0326c1b';


const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  BACKEND_URL: z
    .string()
    .min(1)
    .describe('Публичный базовый URL API (GraphQL/REST), без завершающего слэша; ICS-лента, интеграции'),
  FRONTEND_URL: z
    .string()
    .min(1)
    .describe('Публичный базовый URL рабочего стола (SPA); ссылки в письмах и deep links'),
  SERVER_SECRET: z.string(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .optional()
    .describe(
      'Уровень логов winston. По умолчанию info на проде и debug в разработке. ' +
        'На debug в лог попадают успешные HTTP-запросы с временем ответа (morgan successHandler) — ' +
        'без этого в логе видны только ответы 4xx/5xx, и латентность по логам не измерить',
    ),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  MONGODB_URL: z.string().describe('Mongo DB url'),
  JWT_SECRET: z.string().describe('JWT secret key'),
  JWT_ACCESS_EXPIRATION_MINUTES: z
    .string()
    .default('30')
    .transform((val) => parseInt(val, 10)),
  JWT_REFRESH_EXPIRATION_DAYS: z
    .string()
    .default('30')
    .transform((val) => parseInt(val, 10)),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10)),
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10)),
  JWT_INVITE_EXPIRATION_MINUTES: z
    .string()
    .default('315360000') // 10 лет в секундах
    .transform((val) => parseInt(val, 10)),
  SMTP_HOST: z.string().default(''), // Задаём пустую строку по умолчанию
  SMTP_PORT: z
    .string()
    .default('587') // Пример порта по умолчанию
    .transform((val) => parseInt(val, 10)),
  SMTP_USERNAME: z.string().default(''), // Пустая строка для необязательного значения
  SMTP_PASSWORD: z.string().default(''), // Пустая строка для необязательного значения
  EMAIL_FROM: z.string().default(''), // Пустая строка для необязательного значения
  // HTTP→SMTP релей (@coopenomics/email-relay). Если URL задан — письма уходят
  // POST'ом на релей вместо прямого SMTP (хостинг кооператива может резать порты).
  EMAIL_RELAY_URL: z.string().default(''),
  EMAIL_RELAY_TOKEN: z.string().default(''),
  COOPNAME: z.string().min(1, { message: 'Не должно быть пустым' }).default('voskhod'), // Задаём дефолтное значение, пустая строка невалидна
  TIMEZONE: z.string().min(1, { message: 'Не должно быть пустым' }).default('Europe/Moscow'), // Пустая строка невалидна
  GRAPHQL_SERVICE: z
    .string()
    .min(1, { message: 'Не должно быть пустым' })
    .default('http://localhost:4090')
    .describe('адрес сервиса GRAPHQL'),
  PROVIDER_BASE_URL: z.string().default('').describe('базовый URL сервиса провайдера'),

  // Параметры союза кооперативов
  UNION_LINK: z
    .string()
    .default('https://союз-русь.рф/anketa')
    .describe('ссылка на анкету для получения членства в союзе кооперативов'),
  IS_UNIONED: z
    .string()
    .default('true')
    .transform((v) => v === 'true')
    .describe('флаг, указывающий что требуется членство в союзе для подключения к кооперативной экономике'),
  MATRIX_UNION_PERSON_ID: z.string().optional().describe('Matrix userId представителя союза для связи с кооперативами'),
  MATRIX_UNION_NAME: z.string().default('СПО РУСЬ').describe('Название союза для подписания комнат связи'),

  // Новые переменные для PostgreSQL
  POSTGRES_HOST: z.string().min(1, { message: 'Не должно быть пустым' }).default('127.0.0.1'),
  POSTGRES_PORT: z
    .string()
    .default('5432')
    .transform((val) => parseInt(val, 10)),
  POSTGRES_USERNAME: z.string().min(1, { message: 'Не должно быть пустым' }),
  POSTGRES_PASSWORD: z.string().min(1, { message: 'Не должно быть пустым' }),
  POSTGRES_DATABASE: z.string().min(1, { message: 'Не должно быть пустым' }),

  REDIS_HOST: z.string().min(1, { message: 'Не должно быть пустым' }),
  REDIS_PORT: z
    .string()
    .default('6379')
    .transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string(),
  BLOCKCHAIN_RPC: z.string().min(1, { message: 'Не должно быть пустым' }),
  CHAIN_ID: z.string().min(1, { message: 'Не должно быть пустым' }),
  /** Задержка (мс) перед get_table_rows после мутации; 0 — отключить */
  POST_TRANSACT_CHAIN_READ_DELAY_MS: z
    .string()
    .default('1000')
    .transform((val) => parseInt(val, 10)),
  /**
   * Задержка (мс) перед emit'ом action-события во внутреннюю шину. Даёт
   * дельтам того же блока сохраниться в БД раньше, чем обработчики action
   * полезут читать состояние (DEC-007, ранее хардкод-константа 3000).
   */
  BLOCKCHAIN_ACTION_EMIT_DELAY_MS: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  /**
   * Story 4.4: глобальный выключатель ежечасного retention-крона архива
   * invalidated_entities/invalidated_entity_versions. На малом объёме (нынешний
   * кооператив) данные могут копиться годами — отключить кроном.
   */
  BLOCKCHAIN_ARCHIVE_RETENTION_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  /**
   * Story 4.4: cron-расписание retention. Default — ежечасно. RETENTION_HORIZON_BLOCKS
   * (=1000) хардкод в BlockchainArchiveRetentionService — не вынесен в env намеренно
   * (свойство сети, не оператора).
   */
  BLOCKCHAIN_ARCHIVE_RETENTION_CRON: z.string().default('0 * * * *'),
  /**
   * Story 6.5: при `true` mapper-fail (mapDeltaToBlockchainData → null) перестаёт
   * быть silent loss и поднимается `UnsupportedContractVersionError` из
   * `AbstractEntitySyncService.processDelta`. Парсер не ACK'ает delta — DLQ
   * сработает. Default `false` для не-ломать-прод-немедленно; включается после
   * подтверждения, что schema drift отсутствует (например на стенде).
   */
  BLOCKCHAIN_UNSUPPORTED_VERSION_STRICT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * Как часто пересчитывается отставание узла от головы цепи. Тик стоит один
   * RPC `get_info` и одно чтение Redis, поэтому дёшев; от него же зависит,
   * насколько быстро рабочий стол узнает, что узел вернулся в строй.
   */
  BLOCKCHAIN_SYNC_TICK_MS: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  /**
   * Отставание (в блоках), с которого рабочий стол считается неработоспособным
   * и закрывается заглушкой. Порог входа выше порога выхода намеренно —
   * см. `BLOCKCHAIN_SYNC_HEALTHY_LAG_BLOCKS`.
   */
  BLOCKCHAIN_SYNC_LAGGING_LAG_BLOCKS: z
    .string()
    .default('40')
    .transform((val) => parseInt(val, 10)),
  /**
   * Отставание, ниже которого узел снова считается догнавшим. Обязано быть
   * меньше порога входа: на живой сети отставание колеблется вокруг границы, и
   * при одном пороге заглушка замигает посреди работы.
   */
  BLOCKCHAIN_SYNC_HEALTHY_LAG_BLOCKS: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10)),
  /**
   * Сколько тиков подряд узел обязан продержаться у головы, чтобы заглушка
   * снялась. Вторая половина гистерезиса: порог по блокам гасит дрожание
   * амплитуды, счётчик тиков — дрожание по времени.
   */
  BLOCKCHAIN_SYNC_HEALTHY_TICKS: z
    .string()
    .default('3')
    .transform((val) => parseInt(val, 10)),
  /**
   * Окно, после которого неподвижный курсор парсера считается обрывом чтения
   * цепи, а не медленным догоном. Курсор обновляется на каждом обработанном
   * блоке, поэтому тишина дольше нескольких десятков секунд — это остановка.
   */
  BLOCKCHAIN_SYNC_STALE_CURSOR_SECONDS: z
    .string()
    .default('60')
    .transform((val) => parseInt(val, 10)),

  // Параметры VAPID для web push
  VAPID_PUBLIC_KEY: z.string().min(1, { message: 'VAPID_PUBLIC_KEY не должен быть пустым' }),
  VAPID_PRIVATE_KEY: z.string().min(1, { message: 'VAPID_PRIVATE_KEY не должен быть пустым' }),
  VAPID_SUBJECT: z.string().default('mailto:admin@coopenomics.world'),

  // Параметры блокчейна
  ROOT_SYMBOL: z.string().default('AXON'),
  ROOT_GOVERN_SYMBOL: z.string().default('RUB'),
  ROOT_PRECISION: z
    .string()
    .default('4')
    .transform((val) => parseInt(val, 10)),
  ROOT_GOVERN_PRECISION: z
    .string()
    .default('4')
    .transform((val) => parseInt(val, 10)),

  // Параметры Matrix
  MATRIX_HOMESERVER_URL: z.string().default('https://matrix.coopenomics.world'),
  MATRIX_ADMIN_USERNAME: z.string(),
  MATRIX_ADMIN_PASSWORD: z.string(),
  MATRIX_CLIENT_URL: z.string().default('https://element.coopenomics.world'),
  MATRIX_COMMON_ROOM_ID: z.string().optional(),

  // Параметры Sentry для отслеживания ошибок
  SENTRY_DSN: z.string().optional().describe('Sentry DSN для отслеживания ошибок'),

  // Параметры GitHub
  GITHUB_TOKEN: z.string().optional().describe('GitHub токен для доступа к API'),

  // Параметры LiveKit для секретаря-агента
  LIVEKIT_URL: z.string().optional().describe('LiveKit server URL (ws://livekit:7880)'),
  LIVEKIT_API_KEY: z.string().optional().describe('LiveKit API key для генерации токенов'),
  LIVEKIT_API_SECRET: z.string().optional().describe('LiveKit API secret для генерации токенов'),

  // Параметры геокодера (провайдер-агностично; реализация выбирается через GEOCODER_PROVIDER)
  GEOCODER_PROVIDER: z
    .enum(['yandex', 'noop'])
    .default('noop')
    .describe('Провайдер геокодинга адресов: yandex | noop (отключён). Будущие: google, maps.me'),
  GEOCODER_API_KEY: z
    .string()
    .optional()
    .describe('API ключ выбранного провайдера геокодинга'),
  GEOCODER_BASE_URL: z
    .string()
    .optional()
    .describe('Базовый URL HTTP API геокодера (пусто — дефолт провайдера)'),
  GEOCODER_RATE_LIMIT_RPS: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .describe('Локальный rate-limit на запросы к провайдеру геокодинга (req/sec)'),
  GEOCODER_TIMEOUT_MS: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .describe('Таймаут одиночного HTTP-запроса к провайдеру геокодинга (ms)'),

  // Параметры OpenAI Whisper для STT
  OPENAI_API_KEY: z.string().optional().describe('OpenAI API ключ для Whisper STT'),
  OPENAI_BASE_URL: z.string().optional().describe('Базовый URL для Whisper API (через chatcoop-proxy nginx)'),
  WHISPER_MODEL: z.string().default('whisper-1').describe('Модель Whisper для STT'),
  WHISPER_LANGUAGE: z.string().default('ru').describe('Язык для Whisper STT'),

  // Файловое хранилище (MinIO в dev/контуре кооператива; S3 в проде по плану E59-N).
  // MINIO_ENDPOINT без default: если не задан — file storage стартует в no-op,
  // HeadBucket не делается, операции get/put отдают понятную ошибку.
  MINIO_ENDPOINT: z
    .string()
    .optional()
    .describe('Endpoint S3-совместимого бэкенда; в compose — service name. Пусто = file storage отключён.'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin').describe('Access-key для MinIO/S3'),
  MINIO_SECRET_KEY: z.string().default('minioadmin').describe('Secret-key для MinIO/S3'),
  MINIO_BUCKET: z
    .string()
    .optional()
    .describe('Имя физического бакета; по умолчанию `coop-${COOPNAME}`'),
  FILE_STORAGE_SIGNING_SECRET: z
    .string()
    .optional()
    .describe('HMAC-секрет для подписи read-URL; пусто — берётся SERVER_SECRET'),
  FILE_STORAGE_PUBLIC_BASE_URL: z
    .string()
    .optional()
    .describe('База публичного URL контроллера для read-URL; пусто — берётся BACKEND_URL'),
  MIN_SOVIET_MEMBERS_COUNT: z
    .string()
    .optional()
    .describe('Минимум членов совета при install; пусто — 3 на production, 1 на development/test'),
});

const envInput = isSchemaGeneration ? { ...PLACEHOLDER_ENV_DEFAULTS, ...process.env } : process.env;

// Валидация переменных окружения
const envVars = envVarsSchema.safeParse(envInput);

if (!envVars.success) {
  const formattedErrors = envVars.error.format();

  const errorMessages = Object.keys(formattedErrors)
    .filter((key) => key !== '_errors')
    .map((key) => `${key}: параметр не установлен`)
    .join('\n');

  const hint = isSchemaGeneration
    ? '\n(Режим CONTROLLER_SCHEMA_GEN: проверьте, что новые обязательные поля добавлены в PLACEHOLDER_ENV_DEFAULTS в src/config/placeholder-env.ts.)\n'
    : '\n';
  console.error('❌ Ошибка конфигурации:\n', errorMessages, hint);
  process.exit(1); // Завершаем приложение в случае ошибки
}

// Экспорт настроек
export default {
  env: envVars.data.NODE_ENV,
  log_level: envVars.data.LOG_LEVEL ?? (envVars.data.NODE_ENV === 'development' ? 'debug' : 'info'),
  backend_url: envVars.data.BACKEND_URL,
  frontend_url: envVars.data.FRONTEND_URL,
  port: envVars.data.PORT,
  server_secret: envVars.data.SERVER_SECRET,
  timezone: envVars.data.TIMEZONE,
  blockchain: {
    url: envVars.data.BLOCKCHAIN_RPC,
    id: envVars.data.CHAIN_ID,
    /** Узел работает в основной сети. Любая другая цепь (тестовая, локальная) — false. */
    is_mainnet: envVars.data.CHAIN_ID === MAINNET_CHAIN_ID,
    root_symbol: envVars.data.ROOT_SYMBOL,
    root_govern_symbol: envVars.data.ROOT_GOVERN_SYMBOL,
    root_precision: envVars.data.ROOT_PRECISION,
    root_govern_precision: envVars.data.ROOT_GOVERN_PRECISION,
    post_transact_chain_read_delay_ms: envVars.data.POST_TRANSACT_CHAIN_READ_DELAY_MS,
    action_emit_delay_ms: envVars.data.BLOCKCHAIN_ACTION_EMIT_DELAY_MS,
    archive_retention_enabled: envVars.data.BLOCKCHAIN_ARCHIVE_RETENTION_ENABLED,
    archive_retention_cron: envVars.data.BLOCKCHAIN_ARCHIVE_RETENTION_CRON,
    unsupported_version_strict: envVars.data.BLOCKCHAIN_UNSUPPORTED_VERSION_STRICT,
    sync_tick_ms: envVars.data.BLOCKCHAIN_SYNC_TICK_MS,
    sync_lagging_lag_blocks: envVars.data.BLOCKCHAIN_SYNC_LAGGING_LAG_BLOCKS,
    sync_healthy_lag_blocks: envVars.data.BLOCKCHAIN_SYNC_HEALTHY_LAG_BLOCKS,
    sync_healthy_ticks: envVars.data.BLOCKCHAIN_SYNC_HEALTHY_TICKS,
    sync_stale_cursor_seconds: envVars.data.BLOCKCHAIN_SYNC_STALE_CURSOR_SECONDS,
  },
  mongoose: {
    url: envVars.data.MONGODB_URL + (envVars.data.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      // useCreateIndex: true,
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.data.JWT_SECRET,
    accessExpirationMinutes: envVars.data.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.data.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.data.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.data.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    inviteExpirationMinutes: envVars.data.JWT_INVITE_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.data.SMTP_HOST,
      port: envVars.data.SMTP_PORT,
      auth: {
        user: envVars.data.SMTP_USERNAME,
        pass: envVars.data.SMTP_PASSWORD,
      },
    },
    from: envVars.data.EMAIL_FROM,
    relay: {
      url: envVars.data.EMAIL_RELAY_URL,
      token: envVars.data.EMAIL_RELAY_TOKEN,
    },
  },
  coopname: envVars.data.COOPNAME,
  min_soviet_members_count: envVars.data.MIN_SOVIET_MEMBERS_COUNT
    ? parseInt(envVars.data.MIN_SOVIET_MEMBERS_COUNT, 10)
    : envVars.data.NODE_ENV === 'production'
      ? 3
      : 1,
  graphql_service: envVars.data.GRAPHQL_SERVICE,
  provider_base_url: envVars.data.PROVIDER_BASE_URL,
  union: {
    link: envVars.data.UNION_LINK,
    is_unioned: envVars.data.IS_UNIONED,
    union_person_id: envVars.data.MATRIX_UNION_PERSON_ID,
    union_name: envVars.data.MATRIX_UNION_NAME,
  },
  postgres: {
    host: envVars.data.POSTGRES_HOST,
    port: envVars.data.POSTGRES_PORT,
    username: envVars.data.POSTGRES_USERNAME,
    password: envVars.data.POSTGRES_PASSWORD,
    database: envVars.data.POSTGRES_DATABASE,
  },
  redis: {
    host: envVars.data.REDIS_HOST,
    port: envVars.data.REDIS_PORT,
    password: envVars.data.REDIS_PASSWORD,
  },
  vapid: {
    public_key: envVars.data.VAPID_PUBLIC_KEY,
    private_key: envVars.data.VAPID_PRIVATE_KEY,
    subject: envVars.data.VAPID_SUBJECT,
  },
  matrix: {
    homeserver_url: envVars.data.MATRIX_HOMESERVER_URL,
    client_url: envVars.data.MATRIX_CLIENT_URL,
    admin_username: envVars.data.MATRIX_ADMIN_USERNAME,
    admin_password: envVars.data.MATRIX_ADMIN_PASSWORD,
    common_room_id: envVars.data.MATRIX_COMMON_ROOM_ID,
  },
  sentry: {
    dsn: envVars.data.SENTRY_DSN,
  },
  github: {
    token: envVars.data.GITHUB_TOKEN,
  },
  livekit: {
    url: envVars.data.LIVEKIT_URL,
    api_key: envVars.data.LIVEKIT_API_KEY,
    api_secret: envVars.data.LIVEKIT_API_SECRET,
  },
  openai: {
    api_key: envVars.data.OPENAI_API_KEY,
    base_url: envVars.data.OPENAI_BASE_URL,
    whisper_model: envVars.data.WHISPER_MODEL,
    whisper_language: envVars.data.WHISPER_LANGUAGE,
  },
  geocoder: {
    provider: envVars.data.GEOCODER_PROVIDER,
    api_key: envVars.data.GEOCODER_API_KEY,
    base_url: envVars.data.GEOCODER_BASE_URL,
    rate_limit_rps: envVars.data.GEOCODER_RATE_LIMIT_RPS,
    timeout_ms: envVars.data.GEOCODER_TIMEOUT_MS,
  },
  file_storage: {
    endpoint: envVars.data.MINIO_ENDPOINT,
    access_key: envVars.data.MINIO_ACCESS_KEY,
    secret_key: envVars.data.MINIO_SECRET_KEY,
    bucket: envVars.data.MINIO_BUCKET || `coop-${envVars.data.COOPNAME}`,
    signing_secret: envVars.data.FILE_STORAGE_SIGNING_SECRET || envVars.data.SERVER_SECRET,
    public_base_url: envVars.data.FILE_STORAGE_PUBLIC_BASE_URL || envVars.data.BACKEND_URL,
  },
};
