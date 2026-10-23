import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Полный сброс устройства — «Выйти» и потеря доступа.
 *
 * Случай 16.10.2026 (стенд 5): выход чистил только браузер, cookie сессии принятого
 * пайщика оставалась, и серверный рендер подмешивал его аккаунт в регистрацию нового —
 * на секунду появлялось меню кабинета. Сброс обязан отозвать токены на сервере
 * (это же снимает cookie) до очистки браузера и стереть состояние вступления.
 */
const m = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    coopTokens: null as null | { accessToken: string; refreshToken: string },
    global: { tokens: undefined as undefined | { access: { token: string }; refresh: { token: string } } },
    session: {
      close: vi.fn(async () => {
        calls.push('session.close');
      }),
      clearAccount: vi.fn(() => {
        calls.push('session.clearAccount');
      }),
    },
    registrator: {
      clearUserData: vi.fn(() => {
        calls.push('registrator.clearUserData');
      }),
    },
    serverLogout: vi.fn(async (tokens: { accessToken?: string | null }) => {
      calls.push(`serverLogout:${tokens.accessToken ?? '-'}`);
    }),
  };
});

vi.mock('@coopenomics/auth', () => ({ currentTokens: () => m.coopTokens }));
vi.mock('src/entities/Session', () => ({ useSessionStore: () => m.session }));
vi.mock('src/entities/Session/lib/serverLogout', () => ({ serverLogout: m.serverLogout }));
vi.mock('src/shared/store', () => ({ useGlobalStore: () => m.global }));
vi.mock('src/entities/Registrator', () => ({ useRegistratorStore: () => m.registrator }));

const { resetDevice } = await import('src/features/User/Logout/model');

describe('resetDevice', () => {
  beforeEach(() => {
    m.calls.length = 0;
    m.coopTokens = null;
    m.global.tokens = undefined;
    vi.clearAllMocks();
  });

  it('отзывает токены на сервере до очистки браузера', async () => {
    m.coopTokens = { accessToken: 'COOP_ACCESS', refreshToken: 'COOP_REFRESH' };

    await resetDevice();

    expect(m.serverLogout).toHaveBeenCalledWith({ accessToken: 'COOP_ACCESS', refreshToken: 'COOP_REFRESH' });
    expect(m.calls.indexOf('serverLogout:COOP_ACCESS')).toBeLessThan(m.calls.indexOf('session.close'));
  });

  it('пары CoopID и входа по ключу отзываются обе — они могут быть разных пайщиков', async () => {
    m.coopTokens = { accessToken: 'COOP_ACCESS', refreshToken: 'COOP_REFRESH' };
    m.global.tokens = { access: { token: 'LEGACY_ACCESS' }, refresh: { token: 'LEGACY_REFRESH' } };

    await resetDevice();

    expect(m.serverLogout).toHaveBeenCalledWith({ accessToken: 'LEGACY_ACCESS', refreshToken: 'LEGACY_REFRESH' });
    expect(m.serverLogout).toHaveBeenCalledTimes(2);
  });

  it('без токенов сервер всё равно зовётся — он снимает cookie сессии', async () => {
    await resetDevice();

    expect(m.serverLogout).toHaveBeenCalledTimes(1);
  });

  it('стирает состояние вступления, сессию и аккаунт', async () => {
    await resetDevice();

    expect(m.registrator.clearUserData).toHaveBeenCalled();
    expect(m.session.close).toHaveBeenCalled();
    expect(m.session.clearAccount).toHaveBeenCalled();
  });

  it('сервер не ответил → браузер очищается всё равно', async () => {
    m.serverLogout.mockRejectedValueOnce(new Error('сеть'));

    await expect(resetDevice()).resolves.toBeUndefined();
    expect(m.session.close).toHaveBeenCalled();
    expect(m.registrator.clearUserData).toHaveBeenCalled();
  });
});
