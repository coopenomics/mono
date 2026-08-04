import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * Отслеживание версий и оповещение об обновлении.
 *
 * Заменяет ненадёжный триггер от lifecycle service worker'а. Сравнивает
 * «запущенную» версию (запечена в бандл при сборке) с «доступной» (self-report
 * SSR-ноды через /version). При расхождении — тост `sw:update-available`
 * (boot pwa-update); перезагрузка ТОЛЬКО по кнопке «Обновить», без авто-reload
 * после того как пользователь уже видит приложение.
 *
 * Структура — реестр компонентов (ключ → версии). Сейчас только `shell`.
 */

// Запечённая при сборке версия клиента (CalVer, lockstep через lerna).
const LOCAL_VERSION = (process.env.APP_VERSION as string) || 'dev';

// Та же каденция, что у SW-троттла обновления: раз в 5 минут + при возврате на вкладку.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const VERSION_URL = '/version';
// Повторные попытки на холодном старте: /version может не успеть после
// blue-green switch или краткого 502 на nginx.
const STARTUP_RETRY_MS = [0, 1500, 4000];

type ComponentKey = 'shell' | `ext:${string}`;

interface IComponentVersion {
  running: string;
  available: string | null;
}

export const useUpdateWatch = defineStore('updateWatch', () => {
  const components = ref<Record<string, IComponentVersion>>({
    shell: { running: LOCAL_VERSION, available: null },
  });

  // Запущенная версия шелла — для отображения в UI.
  const currentVersion = computed(() => components.value.shell.running);

  // Компонент устарел, если известна доступная версия и она != запущенной.
  const isOutdated = (key: ComponentKey): boolean => {
    const c = components.value[key];
    return !!c && !!c.available && c.available !== c.running;
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let listenersBound = false;
  // Гасит повтор тоста по одной и той же версии (опрос идёт по таймеру).
  let lastNotified: string | null = null;

  // Self-report ноды. В SPA/без ноды /version отдаёт index.html → не JSON →
  // возвращаем null, оповещение не показываем (приложение не ломаем).
  const fetchShellVersion = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) return null;
      const data = (await res.json()) as { version?: unknown };
      // 'unknown' — нода не смогла определить версию (мисконфиг сборки). Не
      // считаем расхождением, чтобы не спамить тостом при каждом опросе.
      if (typeof data.version !== 'string' || data.version === 'unknown') {
        return null;
      }
      return data.version;
    } catch {
      return null;
    }
  };

  // Подтянуть новый service-worker.js в waiting — чтобы «Обновить» могло
  // сделать SKIP_WAITING, а не только hardReload «вслепую».
  const pullServiceWorkerUpdate = (): void => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { checkForUpdate?: () => void };
    if (typeof w.checkForUpdate === 'function') {
      w.checkForUpdate();
    }
  };

  const notifyIfOutdated = (key: ComponentKey): void => {
    const c = components.value[key];
    if (!c || !isOutdated(key)) return;
    if (lastNotified === c.available) return;
    lastNotified = c.available;
    pullServiceWorkerUpdate();
    // Только тост — пользователь сам жмёт «Обновить». Без авто-hardReload:
    // приложение уже на экране, принудительный reload недопустим.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sw:update-available'));
    }
  };

  const check = async (): Promise<boolean> => {
    const version = await fetchShellVersion();
    if (!version) return false;
    components.value.shell.available = version;
    notifyIfOutdated('shell');
    return true;
  };

  // Холодный старт: несколько попыток, чтобы тост не потерялся из-за
  // краткого сбоя /version сразу после деплоя.
  const checkWithStartupRetries = async (): Promise<void> => {
    for (const delay of STARTUP_RETRY_MS) {
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      const ok = await check();
      if (ok) return;
    }
  };

  const scheduleNext = (): void => {
    if (typeof window === 'undefined') return; // SSR-safe
    stop();
    timer = setTimeout(() => {
      if (document.visibilityState === 'visible') void check();
      scheduleNext();
    }, CHECK_INTERVAL_MS);
  };

  const start = (): void => {
    if (typeof window === 'undefined') return; // не запускаем на сервере (SSR)
    if (!listenersBound) {
      listenersBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
      });
      // bfcache / восстановление вкладки — visibilitychange иногда не горит.
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) void check();
      });
      window.addEventListener('focus', () => {
        void check();
      });
    }
    void checkWithStartupRetries();
    scheduleNext();
  };

  const stop = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { components, currentVersion, isOutdated, check, start, stop };
});
