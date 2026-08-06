module.exports = {
  // https://eslint.org/docs/user-guide/configuring#configuration-cascading-and-hierarchy
  // This option interrupts the configuration hierarchy at this file
  // Remove this if you have an higher level ESLint config file (it usually happens into a monorepos)
  root: true,

  // https://eslint.vuejs.org/user-guide/#how-to-use-a-custom-parser
  // Must use parserOptions instead of "parser" to allow vue-eslint-parser to keep working
  // `parser: 'vue-eslint-parser'` is already included with any 'plugin:vue/**' config and should be omitted
  parserOptions: {
    parser: require.resolve('@typescript-eslint/parser'),
    extraFileExtensions: ['.vue'],
  },

  env: {
    browser: true,
    es2021: true,
    node: true,
  },

  // Rules order is important, please avoid shuffling them
  extends: [
    // Base ESLint recommended rules
    // 'eslint:recommended',

    // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin#usage
    // ESLint typescript rules
    'plugin:@typescript-eslint/recommended',

    // Uncomment any of the lines below to choose desired strictness,
    // but leave only one uncommented!
    // See https://eslint.vuejs.org/rules/#available-rules
    'plugin:vue/vue3-essential', // Priority A: Essential (Error Prevention)
    // 'plugin:vue/vue3-strongly-recommended', // Priority B: Strongly Recommended (Improving Readability)
    // 'plugin:vue/vue3-recommended', // Priority C: Recommended (Minimizing Arbitrary Choices and Cognitive Overhead)

    // 'plugin:vue/vue3-recommended',
    'plugin:vue-pug/vue3-recommended',

    // https://github.com/prettier/eslint-config-prettier#installation
    // usage with Prettier, provided by 'eslint-config-prettier'.
    'prettier',
  ],

  plugins: [
    // required to apply rules which need type information
    '@typescript-eslint',
    // https://eslint.vuejs.org/user-guide/#why-doesn-t-it-work-on-vue-files
    // required to lint *.vue files
    'vue',
    // https://github.com/typescript-eslint/typescript-eslint/issues/389#issuecomment-509292674
    // Prettier has not been included as plugin to avoid performance impact
    // add it as an extension for your IDE
  ],

  globals: {
    ga: 'readonly', // Google Analytics
    cordova: 'readonly',
    __statics: 'readonly',
    __QUASAR_SSR__: 'readonly',
    __QUASAR_SSR_SERVER__: 'readonly',
    __QUASAR_SSR_CLIENT__: 'readonly',
    __QUASAR_SSR_PWA__: 'readonly',
    process: 'readonly',
    Capacitor: 'readonly',
    chrome: 'readonly',
  },

  overrides: [
    {
      files: ['alias-resolver.js', 'quasar.config.cjs', '**/*.cjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },

    // --- Границы ядра и расширений -------------------------------------
    // Ядро (src/**) не знает про расширения. Исключения ровно два:
    //  1. реестр установки — это composition root, он обязан их перечислять;
    //  2. ConnectionAgreementPage.vue — известный долг, см. ниже.
    {
      files: ['src/**/*.{ts,js,vue}'],
      excludedFiles: [
        'src/processes/init-installed-extensions/**',
        // Долг: страница ядра тянет виджет и стор из chatcoop напрямую.
        // Лечится переносом в расширение либо выносом точки монтирования.
        // Пока — здесь, на виду; новые такие импорты правило не пропустит.
        'src/pages/Union/ConnectionAgreement/ConnectionAgreementPage.vue',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/extensions/*/**'],
                message:
                  'Ядро не знает про расширения: прямой импорт из extensions/** запрещён. ' +
                  'Точка подключения — реестр установки, взаимодействие — через inter.',
              },
            ],
          },
        ],
      },
    },
    ...['capital', 'chairman', 'chatcoop', 'expenses', 'participant', 'powerup', 'reports', 'soviet'].map(
      (name) => ({
        files: [`extensions/${name}/**/*.{ts,js,vue}`],
        // Долг: два прямых кросс-импорта в expenses через алиас app/extensions/**.
        // Лечится портом в inter (api расходов + точка монтирования страницы).
        // Список не растёт — любой новый такой импорт упрётся в правило.
        excludedFiles: [
          'extensions/capital/app/extensions.ts',
          'extensions/soviet/install.ts',
        ],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: ['**/extensions/*/**', `!**/extensions/${name}/**`],
                  message:
                    'Граница расширения: прямой импорт чужого расширения запрещён. ' +
                    'Межрасширенческое взаимодействие — только через inter.',
                },
              ],
            },
          ],
        },
      }),
    ),
  ],

  // add your custom rules here
  rules: {
    'prefer-promise-reject-errors': 'off',

    quotes: ['warn', 'single', { avoidEscape: true }],

    // this rule, if on, would require explicit return type on the `render` function
    '@typescript-eslint/explicit-function-return-type': 'off',

    // in plain CommonJS modules, you can't use `import foo = require('foo')` to pass this rule, so it has to be disabled
    '@typescript-eslint/no-var-requires': 'off',

    // The core 'no-unused-vars' rules (in the eslint:recommended ruleset)
    // does not work with type definitions
    'no-unused-vars': 'off',

    '@typescript-eslint/no-explicit-any': 'off',

    // allow debugger during development only
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'vue/multi-word-component-names': 'off',
  },
};
