/**
 * Хранилище фабрики: порт и его реализации. Фабрика работает только через
 * порт; какую реализацию дать — решает тот, кто её создаёт (контроллер,
 * набор тестов, скрипт переноса).
 */
export * from './port'
export { MongoFactoryStorage } from './mongo'
export { MemoryFactoryStorage, matchesWhere } from './memory'
export { PostgresFactoryStorage } from './postgres'
