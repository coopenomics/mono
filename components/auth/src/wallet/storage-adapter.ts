/**
 * Подключаемый async key-value стор для персистентных артефактов кошелька
 * (локальная копия vault'а — Story 11.3). PIN-слой снят в 11.8 (модель «без PIN»).
 *
 * Абстракция нужна для кросс-рантайма (NFR26): в браузере — обёртка над
 * localStorage/IndexedDB, в desktop-runtime — своя реализация, в Node/тестах —
 * память. Крипто и логика хранения от среды не зависят.
 */
export interface StorageAdapter {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
}
