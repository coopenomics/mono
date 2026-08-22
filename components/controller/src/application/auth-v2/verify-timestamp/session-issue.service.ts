import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { DegradedAuthReason } from '~/domain/auth-v2/degraded/degraded-auth.types';
import { SESSION_METADATA_PORT } from '~/domain/auth-v2/ports/session-metadata.port';
import type { ISessionMetadataStore } from '~/domain/auth-v2/ports/session-metadata.port';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { AuditService } from '../audit/audit.service';
import { CertificateService } from '../certificate/certificate.service';
import { DeviceTrackingService } from '../device-tracking/device-tracking.service';

export interface SessionIssueInput {
  /** user.id пайщика — субъект выпуска токенов. */
  userId: string;
  /** username (sub) — для сертификата и аудита. */
  sub: string;
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  degraded: boolean;
  degradedReason?: DegradedAuthReason;
}

export interface SessionIssueResult {
  access_token: string;
  refresh_token: string;
  /** participant_certificate (Story 1.8). Best-effort: при сбое выпуска вход не
   *  ломается — клиент дозапросит через GET /coop/certificate (там ошибка явная). */
  participant_certificate?: string;
  /** Degraded-вход (Story 4.5): ключ сверен против chain_manifests_cache, а не
   *  против живого COOPOS. Сигнал для UI/RP; присутствует только в degraded-режиме. */
  degraded?: boolean;
  degraded_reason?: DegradedAuthReason;
}

/**
 * Финализация входа CoopID — ЕДИНСТВЕННАЯ точка выпуска платформенных токенов
 * нового контура. Вызывается из двух мест: `VerifyTimestampService` (пароль +
 * доказательство ключа, факторы 2FA-входа не включены) и `LoginTwoFactorService`
 * (после прохождения ВСЕХ включённых факторов). Вынесена отдельно именно затем,
 * чтобы 2FA-гейт нельзя было обойти: до вызова `issue()` токены не существуют.
 *
 * Хвост — best-effort телеметрия входа (сертификат, device tracking, метаданные
 * сессии): их сбой не валит уже заслуженный вход.
 */
@Injectable()
export class SessionIssueService {
  private readonly logger = new Logger(SessionIssueService.name);

  constructor(
    private readonly tokens: TokenApplicationService,
    private readonly audit: AuditService,
    private readonly certificate: CertificateService,
    private readonly deviceTracking: DeviceTrackingService,
    @Inject(SESSION_METADATA_PORT) private readonly sessionMetadata: ISessionMetadataStore,
  ) {}

  async issue(input: SessionIssueInput): Promise<SessionIssueResult> {
    // выпуск токенов платформенным механизмом (id_token/certificate — Story 1.8).
    const pair = await this.tokens.generateAuthTokens(input.userId);

    // participant_certificate (Story 1.8) — best-effort: сбой выпуска не валит логин.
    let participant_certificate: string | undefined;
    try {
      participant_certificate = await this.certificate.issueForUsername(input.sub);
    } catch (e) {
      this.logger.warn(`participant_certificate не выпущен на verify для ${input.sub}: ${e instanceof Error ? e.message : e}`);
    }

    await this.safeAudit({ event: 'coopid.verify.timestamp', subjectId: input.sub, actor: input.sub, result: 'success', ip: input.ip });

    // Device tracking (Story 3.8) — best-effort: сбой не валит выданный вход.
    try {
      await this.deviceTracking.recordLogin({
        subjectId: input.userId,
        username: input.sub,
        ip: input.ip,
        userAgent: input.userAgent,
        acceptLanguage: input.acceptLanguage,
      });
    } catch (e) {
      this.logger.warn(`device tracking не записан на verify для ${input.sub}: ${e instanceof Error ? e.message : e}`);
    }

    // Метаданные сессии (Story 3.7) — best-effort: сбой side-store не валит выданный вход.
    // Привязаны к выпущенному refresh-токену → видны/отзываемы в «Активных сессиях».
    try {
      await this.sessionMetadata.record(pair.refresh.token, {
        ip: input.ip,
        device: input.userAgent,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn(`session metadata не записаны на verify для ${input.sub}: ${e instanceof Error ? e.message : e}`);
    }

    return {
      access_token: pair.access.token,
      refresh_token: pair.refresh.token,
      participant_certificate,
      ...(input.degraded ? { degraded: true, degraded_reason: input.degradedReason } : {}),
    };
  }

  /** Аудит не должен валить успешный вход (coop_domain_db недоступен → degraded-лог, не 500). */
  private async safeAudit(record: Parameters<AuditService['record']>[0]): Promise<void> {
    try {
      await this.audit.record(record);
    } catch {
      // намеренно проглатываем: audit-инфраструктура отдельна от auth-критпути
    }
  }
}
