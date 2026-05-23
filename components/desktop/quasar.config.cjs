/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

// const config = require('./src/shared/config/Env.ts');

const { configure } = require('quasar/wrappers');
const path = require('path');

require('dotenv').config();
module.exports = configure(function (ctx) {
  const isDev = ctx.dev;
  const isPWAEnabled = !isDev || process.env.ENABLE_PWA_DEV === 'true';

  const isSPA = ctx.mode.spa;
  // Загружаем переменные окружения всегда в режиме разработки
  // или только для клиентской части в продакшн
  const env =
    isDev || isSPA
      ? require('dotenv').config().parsed
      : {
          CLIENT: process.env.CLIENT,
          SERVER: process.env.SERVER,
        };

  return {
    htmlVariables: {
      SITE_TITLE: process.env.COOP_SHORT_NAME || 'Цифровой Кооператив',
      SITE_DESCRIPTION:
        process.env.SITE_DESCRIPTION ||
        'кооперативная экономика для сообществ и бизнеса',
      SITE_IMAGE:
        process.env.SITE_IMAGE || 'https://ia.media-imdb.com/images/rock.jpg',
    },
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ['widget', 'init', 'axios', 'sentry', 'network', 'chatwoot'],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: [
      '../app/styles/app.scss',
      '../app/styles/style.css',
      '../app/styles/variables.sass',
    ],
    sassVariables: '/src/app/styles/variables.sass',

    // , '../app/styles/quasar-variables.sass'
    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      'roboto-font', // optional, you are not bound to it
      'material-icons', // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node20',
      },

      // Alias для кода в `components/desktop/extensions/*`. Quasar CLI пробрасывает
      // его и в vite `resolve.alias`, и в автогенерированный `.quasar/tsconfig.json`
      // paths — один источник истины, tsc/vue-tsc/vite видят одно и то же.
      alias: {
        extensions: path.resolve(__dirname, './extensions'),
      },

      vueRouterMode: 'hash', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: require('dotenv').config().parsed,
      env,
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir

      extendViteConf(viteConf, { isClient, isServer }) {
        // Vite 8 / Rolldown: SSR server entry по умолчанию — server-entry.mjs, а prod webserver
        // (esbuild из @quasar/app-vite) импортирует ./server/server-entry.js — явно .js
        if (isServer && !isDev) {
          viteConf.build = viteConf.build || {};
          viteConf.build.rolldownOptions = viteConf.build.rolldownOptions || {};
          const ro = viteConf.build.rolldownOptions;
          ro.output = { ...(ro.output || {}), entryFileNames: 'server-entry.js' };
        }

        // Vite 8: server.forwardConsole — браузерный console / unhandled → терминал
        if (isDev) {
          viteConf.clearScreen = false;
          viteConf.server = viteConf.server || {};
          viteConf.server.forwardConsole = {
            unhandledErrors: true,
            logLevels: ['error', 'warn', 'info', 'log', 'debug'],
          };
          // Vite 5.4+ блокирует cross-origin Host без явного allowedHosts.
          // В dev-loop ходим через L7-прокси voskhod-dev.coopenomics.world,
          // partner-dev.coopenomics.world и api-dev.coopenomics.world — без
          // этой опции SSR/HMR-сервер возвращает 403 «Blocked request».
          viteConf.server.allowedHosts = [
            'voskhod-dev.coopenomics.world',
            'partner-dev.coopenomics.world',
            'api-dev.coopenomics.world',
            'localhost',
            '127.0.0.1',
          ];
        }

        if (!isClient) {
          return;
        }
        const stub = path.resolve(
          __dirname,
          './src/shared/lib/proxy/node-crypto-browser-stub.ts',
        );
        const prev = viteConf.resolve?.alias;
        if (Array.isArray(prev)) {
          prev.push({ find: 'node:crypto', replacement: stub });
        } else {
          viteConf.resolve = viteConf.resolve || {};
          viteConf.resolve.alias = {
            ...(typeof prev === 'object' && prev !== null ? prev : {}),
            'node:crypto': stub,
          };
        }
      },
      // viteVuePluginOptions: {},

      vitePlugins: [
        [
          'vite-plugin-checker',
          {
            // vueTsc отключён в dev — пожирал 100% CPU/RAM на больших правках
            // (Quasar + Vue 3 + Milkdown/BPMN/VueFlow/Mermaid/OpenLayers).
            // Типы проверяем отдельно: `pnpm typecheck` и в IDE через Volar.
            eslint: {
              lintCommand: 'eslint "./**/*.{js,ts,mjs,cjs,vue}"',
            },
            overlay: true,
          },
          { server: false },
        ],
      ],

      optimizeDeps: {
        include: ['@dicebear/core', '@dicebear/collection'],
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      https: false,
      // Vue DevTools + Vite: подключение скрипта в dev (расширение браузера)
      vueDevtools: false,
      open: false,
      port: 2999,
      strictPort: true,
      host: '0.0.0.0',
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {},
      lang: 'ru',

      iconSet: 'material-icons', // Quasar icon set

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: [
        'Notify',
        'Dialog',
        'LocalStorage',
        'Loading',
        'Meta',
        'Ripple',
      ],
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
    sourceFiles: {
      rootComponent: 'src/app/App.vue',
      router: 'src/app/providers/router',
      //   store: 'src/store/index',
      registerServiceWorker: isPWAEnabled
        ? 'src-pwa/register-service-worker'
        : undefined,
      serviceWorker: isPWAEnabled ? 'src-pwa/custom-service-worker' : undefined,
      pwaManifestFile: isPWAEnabled ? 'src-pwa/manifest.json' : undefined,
      //   electronMain: 'src-electron/electron-main',
      //   electronPreload: 'src-electron/electron-preload'
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: isPWAEnabled, // Включаем PWA в prod или при наличии флага ENABLE_PWA_DEV

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'generateConfig', // middleware для генерации config.js с переменными окружения
        'render', // keep this as last one
      ],

      // Не обрабатывать эти модули для SSR
      noExternal: ['@dicebear/core', '@dicebear/collection', '@editorjs/editorjs', '@editorjs/header', '@editorjs/list', '@editorjs/quote', '@editorjs/code', '@editorjs/inline-code', '@editorjs/marker'],
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: !isPWAEnabled
      ? {}
      : {
          workboxMode: 'GenerateSW', // Генерируем service worker и manifest.json автоматически
          injectPwaMetaTags: true,
          swFilename: 'service-worker.js',
          manifestFilename: 'manifest.json',
          useCredentialsForManifestTag: false,
          useFilenameHashes: true, // Включаем хеширование файлов
          extendGenerateSWOptions(cfg) {
            // Увеличиваем максимальный размер файла для кэширования
            cfg.maximumFileSizeToCacheInBytes = 5 * 1024 * 1024; // 5MB
            // Не включаем ревизию для определенных файлов
            cfg.dontCacheBustURLsMatching = /\.\w{8}\./;
          },
          extendManifestJson(json) {
            json.name = process.env.COOP_SHORT_NAME || 'Цифровой Кооператив';
            json.short_name = process.env.COOP_SHORT_NAME || 'Кооператив';
            json.description =
              process.env.SITE_DESCRIPTION ||
              'кооперативная экономика для сообществ и бизнеса';
            json.start_url = '/';
            json.display = 'standalone';
            json.categories = ['business', 'finance', 'productivity'];
            json.lang = 'ru';
            json.dir = 'ltr';
          },
          // extendPWACustomSWConf (esbuildConf) {}
        },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf)
      // extendElectronPreloadConf (esbuildConf)

      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'terminal',
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      contentScripts: ['my-content-script'],

      // extendBexScriptsConf (esbuildConf) {}
      // extendBexManifestJson (json) {}
    },
  };
});
