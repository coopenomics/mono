/**
 * Хранилище фабрики: порт и его реализации. Фабрика работает только через
 * порт; какую реализацию дать — решает тот, кто её создаёт: контроллер и
 * набор тестов дают PostgreSQL, отдельные проверки — память.
 */
export * from './port'
export { MemoryFactoryStorage, matchesWhere } from './memory'
export { PostgresFactoryStorage } from './postgres'
export { FACTORY_STORAGE_DDL } from './schema'
