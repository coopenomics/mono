import { SetMetadata } from '@nestjs/common';

/** Ключ метаданных, который читает `AuditActionInterceptor` (Story 8.5). */
export const AUDIT_ACTION = 'coopid:audit-action';

/** Описание метки авто-аудита: категория действия (по умолчанию `admin`). */
export interface AuditActionMeta {
  category: string;
}

/**
 * Помечает резолвер/endpoint для автоматического аудита админ-действия (Story 8.5):
 * `AuditActionInterceptor` пишет `audit_events` без ручного вызова `AuditService.record`
 * в каждом резолвере (защита от человеческого фактора). Имя события строится из имени
 * хэндлера: `coopid.<category>.<handlerName>`.
 *
 * @example `@AuditAction()` → `coopid.admin.changeRoles`
 */
export function AuditAction(category = 'admin'): MethodDecorator & ClassDecorator {
  const meta: AuditActionMeta = { category };
  return SetMetadata(AUDIT_ACTION, meta);
}
