import type { InterFileStorageBucketSpec } from '@coopenomics/inter';

/**
 * Глобальный реестр бакетов, наполняется декоратором `@UseBucket` на этапе загрузки модулей.
 * Используется `FileStorageInfrastructureModule.forFeature(...)` для wire-up per-class providers
 * и `MinioFileStorageAdapter.onApplicationBootstrap` для логирования / диагностики.
 */
export interface RegisteredBucket {
  readonly cls: { readonly name: string };
  readonly spec: InterFileStorageBucketSpec;
}

const REGISTERED = new Map<{ name: string }, InterFileStorageBucketSpec>();

export const BucketRegistry = {
  add(cls: { name: string }, spec: InterFileStorageBucketSpec): void {
    const existing = REGISTERED.get(cls);
    if (existing && existing.name !== spec.name) {
      throw new Error(
        `BucketRegistry: класс ${cls.name} уже зарегистрирован под бакетом '${existing.name}', ` +
          `повторная регистрация под '${spec.name}' запрещена`,
      );
    }
    REGISTERED.set(cls, spec);
  },

  get(cls: { name: string }): InterFileStorageBucketSpec | undefined {
    return REGISTERED.get(cls);
  },

  list(): readonly RegisteredBucket[] {
    return Array.from(REGISTERED.entries()).map(([cls, spec]) => ({ cls, spec }));
  },

  /** Только для тестов: очистка реестра между сценариями. */
  _resetForTests(): void {
    REGISTERED.clear();
  },
};
