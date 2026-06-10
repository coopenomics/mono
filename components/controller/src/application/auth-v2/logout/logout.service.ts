import { Injectable } from '@nestjs/common';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { tokenTypes } from '~/types/token.types';
import { AuditService } from '../audit/audit.service';

export interface LogoutInput {
  refreshToken?: string | null;
  accessToken?: string | null;
  ip?: string | null;
}

export interface LogoutResult {
  /** userId отозванного токена (для лога/контекста); null, если токен уже отсутствовал. */
  subjectId: string | null;
}

/**
 * RP-initiated logout (Story 1.10): отзыв refresh/access токенов текущей сессии.
 * Толерантен — не требует валидного access-токена (выйти можно и с истёкшим);
 * идемпотентен — повторный/пустой вызов не ошибка. Субъект для аудита берётся из
 * `userId` отозванного refresh-токена. Стандартный OIDC end-session с `id_token_hint`
 * придёт в Story 5.1; здесь — отзыв токенов платформенным механизмом, как legacy-logout.
 */
@Injectable()
export class LogoutService {
  constructor(
    private readonly tokens: TokenApplicationService,
    private readonly audit: AuditService,
  ) {}

  async logout(input: LogoutInput): Promise<LogoutResult> {
    let subjectId: string | null = null;

    if (input.refreshToken) {
      const revoked = await this.tokens.findOneAndDelete(input.refreshToken, tokenTypes.REFRESH);
      subjectId = revoked?.userId ?? null;
    }
    if (input.accessToken) {
      await this.tokens.findOneAndDelete(input.accessToken, tokenTypes.ACCESS);
    }

    await this.safeAudit({ event: 'coopid.logout', subjectId, actor: subjectId, result: 'success', ip: input.ip });

    return { subjectId };
  }

  /** Аудит не должен валить ответ logout (coop_domain_db недоступен → degraded-лог, не 500). */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // намеренно проглатываем: audit-инфраструктура отдельна от auth-критпути
    }
  }
}
