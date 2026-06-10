import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type { INotMeTokenStore } from '~/domain/auth-v2/ports/not-me-token-store.port';

/**
 * Redis-хранилище одноразовых токенов «Это не я» (CoopID, Story 3.10) поверх ioredis.
 *
 * Ключ — `coopid:notme:<token>` → subjectId, TTL 7 дней (окно на реакцию по письму).
 * Токен — 32 случайных байта (256 бит): ссылка неаутентифицированная и инициирует
 * массовый отзыв сессий, поэтому угадывание должно быть исключено. `consume` атомарен
 * (Lua GET→DEL) — повторный клик по ссылке второй раз не сработает.
 */
@Injectable()
export class RedisNotMeTokenStore implements INotMeTokenStore {
  /** Окно реакции на подозрительный вход — 7 дней. */
  private static readonly TTL_SEC = 7 * 24 * 60 * 60;

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
    return `coopid:notme:${token}`;
  }

  async issue(subjectId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.publisher.set(this.key(token), subjectId, 'EX', RedisNotMeTokenStore.TTL_SEC);
    return token;
  }

  async consume(token: string): Promise<string | null> {
    const subjectId = (await this.redis.publisher.eval(
      RedisNotMeTokenStore.CONSUME_LUA,
      1,
      this.key(token),
    )) as string | null;
    return subjectId ?? null;
  }
}
