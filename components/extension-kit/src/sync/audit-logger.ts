import type { AuditLoggerLike } from './errors/audit-unknown-status';

/**
 * Журнал для аудита расхождений со схемой контракта.
 *
 * Аудит зовут не только сервисы, но и доменные сущности — а сущность создаётся
 * оператором `new`, а не контейнером, и своего логгера через инъекцию получить
 * не может. Раньше расширение обходило это, создавая `WinstonLoggerService`
 * ядра прямо в модуле сущности: за пределами монолита такого пути нет, и
 * расширение переставало собираться.
 *
 * Поэтому журнал каркасу передаёт composition root — тем же приёмом, что и
 * режим строгой проверки версии контракта (см. `sync-policy`). До настройки
 * работает запасной вариант через `console`: пакет обязан оставаться
 * работоспособным и вне контроллера.
 */
const consoleAuditLogger: AuditLoggerLike = {
  error(message: string, ...meta: any[]): void {
    console.error(message, ...meta);
  },
};

let currentAuditLogger: AuditLoggerLike = consoleAuditLogger;

/** Задать журнал аудита. Вызывается из composition root при старте. */
export function configureAuditLogger(logger: AuditLoggerLike): void {
  currentAuditLogger = logger;
}

/** Журнал аудита, которым пользуются каркас и расширения. */
export function auditLogger(): AuditLoggerLike {
  return currentAuditLogger;
}
