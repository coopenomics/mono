import { t } from 'src/shared/i18n';
/**
 * Утилиты для обработки сетевых ошибок и проблем с background throttling
 */

/**
 * Создаёт fetch с retry логикой для борьбы с background throttling
 */
export function createRobustFetch(
  retries = 3,
  retryDelay = 1000,
  timeout = 10000,
) {
  return async function robustFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (typeof fetch === 'undefined') {
      throw new Error(t('app.error.fetchApiUnavailable'));
    }

    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        // Создаём AbortController для таймаута
        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller
          ? setTimeout(() => controller.abort(), timeout)
          : null;

        const response = await fetch(input, {
          ...init,
          signal: controller?.signal,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Если ответ успешный, возвращаем его
        if (response.ok) {
          return response;
        }

        // Если сервер вернул ошибку, но это не сетевая проблема
        if (response.status >= 400 && response.status < 500) {
          return response; // Возвращаем как есть для обработки на уровне приложения
        }

        // Для 5xx ошибок делаем retry
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Попытка ${i + 1}/${retries} неудачна:`, error);

        // Если это не последняя попытка, ждём и повторяем
        if (i < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (i + 1)),
          );
        }
      }
    }

    // Если все попытки неудачны, выбрасываем последнюю ошибку
    throw lastError || new Error(t('app.error.allFetchAttemptsFailed'));
  };
}

/**
 * Проверяет, находится ли вкладка в фоновом режиме
 */
export function isTabInBackground(): boolean {
  return (
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
}

/**
 * Ждёт, пока вкладка не станет активной
 */
export function waitForTabActive(timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve(); // В SSR окружении сразу резолвим
      return;
    }

    if (document.visibilityState === 'visible') {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      document.removeEventListener('visibilitychange', handler);
      reject(new Error(t('app.error.tabActiveTimeout')));
    }, timeout);

    const handler = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeoutId);
        document.removeEventListener('visibilitychange', handler);
        resolve();
      }
    };

    document.addEventListener('visibilitychange', handler);
  });
}

/**
 * Fetch с поддержкой background throttling
 */
export async function backgroundAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof fetch === 'undefined') {
    throw new Error(t('app.error.fetchApiUnavailable'));
  }

  // Если вкладка в фоне, ждём активации
  if (isTabInBackground()) {
    console.log('Вкладка в фоне, ждём активации перед выполнением запроса');
    try {
      await waitForTabActive(5000); // Ждём максимум 5 секунд
    } catch {
      console.warn(
        'Таймаут ожидания активности вкладки, выполняем запрос в фоне',
      );
    }
  }

  // Используем robust fetch
  const robustFetch = createRobustFetch();
  return robustFetch(input, init);
}

/**
 * Обработчик для Service Worker сообщений
 */
export function setupServiceWorkerErrorHandling() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_THROTTLE_ERROR') {
        console.warn('Service Worker сообщил об ошибке background throttling');

        // Можем показать уведомление пользователю
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(t('app.networkUtils.networkIssueTitle'), {
            body: t('app.networkUtils.networkIssueBody'),
            icon: '/icons/icon-192x192.png',
          });
        }
      }
    });
  }
}

/**
 * Мониторинг состояния сети
 */
export function setupNetworkMonitoring() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return; // Не работает в SSR
  }

  const updateOnlineStatus = () => {
    const status = navigator.onLine ? 'online' : 'offline';
    console.log(`Статус сети изменился: ${status}`);

    // Отправляем обновление в Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'NETWORK_STATUS_UPDATE',
        online: navigator.onLine,
      });
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Проверяем статус при инициализации
  updateOnlineStatus();
}

/**
 * Инициализация всех утилит
 */
export function initNetworkUtils() {
  if (typeof window === 'undefined') {
    // console.log('SSR окружение: пропускаем инициализацию network utils');
    return;
  }

  setupServiceWorkerErrorHandling();
  setupNetworkMonitoring();

  // console.log('Утилиты для работы с сетью инициализированы');
}

/**
 * Обёртка для axios с поддержкой background throttling
 */
export function createAxiosAdapter() {
  return async function backgroundAwareAxiosAdapter(config: any) {
    try {
      const response = await backgroundAwareFetch(config.url, {
        method: config.method?.toUpperCase() || 'GET',
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
      });

      return {
        data: await response.json(),
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
        request: config,
      };
    } catch (error: any) {
      throw {
        message: error.message,
        config,
        request: config,
        response: null,
        isAxiosError: true,
      };
    }
  };
}
