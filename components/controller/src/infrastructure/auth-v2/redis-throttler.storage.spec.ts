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

  describe('incrementEscalating (Story 3.12)', () => {
    const TIERS = [3600000, 14400000, 43200000, 86400000]; // 1ч,4ч,12ч,24ч

    it('зовёт Lua с тремя ключами (hit/block/strike) и тирами в ARGV', async () => {
      const evalImpl = jest.fn().mockResolvedValue([4, 3600000, 0, 0, 0, 0]);
      const storage = makeStorage(evalImpl);

      await storage.incrementEscalating('ant', 3600000, 3, TIERS, 86400000, 'account');

      const [script, numKeys, hitKey, blockKey, strikeKey, ttl, limit, memoryTtl, t1, t2, t3, t4] =
        evalImpl.mock.calls[0];
      expect(typeof script).toBe('string');
      expect(numKeys).toBe(3);
      expect(hitKey).toBe('coopid:rl:account:ant');
      expect(blockKey).toBe('coopid:rl:account:ant:block');
      expect(strikeKey).toBe('coopid:rl:account:ant:strike');
      expect([ttl, limit, memoryTtl]).toEqual([3600000, 3, 86400000]);
      expect([t1, t2, t3, t4]).toEqual(TIERS);
    });

    it('маппит 6-кортеж Lua, включая newlyBlocked и strike', async () => {
      // первый страйк: блок выставлен этим вызовом на тир 1ч
      const storage = makeStorage(jest.fn().mockResolvedValue([4, 3590000, 1, 3600000, 1, 1]));
      const rec = await storage.incrementEscalating('ant', 3600000, 3, TIERS, 86400000, 'account');
      expect(rec).toEqual({
        totalHits: 4,
        timeToExpire: 3590000,
        isBlocked: true,
        timeToBlockExpire: 3600000,
        newlyBlocked: true,
        strike: 1,
      });
    });

    it('повтор в окне уже выставленного блока → newlyBlocked=false, strike сохраняется', async () => {
      const storage = makeStorage(jest.fn().mockResolvedValue([9, 3590000, 1, 43200000, 0, 3]));
      const rec = await storage.incrementEscalating('ant', 3600000, 3, TIERS, 86400000, 'account');
      expect(rec.isBlocked).toBe(true);
      expect(rec.newlyBlocked).toBe(false);
      expect(rec.strike).toBe(3);
      expect(rec.timeToBlockExpire).toBe(43200000); // тир 12ч
    });

    it('под лимитом → не заблокирован, страйков нет', async () => {
      const storage = makeStorage(jest.fn().mockResolvedValue([2, 3600000, 0, 0, 0, 0]));
      const rec = await storage.incrementEscalating('ant', 3600000, 3, TIERS, 86400000, 'account');
      expect(rec.isBlocked).toBe(false);
      expect(rec.newlyBlocked).toBe(false);
      expect(rec.strike).toBe(0);
    });
  });
});
