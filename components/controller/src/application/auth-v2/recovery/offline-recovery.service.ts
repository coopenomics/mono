import { createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import config from '~/config/config';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { OFFLINE_RECOVERY_CODE_REPOSITORY } from '~/domain/auth-v2/ports/offline-recovery-code.port';
import type { IOfflineRecoveryCodeRepository } from '~/domain/auth-v2/ports/offline-recovery-code.port';
import { RECOVERY_TOKEN_STORE } from '~/domain/auth-v2/ports/recovery-token-store.port';
import type { IRecoveryTokenStore } from '~/domain/auth-v2/ports/recovery-token-store.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { AuditService } from '../audit/audit.service';
import { RecoveryStrategyService } from './recovery-strategy.service';

/** TTL recovery-токена — как у magic-link (Story 3.1): 5 минут. */
const RECOVERY_TOKEN_TTL_SEC = 5 * 60;

/**
 * Альтернативный recovery по offline-коду (CoopID, Story 3.4).
 *
 * Печатный код, выданный при on-boarding, — первый канал для пайщика без доступа
 * к email. При совпадении keyed-hash выдаётся тот же recovery-токен, что и у
 * magic-link (Story 3.1); завершение — через двухканальный confirm (Story 3.2):
 * второй фактор TOTP + новый материал. Код single-use.
 */
@Injectable()
export class OfflineRecoveryService {
  private readonly logger = new Logger(OfflineRecoveryService.name);

  constructor(
    @Inject(OFFLINE_RECOVERY_CODE_REPOSITORY) private readonly codes: IOfflineRecoveryCodeRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
    @Inject(RECOVERY_TOKEN_STORE) private readonly tokenStore: IRecoveryTokenStore,
    private readonly strategy: RecoveryStrategyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Проверить offline-код и при совпадении выдать recovery-токен (для перехода на
   * confirm, Story 3.2). Неверный код → InvalidOfflineCode. Код single-use.
   * Возвращает recovery-токен (клиент несёт его в `/coop/recovery/confirm`).
   */
  async requestByOfflineCode(rawCode: string, ip: string | null): Promise<string> {
    const codeHash = this.hashCode(rawCode);
    const subjectId = await this.codes.findSubjectByCodeHash(codeHash);
    if (!subjectId) throw this.invalidCode();

    // Защитно: код есть, но пайщик пропал — трактуем как неверный код.
    const user = await this.users.findUserById(subjectId);
    if (!user) throw this.invalidCode();

    // Гейтинг стратегии (Story 3.5): offline-канал работает только если он выбран.
    // Не раскрываем стратегию наружу — тот же InvalidOfflineCode; код не потребляем.
    if (!(await this.strategy.isChannelActive(subjectId, RecoveryStrategy.OfflineCode))) {
      throw this.invalidCode();
    }

    const token = randomUUID();
    await this.tokenStore.issue(
      token,
      { subjectId: user.id, username: user.username, coopname: config.coopname },
      RECOVERY_TOKEN_TTL_SEC,
    );

    // Single-use: код сгорает сразу после выдачи токена.
    await this.codes.consume(subjectId);

    // Контекст без секретов: ни кода, ни хеша, ни токена.
    await this.audit.record({
      event: 'coopid.recovery.requested',
      subjectId: user.id,
      actor: 'self',
      result: 'success',
      context: { strategy: 'offline_code' },
      ip,
    });

    return token;
  }

  /**
   * Сохранить offline-код пайщику (сейм on-boarding, Story 3.4 AC — выдача вне
   * scope). Хранится только keyed-hash; сырой код вызывающий обязан выдать пайщику
   * out-of-band и не сохранять.
   */
  async setForSubject(subjectId: string, rawCode: string): Promise<void> {
    await this.codes.set(subjectId, this.hashCode(rawCode));
  }

  /** Keyed-hash кода: HMAC-SHA256(server_secret) — детерминирован для lookup, но не precompute-able без секрета. */
  private hashCode(rawCode: string): string {
    const normalized = rawCode.replace(/\D/g, '');
    return createHmac('sha256', config.server_secret).update(normalized).digest('hex');
  }

  private invalidCode(): AuthV2Error {
    return new AuthV2Error(
      AuthV2ErrorCode.InvalidOfflineCode,
      'Код восстановления неверен или уже использован.',
    );
  }
}
