import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Directive, GqlExecutionContext } from '@nestjs/graphql';
import { DomainError } from '../errors/domain-error';

/**
 * Поле объекта, которое читают совет и сам владелец объекта.
 *
 * Права операций задаёт таблица прав приложения (`@RequireRight`). Полю её
 * мало: в списке объектов часть своя, часть чужая, и решать приходится по
 * каждому объекту отдельно. `self` — пути внутри самого объекта, по которым
 * пайщик признаётся его владельцем: `trustee.username` — одно значение,
 * `trusted[].username` — значения из массива. Совпало хотя бы одно с именем
 * вошедшего — поле отдаётся ему; совет читает поле любого объекта. Остальным
 * поле приходит пустым, поэтому оно обязано быть `nullable`.
 *
 * ```ts
 * // совет видит состав любого участка, председатель участка и его
 * // доверенные — состав своего
 * @CouncilField(['trustee.username', 'trusted[].username'])
 * public readonly trusted: IndividualDTO[];
 * ```
 */
export function CouncilField(self: string[] = []): PropertyDecorator {
  const council = 'roles: ["chairman", "member"]';
  return Directive(`@auth(${self.length ? `${council}, self: ${JSON.stringify(self)}` : council})`);
}

/** Текущий пользователь запроса. Бросает, если запрос не авторизован. */
export const CurrentUser = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext().req;

  if (!request?.user) {
    throw DomainError.unauthorized('KIT_USER_NOT_AUTHORIZED');
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
