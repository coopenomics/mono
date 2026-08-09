import { SetMetadata, applyDecorators, createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Directive, GqlExecutionContext } from '@nestjs/graphql';

/**
 * Объявляет роли, допущенные к операции. Метаданные читает `RolesGuard`,
 * директива `@auth` попадает в схему как документация.
 */
export function AuthRoles(roles: string[]): PropertyDecorator & MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata('roles', roles),
    Directive(`@auth(roles: ${JSON.stringify(roles)})`)
  );
}

/** Текущий пользователь запроса. Бросает, если запрос не авторизован. */
export const CurrentUser = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext().req;

  if (!request?.user) {
    throw new UnauthorizedException('Пользователь не авторизован');
  }
  return request?.user;
});

/**
 * Текущий пользователь либо `null`, если запрос гостевой. В паре с
 * `OptionalGqlJwtAuthGuard`: не бросает, не требует авторизации. Для ручек,
 * открытых и гостю, где ответ зависит от того, кто спрашивает.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req?.user ?? null;
  },
);
