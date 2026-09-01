import { createHash } from 'node:crypto';
import { RedisSessionMetadataStore } from './redis-session-metadata.store';

function setup() {
  const publisher = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
  };
  const store = new RedisSessionMetadataStore({ publisher } as never);
  return { store, publisher };
}

const TOKEN = 'refresh-secret-token';
const KEY = `coopid:session-meta:${createHash('sha256').update(TOKEN).digest('hex')}`;

describe('RedisSessionMetadataStore (Story 3.7)', () => {
  it('record: ключ = sha256(refresh) (сам токен не хранится), TTL через EX, lastSeenAt=createdAt', async () => {
    const { store, publisher } = setup();

    await store.record(TOKEN, { ip: '1.2.3.4', device: 'UA/1', createdAt: '2026-06-01T10:00:00.000Z' });

    expect(publisher.set).toHaveBeenCalledTimes(1);
    const [key, value, exFlag, ttl] = publisher.set.mock.calls[0];
    expect(key).toBe(KEY);
    expect(key).not.toContain(TOKEN);
    expect(JSON.parse(value)).toEqual({ ip: '1.2.3.4', device: 'UA/1', createdAt: '2026-06-01T10:00:00.000Z', lastSeenAt: '2026-06-01T10:00:00.000Z' });
    expect(exFlag).toBe('EX');
    expect(ttl).toBeGreaterThan(0);
  });

  it('get: парсит JSON из Redis', async () => {
    const { store, publisher } = setup();
    publisher.get.mockResolvedValueOnce(JSON.stringify({ ip: '9.9.9.9', device: 'UA/2', createdAt: 'c', lastSeenAt: 'l' }));

    const res = await store.get(TOKEN);

    expect(publisher.get).toHaveBeenCalledWith(KEY);
    expect(res).toEqual({ ip: '9.9.9.9', device: 'UA/2', createdAt: 'c', lastSeenAt: 'l' });
  });

  it('get: нет ключа → null', async () => {
    const { store, publisher } = setup();
    publisher.get.mockResolvedValueOnce(null);
    expect(await store.get(TOKEN)).toBeNull();
  });

  it('get: битый JSON → null (не бросает)', async () => {
    const { store, publisher } = setup();
    publisher.get.mockResolvedValueOnce('{not-json');
    expect(await store.get(TOKEN)).toBeNull();
  });

  it('delete: удаляет по тому же хэш-ключу', async () => {
    const { store, publisher } = setup();
    await store.delete(TOKEN);
    expect(publisher.del).toHaveBeenCalledWith(KEY);
  });
});
