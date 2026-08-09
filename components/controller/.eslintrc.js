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

// ── Инварианты CoopID / auth-v2 ──────────────────────────────────────────────
// Перенесены из components/controller/.eslintrc.json при мердже dev 2026-08-09:
// dev перевёл controller на .eslintrc.js и json удалил, а правила терять нельзя —
// они держат гексагональную границу auth-v2 и запрет секретов в логах (Story 8.7).

const HEX_MESSAGE =
  'Гексагональный инвариант auth-v2: application/ и domain/ не импортируют ' +
  'wharfkit/oidc-client-ts/ioredis напрямую — только через порты ' +
  '(infrastructure-адаптеры). excludedFiles — легаси-долг до перевода на CoopID.';

// Легаси-долг: файлы, написанные до введения границы. Список не растёт —
// любой новый файл упрётся в правило.
const HEX_DEBT = [
  'src/application/agreement/use-cases/agreement.interactor.ts',
  'src/application/decision/use-cases/decision.interactor.ts',
  'src/application/cooplace/interactors/cooplace.interactor.ts',
  'src/application/participant/interactors/participant.interactor.ts',
  'src/application/system/interactors/load-contacts.interactor.ts',
  'src/application/system/dto/blockchain-info.dto.ts',
  'src/application/system/interactors/wif.interactor.ts',
  'src/domain/process-registry/services/process-registry.service.ts',
  'src/domain/branch/interfaces/branch-blockchain.port.ts',
  'src/domain/common/ports/soviet-blockchain.port.ts',
  'src/domain/common/ports/blockchain.port.ts',
  'src/domain/blockchain/types/transaction-result.type.ts',
  'src/domain/cooplace/interfaces/cooplace-blockchain.port.ts',
  'src/domain/auth/services/auth-domain.service.ts',
];

const AUTHROLES_MESSAGE =
  'no-authroles-in-authv2: в auth-v2 запрещён роле-ориентированный @AuthRoles — ' +
  'используйте capability-ориентированный @CheckAbility + AuthorizationGuard. ' +
  'Legacy auth/ сохраняет @AuthRoles до чистки старого контура.';

const SECRET_NAMES =
  '(password|passwd|privatekey|private_key|secret|token|signature|wif|mnemonic|seed|credential)';

const SENSITIVE_LOG_MESSAGE =
  'no-sensitive-in-log (Story 8.7): секрет утечёт в production-логи. ' +
  'Не логируй секрет вовсе либо передавай объект — runtime-маскирование ' +
  'log-redaction замаскирует значение.';

// Четыре формы одного запрета: console.* и logger.*, переменная и поле объекта.
const noSensitiveLogSelectors = [
  `CallExpression[callee.object.name='console'][callee.property.name=/^(log|info|warn|error|debug)$/] > Identifier.arguments[name=/${SECRET_NAMES}/i]`,
  `CallExpression[callee.object.name='console'][callee.property.name=/^(log|info|warn|error|debug)$/] > MemberExpression.arguments[property.name=/${SECRET_NAMES}/i]`,
  `CallExpression[callee.property.name=/^(log|info|warn|error|debug|verbose)$/] > Identifier.arguments[name=/${SECRET_NAMES}/i]`,
  `CallExpression[callee.property.name=/^(log|info|warn|error|debug|verbose)$/] > MemberExpression.arguments[property.name=/${SECRET_NAMES}/i]`,
].map((selector) => ({ selector, message: SENSITIVE_LOG_MESSAGE }));

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

    // auth-v2: application/ и domain/ ходят во внешний мир только через порты.
    //
    // Внимание: ESLint для одного и того же правила берёт ПОСЛЕДНИЙ подходящий
    // override, поэтому здесь перечислены ОБА ограничения — и граница ядра
    // (CORE_MESSAGE) из override выше, и гексагональное. Если оставить только
    // второе, граница ядра для application/ и domain/ молча отключится.
    {
      files: ['src/application/**/*.ts', 'src/domain/**/*.ts'],
      excludedFiles: [...COMPOSITION_ROOT, ...HEX_DEBT, 'src/**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['~/extensions/*/**'], message: CORE_MESSAGE },
              {
                group: ['@wharfkit/*', 'oidc-client-ts', 'ioredis'],
                message: HEX_MESSAGE,
              },
            ],
          },
        ],
      },
    },
    // auth-v2: без @AuthRoles + без секретов в логах.
    {
      files: ['src/application/auth-v2/**/*.ts'],
      excludedFiles: ['src/**/*.spec.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "ImportSpecifier[imported.name='AuthRoles']",
            message: AUTHROLES_MESSAGE,
          },
          {
            selector: "Decorator[expression.callee.name='AuthRoles']",
            message: AUTHROLES_MESSAGE,
          },
          ...noSensitiveLogSelectors,
        ],
      },
    },
    // Остальной controller: запрет секретов в логах (без правила про @AuthRoles —
    // легаси-контур им пользуется законно).
    {
      files: ['src/**/*.ts'],
      excludedFiles: ['src/**/*.spec.ts', 'src/application/auth-v2/**/*.ts'],
      rules: {
        'no-restricted-syntax': ['error', ...noSensitiveLogSelectors],
      },
    },
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
