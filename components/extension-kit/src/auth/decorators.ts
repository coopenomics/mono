import { SetMetadata, applyDecorators, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Directive, GqlExecutionContext } from '@nestjs/graphql';
import { DomainError } from '../errors/domain-error';

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
  /**
   * Пускает ли `RolesGuard` пайщика без нужной роли, когда `username` в
   * аргументах — он сам. По умолчанию да: так пайщик читает свои записи и
   * подаёт свои заявления. Для полномочий совета, где `username` — адресат
   * действия (подтвердить соглашение, внести данные, импортировать вклад),
   * ставится `false`: иначе пайщик выполнил бы его над собой.
   */
  allowSelf?: boolean;
  /**
   * Пускает ли роль `user` пайщика, которого совет ещё не принял (или уже
   * исключил). По умолчанию нет: `user` в списке ролей означает «принятый
   * пайщик», и учётная запись со статусом вступления по роли не проходит —
   * иначе любой, кто заполнил форму регистрации, читал бы реестры кооператива.
   * `true` — для того, что нужно и кандидату: входящие уведомления о ходе
   * его же заявления.
   */
  anyStatus?: boolean;
}

/** Ключ метаданных: самообход `RolesGuard` запрещён. */
export const ROLES_DENY_SELF_KEY = 'roles_deny_self';
/** Ключ метаданных: роль `user` проходит в любом статусе учётной записи. */
export const ROLES_ANY_STATUS_KEY = 'roles_any_status';

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

  const decorators = [SetMetadata('roles', roles), Directive(`@auth(${args})`)];
  if (options.allowSelf === false) decorators.push(SetMetadata(ROLES_DENY_SELF_KEY, true));
  if (options.anyStatus === true) decorators.push(SetMetadata(ROLES_ANY_STATUS_KEY, true));
  return applyDecorators(...decorators);
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
