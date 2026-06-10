import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import config from '~/config/config';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type { ISessionMetadataStore, SessionMetadata } from '~/domain/auth-v2/ports/session-metadata.port';

/**
 * Redis-хранилище метаданных сессий CoopID (Story 3.7).
 *
 * Ключ — `coopid:session-meta:<sha256(refresh)>`: сам refresh-токен является секретом,
 * поэтому в Redis кладём только его хэш — для адресации этого достаточно, а утечка дампа
 * Redis не выдаёт валидный токен. TTL равен сроку жизни refresh-токена, чтобы запись
 * «умирала» вместе с сессией без отдельной чистки.
 */
@Injectable()
export class RedisSessionMetadataStore implements ISessionMetadataStore {
  private readonly ttlSec = config.jwt.refreshExpirationDays * 24 * 60 * 60;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private key(refreshToken: string): string {
    return `coopid:session-meta:${createHash('sha256').update(refreshToken).digest('hex')}`;
  }

  async record(refreshToken: string, meta: { ip: string | null; device: string | null; createdAt: string }): Promise<void> {
    const value: SessionMetadata = { ip: meta.ip, device: meta.device, createdAt: meta.createdAt, lastSeenAt: meta.createdAt };
    await this.redis.publisher.set(this.key(refreshToken), JSON.stringify(value), 'EX', this.ttlSec);
  }

  async get(refreshToken: string): Promise<SessionMetadata | null> {
    const raw = await this.redis.publisher.get(this.key(refreshToken));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionMetadata;
    } catch {
      return null;
    }
  }

  async delete(refreshToken: string): Promise<void> {
    await this.redis.publisher.del(this.key(refreshToken));
  }
}
