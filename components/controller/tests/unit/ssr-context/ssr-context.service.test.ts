/**
 * Серверный рендер узнаёт пайщика по cookie сессии через SsrContextService.
 * Три исхода — гость, истёкшая сессия, активный пайщик с аккаунтом и столом —
 * и устойчивость к мусору в cookie и к молчащей цепи (аккаунт не собрался —
 * личность всё равно известна).
 */
import { SsrContextService } from '~/application/ssr-context/ssr-context.service';
import {
  clearSessionCookie,
  readSessionCookie,
  sessionIdFromAccessToken,
  setSessionCookie,
} from '~/application/auth-v2/session-cookie/session-cookie';

const SID = '11111111-2222-4333-8444-555555555555';

function accessTokenWith(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

function service(overrides: Partial<{ session: any; user: any; account: any; desktop: any }> = {}) {
  const tokens = { findById: jest.fn(async () => overrides.session ?? null) };
  const users = { findById: jest.fn(async () => overrides.user ?? null) };
  const accounts = { getAccount: jest.fn(async () => overrides.account ?? { username: 'ant' }) };
  const desktops = { getDesktop: jest.fn(async () => overrides.desktop ?? { coopname: 'voskhod', workspaces: [] }) };
  return { svc: new SsrContextService(tokens as any, users as any, accounts as any, desktops as any), tokens, users, accounts, desktops };
}

const liveSession = { id: SID, userId: 'u1', type: 'refresh', blacklisted: false, expires: new Date(Date.now() + 86400000) };
const user = { id: 'u1', username: 'ant', role: 'chairman', status: '5_Active' };

describe('SsrContextService: кто запросил документ', () => {
  it('без cookie — гость, в базу не ходим', async () => {
    const { svc, tokens } = service();
    expect(await svc.resolve(undefined)).toEqual({ status: 'guest' });
    expect(tokens.findById).not.toHaveBeenCalled();
  });

  it('мусор вместо sid — сессия считается истёкшей, база не трогается', async () => {
    const { svc, tokens } = service();
    expect(await svc.resolve('coop_session=nope')).toEqual({ status: 'expired' });
    expect(tokens.findById).not.toHaveBeenCalled();
  });

  it('строки сессии нет, она в чёрном списке или просрочена — истёкшая', async () => {
    expect(await service().svc.resolve(`coop_session=${SID}`)).toEqual({ status: 'expired' });
    expect(await service({ session: { ...liveSession, blacklisted: true } }).svc.resolve(`coop_session=${SID}`)).toEqual({ status: 'expired' });
    expect(await service({ session: { ...liveSession, expires: new Date(Date.now() - 1000) } }).svc.resolve(`coop_session=${SID}`)).toEqual({ status: 'expired' });
  });

  it('живая сессия — активный пайщик с аккаунтом и столом, стол считается по его роли', async () => {
    const { svc, desktops } = service({ session: liveSession, user });
    const result = await svc.resolve(`other=1; coop_session=${SID}; x=2`);
    expect(result.status).toBe('active');
    expect(result.username).toBe('ant');
    expect(result.account).toEqual({ username: 'ant' });
    expect(result.desktop).toEqual({ coopname: 'voskhod', workspaces: [] });
    expect(desktops.getDesktop).toHaveBeenCalledWith({ username: 'ant', role: 'chairman', status: '5_Active' });
  });

  it('цепь молчит и аккаунт не собрался — личность известна, аккаунт пустой, статус активный', async () => {
    const { svc, accounts } = service({ session: liveSession, user });
    accounts.getAccount.mockRejectedValueOnce(new Error('chain down'));
    const result = await svc.resolve(`coop_session=${SID}`);
    expect(result.status).toBe('active');
    expect(result.account).toBeNull();
    expect(result.desktop).not.toBeNull();
  });
});

describe('cookie сессии', () => {
  const req = (proto?: string) => ({ secure: false, headers: proto ? { 'x-forwarded-proto': proto } : {} }) as any;
  const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

  it('sid берётся из access-токена без проверки подписи; токен без sid cookie не ставит', () => {
    expect(sessionIdFromAccessToken(accessTokenWith({ sid: SID }))).toBe(SID);
    expect(sessionIdFromAccessToken(accessTokenWith({}))).toBeNull();
    expect(sessionIdFromAccessToken('garbage')).toBeNull();
    const r = res();
    setSessionCookie(req(), r, accessTokenWith({}));
    expect(r.cookie).not.toHaveBeenCalled();
  });

  it('cookie httpOnly и Lax, secure за https-прокси; очистка теми же атрибутами', () => {
    const r = res();
    setSessionCookie(req('https'), r, accessTokenWith({ sid: SID }));
    expect(r.cookie).toHaveBeenCalledWith('coop_session', SID, expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' }));
    const r2 = res();
    setSessionCookie(req(), r2, accessTokenWith({ sid: SID }));
    expect(r2.cookie.mock.calls[0][2].secure).toBe(false);
    clearSessionCookie(req('https'), r2);
    expect(r2.clearCookie).toHaveBeenCalledWith('coop_session', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
  });

  it('чтение из заголовка Cookie: находит среди прочих, пустое значение — нет сессии', () => {
    expect(readSessionCookie(`a=1; coop_session=${SID}; b=2`)).toBe(SID);
    expect(readSessionCookie('a=1')).toBeNull();
    expect(readSessionCookie('coop_session=')).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });
});
