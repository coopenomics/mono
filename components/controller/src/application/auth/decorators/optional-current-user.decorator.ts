import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Возвращает текущего пользователя из запроса ЛИБО `null`, если запрос
 * гостевой. В паре с `OptionalGqlJwtAuthGuard`: не бросает, не требует
 * авторизации. Использовать там, где ручка открыта и гостю, но ответ
 * зависит от того, кто спрашивает.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req?.user ?? null;
  },
);
