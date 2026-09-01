import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Транспортные детали запроса для GraphQL-резолверов auth-v2 (Фаза 2 миграции
 * REST→GraphQL/SDK). Доменные аргументы идут через `@Args`/Input-DTO; IP и
 * заголовок текущей сессии — это транспорт, не домен, поэтому достаются здесь
 * из express-`req` в GraphQL-контексте (по образцу {@link CurrentUser}), а не
 * прокидываются как GraphQL-переменные. Так IP/refresh-токен не светятся в
 * запросе/логах GraphQL, а резолвер остаётся тестируемым (значение передаётся
 * в метод напрямую — декоратор в unit-тесте не исполняется).
 */

/** IP-адрес клиента (для аудита security-операций); null, если недоступен. */
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  const ctx = GqlExecutionContext.create(context);
  const req = ctx.getContext().req;
  return req?.ip ?? null;
});

/** Заголовок, которым SPA передаёт свой refresh-токен, чтобы пометить текущую сессию в списке. */
export const CURRENT_SESSION_HEADER = 'x-coop-refresh-token';

/** Refresh-токен текущей сессии из заголовка (пометка `current` в списке сессий); null, если не передан. */
export const RefreshTokenHeader = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  const ctx = GqlExecutionContext.create(context);
  const req = ctx.getContext().req;
  return req?.headers?.[CURRENT_SESSION_HEADER] ?? null;
});
