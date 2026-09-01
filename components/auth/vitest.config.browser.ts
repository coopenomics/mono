/**
 * Браузерный таргет cross-runtime smoke (Story 9.13): vitest browser mode,
 * playwright + chromium headless. Гоняет ТОЛЬКО test/cross-runtime/** —
 * остальные юнит-тесты пакета остаются Node-таргетом (`pnpm test`).
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/cross-runtime/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
      headless: true,
      screenshotFailures: false,
    },
  },
})
