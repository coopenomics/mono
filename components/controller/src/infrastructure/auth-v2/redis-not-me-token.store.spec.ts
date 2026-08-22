import { RedisNotMeTokenStore } from './redis-not-me-token.store';

function setup() {
  const publisher = {
    set: jest.fn().mockResolvedValue('OK'),
    eval: jest.fn(),
  };
  const store = new RedisNotMeTokenStore({ publisher } as never);
  return { store, publisher };
}

describe('RedisNotMeTokenStore (Story 3.10)', () => {
  it('issue: кладёт subjectId под ключ coopid:notme:<token> с EX-TTL, возвращает токен', async () => {
    const { store, publisher } = setup();

    const token = await store.issue('user-7');

    expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 байта hex = 256 бит
    const [key, value, exFlag, ttl] = publisher.set.mock.calls[0];
    expect(key).toBe(`coopid:notme:${token}`);
    expect(value).toBe('user-7');
    expect(exFlag).toBe('EX');
    expect(ttl).toBe(7 * 24 * 60 * 60);
  });

  it('issue: токены уникальны между вызовами', async () => {
    const { store } = setup();
    const a = await store.issue('u1');
    const b = await store.issue('u1');
    expect(a).not.toBe(b);
  });

  it('consume: атомарный GET→DEL (Lua) возвращает subjectId', async () => {
    const { store, publisher } = setup();
    publisher.eval.mockResolvedValueOnce('user-7');

    const res = await store.consume('token-abc');

    expect(res).toBe('user-7');
    const [, numKeys, key] = publisher.eval.mock.calls[0];
    expect(numKeys).toBe(1);
    expect(key).toBe('coopid:notme:token-abc');
  });

  it('consume: нет ключа → null', async () => {
    const { store, publisher } = setup();
    publisher.eval.mockResolvedValueOnce(null);
    expect(await store.consume('gone')).toBeNull();
  });
});
