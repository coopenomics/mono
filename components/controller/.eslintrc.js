const fs = require('fs');
const path = require('path');

// Список расширений читаем с диска, а не держим руками:
// новое расширение автоматически получает границу, о ней не надо помнить.
const extensionsDir = path.join(__dirname, 'src', 'extensions');
const extensions = fs
  .readdirSync(extensionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const BOUNDARY_MESSAGE =
  'Граница расширения: прямой импорт чужого расширения запрещён. ' +
  'Межрасширенческое взаимодействие — только через @coopenomics/inter ' +
  '(порт+токен в components/inter, биндинг в InterCommunicationBridgeModule).';

const CORE_MESSAGE =
  'Ядро не знает про расширения: импорт из ~/extensions/** в ядре запрещён. ' +
  'Расширение подключается через реестр и inter, а не прямой ссылкой.';

// Точки сборки. Им по определению нужно знать обо всех расширениях —
// это composition root, а не нарушение границы.
const COMPOSITION_ROOT = [
  'src/extensions/extensions.module.ts',
  'src/extensions/extensions.registry.ts',
  'src/extensions/inter-communication-bridge.module.ts',
  'src/extensions/base.extension.module.ts',
  'src/domain/extension/**/*.ts',
];

// Долг. Прямые импорты enum'ов из чужого расширения (capital -> expenses).
// Лечится переносом общих enum'ов в контракт; до тех пор список лежит здесь,
// на виду, и не растёт — любой новый файл упрётся в правило.
const CROSS_EXTENSION_DEBT = [
  'src/extensions/capital/application/dto/program_expenses/create-program-expense.input.ts',
  'src/extensions/capital/application/dto/program_expenses/program-expense.output.ts',
  'src/extensions/capital/application/services/program-expenses-management.service.ts',
];

// Внутри расширения X запрещены импорты из ~/extensions/<любое кроме X>/**.
// Собственное расширение через `~` разрешено — так уже написан capital.
const extensionBoundaryOverrides = extensions.map((name) => ({
  files: [`src/extensions/${name}/**/*.ts`],
  excludedFiles: [...COMPOSITION_ROOT, ...CROSS_EXTENSION_DEBT],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['~/extensions/*/**', `!~/extensions/${name}/**`],
            message: BOUNDARY_MESSAGE,
          },
        ],
      },
    ],
  },
}));

module.exports = {
  env: {
    node: true,
    jest: true,
    browser: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': 'off',
    'func-names': 'off',
    'no-underscore-dangle': 'off',
    'consistent-return': 'off',
    'jest/expect-expect': 'off',
    'security/detect-object-injection': 'off',

    // Правило «статус — всегда enum» здесь НЕ включено намеренно.
    // На всей базе оно даёт 21 срабатывание, и часть законна: статус,
    // прилетающий снаружи (livekit-webhook, yookassa), строкой и приходит.
    // Поэтому оно живёт в дифференциальном ярусе — scripts/lint-changed.sh,
    // то есть требуется только от кода, который мы трогаем.
  },
  overrides: [
    // Ядро не знает про расширения.
    {
      files: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/shared/**/*.ts',
        'src/utils/**/*.ts',
      ],
      excludedFiles: COMPOSITION_ROOT,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [{ group: ['~/extensions/*/**'], message: CORE_MESSAGE }],
          },
        ],
      },
    },
    ...extensionBoundaryOverrides,
    // Тесты не участвуют в границах: моки лезут куда угодно по своей природе.
    {
      files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
