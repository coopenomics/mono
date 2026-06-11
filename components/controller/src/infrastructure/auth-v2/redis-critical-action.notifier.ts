import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import {
  CRITICAL_ACTION_PENDING_CHANNEL,
  type ICriticalActionNotifier,
  type PendingCriticalAction,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';

/**
 * Нотификатор совета о новом критическом действии (Story 6.8). Публикует ОДНО событие
 * в Redis-канал; пер-членский фан-аут (письма/пуши «<chairman> просит подтвердить
 * <action>») — забота notification-center (downstream-подписчик), как и сброс кэша
 * Ability в Story 6.2/6.4. Здесь — механизм публикации, не доставка.
 *
 * `ioredis` — только в infrastructure (hexagonal-инвариант auth-v2).
 */
@Injectable()
export class RedisCriticalActionNotifier implements ICriticalActionNotifier {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  async notifyPending(action: PendingCriticalAction): Promise<void> {
    await this.redis.publisher.publish(
      CRITICAL_ACTION_PENDING_CHANNEL,
      JSON.stringify({
        id: action.id,
        actionType: action.actionType,
        actorId: action.actorId,
        targetId: action.targetId,
        expiresAt: action.expiresAt,
      }),
    );
  }
}
