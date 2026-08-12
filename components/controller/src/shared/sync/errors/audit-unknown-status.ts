/**
 * Story 6.5 (Epic 6): helper для эталонной точки `mapStatusToDomain`.
 * При попадании на default-ветку (unknown статус из цепи) пишет `logger.error`
 * с контекстом (entity, статус, ожидаемые статусы) — это audit-trail для schema drift.
 *
 * Возврата нет — caller сам решает, какой UNDEFINED-fallback использовать.
 */

export interface AuditLoggerLike {
  error(message: string, ...meta: any[]): void;
}

export function auditUnknownStatus(
  entityName: string,
  receivedStatus: unknown,
  logger: AuditLoggerLike,
  allowedStatuses?: ReadonlyArray<string>
): void {
  const expected = allowedStatuses && allowedStatuses.length > 0 ? `[${allowedStatuses.join(', ')}]` : 'не указано';
  logger.error(
    `UNKNOWN_ENTITY_STATUS ${entityName}: получен '${String(receivedStatus)}', ожидаются ${expected}`,
    { entityName, receivedStatus, allowedStatuses }
  );
}
