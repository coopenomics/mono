import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import {
  ACCESS_RULES_INVALIDATION_CHANNEL,
  type AccessRulesInvalidationTarget,
  type IAccessRulesInvalidationPublisher,
} from '~/domain/auth-v2/ports/access-rules.port';

/**
 * Публикует инвалидацию прав активной сессии (Story 6.2). При изменении
 * `access_rules` (admin-запись ролей/capabilities — Story 6.6/6.7) шлёт принципала
 * в Redis-канал; подписчик (Story 6.4) сбрасывает закэшированную Ability затронутых
 * сессий, чтобы новые права применились без ожидания истечения сессии.
 *
 * `ioredis` — только в infrastructure (hexagonal-инвариант auth-v2).
 */
@Injectable()
export class RedisAccessRulesInvalidationPublisher implements IAccessRulesInvalidationPublisher {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  async publish(target: AccessRulesInvalidationTarget): Promise<void> {
    await this.redis.publisher.publish(ACCESS_RULES_INVALIDATION_CHANNEL, JSON.stringify(target));
  }
}
