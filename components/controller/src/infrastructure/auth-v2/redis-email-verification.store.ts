import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  EmailVerificationState,
  IEmailVerificationStore,
} from '~/domain/auth-v2/ports/email-verification-store.port';

/**
 * Redis-хранилище кодов подтверждения почты поверх ioredis.
 *
 * Ключ строится от sha256 адреса, а не от самого адреса: почтовые ящики пайщиков
 * не должны валяться в именах ключей Redis, который смотрят при отладке. Сам
 * адрес лежит внутри значения — он нужен, чтобы отправить письмо.
 *
 * Счётчики (попытки, обращения) — атомарный INCR: перебор шестизначного кода
 * не должен пролезать через гонку read-modify-write.
 */
@Injectable()
export class RedisEmailVerificationStore implements IEmailVerificationStore {
  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private hash(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  private key(email: string): string {
    return `coopid:emailverify:${this.hash(email)}`;
  }

  private verifiedKey(email: string): string {
    return `coopid:emailverified:${this.hash(email)}`;
  }

  async put(email: string, state: EmailVerificationState, ttlSec: number): Promise<void> {
    await this.redis.publisher.set(this.key(email), JSON.stringify(state), 'EX', ttlSec);
  }

  async get(email: string): Promise<EmailVerificationState | null> {
    const raw = await this.redis.publisher.get(this.key(email));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EmailVerificationState;
    } catch {
      return null;
    }
  }

  async delete(email: string): Promise<void> {
    await this.redis.publisher.del(this.key(email), `${this.key(email)}:att`);
  }

  async bumpAttempts(email: string, ttlSec: number): Promise<number> {
    const key = `${this.key(email)}:att`;
    const count = await this.redis.publisher.incr(key);
    if (count === 1) await this.redis.publisher.expire(key, ttlSec);
    return count;
  }

  async tryAcquireResend(email: string, ttlSec: number): Promise<boolean> {
    const acquired = await this.redis.publisher.set(`${this.key(email)}:resend`, '1', 'EX', ttlSec, 'NX');
    return acquired === 'OK';
  }

  async resendCooldown(email: string): Promise<number> {
    const ttl = await this.redis.publisher.ttl(`${this.key(email)}:resend`);
    return ttl > 0 ? ttl : 0;
  }

  async markVerified(email: string, ttlSec: number): Promise<void> {
    await this.redis.publisher.set(this.verifiedKey(email), '1', 'EX', ttlSec);
  }

  async isVerified(email: string): Promise<boolean> {
    return (await this.redis.publisher.exists(this.verifiedKey(email))) === 1;
  }

  async bumpRequests(scope: string, key: string, ttlSec: number): Promise<number> {
    const redisKey = `coopid:emailverify:rate:${scope}:${createHash('sha256').update(key).digest('hex')}`;
    const count = await this.redis.publisher.incr(redisKey);
    if (count === 1) await this.redis.publisher.expire(redisKey, ttlSec);
    return count;
  }
}
