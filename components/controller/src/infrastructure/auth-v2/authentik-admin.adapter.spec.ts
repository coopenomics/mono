const mockConfig = {
  authV2: {
    authentikInternalUrl: 'http://authentik-test:9000',
    authentikAdminToken: 'admin-test-token',
  },
};
jest.mock('~/config/config', () => ({ __esModule: true, default: mockConfig }));

import { AuthentikAdminAdapter } from './authentik-admin.adapter';

/** Story 11.1 — admin-API authentik: provisioning учётки + установка пароля пайщику. */
describe('AuthentikAdminAdapter', () => {
  let adapter: AuthentikAdminAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new AuthentikAdminAdapter();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockConfig.authV2.authentikAdminToken = 'admin-test-token';
  });

  afterEach(() => jest.restoreAllMocks());

  function ok(body: unknown, status = 200) {
    return { ok: true, status, json: async () => body };
  }
  function fail(status: number) {
    return { ok: false, status, json: async () => ({}) };
  }

  it('findUserPk — берёт точное совпадение по username (частичный фильтр authentik)', async () => {
    fetchMock.mockResolvedValue(ok({ results: [{ pk: 7, username: 'ant' }, { pk: 8, username: 'anton' }] }));
    expect(await adapter.findUserPk('ant')).toBe(7);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://authentik-test:9000/api/v3/core/users/?username=ant');
    expect(init.headers.authorization).toBe('Bearer admin-test-token');
  });

  it('findUserPk — нет совпадения → null', async () => {
    fetchMock.mockResolvedValue(ok({ results: [{ pk: 8, username: 'anton' }] }));
    expect(await adapter.findUserPk('ant')).toBeNull();
  });

  it('ensureUser — учётка есть → НЕ создаёт, возвращает pk (идемпотентность)', async () => {
    fetchMock.mockResolvedValue(ok({ results: [{ pk: 7, username: 'ant' }] }));
    expect(await adapter.ensureUser({ username: 'ant', email: 'a@e.com' })).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1); // только поиск, без POST
  });

  it('ensureUser — учётки нет → создаёт (POST internal) и возвращает новый pk', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ results: [] }))
      .mockResolvedValueOnce(ok({ pk: 42 }, 201));
    expect(await adapter.ensureUser({ username: 'newby', email: 'n@e.com', name: 'Новый' })).toBe(42);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('http://authentik-test:9000/api/v3/core/users/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ username: 'newby', email: 'n@e.com', name: 'Новый', type: 'internal' });
  });

  it('setPassword — POST .../set_password/ с паролем; 204 ok', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    await adapter.setPassword(42, 'S3cret!');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://authentik-test:9000/api/v3/core/users/42/set_password/');
    expect(JSON.parse(init.body)).toEqual({ password: 'S3cret!' });
  });

  it('setPassword — ошибка authentik → throw', async () => {
    fetchMock.mockResolvedValue(fail(400));
    await expect(adapter.setPassword(42, 'x')).rejects.toThrow('set_password вернул 400');
  });

  it('нет admin-токена → явная ошибка конфигурации, без сетевого запроса', async () => {
    mockConfig.authV2.authentikAdminToken = '';
    await expect(adapter.findUserPk('ant')).rejects.toThrow('AUTHENTIK_ADMIN_TOKEN не сконфигурирован');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
