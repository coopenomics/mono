import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 240_000,
    hookTimeout: 240_000,
    // Все файлы пишут в одну цепь и одну базу стенда: параллельный запуск
    // давал бы гонки балансов и чужие строки в выборках. Строго по очереди.
    // Матрица прав (src/rights) запускается отдельной фазой после всех
    // сценариев: она зовёт мутации от лица каждой роли с чужими аргументами.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
