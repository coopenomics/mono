import { register } from 'register-service-worker';

// Логирование только в production или при явном включении PWA в dev
const isVerbose =
  process.env.NODE_ENV === 'production' ||
  process.env.ENABLE_PWA_DEV === 'true';

if (isVerbose) {
  console.log('=== register-service-worker.ts загружен ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('ENABLE_PWA_DEV:', process.env.ENABLE_PWA_DEV);
  console.log('PWA_MODE: generateSW (автоматическая генерация)');
}

// Определяем, нужно ли регистрировать Service Worker
const shouldRegisterSW =
  process.env.NODE_ENV === 'production' ||
  process.env.ENABLE_PWA_DEV === 'true';

// Объявляем глобальные переменные
declare global {
  interface Window {
    applyUpdate: () => void;
    checkForUpdate: () => void;
  }
}

// Флаг на уровне модуля — доступен как из блока регистрации SW, так и из controllerchange.
// Перезагрузка происходит ТОЛЬКО при подтверждённом обновлении (callback updated).
let hasPendingUpdate = false;
let isReloading = false;

// Автоматическая перезагрузка при смене SW-контроллера.
// updated callback устанавливает hasPendingUpdate = true → skipWaiting активирует новый SW
// → controllerchange срабатывает → перезагружаем страницу с новыми чанками.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isReloading && hasPendingUpdate) {
      isReloading = true;
      if (isVerbose) console.log('🔄 Автоматическая перезагрузка из-за обновления SW');
      window.location.reload();
    }
  });
}

if (!shouldRegisterSW) {
  if (isVerbose)
    console.log('Development режим без PWA - отключаем Service Worker');

  // Отключаем существующий service worker если он есть
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      if (isVerbose)
        console.log(
          'Найдено регистраций Service Worker:',
          registrations.length,
        );
      for (const registration of registrations) {
        if (isVerbose) console.log('Отключаем регистрацию:', registration);
        registration.unregister();
      }
    });
  }
  // Не регистрируем новый service worker
  if (isVerbose) console.log('Service Worker не будет зарегистрирован');
} else {
  if (isVerbose)
    console.log(
      'Регистрируем Service Worker (Production или PWA в Development)',
    );
  if (isVerbose)
    console.log('Файл Service Worker: генерируется автоматически (generateSW)');

  // Переменная для отслеживания обновлений
  let refreshing = false;
  let registrationInstance: any;

  // Применение обновления (доступно глобально через window). Вызывается из тоста
  // version-watch. НЕ зависит от того, выстрелил ли lifecycle-callback `updated`:
  // - если есть готовый waiting-SW → активируем его (SKIP_WAITING), перезагрузка
  //   произойдёт через глобальный controllerchange-слушатель;
  // - если waiting нет (SW ещё не подготовил бандл или его нет вовсе) → просто
  //   перезагружаем; свежий index/бандлы придут из SSR/сети (useFilenameHashes).
  const applyUpdate = function () {
    if (refreshing) return;
    refreshing = true;
    hasPendingUpdate = true; // разрешаем reload по controllerchange

    if (isVerbose) console.log('Применяем обновление...');

    if (registrationInstance && registrationInstance.waiting) {
      registrationInstance.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  // Функция для проверки доступности обновления
  const checkForUpdate = function () {
    if (registrationInstance) {
      if (isVerbose) console.log('Проверяем обновления...');
      registrationInstance.update();
    } else {
      if (isVerbose) console.log('Service Worker не зарегистрирован');
    }
  };

  // Диагностический таймстемп первого старта (грепается по слову BOOTRACE).
  const bootraceTs = (): string => {
    try {
      return `${Math.round(performance.now())}ms`;
    } catch {
      return '?';
    }
  };

  // [FIX-2] Регистрацию SW откладываем до window 'load'. Раньше register()
  // вызывался на этапе eval модуля — и фоновой precache всего build-manifest
  // (до 5 МБ/файл) стартовал ОДНОВРЕМЕННО с первой отрисовкой и догрузкой ленивых
  // чанков маршрутов, конкурируя за сеть. На холодном заходе в проде это и
  // приводило к провалу import() чанка → пустой router-view. После 'load'
  // критический путь уже отрисован, precache идёт «вторым эшелоном».
  const doRegister = () => {
    console.log(`[BOOTRACE] ${bootraceTs()} SW: старт регистрации (после window load)`);
    register(process.env.SERVICE_WORKER_FILE || '/service-worker.js', {
    // The registrationOptions object will be passed as the second argument
    // to ServiceWorkerContainer.register()
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

    // registrationOptions: { scope: './' },

    ready(registration) {
      if (isVerbose) console.log('Service Worker готов:', registration);
      registrationInstance = registration;
    },

    registered(registration) {
      if (isVerbose)
        console.log('Service Worker зарегистрирован:', registration);

      // Проверяем обновления только при фокусе окна
      let updateInterval;

      const checkForUpdates = () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      };

      // Проверяем обновления при фокусе окна, но не чаще чем раз в 5 минут
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!updateInterval) {
            checkForUpdates();
            updateInterval = setTimeout(
              () => {
                updateInterval = null;
              },
              5 * 60 * 1000,
            ); // 5 минут
          }
        }
      });
    },

    cached(registration) {
      if (isVerbose)
        console.log(
          'Контент кэширован для офлайн использования:',
          registration,
        );
    },

    updatefound(registration) {
      if (isVerbose)
        console.log('Найдено обновление Service Worker:', registration);

      // Показываем уведомление пользователю о доступном обновлении
      if ('Notification' in window && Notification.permission === 'granted') {
        // new Notification('Обновление доступно', {
        //   body: 'Выпущена новая версия приложения. Нажмите на уведомление, чтобы обновить приложение.',
        //   icon: '/icons/icon-192x192.png',
        // });
      }
    },

    updated(registration) {
      if (isVerbose)
        console.log(
          'Новый контент доступен, требуется обновление:',
          registration,
        );

      // Готовый waiting-SW — позволяет applyUpdate() активировать его без reload «вслепую».
      hasPendingUpdate = true;

      // НЕ показываем тост отсюда: lifecycle service worker'а ненадёжен (iOS
      // standalone PWA не пробрасывает событие, первая установка шлёт `cached`,
      // событие нет если бинарь SW не изменился). Триггер тоста перенесён в
      // version-watch (src/entities/AppVersion) по self-report ноды /version.

      // Показываем уведомление пользователю
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          // new Notification('Обновление доступно', {
          //   body: 'Выпущена новая версия приложения. Нажмите на уведомление, чтобы обновить приложение.',
          //   icon: '/icons/icon-192x192.png',
          //   requireInteraction: true,
          // }).onclick = () => {
          //   applyUpdate();
          // };
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              // new Notification('Обновление доступно', {
              //   body: 'Выпущена новая версия приложения. Нажмите на уведомление, чтобы обновить приложение.',
              //   icon: '/icons/icon-192x192.png',
              //   requireInteraction: true,
              // }).onclick = () => {
              //   applyUpdate();
              // };
            }
          });
        }
      }

      // Также можно показать сообщение в консоли
      if (isVerbose)
        console.log(
          '🔄 Обновление доступно! Вызовите applyUpdate() для применения обновления.',
        );
    },

    offline() {
      if (isVerbose)
        console.log(
          'Нет подключения к интернету. Приложение работает в офлайн режиме.',
        );

      // Показываем уведомление об офлайн режиме
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Офлайн режим', {
          body: 'Приложение работает в автономном режиме',
          icon: '/icons/icon-192x192.png',
        });
      }
    },

    error(err) {
      console.error('Ошибка регистрации Service Worker:', err);

      // Если Service Worker не может быть зарегистрирован, продолжаем работу без него
      if (isVerbose)
        console.log('Приложение будет работать без Service Worker');
    },
  });
  };

  // window.load уже мог пройти к моменту eval (SSR-гидратация быстрая) —
  // тогда регистрируем сразу, иначе ждём событие load.
  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', () => doRegister(), { once: true });
  }

  // Присваиваем функции глобальному объекту window
  window.applyUpdate = applyUpdate;
  window.checkForUpdate = checkForUpdate;

  // Обработка сообщений от Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (isVerbose) console.log('Сообщение от Service Worker:', event.data);

      if (event.data && event.data.type === 'OFFLINE_STATUS') {
        if (isVerbose) console.log('Статус офлайн:', event.data.offline);
      }
    });
  }
}

// Функция для проверки сетевого соединения
function checkNetworkStatus() {
  if ('navigator' in window && 'onLine' in navigator) {
    if (isVerbose)
      console.log('Статус сети:', navigator.onLine ? 'онлайн' : 'офлайн');

    // Отправляем статус в Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'NETWORK_STATUS',
        online: navigator.onLine,
      });
    }
  }
}

// Слушаем изменения сетевого статуса
if ('addEventListener' in window) {
  window.addEventListener('online', checkNetworkStatus);
  window.addEventListener('offline', checkNetworkStatus);
}

// Проверяем статус сети при загрузке
checkNetworkStatus();
