import { SetMetadata, applyDecorators, createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Directive, GqlExecutionContext } from '@nestjs/graphql';

/**
 * Пути внутри объекта, по которым пайщик признаётся «своим» для поля.
 *
 * Записываются от корня самого объекта: `trustee.username` — одно значение,
 * `trusted[].username` — значения из массива. Если хотя бы одно совпало с
 * именем аккаунта запрашивающего, поле отдаётся ему независимо от роли в
 * кооперативе.
 */
export interface AuthRolesOptions {
  self?: string[];
}

/**
 * Ограничение доступа к резолверу или к отдельному полю объекта.
 *
 * Роли — это капабилити уровня кооператива (`chairman`, `member`, `user`).
 * Их недостаточно там, где данные принадлежат самому пайщику: председатель
 * кооперативного участка для кооператива — обычный пайщик, и по ролям он не
 * может прочитать даже собственный участок.
 *
 * Для таких полей задаётся `self`: пути внутри объекта, по которым проверяется
 * принадлежность. Это тот же принцип, что квалификаторы `:own` / `:own-KU` в
 * матрице доступа расширений, — роль отвечает за «такой род данных вообще
 * доступен», а принадлежность проверяется по самим данным.
 *
 * Метаданные читает `RolesGuard`, директива `@auth` попадает в схему как
 * документация.
 *
 * ```ts
 * // председатель кооператива и совет видят состав любого участка,
 * // а председатель участка и его доверенные — состав своего
 * @AuthRoles(['chairman', 'member'], { self: ['trustee.username', 'trusted[].username'] })
 * public readonly trusted: IndividualDTO[];
 * ```
 */
export function AuthRoles(
  roles: string[],
  options: AuthRolesOptions = {}
): PropertyDecorator & MethodDecorator & ClassDecorator {
  const self = options.self ?? [];
  const args = self.length
    ? `roles: ${JSON.stringify(roles)}, self: ${JSON.stringify(self)}`
    : `roles: ${JSON.stringify(roles)}`;

  return applyDecorators(SetMetadata('roles', roles), Directive(`@auth(${args})`));
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
