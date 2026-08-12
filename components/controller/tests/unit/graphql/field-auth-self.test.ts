/**
 * Доступ к полю объекта: роль кооператива ИЛИ принадлежность самих данных.
 *
 * Роль отвечает за «такой род данных вообще доступен» — председателю
 * кооператива и совету. Но часть данных принадлежит самому пайщику:
 * председатель кооперативного участка для кооператива обычный пайщик, и по
 * ролям он не прочитал бы состав собственного участка. Отказ поля роняет весь
 * запрос целиком, поэтому вместе с составом он терял и всю карточку участка —
 * стол ПВЗ переставал узнавать в нём председателя.
 *
 * Проверяется механика директивы: пути `self` считаются от самого объекта,
 * `[]` разворачивает массив, посторонний пайщик доступа не получает.
 */
import { UnauthorizedException } from '@nestjs/common';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { fieldAuthDirectiveTransformer } from '~/infrastructure/graphql/directives/fieldAuth.directive';

const typeDefs = /* GraphQL */ `
  directive @auth(roles: [String!]!, self: [String!]) on FIELD_DEFINITION

  type Person {
    username: String!
  }

  type Branch {
    braname: String!
    trustee: Person @auth(roles: ["chairman", "member"], self: ["trustee.username", "trusted[].username"])
    trusted: [Person!] @auth(roles: ["chairman", "member"], self: ["trustee.username", "trusted[].username"])
    whitelist: [String!]! @auth(roles: ["chairman", "member"])
  }

  type Query {
    branch: Branch!
  }
`;

const BRANCH = {
  braname: 'krg',
  trustee: { username: 'chairkrg' },
  trusted: [{ username: 'trustedkrg' }, { username: 'opkrg' }],
  whitelist: ['ekaterina'],
};

function buildSchema() {
  return fieldAuthDirectiveTransformer(
    makeExecutableSchema({ typeDefs, resolvers: { Query: { branch: () => BRANCH } } }),
    'auth'
  );
}

/** Запрос от имени пайщика с указанной ролью. */
async function ask(query: string, user: { username: string; role: string } | null) {
  return graphql({
    schema: buildSchema(),
    source: query,
    contextValue: { req: { user, headers: {} } },
  });
}

const FULL = '{ branch { braname trustee { username } trusted { username } } }';

describe('Поле объекта: роль кооператива', () => {
  it('председатель кооператива читает состав любого участка', async () => {
    const res = await ask(FULL, { username: 'voskhod', role: 'chairman' });

    expect(res.errors).toBeUndefined();
    expect((res.data as any).branch.trustee.username).toBe('chairkrg');
  });

  it('посторонний пайщик состав участка не видит, но карточку получает', async () => {
    // Поле с `self` при отказе пустеет, а не роняет ответ: пайщику приходит
    // список участков, где состав виден только у своих. Исключение здесь
    // обнулило бы весь список.
    const res = await ask(FULL, { username: 'ekaterina', role: 'user' });

    expect(res.errors).toBeUndefined();
    expect((res.data as any).branch.braname).toBe('krg');
    expect((res.data as any).branch.trustee).toBeNull();
    expect((res.data as any).branch.trusted).toBeNull();
  });

  it('неавторизованный запрос отклоняется', async () => {
    const res = await ask(FULL, null);

    expect(res.errors?.[0]?.message).toContain('не авторизован');
  });
});

describe('Поле объекта: принадлежность данных пайщику', () => {
  it('председатель участка читает свой участок, оставаясь обычным пайщиком', async () => {
    const res = await ask(FULL, { username: 'chairkrg', role: 'user' });

    expect(res.errors).toBeUndefined();
    expect((res.data as any).branch.trusted.map((p: any) => p.username)).toEqual([
      'trustedkrg',
      'opkrg',
    ]);
  });

  it('доверенное лицо участка тоже читает свой участок', async () => {
    // Путь `trusted[].username` разворачивает массив: совпадение с любым из
    // доверенных открывает поле.
    const res = await ask(FULL, { username: 'opkrg', role: 'user' });

    expect(res.errors).toBeUndefined();
    expect((res.data as any).branch.trustee.username).toBe('chairkrg');
  });

  it('поле без self отказывает по-прежнему исключением', async () => {
    // Там, где принадлежность не объявлена, поведение не меняется: отказ
    // громкий. Мягкое пустое значение — только для полей с `self`, где часть
    // объектов своя, а часть чужая.
    const res = await ask('{ branch { whitelist } }', { username: 'chairkrg', role: 'user' });

    expect(res.errors?.[0]?.originalError).toBeInstanceOf(UnauthorizedException);
  });

  it('председатель чужого участка состав этого участка не видит', async () => {
    // Он председатель, но другого участка: пути self ведут к чужим именам.
    const res = await ask(FULL, { username: 'chairodn', role: 'user' });

    expect(res.errors).toBeUndefined();
    expect((res.data as any).branch.trustee).toBeNull();
  });
});
