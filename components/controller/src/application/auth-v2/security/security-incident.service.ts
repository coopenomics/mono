import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NOT_ME_TOKEN_STORE } from '~/domain/auth-v2/ports/not-me-token-store.port';
import type { INotMeTokenStore } from '~/domain/auth-v2/ports/not-me-token-store.port';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';

/** Откуда пришёл сигнал «Это не я» — для аудита (не секрет). */
export type SuspiciousReportSource = 'settings' | 'one_click';

export interface ReportSuspiciousInput {
  subjectId: string;
  ip: string | null;
  source: SuspiciousReportSource;
  /** id сессии, помеченной как подозрительная (если известна — из настроек). */
  reportedSessionId?: string | null;
}

export interface ReportSuspiciousResult {
  /** Сколько сессий отозвано. */
  revoked: number;
}

/**
 * Реакция на подозрительный вход — флаг «Это не я» (CoopID, Story 3.10).
 *
 * Немедленное сдерживание: массовый отзыв **всех** сессий пайщика (и purge их метаданных
 * в Redis) — злоумышленник, даже если уже вошёл, теряет доступ на следующем обновлении
 * access-токена. Переиспользует {@link SessionsService.revokeAll}. Пишет инцидент в аудит
 * (`coopid.security.suspicious_login_reported`).
 *
 * Два входа: аутентифицированный (из настроек ЛК) и one-click по токену из письма о новом
 * устройстве (3.9) — последний работает без активной сессии, т.к. она может быть
 * скомпрометирована.
 *
 * **Граница (отложено в Story 3.3):** принудительная смена пароля при следующем входе и
 * ротация ключа в COOPOS. AC сам относит key rotation к 3.3; флаг принуждения без
 * enforcement-а на входе (этап пароля — в authentik) был бы мёртвым состоянием, поэтому
 * принуждение и ротация подключаются цельно в 3.3, потребляя тот же сигнал инцидента.
 */
@Injectable()
export class SecurityIncidentService {
  constructor(
    private readonly sessions: SessionsService,
    @Inject(NOT_ME_TOKEN_STORE) private readonly notMeTokens: INotMeTokenStore,
    private readonly audit: AuditService,
  ) {}

  /** Отчёт о подозрительном входе с известным subjectId (аутентифицированный путь). */
  async report(input: ReportSuspiciousInput): Promise<ReportSuspiciousResult> {
    const { revoked } = await this.sessions.revokeAll(input.subjectId, input.ip);
    await this.safeAudit({
      event: 'coopid.security.suspicious_login_reported',
      subjectId: input.subjectId,
      actor: input.subjectId,
      result: 'success',
      context: { source: input.source, reported_session_id: input.reportedSessionId ?? null, revoked_count: revoked },
      ip: input.ip,
    });
    return { revoked };
  }

  /** One-click путь: потребить токен из письма → subjectId → отчёт. */
  async reportByToken(token: string, ip: string | null): Promise<ReportSuspiciousResult> {
    const subjectId = await this.notMeTokens.consume(token);
    if (!subjectId) throw new BadRequestException('Ссылка недействительна или уже использована');
    return this.report({ subjectId, ip, source: 'one_click' });
  }

  /** Сессии уже отозваны к моменту аудита — недоступность audit-БД не должна давать 500. */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // аудит отдельный от крит-пути сдерживания
    }
  }
}
