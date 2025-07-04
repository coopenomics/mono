import { EnvVars } from './Environment';

/**
 * Создает объект переменных окружения из process.env
 * Используется в SSR middleware, PWA boot файле и fallback логике
 */
export function createEnvObject(): EnvVars {
  console.log('DEBUG: createEnvObject() called');
  console.log('DEBUG: process.env.BACKEND_URL:', process.env.BACKEND_URL);
  console.log('DEBUG: process.env.NODE_ENV:', process.env.NODE_ENV);

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
    UPLOAD_URL: process.env.UPLOAD_URL as string,
    TIMEZONE: process.env.TIMEZONE || 'Europe/Moscow',
    CLIENT: process.env.CLIENT as unknown as boolean,
    SERVER: process.env.SERVER as unknown as boolean,
    VUE_ROUTER_MODE: process.env.VUE_ROUTER_MODE as string,
    VUE_ROUTER_BASE: process.env.VUE_ROUTER_BASE as string,
    NOVU_APP_ID: process.env.NOVU_APP_ID as string,
    NOVU_BACKEND_URL: process.env.NOVU_BACKEND_URL as string,
    NOVU_SOCKET_URL: process.env.NOVU_SOCKET_URL as string,
  };

  console.log('DEBUG: createEnvObject result:', envObj);
  return envObj;
}
