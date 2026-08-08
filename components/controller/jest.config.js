module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  // Локально dev-стек controller'а живёт в docker и параллельный пул jest
  // съедает CPU/RAM — вешает сервер. Любой `pnpm jest [...]` идёт в один воркер.
  maxWorkers: 1,
  restoreMocks: true,
  // Заглушки окружения до импорта тестовых модулей: спеки в src/ тянут реальные
  // сервисы, те — `~/config`, а он при невалидном env делает process.exit(1).
  // Без этого прогон в CI (где .env нет) умирает целиком. См. tests/setup-env.ts.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  // Интеграционные тесты против внешних сервисов (MinIO и т.п.) — не часть штатного `jest`-прогона.
  // Запускаются явно через `npm run test:integration:file-storage`.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$'],
  coveragePathIgnorePatterns: ['node_modules', 'src/config', 'src/app.ts', 'tests'],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  moduleNameMapper: {
    // tsconfig.baseUrl="./src" + paths={"~/*":["*"]} — дублируем здесь,
    // иначе ts-jest не резолвит `~/...` импорты в тестируемом коде.
    '^~/(.*)$': '<rootDir>/src/$1',
  },
};
