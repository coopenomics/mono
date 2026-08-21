import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  IRecoveryTokenStore,
  RecoveryTokenPayload,
} from '~/domain/auth-v2/ports/recovery-token-store.port';

/**
 * Redis-хранилище одноразовых recovery-токенов (CoopID, Story 3.1) — реализация
 * {@link IRecoveryTokenStore} поверх ioredis (`REDIS_PROVIDER.publisher`).
 *
 * Токен хранится строкой JSON под ключом `coopid:recovery:<token>` с PX(TTL).
 * `consume` атомарен (Lua GET→DEL): два параллельных клика по одной ссылке не
 * могут оба «выиграть» — payload получит только первый, второй увидит null.
 * Префикс `coopid:recovery:` изолирует токены контура от прочих данных Redis.
 */
@Injectable()
export class RedisRecoveryTokenStore implements IRecoveryTokenStore {
  // Атомарно: вернуть значение и тут же удалить ключ (single-use).
  private static readonly CONSUME_LUA = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private key(token: string): string {
    return `coopid:recovery:${token}`;
  }

  async issue(token: string, payload: RecoveryTokenPayload, ttlSec: number): Promise<void> {
    await this.redis.publisher.set(this.key(token), JSON.stringify(payload), 'PX', ttlSec * 1000);
  }

  async peek(token: string): Promise<RecoveryTokenPayload | null> {
    const raw = await this.redis.publisher.get(this.key(token));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RecoveryTokenPayload;
    } catch {
      return null;
    }
  }

  async consume(token: string): Promise<RecoveryTokenPayload | null> {
    const raw = (await this.redis.publisher.eval(
      RedisRecoveryTokenStore.CONSUME_LUA,
      1,
      this.key(token),
    )) as string | null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RecoveryTokenPayload;
    } catch {
      return null;
    }
  }
}
