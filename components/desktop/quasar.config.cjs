/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

// const config = require('./src/shared/config/Env.ts');

const { configure } = require('quasar/wrappers');
const path = require('path');

module.exports = configure(function (ctx) {
  const isDev = ctx.dev;

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
    boot: ['init', 'i18n', 'axios', 'sentry'],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: [
      '../app/styles/app.scss',
      '../app/styles/style.css',
      '../app/styles/quasar-variables.sass',
    ],
    sassVariables: '/src/app/styles/quasar-variables.sass',

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

      // extendViteConf(viteConf) {},
      // viteVuePluginOptions: {},

      vitePlugins: [
        [
          '@intlify/vite-plugin-vue-i18n',
          {
            // if you want to use Vue I18n Legacy API, you need to set `compositionOnly: false`
            // compositionOnly: false,

            // if you want to use named tokens in your Vue I18n messages, such as 'Hello {name}',
            // you need to set `runtimeOnly: false`
            // runtimeOnly: false,

            // you need to set i18n resource including paths !
            include: path.resolve(__dirname, './src/i18n/**'),
          },
        ],
        [
          'vite-plugin-checker',
          {
            vueTsc: {
              tsconfigPath: 'tsconfig.vue-tsc.json',
            },
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
      // https: true
      vueDevtools: false,
      open: false, // opens browser window automatically
      port: 3005,
      hmr: {
        // clientPort: 3005,
        //   overlay: false
      },
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
      registerServiceWorker: isDev
        ? undefined
        : 'src-pwa/register-service-worker',
      serviceWorker: isDev ? undefined : 'src-pwa/custom-service-worker',
      pwaManifestFile: isDev ? undefined : 'src-pwa/manifest.json',
      //   electronMain: 'src-electron/electron-main',
      //   electronPreload: 'src-electron/electron-preload'
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: !isDev, // Отключаем PWA в dev режиме

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'generateConfig', // middleware для генерации config.js с переменными окружения
        'render', // keep this as last one
      ],

      // Не обрабатывать эти модули для SSR
      noExternal: ['@dicebear/core', '@dicebear/collection'],
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: isDev
      ? {}
      : {
          workboxMode: 'injectManifest', // or 'generateSW'
          injectPwaMetaTags: true,
          swFilename: 'sw.js',
          manifestFilename: 'manifest.json',
          useCredentialsForManifestTag: false,
          // Отключаем использование хешей в именах файлов для лучшей совместимости
          useFilenameHashes: false,
          // extendGenerateSWOptions (cfg) {}
          extendInjectManifestOptions(cfg) {
            // Добавляем дополнительные настройки для Workbox
            cfg.globIgnores = cfg.globIgnores || [];
            cfg.globIgnores.push(
              '**/*.map',
              '**/config.js',
              '**/config.default.js',
            );

            // Настройки для лучшей обработки обновлений
            cfg.skipWaiting = false; // Управляем этим в custom service worker
            cfg.clientsClaim = false; // Управляем этим в custom service worker
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
            // Добавляем дополнительные настройки для лучшей работы PWA
            json.orientation = 'portrait-primary';
            json.prefer_related_applications = false;
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
