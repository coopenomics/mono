import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  IKnownDevicesStore,
  KnownDeviceMeta,
} from '~/domain/auth-v2/ports/known-devices-store.port';

/**
 * Redis-хранилище «известных устройств» пайщика (CoopID, Story 3.8) — реализация
 * {@link IKnownDevicesStore} поверх ioredis (`REDIS_PROVIDER.publisher`).
 *
 * Устройства одного пайщика лежат в HASH `coopid:devices:<subjectId>`: поле —
 * fingerprint, значение — JSON{ip,userAgent,firstSeen,lastSeen}. `firstSeen`
 * существующего устройства сохраняется при повторном входе. На каждом входе
 * ключу продлевается TTL (sliding-retention) — давно неактивные пайщики не
 * копят устройства вечно. Префикс `coopid:devices:` изолирует контур.
 */
@Injectable()
export class RedisKnownDevicesStore implements IKnownDevicesStore {
  /** Retention множества устройств — продлевается при каждом входе. */
  private static readonly RETENTION_SEC = 180 * 24 * 60 * 60;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private key(subjectId: string): string {
    return `coopid:devices:${subjectId}`;
  }

  async isKnown(subjectId: string, fingerprint: string): Promise<boolean> {
    return (await this.redis.publisher.hexists(this.key(subjectId), fingerprint)) === 1;
  }

  async remember(
    subjectId: string,
    fingerprint: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    const key = this.key(subjectId);
    const now = new Date().toISOString();

    let firstSeen = now;
    const existing = await this.redis.publisher.hget(key, fingerprint);
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as KnownDeviceMeta;
        if (parsed.firstSeen) firstSeen = parsed.firstSeen;
      } catch {
        // битое значение — переинициализируем устройство текущим временем
      }
    }

    const value: KnownDeviceMeta = { ip: meta.ip, userAgent: meta.userAgent, firstSeen, lastSeen: now };
    await this.redis.publisher.hset(key, fingerprint, JSON.stringify(value));
    await this.redis.publisher.expire(key, RedisKnownDevicesStore.RETENTION_SEC);
  }
}
