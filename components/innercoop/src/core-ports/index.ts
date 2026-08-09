/**
 * `core-ports/` — контракты, которые ПРЕДОСТАВЛЯЕТ ядро, а потребляют расширения.
 * Адаптер живёт в ядре, регистрация — в `InnercoopBridgeModule` (ADR-10).
 */
export * from './file-storage.port';
export * from './ledger2-history.port';
export * from './logger.port';
export * from './message-channel.port';
export * from './cooperative-vars.port';
export * from './document.port';
export * from './signed-document.port';
export * from './signature-info.contract';
export * from './meta-document.contract';
export * from './mono-account.contract';
