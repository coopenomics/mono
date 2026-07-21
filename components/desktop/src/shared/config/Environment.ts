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
  VAPID_PUBLIC_KEY: string;
  SENTRY_DSN: string;
  OPENREPLAY_PROJECT_KEY: string;
  YANDEX_MAPS_API_KEY: string;
}

// Расширяем глобальный Window чтобы TypeScript понимал window.__APP_CONFIG__
declare global {
  interface Window {
    __APP_CONFIG__?: EnvVars;
  }
}

// Кэш для переменных окружения
let envCache: EnvVars | null = null;
let isLoading = false;

/**
 * Синхронная загрузка config.js через блокирующий XMLHttpRequest
 * Используется как fallback когда переменные не инжектированы в HTML
 */
function loadConfigSync(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/config.js?t=${Date.now()}`, false); // false = синхронный запрос
    xhr.send();

    if (xhr.status === 200) {
      // В dev-режиме Vite на несуществующий /config.js отдаёт index.html
      // (catch-all для SPA). eval(htmlString) бросает SyntaxError, который
      // всплывает как "Quasar boot error" и ломает последующую init-app.
      // Запускаем eval только если content-type явно JavaScript.
      const ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
      if (!ct.includes('javascript')) {
        return false;
      }
      // Выполняем JavaScript код из ответа
      eval(xhr.responseText);

      if (window.__APP_CONFIG__) {
        return true;
      }
    }
  } catch {

  }

  // Пробуем резервный config.default.js (для SPA-dev режима, где SSR middleware
  // не запущен и нет /config.js — без этого фронт получает пустой BACKEND_URL).
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/config.default.js?t=${Date.now()}`, false);
    xhr.send();

    if (xhr.status === 200) {
      const ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
      if (!ct.includes('javascript')) {
        return false;
      }
      eval(xhr.responseText);
      if (window.__APP_CONFIG__) {
        return true;
      }
    }
  } catch {
    // молча — следующая ветка вернёт false
  }

  return false;
}

/**
 * Определение переменных окружения для разных сред
 * Автоматически загружает config.js если переменные недоступны
 */
function getEnv(): EnvVars {
  // Если уже есть кэш, возвращаем его
  if (envCache) {
    return envCache;
  }

  // Предотвращаем множественные загрузки
  if (isLoading) {

    // В синхронном режиме просто возвращаем объект с базовыми значениями
    return {
      NODE_ENV: 'development',
      BACKEND_URL: '',
      CHAIN_URL: '',
      CHAIN_ID: '',
      CURRENCY: '',
      COOP_SHORT_NAME: '',
      SITE_DESCRIPTION: '',
      SITE_IMAGE: '',
      STORAGE_URL: '',
      UPLOAD_URL: '',
      TIMEZONE: 'Europe/Moscow',
      VUE_ROUTER_MODE: '',
      VUE_ROUTER_BASE: '',
      VAPID_PUBLIC_KEY: '',
      SENTRY_DSN: '',
      OPENREPLAY_PROJECT_KEY: '',
      YANDEX_MAPS_API_KEY: '',
    };
  }

  isLoading = true;

  // Пробуем получить window.__APP_CONFIG__ (инжектированные в HTML)
  try {
    if (typeof window !== 'undefined' && window.__APP_CONFIG__) {
      envCache = window.__APP_CONFIG__;
      isLoading = false;
      return envCache;
    } else if (typeof window !== 'undefined') {
      // Пытаемся загрузить конфигурацию синхронно
      if (loadConfigSync() && window.__APP_CONFIG__) {
        envCache = window.__APP_CONFIG__;
        isLoading = false;
        return envCache;
      }
    } else {

    }
  } catch {

  }

  // Fallback к process.env (для сервера или dev режима)
  envCache = {
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
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY as string,
    SENTRY_DSN: process.env.SENTRY_DSN as string,
    OPENREPLAY_PROJECT_KEY: process.env.OPENREPLAY_PROJECT_KEY as string,
    YANDEX_MAPS_API_KEY: process.env.YANDEX_MAPS_API_KEY as string,
  };

  isLoading = false;
  return envCache;
}

/**
 * Очищает кэш переменных окружения
 * Используется когда нужно перезагрузить конфигурацию
 */
export function clearEnvCache(): void {
  envCache = null;
  isLoading = false;
}

/**
 * Ленивый геттер для переменных окружения
 * Автоматически загружает конфигурацию при первом обращении
 */
export const env = new Proxy({} as EnvVars, {
  get(target, prop) {
    const envVars = getEnv();
    return envVars[prop as keyof EnvVars];
  },
});
