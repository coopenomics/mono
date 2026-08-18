/**
 * `cross-plugin-ports/` — контракты между расширениями через bridge.
 * Адаптер живёт в расширении-владельце (`<owner>/infrastructure/innercoop/*.adapter.ts`, ADR-10).
 * Если владелец не установлен — bridge регистрирует `null`, потребитель обязан это пережить (INV-013).
 */
export * from './chatcoop-calendar.port';
export * from './coop-calendar-event-notification.port';
export * from './expense-chassis.port';
export * from './matrix-room-messaging.port';
export * from './project-capital-clearance.port';
export * from './project-communication-artifacts.port';
export * from './capital-project-room.events';
