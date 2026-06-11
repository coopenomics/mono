import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import {
  FORCE_RECOVERY_CONSENT_CHANNEL,
  type ForceRecoveryConsentRequest,
  type IForceRecoveryConsentNotifier,
} from '~/domain/auth-v2/ports/force-recovery-consent.port';

/**
 * Нотификатор запроса согласия на force-recovery (Story 6.9). Публикует событие с
 * токеном в Redis-канал; рендер и доставка письма с magic-link — забота
 * notification-center (downstream-подписчик), как фан-аут critical-action (6.8).
 * `ioredis` — только в infrastructure.
 */
@Injectable()
export class RedisForceRecoveryConsentNotifier implements IForceRecoveryConsentNotifier {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  async notifyConsentRequested(request: ForceRecoveryConsentRequest & { token: string }): Promise<void> {
    await this.redis.publisher.publish(FORCE_RECOVERY_CONSENT_CHANNEL, JSON.stringify(request));
  }
}
