import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/** Устанавливается через `scripts/register-schema-gen-env.cjs` (-r) перед запуском generate-schema */
const isSchemaGeneration = process.env.CONTROLLER_SCHEMA_GEN === '1';

/**
 * Заглушки только для режима генерации schema.gql: реальные сервисы не вызываются,
 * но Zod и импорты резолверов получают валидный объект env.
 */
const SCHEMA_GEN_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: 'development',
  BACKEND_URL: 'http://127.0.0.1:2998',
  FRONTEND_URL: 'http://127.0.0.1:2999',
  SERVER_SECRET: 'schema-gen-server-secret',
  MONGODB_URL: 'mongodb://127.0.0.1:27017/schema-gen',
  JWT_SECRET: 'schema-gen-jwt-secret-min-length-placeholder-32',
  POSTGRES_USERNAME: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  POSTGRES_DATABASE: 'postgres',
  REDIS_HOST: '127.0.0.1',
  REDIS_PASSWORD: '',
  BLOCKCHAIN_RPC: 'http://127.0.0.1:8888',
  CHAIN_ID: 'cf057bbfb72640471fd910bcb67639c22df9f238706fab5919ce743a1f9efa38',
  NOVU_APP_ID: 'schema-gen',
  NOVU_API_KEY: 'schema-gen',
  VAPID_PUBLIC_KEY: 'BM_schema_gen_placeholder_public_key____________________________',
  VAPID_PRIVATE_KEY: 'schema_gen_placeholder_private_key',
  MATRIX_ADMIN_USERNAME: 'schema-gen',
  MATRIX_ADMIN_PASSWORD: 'schema-gen',
};

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
    .boolean()
    .default(true)
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

  // Параметры NOVU
  NOVU_APP_ID: z.string().min(1, { message: 'Не должно быть пустым' }),
  NOVU_BACKEND_URL: z.string().min(1, { message: 'Не должно быть пустым' }).default('https://novu.coopenomics.world/api'),
  NOVU_SOCKET_URL: z.string().min(1, { message: 'Не должно быть пустым' }).default('https://novu.coopenomics.world/ws'),
  NOVU_API_KEY: z.string().min(1, { message: 'Не должно быть пустым' }),
  NOVU_WEBHOOK_SECRET: z.string().min(1, { message: 'Не должно быть пустым' }).default('default-webhook-secret'),

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

  // Параметры OpenAI Whisper для STT
  OPENAI_API_KEY: z.string().optional().describe('OpenAI API ключ для Whisper STT'),
  OPENAI_BASE_URL: z.string().optional().describe('Базовый URL для Whisper API (через chatcoop-proxy nginx)'),
  WHISPER_MODEL: z.string().default('whisper-1').describe('Модель Whisper для STT'),
  WHISPER_LANGUAGE: z.string().default('ru').describe('Язык для Whisper STT'),

  // Файловое хранилище (MinIO в dev/контуре кооператива; S3 в проде по плану E59-N)
  MINIO_ENDPOINT: z
    .string()
    .default('http://minio:9000')
    .describe('Endpoint S3-совместимого бэкенда; в compose — service name'),
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
});

const envInput = isSchemaGeneration ? { ...SCHEMA_GEN_ENV_DEFAULTS, ...process.env } : process.env;

// Валидация переменных окружения
const envVars = envVarsSchema.safeParse(envInput);

if (!envVars.success) {
  const formattedErrors = envVars.error.format();

  const errorMessages = Object.keys(formattedErrors)
    .filter((key) => key !== '_errors')
    .map((key) => `${key}: параметр не установлен`)
    .join('\n');

  const hint = isSchemaGeneration
    ? '\n(Режим CONTROLLER_SCHEMA_GEN: проверьте, что новые обязательные поля добавлены в SCHEMA_GEN_ENV_DEFAULTS в src/config/config.ts.)\n'
    : '\n';
  console.error('❌ Ошибка конфигурации:\n', errorMessages, hint);
  process.exit(1); // Завершаем приложение в случае ошибки
}

// Экспорт настроек
export default {
  env: envVars.data.NODE_ENV,
  backend_url: envVars.data.BACKEND_URL,
  frontend_url: envVars.data.FRONTEND_URL,
  port: envVars.data.PORT,
  server_secret: envVars.data.SERVER_SECRET,
  timezone: envVars.data.TIMEZONE,
  blockchain: {
    url: envVars.data.BLOCKCHAIN_RPC,
    id: envVars.data.CHAIN_ID,
    root_symbol: envVars.data.ROOT_SYMBOL,
    root_govern_symbol: envVars.data.ROOT_GOVERN_SYMBOL,
    root_precision: envVars.data.ROOT_PRECISION,
    root_govern_precision: envVars.data.ROOT_GOVERN_PRECISION,
    post_transact_chain_read_delay_ms: envVars.data.POST_TRANSACT_CHAIN_READ_DELAY_MS,
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
  },
  coopname: envVars.data.COOPNAME,
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
  novu: {
    app_id: envVars.data.NOVU_APP_ID,
    backend_url: envVars.data.NOVU_BACKEND_URL,
    socket_url: envVars.data.NOVU_SOCKET_URL,
    api_key: envVars.data.NOVU_API_KEY,
    webhook_secret: envVars.data.NOVU_WEBHOOK_SECRET,
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
  file_storage: {
    endpoint: envVars.data.MINIO_ENDPOINT,
    access_key: envVars.data.MINIO_ACCESS_KEY,
    secret_key: envVars.data.MINIO_SECRET_KEY,
    bucket: envVars.data.MINIO_BUCKET || `coop-${envVars.data.COOPNAME}`,
    signing_secret: envVars.data.FILE_STORAGE_SIGNING_SECRET || envVars.data.SERVER_SECRET,
    public_base_url: envVars.data.FILE_STORAGE_PUBLIC_BASE_URL || envVars.data.BACKEND_URL,
  },
};
