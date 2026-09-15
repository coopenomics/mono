import type { Request, Response } from 'express';
import config from '~/config/config';

/**
 * Cookie сессии кабинета: несёт идентификатор сессии (`sid`, он же id строки
 * refresh-токена), а не сам токен. Нужна серверному рендеру: страницу с правами
 * пайщика может собрать только тот, кто знает, кто её запросил, а ключи и токены
 * CoopID живут в хранилище браузера и в документ-запросе не едут. По `sid` SSR
 * через `/coop/ssr-context` (с server-secret) получает аккаунт и рабочий стол.
 *
 * Сама по себе cookie ничего не открывает: без server-secret по `sid` нельзя
 * ни получить токены, ни выполнить запрос. Поэтому SameSite=Lax — она обязана
 * ехать с переходами по ссылке, иначе первая страница снова рендерится гостем.
 */
export const SESSION_COOKIE_NAME = 'coop_session';

function isSecure(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  const forwarded = Array.isArray(proto) ? proto[0] : proto;
  return req.secure || (typeof forwarded === 'string' && forwarded.split(',')[0].trim() === 'https');
}

/** `sid` из только что выданного access-токена: подпись не проверяем, токен наш. */
export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sid?: unknown };
    return typeof payload.sid === 'string' && payload.sid ? payload.sid : null;
  } catch {
    return null;
  }
}

/** Ставит cookie сессии на срок жизни refresh-токена. Без `sid` в токене — ничего не делает. */
export function setSessionCookie(req: Request, res: Response, accessToken: string | null | undefined): void {
  const sid = sessionIdFromAccessToken(accessToken);
  if (!sid) return;
  setSessionCookieBySid(req, res, sid);
}

/** То же по уже известному идентификатору сессии (например, из проверенного bearer-токена). */
export function setSessionCookieBySid(req: Request, res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE_NAME, sid, {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: isSecure(req), sameSite: 'lax', path: '/' });
}

/** `sid` из заголовка Cookie документ-запроса (парсер cookie в контроллере не подключён). */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const pair = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!pair) return null;
  const value = decodeURIComponent(pair.slice(SESSION_COOKIE_NAME.length + 1));
  return value || null;
}
