import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /**
     * Заглушки окружения. Единственная обязательная переменная —
     * SIMPLE_EXPLORER_API: `Cooperative.getOne` подставляет её в строку URL
     * ещё до вызова getFetch, а тот при NODE_ENV=test возвращает мок и в сеть
     * не ходит вовсе (src/Utils/getFetch.ts). Значение произвольное: mock
     * сопоставляется только по пути `/get-tables` и `/get-actions`
     * (src/Utils/mocks/matchMock.ts), хост не проверяется.
     *
     * Без этого прогон в CI падал на всех 73 тестах с «Env variable
     * SIMPLE_EXPLORER_API is required», хотя ни одного запроса наружу
     * не делается. Локально переменную подставлял .env разработчика.
     */
    env: {
      SIMPLE_EXPLORER_API: 'http://127.0.0.1:4000',
      DOCUMENTS_DIR: './documents',
    },
    globalSetup: './test/setup.ts',
    testTimeout: 120000,
    fileParallelism: false,
  },
})
