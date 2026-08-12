/**
 * Настройки контура для тестов, которые сбрасывают реестр модулей.
 *
 * `tests/setup-env.ts` настраивает каркас один раз на файл, но `jest.resetModules()`
 * поднимает свежий экземпляр `@coopenomics/extension-kit` — уже ненастроенный, и
 * первый же `platformSettings()` падает. Такому тесту нужно настроить каркас
 * заново, до динамического импорта проверяемого кода.
 */
export async function configurePlatformSettingsForTest(): Promise<void> {
  const { configurePlatformSettings } = await import('@coopenomics/extension-kit');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require('../../src/config/config').default;

  configurePlatformSettings({
    coopname: config.coopname,
    frontendUrl: config.frontend_url,
    backendUrl: config.backend_url,
    timezone: config.timezone,
    environment: config.env,
    blockchain: {
      rootGovernSymbol: config.blockchain.root_govern_symbol,
      rootGovernPrecision: config.blockchain.root_govern_precision,
      rootSymbol: config.blockchain.root_symbol,
      rootPrecision: config.blockchain.root_precision,
      postTransactChainReadDelayMs: config.blockchain.post_transact_chain_read_delay_ms,
      chainId: config.blockchain.id,
    },
  });
}
