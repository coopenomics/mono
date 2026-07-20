import { ssrMiddleware } from 'quasar/wrappers';

// Динамический web app manifest: имя берётся из process.env коопа в РАНТАЙМЕ.
// Образ desktop generic, кооп задаётся env контейнера → статический manifest
// (этап сборки) коопа не знает и всегда отдаёт дефолтное имя.
//
// ВАЖНО: serveStatic('/') в src-ssr server'е регистрируется ДО user-middleware,
// поэтому путь /manifest.json перехватила бы статика Workbox (файл существует) и
// сюда бы не дошло. Поэтому отдаём по /manifest.webmanifest — статики там нет,
// запрос проваливается до этого middleware. <link rel="manifest"> в HTML
// переписывается на этот путь в generateConfig.ts.
export default ssrMiddleware(({ app }) => {
  app.get('/manifest.webmanifest', (req, res) => {
    const name = process.env.COOP_SHORT_NAME || 'Цифровой Кооператив';
    const description =
      process.env.SITE_DESCRIPTION ||
      'кооперативная экономика для сообществ и бизнеса';

    const manifest = {
      name,
      short_name: name,
      description,
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      categories: ['business', 'finance', 'productivity'],
      lang: 'ru',
      dir: 'ltr',
      icons: [
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
        { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    res.set({
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.send(JSON.stringify(manifest));
  });
});
