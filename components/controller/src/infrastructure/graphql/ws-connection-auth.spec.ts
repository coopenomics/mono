import * as jwt from 'jsonwebtoken';
import { tokenTypes } from '~/types/token.types';
import { authenticateWsConnection, extractBearerToken } from './ws-connection-auth';
import { registerWsSessionCheck } from './ws-session-check.registry';

/**
 * Аутентификация ws-соединения (C28-77). Подписки строят персональные топики
 * по имени аккаунта из соединения, поэтому имя обязано приходить от проверки
 * сессии по подписанному токену — не из параметров, которые шлёт клиент.
 */
describe('authenticateWsConnection', () => {
  const secret = 'ws-test-secret';
  const sign = (payload: Record<string, unknown>) => jwt.sign(payload, secret);
  const access = (extra: Record<string, unknown> = {}) =>
    sign({ sub: 'user-id-1', type: tokenTypes.ACCESS, sid: 'sid-1', ...extra });

  beforeEach(() => {
    registerWsSessionCheck(async (sid, sub) => (sid === 'sid-1' && sub === 'user-id-1' ? 'ant' : null));
  });

  it('живая сессия — соединение получает sub и имя аккаунта из проверки сессии', async () => {
    const auth = await authenticateWsConnection({ authorization: `Bearer ${access()}` }, secret);
    expect(auth).toEqual({ ok: true, user: { sub: 'user-id-1', username: 'ant' } });
  });

  it('анонимное соединение без токена отклоняется', async () => {
    await expect(authenticateWsConnection({}, secret)).resolves.toMatchObject({ ok: false });
    await expect(authenticateWsConnection(undefined, secret)).resolves.toMatchObject({ ok: false });
  });

  it('токен с чужой подписью отклоняется', async () => {
    const forged = jwt.sign({ sub: 'user-id-1', type: tokenTypes.ACCESS, sid: 'sid-1' }, 'other-secret');
    await expect(authenticateWsConnection({ authorization: forged }, secret)).resolves.toMatchObject({ ok: false });
  });

  it('refresh-токен вместо access отклоняется', async () => {
    const refresh = sign({ sub: 'user-id-1', type: tokenTypes.REFRESH, sid: 'sid-1' });
    await expect(authenticateWsConnection({ authorization: refresh }, secret)).resolves.toMatchObject({ ok: false });
  });

  it('завершённая сессия отклоняется', async () => {
    const auth = await authenticateWsConnection({ authorization: access({ sid: 'sid-revoked' }) }, secret);
    expect(auth).toMatchObject({ ok: false });
  });

  it('имя аккаунта из параметров клиента игнорируется — берётся только у проверки сессии', async () => {
    const auth = await authenticateWsConnection(
      { authorization: access(), username: 'victim', user: { username: 'victim' } },
      secret
    );
    expect(auth).toEqual({ ok: true, user: { sub: 'user-id-1', username: 'ant' } });
  });

  it('проверка сессии не зарегистрирована — соединение отклоняется', async () => {
    registerWsSessionCheck(async () => null);
    await expect(authenticateWsConnection({ authorization: access() }, secret)).resolves.toMatchObject({ ok: false });
  });

  it('extractBearerToken принимает и «Bearer <t>», и голый токен', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('abc')).toBe('abc');
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
