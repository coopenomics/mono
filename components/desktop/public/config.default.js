// Резервная конфигурация для SPA-dev режима (когда SSR middleware
// `generateConfig.ts` не запущен и /config.js отдаёт SPA fallback).
// Адреса соответствуют локальному стеку из docker-compose.yml: backend
// на :2998, EOSIO chain на :8888, mongo на :27047, postgres на :5532.
// В CI/prod этот файл переопределяется реальным /config.js, который
// генерирует SSR.

console.warn(
  'Используется резервная конфигурация config.default.js! Убедитесь, что config.js генерируется SSR middleware в production.',
);

window.__APP_CONFIG__ = {
  NODE_ENV: 'development',
  BACKEND_URL: 'http://127.0.0.1:2998',
  CHAIN_URL: 'http://127.0.0.1:8888',
  CHAIN_ID: 'db79c8409645082749ca50640d6f4ee511575acf26c4e2c8e4748e6bf6a01ed4',
  CURRENCY: 'RUB',
  COOP_SHORT_NAME: 'DEV Кооператив',
  SITE_DESCRIPTION: 'кооперативная экономика для сообществ и бизнеса',
  SITE_IMAGE: 'https://ia.media-imdb.com/images/rock.jpg',
  STORAGE_URL: 'http://127.0.0.1:2998/storage',
  UPLOAD_URL: 'http://127.0.0.1:2998/upload',
  TIMEZONE: 'Europe/Moscow',
  VUE_ROUTER_MODE: 'hash',
  VUE_ROUTER_BASE: '/',
  NOVU_APP_ID: 'BTaPV0bRL0dz',
  NOVU_BACKEND_URL: 'https://novu.coopenomics.world/api',
  NOVU_SOCKET_URL: 'https://novu.coopenomics.world',
  VAPID_PUBLIC_KEY: 'BLomcBkzOF0jGYU_kfZ07-dhl6_euyZKGoZb-yKcP6vzNXvb49DQgce_7EyXhL4PPwS0MklVYQbq_mzJhFiLHaw',
  SENTRY_DSN: '',
  OPENREPLAY_PROJECT_KEY: '',
  YANDEX_MAPS_API_KEY: '',
};
