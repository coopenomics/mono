import { jwtVerify } from 'jose';
import { SessionBindingService, SESSION_BINDING_TTL_SEC } from '~/application/auth-v2/session-binding/session-binding.service';
import type { RedisPort } from '~/domain/common/ports/redis.port';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { authV2: { sessionBindingSecret: 'test-binding-secret-min-32-bytes-len!!' } },
}));

function makeRedisMock() {
  const store: Record<string, { value: string; ttl: number }> = {};
  const redis: RedisPort = {
    publish: jest.fn(),
    subscribe: jest.fn(),
    setSingleUse: jest.fn(async (key, value, ttl) => {
      if (store[key]) return false;
      store[key] = { value, ttl };
      return true;
    }),
    consumeSingleUse: jest.fn(async (key) => {
      const v = store[key]?.value ?? null;
      delete store[key];
      return v;
    }),
  };
  return { redis, store };
}

describe('SessionBindingService.issue', () => {
  const secret = new TextEncoder().encode('test-binding-secret-min-32-bytes-len!!');

  it('выпускает JWT HS256 с контрактными claims', async () => {
    const { redis } = makeRedisMock();
    const svc = new SessionBindingService(redis);
    const { token, jti } = await svc.issue('ant');

    const { payload, protectedHeader } = await jwtVerify(token, secret);
    expect(protectedHeader.alg).toBe('HS256');
    expect(payload.sub).toBe('ant');
    expect(payload.jti).toBe(jti);
    expect(payload.stage_completed).toBe('password');
    expect(payload.exp! - payload.iat!).toBe(SESSION_BINDING_TTL_SEC);
  });

  it('пишет jti→sub в Redis с TTL чуть больше exp', async () => {
    const { redis, store } = makeRedisMock();
    const svc = new SessionBindingService(redis);
    const { jti } = await svc.issue('petrov');
    expect(store[`coopid:binding:${jti}`].value).toBe('petrov');
    expect(store[`coopid:binding:${jti}`].ttl).toBeGreaterThan(SESSION_BINDING_TTL_SEC);
  });

  it('каждый вызов — новый jti', async () => {
    const { redis } = makeRedisMock();
    const svc = new SessionBindingService(redis);
    const a = await svc.issue('x');
    const b = await svc.issue('x');
    expect(a.jti).not.toBe(b.jti);
  });
});
