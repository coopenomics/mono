import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type { INewDeviceNotificationThrottle } from '~/domain/auth-v2/ports/new-device-notification-throttle.port';

/**
 * Redis-троттл уведомлений о новом устройстве (CoopID Story 3.9, bundling NFR10).
 *
 * Замок — `SET coopid:newdev-notif:<subjectId> '1' EX 43200 NX` (12 часов).
 * Атомарность `NX` гарантирует, что из нескольких одновременных входов с новых
 * устройств письмо инициирует только первый — остальные в окне молчат.
 */
@Injectable()
export class RedisNewDeviceNotificationThrottleStore implements INewDeviceNotificationThrottle {
  /** Окно bundling-а уведомлений — 12 часов (NFR10). */
  private static readonly WINDOW_SEC = 12 * 60 * 60;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  async tryAcquire(subjectId: string): Promise<boolean> {
    const res = await this.redis.publisher.set(
      `coopid:newdev-notif:${subjectId}`,
      '1',
      'EX',
      RedisNewDeviceNotificationThrottleStore.WINDOW_SEC,
      'NX',
    );
    return res === 'OK';
  }
}
