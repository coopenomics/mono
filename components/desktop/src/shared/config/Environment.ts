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
 */
function getEnv(): EnvVars {
  console.log('DEBUG: getEnv() called');
  console.log('DEBUG: process.env.SERVER:', process.env?.SERVER);
  console.log('DEBUG: process.env.CLIENT:', process.env?.CLIENT);

  // Пробуем получить window.__ENV__ (для SSR клиента и PWA)
  try {
    if (window && window.__ENV__) {
      console.log('DEBUG: Используем window.__ENV__');
      console.log('DEBUG: window.__ENV__:', window.__ENV__);
      return window.__ENV__;
    }
  } catch (e) {
    console.log('DEBUG: window недоступен (сервер)');
  }

  // Используем process.env (для SSR сервера и SPA сборки)
  if (process && process.env) {
    console.log('DEBUG: Используем process.env, создаем через createEnvObject');
    return createEnvObject();
  }

  // Запасной вариант, если ничего не сработало
  console.warn('Не удалось получить переменные окружения!');
  console.warn('DEBUG: Все проверки не сработали');
  return {} as EnvVars;
}

// Экспортируем переменные окружения
export const env: EnvVars = getEnv();
