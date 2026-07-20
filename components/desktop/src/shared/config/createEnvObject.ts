import { EnvVars } from './Environment';

/**
 * Создает объект переменных окружения из process.env
 * Используется в SSR middleware, PWA boot файле и fallback логике
 */
export function createEnvObject(): EnvVars {

  //ТУТ НИ В КОЕМ СЛУЧАЕ И НЕ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ НЕ ДОЛЖНЫ БЫТЬ УКАЗАНЫ
  //CLIENT и SERVER, иначе, будет такая запутанная проблема, что хрен ты ее быстро отыщешь.
  const envObj = {
    NODE_ENV: process.env.NODE_ENV as string,
    BACKEND_URL: process.env.BACKEND_URL as string,
    CHAIN_URL: process.env.CHAIN_URL as string,
    CHAIN_ID: process.env.CHAIN_ID as string,
    CURRENCY: process.env.CURRENCY as string,
    COOP_SHORT_NAME: process.env.COOP_SHORT_NAME as string,
    SITE_DESCRIPTION: process.env.SITE_DESCRIPTION as string,
    SITE_IMAGE: process.env.SITE_IMAGE as string,
    STORAGE_URL: process.env.STORAGE_URL as string,
    // CLIENT: process.env.CLIENT as unknown as boolean,
    // SERVER: process.env.SERVER as unknown as boolean,
    UPLOAD_URL: process.env.UPLOAD_URL as string,
    TIMEZONE: process.env.TIMEZONE || 'Europe/Moscow',
    VUE_ROUTER_MODE: process.env.VUE_ROUTER_MODE as string,
    VUE_ROUTER_BASE: process.env.VUE_ROUTER_BASE as string,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY as string,
    SENTRY_DSN: process.env.SENTRY_DSN as string,
    OPENREPLAY_PROJECT_KEY: process.env.OPENREPLAY_PROJECT_KEY as string,
  };

  return envObj;
}
