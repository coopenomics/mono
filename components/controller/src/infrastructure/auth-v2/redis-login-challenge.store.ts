import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  ILoginChallengeStore,
  LoginChallengeState,
  LoginFactorKind,
} from '~/domain/auth-v2/ports/login-challenge-store.port';

/**
 * Redis-хранилище challenge второго фактора входа поверх ioredis.
 *
 * Ключ — `coopid:login2fa:<token>` → JSON-состояние. Токен — 32 случайных байта
 * (256 бит): challenge представляет уже доказанный пароль+ключ, угадывание должно
 * быть исключено. `put` сохраняет остаток TTL (KEEPTTL) — клиент не может продлить
 * окно повторными запросами. Счётчик попыток — отдельный ключ с атомарным INCR
 * (никаких read-modify-write гонок на переборе кодов).
 */
@Injectable()
export class RedisLoginChallengeStore implements ILoginChallengeStore {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private key(token: string): string {
    return `coopid:login2fa:${token}`;
  }

  async create(state: LoginChallengeState, ttlSec: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.publisher.set(this.key(token), JSON.stringify(state), 'EX', ttlSec);
    return token;
  }

  async get(token: string): Promise<LoginChallengeState | null> {
    const raw = await this.redis.publisher.get(this.key(token));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LoginChallengeState;
    } catch {
      return null;
    }
  }

  async put(token: string, state: LoginChallengeState): Promise<void> {
    // KEEPTTL: состояние меняется (пройденные факторы, новый email-код), окно — нет.
    await this.redis.publisher.set(this.key(token), JSON.stringify(state), 'KEEPTTL');
  }

  async delete(token: string): Promise<void> {
    await this.redis.publisher.del(this.key(token));
  }

  async bumpAttempts(token: string, factor: LoginFactorKind, ttlSec: number): Promise<number> {
    const key = `${this.key(token)}:att:${factor}`;
    const count = await this.redis.publisher.incr(key);
    if (count === 1) await this.redis.publisher.expire(key, ttlSec);
    return count;
  }

  async tryAcquireResend(token: string, ttlSec: number): Promise<boolean> {
    const acquired = await this.redis.publisher.set(`${this.key(token)}:resend`, '1', 'EX', ttlSec, 'NX');
    return acquired === 'OK';
  }
}
