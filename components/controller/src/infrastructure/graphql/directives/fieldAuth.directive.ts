import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { UnauthorizedException } from '@nestjs/common';
import { GraphQLSchema, defaultFieldResolver } from 'graphql';
import config from '~/config/config';

/**
 * Значения объекта по пути вида `trustee.username` либо `trusted[].username`.
 *
 * Сегмент `[]` разворачивает массив: путь `trusted[].username` собирает имена
 * всех доверенных лиц. Отсутствующие звенья дают пустой список, а не ошибку —
 * поле просто не признаётся «своим».
 */
function valuesAtPath(source: unknown, path: string): string[] {
  let current: unknown[] = [source];
  for (const rawSegment of path.split('.')) {
    const isArray = rawSegment.endsWith('[]');
    const key = isArray ? rawSegment.slice(0, -2) : rawSegment;
    const next: unknown[] = [];
    for (const node of current) {
      if (node === null || node === undefined) continue;
      const value = (node as Record<string, unknown>)[key];
      if (value === null || value === undefined) continue;
      if (isArray) {
        if (Array.isArray(value)) next.push(...value);
      } else {
        next.push(value);
      }
    }
    current = next;
  }
  return current.filter((v): v is string => typeof v === 'string');
}

/** Пайщик значится в самом объекте по одному из объявленных путей. */
function isSelf(source: unknown, selfPaths: string[], username: unknown): boolean {
  if (typeof username !== 'string' || !username) return false;
  return selfPaths.some((path) => valuesAtPath(source, path).includes(username));
}

/**
 * Ограничение доступа к полям объектов по ролям кооператива и по
 * принадлежности данных самому пайщику (аргумент `self` директивы).
 *
 * Роль отвечает за «такой род данных вообще доступен» — председателю
 * кооператива и совету. Принадлежность отвечает за «эти данные твои»:
 * председатель кооперативного участка для кооператива обычный пайщик, и по
 * ролям он не прочитал бы даже состав собственного участка, а вместе с ним и
 * всю карточку — отказ поля роняет весь запрос.
 */
export function fieldAuthDirectiveTransformer(schema: GraphQLSchema, directiveName: string) {
  const queryTypeName = schema.getQueryType()?.name;
  const mutationTypeName = schema.getMutationType()?.name;
  const subscriptionTypeName = schema.getSubscriptionType()?.name;

  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
      // Пропускаем поля, принадлежащие корневым типам Query, Mutation, Subscription
      if (typeName === queryTypeName || typeName === mutationTypeName || typeName === subscriptionTypeName) {
        return fieldConfig;
      }

      const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
      if (directive) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        const requiredRoles = directive.roles || [];
        const selfPaths: string[] = directive.self || [];
        fieldConfig.resolve = async function (source, args, context, info) {
          const { req } = context;

          // Проверяем наличие server-secret
          if (req.headers['server-secret'] === config.server_secret) {
            return resolve(source, args, context, info);
          }

          const user = req?.user;
          if (!user) {
            throw new Error(`Пользователь не авторизован для доступа к полю "${info.fieldName}". Выполните вход.`);
          }

          // Проверка соответствия ролей
          const hasAccess = requiredRoles.includes(user.role) || isSelf(source, selfPaths, user.username);
          if (!hasAccess) {
            // У поля с `self` доступ зависит от конкретного объекта: свой
            // участок пайщик читает, чужой — нет. Отказывать исключением здесь
            // нельзя — оно роняет весь ответ, и вместе с чужим объектом
            // пропадает свой. Поэтому такие поля просто пустеют.
            if (selfPaths.length > 0) return null;
            throw new UnauthorizedException(
              `Недостаточно прав доступа к полю "${info.fieldName}". Требуемые роли: ${requiredRoles.join(', ')}.`
            );
          }

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
}
