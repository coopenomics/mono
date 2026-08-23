import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_ACTION, type AuditActionMeta } from './audit-action.decorator';

/** Ключи, имена которых нельзя оставлять в audit-metadata (как secret-blacklist 8.2). */
const SECRET_KEY_PATTERNS = ['password', 'private_key', 'token', 'secret', 'signature'];

/**
 * Авто-аудит админ-действий (Story 8.5). Резолвер/endpoint, помеченный `@AuditAction`,
 * пишет `audit_events` автоматически: `event = coopid.<category>.<handlerName>`,
 * `subject_id = args.target_id || args.id`, `result = success|failure`,
 * `metadata = sanitizeArgs(args)` (ключи-секреты выкинуты).
 *
 * Извлечение user/args из GraphQL и HTTP — тем же приёмом, что `AuthorizationGuard` (6.4).
 * Запись best-effort (в `.catch`): аудит не подменяет исходный результат/ошибку резолвера.
 * Применяется точечно `@UseInterceptors(AuditActionInterceptor)` на admin-контроллере,
 * НЕ как глобальный APP_INTERCEPTOR (канон 6.4/6.5).
 */
@Injectable()
export class AuditActionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditActionInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditActionMeta | undefined>(AUDIT_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle(); // endpoint не помечен — не аудируем

    const { user, args } = this.extract(context);
    const event = `coopid.${meta.category}.${context.getHandler().name}`;
    const subjectId = (args.target_id ?? args.id ?? null) as string | null;
    const actor = (user?.username ?? null) as string | null;
    const metadata = this.sanitizeArgs(args);

    return next.handle().pipe(
      tap(() => {
        void this.record({ event, subjectId, actor, result: 'success', context: metadata });
      }),
      catchError((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        void this.record({ event, subjectId, actor, result: 'failure', context: { ...metadata, _error: message } });
        return throwError(() => error);
      }),
    );
  }

  /** best-effort: провал аудита не должен ронять/подменять ответ резолвера. */
  private async record(rec: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(rec);
    } catch (e) {
      this.logger.error(`audit-action запись не удалась (${rec.event}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private extract(context: ExecutionContext): { user: { username?: string } | undefined; args: Record<string, unknown> } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gql = GqlExecutionContext.create(context);
      const req = gql.getContext().req;
      const a = gql.getArgs<Record<string, unknown>>();
      const args = (a?.data ?? a?.filter ?? a ?? {}) as Record<string, unknown>;
      return { user: req?.user, args };
    }
    const req = context.switchToHttp().getRequest();
    const args = { ...(req?.params ?? {}), ...(req?.query ?? {}), ...(req?.body ?? {}) } as Record<string, unknown>;
    return { user: req?.user, args };
  }

  /**
   * Рекурсивно убирает ключи-секреты (на всех уровнях вложенности); выкинутые имена —
   * в `_redacted[]`. Именно удаление, а не маска значения: secret-blacklist `AuditService`
   * бросает на запретный КЛЮЧ, поэтому ключ оставлять нельзя.
   */
  private sanitizeArgs(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const redacted: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (SECRET_KEY_PATTERNS.some((p) => key.toLowerCase().includes(p))) {
        redacted.push(key);
        continue;
      }
      out[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? this.sanitizeArgs(value as Record<string, unknown>)
        : value;
    }
    if (redacted.length) out._redacted = redacted;
    return out;
  }
}
