/**
 * Настройки контура для тестов, которые сбрасывают реестр модулей.
 *
 * `tests/setup-env.ts` выполняет предусловие один раз на файл, но
 * `jest.resetModules()` поднимает свежий экземпляр `@coopenomics/extension-kit`
 * — уже ненастроенный, и первый же `platformSettings()` падает. Такому тесту
 * нужно выполнить предусловие заново, до динамического импорта проверяемого
 * кода.
 */
export async function configurePlatformSettingsForTest(): Promise<void> {
  const { applyPlatformBootstrap } = await import('../../src/config/platform-bootstrap');
  applyPlatformBootstrap();
}
