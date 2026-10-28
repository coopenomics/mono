import { defineConfig } from 'vitest/config'
import { BaseSequencer } from 'vitest/node'
import type { WorkspaceSpec } from 'vitest/node'

/** Путь файла из описания набора: кортеж [проект, путь] либо объект с moduleId. */
function specPath(spec: WorkspaceSpec): string {
  if (Array.isArray(spec))
    return String(spec[1])
  return String((spec as unknown as { moduleId?: string }).moduleId ?? spec)
}

/**
 * Файлы набора идут по имени, всегда в одном порядке.
 *
 * Тесты делят одну MongoDB: `udata.test.ts` стирает коллекцию udata,
 * `index.test.ts` и тесты «Образования» переписывают переменные кооператива,
 * `documents-1000-plus.test.ts` — номера договоров. Порядок файлов по
 * умолчанию у vitest не закреплён, и два прогона CI 28.10.2026 собрали
 * документы Благороста с разными номерами договора при одинаковом коде.
 * Эталоны (test/golden) требуют одного и того же состояния перед каждым
 * файлом, поэтому порядок задаётся явно.
 */
class AlphabeticalSequencer extends BaseSequencer {
  async sort(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    return [...files].sort((a, b) => specPath(a).localeCompare(specPath(b)))
  }
}

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
    sequence: { sequencer: AlphabeticalSequencer },
    testTimeout: 120000,
    fileParallelism: false,
  },
})
