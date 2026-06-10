import type Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

function makeStorage(evalImpl: jest.Mock) {
  const publisher = { eval: evalImpl } as unknown as Redis;
  return new RedisThrottlerStorage({ publisher });
}

describe('RedisThrottlerStorage (Story 9.1)', () => {
  it('зовёт Lua eval с префиксованными hit/block ключами и аргументами ttl/limit/block', async () => {
    const evalImpl = jest.fn().mockResolvedValue([1, 900000, 0, 0]);
    const storage = makeStorage(evalImpl);

    await storage.increment('1.2.3.4', 900000, 50, 900000, 'ip');

    expect(evalImpl).toHaveBeenCalledTimes(1);
    const [script, numKeys, hitKey, blockKey, ttl, limit, block] = evalImpl.mock.calls[0];
    expect(typeof script).toBe('string');
    expect(numKeys).toBe(2);
    expect(hitKey).toBe('coopid:rl:ip:1.2.3.4');
    expect(blockKey).toBe('coopid:rl:ip:1.2.3.4:block');
    expect([ttl, limit, block]).toEqual([900000, 50, 900000]);
  });

  it('маппит ответ Lua [totalHits, timeToExpire, isBlocked, timeToBlockExpire] в record', async () => {
    const storage = makeStorage(jest.fn().mockResolvedValue([6, 800000, 1, 700000]));
    const rec = await storage.increment('ant', 900000, 5, 900000, 'account');
    expect(rec).toEqual({
      totalHits: 6,
      timeToExpire: 800000,
      isBlocked: true,
      timeToBlockExpire: 700000,
    });
  });

  it('isBlocked=false при флаге 0', async () => {
    const storage = makeStorage(jest.fn().mockResolvedValue([3, 900000, 0, 0]));
    const rec = await storage.increment('ant', 900000, 5, 900000, 'account');
    expect(rec.isBlocked).toBe(false);
    expect(rec.totalHits).toBe(3);
  });
});
