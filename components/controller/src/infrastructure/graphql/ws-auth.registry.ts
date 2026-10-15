/**
 * Опознание пайщика в ws-соединении — тем же путём, что у HTTP.
 *
 * `GraphQLModule.forRoot` статичен: его `onConnect` выполняется вне графа модулей
 * и провайдера в себя не инжектит. Поэтому направление обратное — владелец
 * опознания (`JwtAuthStrategy`) кладёт его сюда при создании, а соединение им
 * пользуется (тот же приём, что с реестрами расширений: см. `forwardRef` в
 * CLAUDE.md контроллера).
 *
 * Зачем один путь. Раньше ws проверял у токена подпись, тип и живость сессии, а
 * в контекст клал только `{ sub }`. HTTP же после стратегии несёт полную учётную
 * запись: `username`, `role`, `status`. Резолвер подписки, написанный как обычный
 * запрос (`@CurrentUser().username`, `RolesGuard`), на ws получал пустоту — так
 * подписка кошелька с 14.09.2026 отклонялась на каждом соединении, и пополнение
 * доходило до карточки только дочиткой по таймеру. Теперь пользователь в
 * контексте подписки — тот же объект, что и у запроса, по построению.
 */
import * as jwt from 'jsonwebtoken';
import config from '~/config/config';
import logger from '~/config/logger';
import { tokenTypes } from '~/types/token.types';

/** Опознание по проверенному payload токена: учётная запись либо исключение. */
type WsUserResolver = (payload: Record<string, unknown>) => Promise<unknown>;

let resolver: WsUserResolver | null = null;

/** Владелец опознания (`JwtAuthStrategy`) отдаёт его веб-сокету. */
export function registerWsUserResolver(fn: WsUserResolver): void {
  resolver = fn;
}

/**
 * Bearer-токен из connectionParams ws-соединения. Принимаем и сам токен, и
 * форму `Bearer <token>` — клиенты Zeus шлют по-разному.
 */
function extractBearerToken(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : raw;
}

/**
 * Проверка ws-соединения в `onConnect`. Токен подписан и это access-токен —
 * пайщика опознаёт стратегия HTTP (она же проверяет живость сессии), и в
 * `extra` соединения ложатся учётная запись и сам токен.
 *
 * Опознание ещё не зарегистрировано — соединение отклоняем: пропускать «пока
 * некому проверить» значит пускать всех, а регистрация происходит при создании
 * провайдера, то есть до приёма первого соединения.
 */
export async function authenticateWsConnection(context: any): Promise<boolean> {
  const params = context?.connectionParams ?? {};
  const token = extractBearerToken(params.authorization ?? params.Authorization);
  if (!token) {
    logger.warn('[mp-ws] onConnect ОТКЛОНЁН: нет токена в connectionParams');
    return false;
  }
  let payload: any;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (e) {
    logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: verify failed (${(e as Error).message})`);
    return false;
  }
  if (payload?.type !== tokenTypes.ACCESS) {
    logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: тип токена "${payload?.type}" != ACCESS`);
    return false;
  }
  if (!resolver) {
    logger.warn('[mp-ws] onConnect ОТКЛОНЁН: опознание пайщика ещё не зарегистрировано');
    return false;
  }
  try {
    const user = await resolver(payload);
    context.extra = context.extra ?? {};
    context.extra.user = user;
    context.extra.authorization = `Bearer ${token}`;
    logger.info(`[mp-ws] onConnect ✅ принят: ${(user as { username?: string })?.username ?? payload.sub}`);
    return true;
  } catch (e) {
    logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: ${(e as Error).message} (sub=${payload.sub})`);
    return false;
  }
}

/**
 * Контекст операции подписки — в форме HTTP-запроса: `req.user` та же учётная
 * запись, `req.headers.authorization` тот же токен. Поэтому `@CurrentUser`,
 * `GqlJwtAuthGuard`, `RolesGuard` и `ActiveUserStatusGuard` на подписке работают
 * ровно как на запросе, и резолвер подписки не пишет своего опознания.
 */
export function buildWsContext(ctx: any): { req: { user: unknown; headers: Record<string, string> } } {
  const authorization = ctx?.extra?.authorization;
  return {
    req: {
      user: ctx?.extra?.user ?? null,
      headers: typeof authorization === 'string' ? { authorization } : {},
    },
  };
}
