import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 240000,
    hookTimeout: 240000,
    // Тесты пишут в один и тот же ончейн-state кооператива voskhod;
    // параллельный запуск вызывает гонки балансов (ledger2-migrate vs
    // registrator/wallet apply()). Гарантируем последовательность файлов.
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
})
