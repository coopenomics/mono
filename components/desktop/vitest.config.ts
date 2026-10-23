import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Юнит-тесты логики рабочего стола — чистые функции и модели без DOM и сети.
// Компоненты и экраны здесь не проверяются: это работа визуальных сценариев
// (docs-harness, workflow ui-docs). Прогон — CI (scripts/run-unit-tests.mjs).
export default defineConfig({
  resolve: {
    alias: { src: fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
});
