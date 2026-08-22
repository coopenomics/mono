import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  ForceRecoveryConsentRequest,
  IForceRecoveryConsentStore,
} from '~/domain/auth-v2/ports/force-recovery-consent.port';

/**
 * Redis-хранилище согласия на force-recovery (Story 6.9). Запрос — JSON под
 * `coopid:fr:req:<token>` с PX(TTL); `consumeRequest` атомарен (Lua GET→DEL, single-use,
 * как recovery-токен). Отметка согласия — `coopid:fr:granted:<target>:<initiator>`
 * c кратким TTL. `ioredis` — только в infrastructure (hexagonal-инвариант).
 */
@Injectable()
export class RedisForceRecoveryConsentStore implements IForceRecoveryConsentStore {
  private static readonly CONSUME_LUA = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private reqKey(token: string): string {
    return `coopid:fr:req:${token}`;
  }

  private grantedKey(targetId: string, initiatorId: string): string {
    return `coopid:fr:granted:${targetId}:${initiatorId}`;
  }

  async issueRequest(token: string, request: ForceRecoveryConsentRequest, ttlSec: number): Promise<void> {
    await this.redis.publisher.set(this.reqKey(token), JSON.stringify(request), 'PX', ttlSec * 1000);
  }

  async consumeRequest(token: string): Promise<ForceRecoveryConsentRequest | null> {
    const raw = (await this.redis.publisher.eval(
      RedisForceRecoveryConsentStore.CONSUME_LUA,
      1,
      this.reqKey(token),
    )) as string | null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ForceRecoveryConsentRequest;
    } catch {
      return null;
    }
  }

  async markGranted(targetId: string, initiatorId: string, ttlSec: number): Promise<void> {
    await this.redis.publisher.set(this.grantedKey(targetId, initiatorId), '1', 'PX', ttlSec * 1000);
  }

  async isGranted(targetId: string, initiatorId: string): Promise<boolean> {
    return (await this.redis.publisher.exists(this.grantedKey(targetId, initiatorId))) === 1;
  }
}
