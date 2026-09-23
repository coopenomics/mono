import * as jwt from 'jsonwebtoken';
import { tokenTypes } from '~/types/token.types';
import { wsSessionUsername } from './ws-session-check.registry';

/** Пользователь ws-соединения: подписки читают его из контекста операции. */
export interface WsConnectionUser {
  /** Идентификатор учётной записи из токена. */
  sub: string;
  /** Имя аккаунта пайщика — по нему строятся персональные топики подписок. */
  username: string;
}

export type WsConnectionAuth =
  | { ok: true; user: WsConnectionUser }
  | { ok: false; reason: string };

/**
 * Bearer-токен из connectionParams ws-соединения. Принимаем и сам токен, и
 * форму `Bearer <token>` — клиенты Zeus шлют по-разному.
 */
export function extractBearerToken(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : raw;
}

/**
 * Аутентификация ws-соединения — однократно, при подключении. Соединение
 * получает пользователя только при валидной подписи, типе ACCESS и живой
 * сессии; любой иной исход — отказ с причиной для журнала. Имя аккаунта
 * берётся у проверки сессии, а не из присланных клиентом параметров:
 * подставить чужое имя клиент не может.
 */
export async function authenticateWsConnection(
  connectionParams: Record<string, unknown> | undefined,
  secret: string
): Promise<WsConnectionAuth> {
  const params = connectionParams ?? {};
  const token = extractBearerToken(params.authorization ?? params.Authorization);
  if (!token) return { ok: false, reason: 'нет токена в connectionParams' };

  let payload: any;
  try {
    payload = jwt.verify(token, secret);
  } catch (e) {
    return { ok: false, reason: `verify failed (${(e as Error).message})` };
  }
  if (payload?.type !== tokenTypes.ACCESS) {
    return { ok: false, reason: `тип токена "${payload?.type}" != ACCESS` };
  }
  // Подписи и типа мало: сессия могла быть отозвана (выход, смена пароля,
  // восстановление доступа). HTTP это проверяет, и ws обязан судить так же —
  // иначе отозванный доступ живёт наполовину.
  const username = await wsSessionUsername(payload.sid, payload.sub);
  if (!username) return { ok: false, reason: `сессия завершена (sub=${payload.sub})` };
  return { ok: true, user: { sub: String(payload.sub), username } };
}
