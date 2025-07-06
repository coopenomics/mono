import { register } from 'register-service-worker';

// Отключаем service worker в dev режиме
if (process.env.NODE_ENV === 'development') {
  // Отключаем существующий service worker если он есть
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  // Не регистрируем новый service worker
} else {
  // Обработчик сообщений от service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('PWA: Получено уведомление об обновлении service worker');
        // Можно добавить дополнительную логику для уведомления пользователя
      }
    });
  }

  // Регистрируем только в production
  register(process.env.SERVICE_WORKER_FILE, {
    // The registrationOptions object will be passed as the second argument
    // to ServiceWorkerContainer.register()
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

    // registrationOptions: { scope: './' },

    ready(_registration) {
      console.log('PWA: Service worker is active and ready');
    },

    registered(registration) {
      console.log('PWA: Service worker has been registered');
      // Проверяем обновления каждые 60 секунд
      setInterval(() => {
        registration.update();
      }, 60000);
    },

    cached(_registration) {
      console.log('PWA: Content has been cached for offline use');
    },

    updatefound(registration) {
      console.log('PWA: New content is downloading');

      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log(
              'PWA: New content is available, waiting for activation',
            );
          }
        });
      }
    },

    updated(_registration) {
      console.log('PWA: New content is available and has been updated');

      // Уведомляем пользователя об обновлении
      // Можно показать уведомление или автоматически перезагрузить
      setTimeout(() => {
        console.log('PWA: Reloading page to apply updates');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1000); // Небольшая задержка для завершения процессов
    },

    offline() {
      console.log(
        'PWA: No internet connection found. App is running in offline mode',
      );
    },

    error(err) {
      console.error('PWA: Error during service worker registration:', err);
    },
  });
}
