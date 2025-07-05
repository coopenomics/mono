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
  // Регистрируем только в production
  register(process.env.SERVICE_WORKER_FILE, {
    // The registrationOptions object will be passed as the second argument
    // to ServiceWorkerContainer.register()
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

    // registrationOptions: { scope: './' },

    ready(/* registration */) {
      // console.log('Service worker is active.')
    },

    registered(/* registration */) {
      // console.log('Service worker has been registered.')
    },

    cached(/* registration */) {
      // console.log('Content has been cached for offline use.')
    },

    updatefound(/* registration */) {
      // console.log('New content is downloading.')
    },

    updated(/* registration */) {
      // console.log('New content is available; please refresh.')
    },

    offline() {
      // console.log('No internet connection found. App is running in offline mode.')
    },

    error(/* err */) {
      // console.error('Error during service worker registration:', err)
    },
  });
}
