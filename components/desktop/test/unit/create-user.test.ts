import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Порядок действий при создании учётки на шаге пароля.
 *
 * Случай 16.10.2026 (стенд 5): токен CoopID пайщика прежней базы ложился поверх
 * токена регистрации, первое чтение аккаунта падало, а шаг откатывался к анкете —
 * без ключа в состоянии вступления и без отметки «учётка создана». Повтор
 * генерировал новый ключ и упирался в занятую почту.
 */
const m = vi.hoisted(() => {
  const calls: string[] = [];
  const registrator = {
    state: {
      account: { username: '', private_key: '', public_key: '' } as Record<string, string>,
      accountCreated: false,
    },
  };
  const session = {
    dropCoopIdSession: vi.fn(async () => {
      calls.push('dropCoopIdSession');
    }),
    init: vi.fn(async () => {
      calls.push('session.init');
    }),
    setCurrentUserAccount: vi.fn(),
  };
  const globalStore = {
    setTokens: vi.fn(async () => {
      calls.push('setTokens');
    }),
    setWif: vi.fn(async () => {
      calls.push('setWif');
    }),
  };
  const client = {
    setToken: vi.fn(() => {
      calls.push('client.setToken');
    }),
    setWif: vi.fn(),
  };
  const api = { createUser: vi.fn() };
  const accountStore = { getAccount: vi.fn() };
  return { calls, registrator, session, globalStore, client, api, accountStore };
});

vi.mock('src/features/User/CreateUser/api', () => ({ api: m.api }));
vi.mock('email-regex', () => ({ default: () => /.+@.+/ }));
vi.mock('src/shared/i18n', () => ({ t: (key: string) => key }));
vi.mock('src/shared/lib/types/user', () => ({}));
vi.mock('src/shared/lib/types/user/IUserData', () => ({}));
vi.mock('src/shared/lib/types/document', () => ({}));
vi.mock('src/entities/Session', () => ({ useSessionStore: () => m.session }));
vi.mock('src/shared/store', () => ({ useGlobalStore: () => m.globalStore }));
vi.mock('src/entities/System/model', () => ({ useSystemStore: () => ({ info: { coopname: 'voskhod' } }) }));
vi.mock('src/entities/Registrator', () => ({ useRegistratorStore: () => m.registrator }));
vi.mock('src/entities/Registration', () => ({ useRegistrationStore: () => ({}) }));
vi.mock('src/shared/api/client', () => ({ client: m.client }));
vi.mock('@coopenomics/sdk', () => ({
  Zeus: { AccountType: { individual: 'individual', organization: 'organization', entrepreneur: 'entrepreneur' } },
  Mutations: {},
}));
vi.mock('src/shared/lib/document', () => ({ DigitalDocument: class {} }));
vi.mock('src/entities/Account/model', () => ({ useAccountStore: () => m.accountStore }));
vi.mock('quasar', () => ({ LocalStorage: { getItem: () => null } }));
vi.mock('src/shared/lib/utils/stripLegacyBankKpp', () => ({ stripLegacyBankKpp: (data: unknown) => data }));

const { useCreateUser } = await import('src/features/User/CreateUser/model');

const generated = { username: 'newmember', private_key: 'PVT_K1_new', public_key: 'PUB_K1_new' };
const userData = { type: 'individual', individual_data: { first_name: 'Анна' } } as never;
const tokens = { access: { token: 'REGISTRATION_ACCESS' }, refresh: { token: 'REGISTRATION_REFRESH' } };

describe('createUser', () => {
  beforeEach(() => {
    m.calls.length = 0;
    m.registrator.state.account = { username: '', private_key: '', public_key: '' };
    m.registrator.state.accountCreated = false;
    vi.clearAllMocks();
    m.accountStore.getAccount.mockResolvedValue({ username: 'newmember' });
  });

  it('забывает чужую сессию CoopID до регистрации и отдаёт SDK токен регистрации', async () => {
    m.api.createUser.mockImplementation(async () => {
      m.calls.push('api.createUser');
      return { account: { username: 'newmember' }, tokens };
    });

    await useCreateUser().createUser('anna@example.com', userData, { ...generated });

    expect(m.calls.indexOf('dropCoopIdSession')).toBeLessThan(m.calls.indexOf('api.createUser'));
    expect(m.client.setToken).toHaveBeenCalledWith('REGISTRATION_ACCESS');
    expect(m.calls.indexOf('client.setToken')).toBeLessThan(m.calls.indexOf('session.init'));
  });

  it('ключ попадает в состояние вступления до запроса, отметка «учётка создана» — после ответа', async () => {
    let stateAtRequest: { account: Record<string, string>; accountCreated: boolean } | null = null;
    m.api.createUser.mockImplementation(async () => {
      stateAtRequest = {
        account: { ...m.registrator.state.account },
        accountCreated: m.registrator.state.accountCreated,
      };
      return { account: { username: 'newmember' }, tokens };
    });

    await useCreateUser().createUser('anna@example.com', userData, { ...generated });

    expect(stateAtRequest).toEqual({ account: generated, accountCreated: false });
    expect(m.registrator.state.accountCreated).toBe(true);
    expect(m.registrator.state.account.private_key).toBe('PVT_K1_new');
  });

  it('сбой перечитки аккаунта после создания учётки регистрацию не роняет', async () => {
    m.api.createUser.mockResolvedValue({ account: { username: 'newmember' }, tokens });
    m.accountStore.getAccount.mockRejectedValue(new Error('Пользователь с указанным JWT не найден'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(useCreateUser().createUser('anna@example.com', userData, { ...generated })).resolves.toBeUndefined();
    expect(m.registrator.state.accountCreated).toBe(true);
  });

  it('отказ создания учётки (почта занята) → учётка не отмечена созданной, ошибка наружу', async () => {
    m.api.createUser.mockRejectedValue(new Error('Почта уже зарегистрирована'));

    await expect(useCreateUser().createUser('anna@example.com', userData, { ...generated })).rejects.toThrow(
      'Почта уже зарегистрирована',
    );
    expect(m.registrator.state.accountCreated).toBe(false);
    expect(m.client.setToken).not.toHaveBeenCalled();
  });
});
