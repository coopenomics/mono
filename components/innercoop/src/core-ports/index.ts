/**
 * `core-ports/` — контракты, которые ПРЕДОСТАВЛЯЕТ ядро, а потребляют расширения.
 * Адаптер живёт в ядре, регистрация — в `InnercoopBridgeModule` (ADR-10).
 */
export * from './file-storage.port';
export * from './ledger2-history.port';
export * from './logger.port';
