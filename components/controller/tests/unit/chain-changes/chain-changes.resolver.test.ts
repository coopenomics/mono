/**
 * Подписка на ленту изменений цепи: какие каналы получает пайщик.
 *
 * Инварианты:
 *   - каналы выбирает сервер по праву пайщика, клиент выбрать чужие не может;
 *   - личная таблица: пайщику — только его строки, персоналу — все строки;
 *   - служебная таблица — только персоналу, остальным канала нет;
 *   - необъявленная таблица, чужой кооператив, соединение без пайщика — отказ;
 *   - без перечня таблиц — все таблицы ленты.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { ChainChangesResolver } from '~/application/chain-changes/resolvers/chain-changes.resolver';
import {
  chainChangesStaffTopic,
  chainChangesOwnerTopic,
  chainChangesTopic,
} from '~/infrastructure/blockchain/chain-changes.service';

const TABLES = [
  { code: 'capital', table: 'projects' },
  { code: 'capital', table: 'contributors', owner_field: 'username' },
  { code: 'edubridge', table: 'edubridge_access_tasks', staff_only: true },
];
const STAFF: Record<string, string[]> = { edubridge: ['eduadmin'] };

function build() {
  const feed = {
    declared: jest.fn(() => TABLES),
    tableOf: jest.fn((code: string, table: string) => TABLES.find((t) => t.code === code && t.table === table)),
    isStaff: jest.fn(
      (code: string, user: { username?: string; role?: string }) =>
        ['chairman', 'member'].includes(String(user.role)) || Boolean(STAFF[code]?.includes(String(user.username)))
    ),
  } as any;
  const iterator = {} as AsyncIterator<unknown>;
  const pubSub = { asyncIterator: jest.fn().mockReturnValue(iterator) } as any;
  return { resolver: new ChainChangesResolver(feed, pubSub), pubSub, iterator };
}

const input = (tables?: { code: string; table: string }[]) => ({ coopname: 'voskhod', tables }) as any;

describe('ChainChangesResolver.chainChanges', () => {
  it('пайщик: открытая таблица — общий канал, личная — только свои строки', () => {
    const { resolver, pubSub, iterator } = build();

    const result = resolver.chainChanges({ username: 'ant', role: 'user' }, input());

    expect(pubSub.asyncIterator).toHaveBeenCalledWith([
      chainChangesTopic('voskhod', 'capital', 'projects'),
      chainChangesOwnerTopic('voskhod', 'capital', 'contributors', 'ant'),
    ]);
    expect(result).toBe(iterator);
  });

  it('председатель и член совета: личная таблица — все строки', () => {
    for (const role of ['chairman', 'member']) {
      const { resolver, pubSub } = build();

      resolver.chainChanges({ username: 'boss', role }, input([{ code: 'capital', table: 'contributors' }]));

      expect(pubSub.asyncIterator).toHaveBeenCalledWith([chainChangesStaffTopic('voskhod', 'capital', 'contributors')]);
    }
  });

  it('перечень таблиц сужает каналы', () => {
    const { resolver, pubSub } = build();

    resolver.chainChanges({ username: 'ant', role: 'user' }, input([{ code: 'capital', table: 'projects' }]));

    expect(pubSub.asyncIterator).toHaveBeenCalledWith([chainChangesTopic('voskhod', 'capital', 'projects')]);
  });

  it('необъявленная таблица — отказ', () => {
    const { resolver, pubSub } = build();

    expect(() =>
      resolver.chainChanges({ username: 'ant', role: 'user' }, input([{ code: 'capital', table: 'secrets' }]))
    ).toThrow(ForbiddenException);
    expect(pubSub.asyncIterator).not.toHaveBeenCalled();
  });

  it('чужой кооператив и соединение без пайщика — отказ', () => {
    const { resolver } = build();

    expect(() => resolver.chainChanges({ username: 'ant', role: 'user' }, { coopname: 'other' } as any)).toThrow(
      ForbiddenException
    );
    expect(() => resolver.chainChanges({}, input())).toThrow(ForbiddenException);
  });

  it('служебная таблица: персоналу расширения — канал, пайщику — нет', () => {
    const tables = [{ code: 'edubridge', table: 'edubridge_access_tasks' }];
    const admin = build();
    admin.resolver.chainChanges({ username: 'eduadmin', role: 'user' }, input(tables));
    expect(admin.pubSub.asyncIterator).toHaveBeenCalledWith([chainChangesStaffTopic('voskhod', 'edubridge', 'edubridge_access_tasks')]);

    const member = build();
    member.resolver.chainChanges({ username: 'ant', role: 'user' }, input(tables));
    expect(member.pubSub.asyncIterator).toHaveBeenCalledWith([]);
  });
});
