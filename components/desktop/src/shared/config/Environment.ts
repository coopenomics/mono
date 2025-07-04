import { createEnvObject } from './createEnvObject';

// Типы для переменных окружения
export interface EnvVars {
  NODE_ENV: string;
  BACKEND_URL: string;
  CHAIN_URL: string;
  CHAIN_ID: string;
  CURRENCY: string;
  COOP_SHORT_NAME: string;
  SITE_DESCRIPTION: string;
  SITE_IMAGE: string;
  STORAGE_URL: string;
  UPLOAD_URL: string;
  TIMEZONE: string;
  CLIENT?: boolean;
  SERVER?: boolean;
  VUE_ROUTER_MODE: string;
  VUE_ROUTER_BASE: string;
  NOVU_APP_ID: string;
  NOVU_BACKEND_URL: string;
  NOVU_SOCKET_URL: string;
  [key: string]: string | boolean | undefined;
}

// Расширяем глобальный Window чтобы TypeScript понимал window.__ENV__
declare global {
  interface Window {
    __ENV__?: EnvVars;
  }
}

/**
 * Определение переменных окружения для разных сред
 * - На сервере (SSR): берем напрямую из process.env
 * - На клиенте (SSR): используем window.__ENV__, инжектированные с сервера
 * - В SPA режиме: переменные заменяются при сборке
 * - В PWA режиме: используем window.__ENV__, инжектированные через boot файл
 */
function getEnv(): EnvVars {
  // SSR сервер - сначала проверяем process.env для сервера
  if (typeof process !== 'undefined' && process.env && process.env.SERVER) {
    return createEnvObject();
  }

  // SSR клиент или PWA - проверяем window.__ENV__
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__;
  }

  // SPA сборка - fallback на process.env
  if (typeof process !== 'undefined' && process.env) {
    return createEnvObject();
  }

  // Запасной вариант, если ничего не сработало
  console.warn('Не удалось получить переменные окружения!');
  return {} as EnvVars;
}

// Экспортируем переменные окружения
export const env: EnvVars = getEnv();
