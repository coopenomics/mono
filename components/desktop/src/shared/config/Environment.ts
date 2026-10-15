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
  // CoopID (Эпик 11): вход по паролю через authentik. Опциональны — пока не заданы,
  // desktop остаётся на легаси-входе по ключу (инвариант: легаси-токены живут до логаута).
  // ISSUER — например `https://coop.example/application/o/coopid/`; CLIENT_ID — публичный
  // OAuth2-клиент authentik для SPA+PKCE (инфра Эпика 5). База coop/* берётся из BACKEND_URL.
  COOPID_ISSUER?: string;
  COOPID_CLIENT_ID?: string;
  /**
   * Корневой ключ доверия — публичный ключ заверения АНО. С него начинается проверка
   * удостоверения: приложение не берёт корень из предъявленного кода, иначе проверка
   * ничего не значила бы.
   *
   * Задаётся окружением, потому что у испытательной сети корень свой. В поставке
   * значение по умолчанию вшито в пакет авторизации — окружение его перекрывает.
   */
  COOPID_TRUST_ANCHOR_KEY?: string;
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

/** Итог попытки выполнить config-скрипт: загружен, ответ не скрипт, скрипта нет. */
type ConfigScriptResult = 'loaded' | 'not-script' | 'missing';

/**
 * Синхронно запрашивает и выполняет config-скрипт по пути `path`.
 *
 * В dev-режиме Vite на несуществующий скрипт отдаёт index.html (catch-all для
 * SPA). eval(htmlString) бросает SyntaxError, который всплывает как "Quasar
 * boot error" и ломает последующую init-app, поэтому выполняется только ответ
 * с явным content-type JavaScript.
 */
function evalConfigScript(path: string): ConfigScriptResult {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${path}?t=${Date.now()}`, false); // false = синхронный запрос
    xhr.send();
    if (xhr.status !== 200) return 'missing';
    const ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
    if (!ct.includes('javascript')) return 'not-script';
    eval(xhr.responseText);
    return window.__APP_CONFIG__ ? 'loaded' : 'missing';
  } catch {
    return 'missing';
  }
}

/**
 * Синхронная загрузка config.js через блокирующий XMLHttpRequest
 * Используется как fallback когда переменные не инжектированы в HTML
 */
function loadConfigSync(): boolean {
  if (typeof window === 'undefined') return false;

  const primary = evalConfigScript('/config.js');
  // Ответ не скрипт — это catch-all dev-сервера: резервный путь не пробуем.
  if (primary !== 'missing') return primary === 'loaded';

  // Резервный config.default.js — для SPA-dev режима, где SSR middleware не
  // запущен и нет /config.js: без него фронт получает пустой BACKEND_URL.
  return evalConfigScript('/config.default.js') === 'loaded';
}

/** Пустой набор переменных — на время повторного входа в загрузку. */
function emptyEnv(): EnvVars {
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

/** Конфигурация браузера: инжектированная в HTML либо загруженная config-скриптом. */
function readWindowConfig(): EnvVars | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.__APP_CONFIG__ || loadConfigSync()) return window.__APP_CONFIG__ ?? null;
  } catch {
    // молча — ниже сработает fallback к process.env
  }
  return null;
}

/**
 * Fallback к process.env (для сервера или dev режима).
 *
 * SSR-сервер рендерит страницу внутри контура и за данными должен ходить к
 * соседнему nginx напрямую, а не наружу по публичному имени: через шлюз он
 * получает 403 (стенды) или лишний круг через L7 (прод), и страница
 * рендерится как для гостя. SSR_BACKEND_URL / SSR_CHAIN_URL действуют только
 * на сервере; браузеру по-прежнему уходят публичные адреса из injectEnv.
 */
function envFromProcess(): EnvVars {
  const onServer = typeof window === 'undefined';
  return {
    NODE_ENV: process.env.NODE_ENV as string,
    BACKEND_URL: ((onServer && process.env.SSR_BACKEND_URL) || process.env.BACKEND_URL) as string,
    CHAIN_URL: ((onServer && process.env.SSR_CHAIN_URL) || process.env.CHAIN_URL) as string,
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
    COOPID_ISSUER: process.env.COOPID_ISSUER as string,
    COOPID_CLIENT_ID: process.env.COOPID_CLIENT_ID as string,
    YANDEX_MAPS_API_KEY: process.env.YANDEX_MAPS_API_KEY as string,
  };
}

/**
 * Определение переменных окружения для разных сред
 * Автоматически загружает config.js если переменные недоступны
 */
function getEnv(): EnvVars {
  if (envCache) return envCache;
  // Предотвращаем множественные загрузки: в синхронном режиме повторный вход
  // получает объект с базовыми значениями.
  if (isLoading) return emptyEnv();

  isLoading = true;
  envCache = readWindowConfig() ?? envFromProcess();
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
