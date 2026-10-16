import { describe, expect, it } from 'vitest';
import { authLossAction } from 'src/entities/Session/lib/auth-loss';

/**
 * Что забыть, когда сервер перестал признавать токен.
 *
 * Случай 16.10.2026 (стенд 5): умер токен CoopID пайщика прежней базы, а в браузере
 * лежали ключ и токены незаконченной регистрации нового пайщика. Забыть устройство
 * целиком значило бы стереть ключ нового пайщика.
 */
describe('authLossAction', () => {
  it('умер токен CoopID → забыть только контур CoopID', () => {
    expect(authLossAction('session', true, false)).toBe('forget-coopid');
  });

  it('умер токен, выставленный вручную → забыть устройство целиком', () => {
    expect(authLossAction('token', true, false)).toBe('forget-device');
  });

  it('уже уходим (отказы запросов в полёте) → ничего не делать', () => {
    expect(authLossAction('session', true, true)).toBe('ignore');
  });

  it('гость → перезагрузка не нужна', () => {
    expect(authLossAction('token', false, false)).toBe('ignore');
  });
});
