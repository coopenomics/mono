import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';
import type {
  EscalatingThrottlerRecord,
  IEscalatingRateLimitStorage,
} from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';

/**
 * Redis-хранилище счётчиков rate-limit (Story 9.1) — реализация `ThrottlerStorage`
 * из `@nestjs/throttler` поверх ioredis (`REDIS_PROVIDER.publisher`). Готового
 * redis-storage-пакета в проекте нет; добавлять зависимость ради одной истории
 * избыточно — реализуем интерфейс сами.
 *
 * Инкремент атомарен (Lua): INCR счётчика → если он первый, сразу ставим PEXPIRE
 * (без гонки «INCR без TTL» → вечный ключ). При превышении лимита ставится отдельный
 * block-ключ с PX(blockDuration) — повторные запросы в окне блока сразу `isBlocked`.
 *
 * Префикс ключей `coopid:rl:` изолирует счётчики контура от прочих данных Redis.
 */
@Injectable()
export class RedisThrottlerStorage implements IEscalatingRateLimitStorage {
  // KEYS[1] — счётчик попыток, KEYS[2] — block-ключ.
  // ARGV: [1] ttl(ms), [2] limit, [3] blockDuration(ms).
  private static readonly INCREMENT_LUA = `
local totalHits = redis.call('INCR', KEYS[1])
local timeToExpire = redis.call('PTTL', KEYS[1])
if timeToExpire <= 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
  timeToExpire = tonumber(ARGV[1])
end
local blocked = redis.call('GET', KEYS[2])
local timeToBlockExpire = 0
if blocked == false then
  if totalHits > tonumber(ARGV[2]) then
    redis.call('SET', KEYS[2], 1, 'PX', tonumber(ARGV[3]))
    blocked = 1
    timeToBlockExpire = tonumber(ARGV[3])
  end
else
  timeToBlockExpire = redis.call('PTTL', KEYS[2])
end
return { totalHits, timeToExpire, blocked ~= false and 1 or 0, timeToBlockExpire }
`;

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis },
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `coopid:rl:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:block`;
    const raw = (await this.redis.publisher.eval(
      RedisThrottlerStorage.INCREMENT_LUA,
      2,
      hitKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = raw;
    return {
      totalHits: Number(totalHits),
      timeToExpire: Number(timeToExpire),
      isBlocked: Number(isBlocked) === 1,
      timeToBlockExpire: Number(timeToBlockExpire),
    };
  }

  // KEYS[1] — счётчик попыток, KEYS[2] — block-ключ, KEYS[3] — счётчик страйков.
  // ARGV: [1] ttl(ms), [2] limit, [3] memoryTtl(ms страйков), [4..] длительности тиров(ms).
  // Возврат: [totalHits, timeToExpire, isBlocked, timeToBlockExpire, newlyBlocked, strike].
  private static readonly INCREMENT_ESCALATING_LUA = `
local totalHits = redis.call('INCR', KEYS[1])
local timeToExpire = redis.call('PTTL', KEYS[1])
if timeToExpire <= 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
  timeToExpire = tonumber(ARGV[1])
end
local blocked = redis.call('GET', KEYS[2])
if blocked ~= false then
  -- Блок уже висит: не эскалируем и не пишем повторный страйк, отдаём остаток.
  local strike = tonumber(redis.call('GET', KEYS[3]) or 0)
  return { totalHits, timeToExpire, 1, redis.call('PTTL', KEYS[2]), 0, strike }
end
if totalHits > tonumber(ARGV[2]) then
  -- Новое срабатывание: наращиваем страйк и берём тир по его номеру (потолок — последний).
  local strike = redis.call('INCR', KEYS[3])
  redis.call('PEXPIRE', KEYS[3], tonumber(ARGV[3]))
  local nTiers = #ARGV - 3
  local idx = strike
  if idx > nTiers then idx = nTiers end
  local dur = tonumber(ARGV[3 + idx])
  redis.call('SET', KEYS[2], 1, 'PX', dur)
  return { totalHits, timeToExpire, 1, dur, 1, strike }
end
return { totalHits, timeToExpire, 0, 0, 0, 0 }
`;

  async incrementEscalating(
    key: string,
    ttl: number,
    limit: number,
    tiersMs: number[],
    memoryTtl: number,
    throttlerName: string,
  ): Promise<EscalatingThrottlerRecord> {
    const hitKey = `coopid:rl:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:block`;
    const strikeKey = `${hitKey}:strike`;
    const raw = (await this.redis.publisher.eval(
      RedisThrottlerStorage.INCREMENT_ESCALATING_LUA,
      3,
      hitKey,
      blockKey,
      strikeKey,
      ttl,
      limit,
      memoryTtl,
      ...tiersMs,
    )) as [number, number, number, number, number, number];

    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire, newlyBlocked, strike] = raw;
    return {
      totalHits: Number(totalHits),
      timeToExpire: Number(timeToExpire),
      isBlocked: Number(isBlocked) === 1,
      timeToBlockExpire: Number(timeToBlockExpire),
      newlyBlocked: Number(newlyBlocked) === 1,
      strike: Number(strike),
    };
  }
}
