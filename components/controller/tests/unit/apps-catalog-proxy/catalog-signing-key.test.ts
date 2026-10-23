import { accountPermissionHoldingKey } from '~/extensions/apps-catalog-proxy/infrastructure/catalog-signing-key';

// Пара dev-фикстуры boot: открытые ключи ниже — открытая часть TEST_KEY в
// устаревшем и новом формате.
const TEST_KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const TEST_PUBLIC_LEGACY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
const TEST_PUBLIC_K1 = 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63';
const OTHER_PUBLIC = 'EOS5uXLGeDV8grLwGQqAfwNWJvSVagNn2etWTWCbaUHozR8d3SjSR';

const permission = (name: string, key: string) => ({
  perm_name: name,
  required_auth: { keys: [{ key }] },
});

describe('accountPermissionHoldingKey — ключ подписи каталога не должен быть ключом аккаунта', () => {
  it('ключ стоит в active → имя разрешения', () => {
    const permissions = [permission('owner', OTHER_PUBLIC), permission('active', TEST_PUBLIC_LEGACY)];
    expect(accountPermissionHoldingKey(permissions, TEST_KEY)).toBe('active');
  });

  it('ключ стоит в owner → имя разрешения', () => {
    expect(accountPermissionHoldingKey([permission('owner', TEST_PUBLIC_LEGACY)], TEST_KEY)).toBe('owner');
  });

  it('открытый ключ в новом формате PUB_K1 тоже распознаётся', () => {
    expect(accountPermissionHoldingKey([permission('active', TEST_PUBLIC_K1)], TEST_KEY)).toBe('active');
  });

  it('отдельный ключ каталога → null', () => {
    const permissions = [permission('owner', OTHER_PUBLIC), permission('active', OTHER_PUBLIC)];
    expect(accountPermissionHoldingKey(permissions, TEST_KEY)).toBeNull();
  });

  it('разрешение без ключей (только аккаунты) → null', () => {
    expect(accountPermissionHoldingKey([{ perm_name: 'active', required_auth: {} }], TEST_KEY)).toBeNull();
  });
});
