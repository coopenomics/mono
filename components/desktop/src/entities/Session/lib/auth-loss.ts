import type { AuthorizationSource } from '@coopenomics/sdk';

/**
 * Что делать столу, когда сервер перестал признавать токен
 * (тесты — test/unit/auth-loss.test.ts).
 *
 * - `ignore` — уже уходим (отказов прилетает столько, сколько запросов было в
 *   полёте) либо сессии нет: гостю перезагрузка не нужна ни при каком ответе;
 * - `forget-coopid` — умер токен CoopID: забыть только этот контур, ключ и
 *   токены незаконченной регистрации в браузере остаются;
 * - `forget-device` — умер токен, выставленный вручную: забыть устройство целиком.
 */
export type AuthLossAction = 'ignore' | 'forget-coopid' | 'forget-device';

export function authLossAction(source: AuthorizationSource, isAuth: boolean, leaving: boolean): AuthLossAction {
  if (leaving || !isAuth) return 'ignore';
  return source === 'session' ? 'forget-coopid' : 'forget-device';
}
