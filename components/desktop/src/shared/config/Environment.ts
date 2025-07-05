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
    console.log('DEBUG: Синхронная загрузка config.js');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/config.js?t=${Date.now()}`, false); // false = синхронный запрос
    xhr.send();

    if (xhr.status === 200) {
      // Выполняем JavaScript код из ответа
      eval(xhr.responseText);

      if (window.__APP_CONFIG__) {
        console.log('DEBUG: config.js загружен синхронно');
        return true;
      }
    }
  } catch (error) {
    console.warn('DEBUG: Ошибка синхронной загрузки config.js:', error);
  }

  // Пробуем загрузить резервную конфигурацию
  try {
    console.log('DEBUG: Загружаем резервную конфигурацию синхронно');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/config.default.js', false);
    xhr.send();

    if (xhr.status === 200) {
      eval(xhr.responseText);

      if (window.__APP_CONFIG__) {
        console.log('DEBUG: config.default.js загружен синхронно');
        return true;
      }
    }
  } catch (error) {
    console.warn('DEBUG: Ошибка загрузки резервной конфигурации:', error);
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
    console.log('DEBUG: Загрузка уже в процессе, ждем...');
    // В синхронном режиме просто возвращаем пустой объект
    return {} as EnvVars;
  }

  isLoading = true;
  console.log('DEBUG: getEnv() called');

  // Пробуем получить window.__APP_CONFIG__ (инжектированные в HTML)
  try {
    if (typeof window !== 'undefined' && window.__APP_CONFIG__) {
      console.log('DEBUG: Используем window.__APP_CONFIG__ из HTML');
      envCache = window.__APP_CONFIG__;
      isLoading = false;
      return envCache;
    } else if (typeof window !== 'undefined') {
      console.log(
        'DEBUG: window.__APP_CONFIG__ не найден, загружаем config.js',
      );

      // Пытаемся загрузить конфигурацию синхронно
      if (loadConfigSync() && window.__APP_CONFIG__) {
        envCache = window.__APP_CONFIG__;
        isLoading = false;
        return envCache;
      }
    } else {
      console.log('DEBUG: window недоступен (сервер)');
    }
  } catch (e) {
    console.error('DEBUG: Ошибка при работе с window:', e);
  }

  // Fallback к process.env (для сервера или dev режима)
  console.log('DEBUG: Используем process.env как fallback');
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
    NOVU_APP_ID: process.env.NOVU_APP_ID as string,
    NOVU_BACKEND_URL: process.env.NOVU_BACKEND_URL as string,
    NOVU_SOCKET_URL: process.env.NOVU_SOCKET_URL as string,
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
