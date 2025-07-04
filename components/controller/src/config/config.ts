import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  BASE_URL: z.string(),
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
    .default('3600')
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

  // Параметры NOVU
  NOVU_APP_ID: z.string().min(1, { message: 'Не должно быть пустым' }),
  NOVU_BACKEND_URL: z.string().min(1, { message: 'Не должно быть пустым' }).default('https://novu.coopenomics.world/api'),
  NOVU_SOCKET_URL: z.string().min(1, { message: 'Не должно быть пустым' }).default('https://novu.coopenomics.world/ws'),
  NOVU_API_KEY: z.string().min(1, { message: 'Не должно быть пустым' }),

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
});

// Валидация переменных окружения
const envVars = envVarsSchema.safeParse(process.env);

if (!envVars.success) {
  const formattedErrors = envVars.error.format();

  const errorMessages = Object.keys(formattedErrors)
    .filter((key) => key !== '_errors')
    .map((key) => `${key}: параметр не установлен`)
    .join('\n');

  console.error('❌ Ошибка конфигурации:\n', errorMessages);
  process.exit(1); // Завершаем приложение в случае ошибки
}

// Экспорт настроек
export default {
  env: envVars.data.NODE_ENV,
  base_url: envVars.data.BASE_URL,
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
  },
};
