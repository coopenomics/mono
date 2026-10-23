import { loadCatalogSigningKey } from './signed-request.client';

// Пара dev-фикстуры boot: открытый ключ ниже — открытая часть TEST_KEY.
const TEST_KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const TEST_PUBLIC_LEGACY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
const TEST_PUBLIC_K1 = 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63';
const OTHER_PUBLIC = 'EOS5uXLGeDV8grLwGQqAfwNWJvSVagNn2etWTWCbaUHozR8d3SjSR';

const accountWith = (activeKey: string) => ({
  permissions: [
    { perm_name: 'owner', required_auth: { keys: [{ key: OTHER_PUBLIC }] } },
    { perm_name: 'active', required_auth: { keys: [{ key: activeKey }] } },
  ],
});

describe('loadCatalogSigningKey', () => {
  const originalEnv = process.env.CATALOG_SIGNING_KEY;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalEnv === undefined) delete process.env.CATALOG_SIGNING_KEY;
    else process.env.CATALOG_SIGNING_KEY = originalEnv;
  });

  const chainReturns = (body: unknown) =>
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);

  it('переменная не задана → null, цепь не опрашивается', async () => {
    delete process.env.CATALOG_SIGNING_KEY;
    await expect(loadCatalogSigningKey('http://node:8888', 'voskhod')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ключ совпадает с ключом active аккаунта → отказ с именем разрешения', async () => {
    process.env.CATALOG_SIGNING_KEY = TEST_KEY;
    chainReturns(accountWith(TEST_PUBLIC_LEGACY));
    await expect(loadCatalogSigningKey('http://node:8888', 'voskhod')).rejects.toThrow(
      /разрешения active аккаунта voskhod/,
    );
  });

  it('ключ active в новом формате PUB_K1 тоже распознаётся', async () => {
    process.env.CATALOG_SIGNING_KEY = TEST_KEY;
    chainReturns(accountWith(TEST_PUBLIC_K1));
    await expect(loadCatalogSigningKey('http://node:8888', 'voskhod')).rejects.toThrow(/разрешения active/);
  });

  it('отдельный ключ каталога → возвращается как есть', async () => {
    process.env.CATALOG_SIGNING_KEY = TEST_KEY;
    chainReturns(accountWith(OTHER_PUBLIC));
    await expect(loadCatalogSigningKey('http://node:8888', 'voskhod')).resolves.toBe(TEST_KEY);
  });

  it('цепь ответила ошибкой → отказ, ключ не принимается вслепую', async () => {
    process.env.CATALOG_SIGNING_KEY = TEST_KEY;
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);
    await expect(loadCatalogSigningKey('http://node:8888', 'voskhod')).rejects.toThrow(/HTTP 500/);
  });

  it('адрес цепи не задан → сверка пропускается', async () => {
    process.env.CATALOG_SIGNING_KEY = TEST_KEY;
    await expect(loadCatalogSigningKey(undefined, 'voskhod')).resolves.toBe(TEST_KEY);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
