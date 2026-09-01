import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type {
  AccountManifest,
  IChainManifestsCache,
} from '~/domain/auth-v2/ports/chain-manifests-cache.port';

/**
 * Redis-кэш манифестов цепи (CoopID, Story 4.5) — реализация
 * {@link IChainManifestsCache} поверх ioredis (`REDIS_PROVIDER.publisher`).
 *
 * Снимок активных ключей аккаунта лежит в строковом ключе
 * `coopid:manifest:<account>` (JSON `AccountManifest`) с TTL — старый/неактивный
 * аккаунт не держит снимок вечно, а свежесть гарантируется перезаписью на каждом
 * живом входе. Префикс `coopid:manifest:` изолирует контур.
 */
@Injectable()
export class RedisChainManifestsStore implements IChainManifestsCache {
  /** TTL снимка (перезаписывается на каждом живом входе). */
  private static readonly TTL_SEC = 7 * 24 * 60 * 60;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  private key(account: string): string {
    return `coopid:manifest:${account}`;
  }

  async put(account: string, activeKeys: string[]): Promise<void> {
    const value: AccountManifest = { account, active_keys: activeKeys, cached_at: new Date().toISOString() };
    await this.redis.publisher.set(this.key(account), JSON.stringify(value), 'EX', RedisChainManifestsStore.TTL_SEC);
  }

  async get(account: string): Promise<AccountManifest | null> {
    const raw = await this.redis.publisher.get(this.key(account));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AccountManifest;
      if (!Array.isArray(parsed.active_keys)) return null;
      return parsed;
    } catch {
      return null; // битое значение — трактуем как отсутствие кэша
    }
  }
}
