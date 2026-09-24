/**
 * Лента изменений цепи: кому уходит сигнал об изменении строки.
 *
 * Инварианты:
 *   - только объявленные таблицы своего кооператива;
 *   - таблица, открытая всем, — общий канал;
 *   - личная таблица — канал владельца строки и канал персонала, не общий;
 *   - снятая строка личной таблицы владельца не называет — только персонал;
 *   - служебная таблица — только персоналу; таблица базы узла — с блоком 0;
 *   - персонал: совет всегда, плюс назначенные расширением.
 *   - в сигнале нет данных строки;
 *   - сбой шины разбор цепи не роняет.
 */
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import {
  ChainChangesService,
  chainChangesStaffTopic,
  chainChangesOwnerTopic,
  chainChangesTopic,
} from './chain-changes.service';

const logger = { setContext: jest.fn(), warn: jest.fn() } as any;

function build() {
  const pubSub = { publish: jest.fn().mockResolvedValue(undefined) } as any;
  const service = new ChainChangesService(logger, pubSub);
  service.declareTables([
    { code: 'capital', table: 'projects' },
    { code: 'capital', table: 'contributors', owner_field: 'username' },
  ]);
  return { service, pubSub };
}

const delta = (over: Record<string, unknown> = {}) =>
  ({
    code: 'capital',
    table: 'projects',
    scope: 'voskhod',
    primary_key: '7',
    block_num: 500,
    present: true,
    value: { username: 'ant', secret: 'x' },
    ...over,
  }) as any;

describe('ChainChangesService', () => {
  afterEach(() => jest.clearAllMocks());

  it('таблица, открытая всем: сигнал в общий канал, без данных строки', async () => {
    const { service, pubSub } = build();

    await service.publish(delta());

    expect(pubSub.publish).toHaveBeenCalledTimes(1);
    expect(pubSub.publish).toHaveBeenCalledWith(chainChangesTopic('voskhod', 'capital', 'projects'), {
      chainChanges: { code: 'capital', table: 'projects', scope: 'voskhod', primary_key: '7', block_num: 500 },
    });
  });

  it('личная таблица: владельцу строки и персоналу, в общий канал — нет', async () => {
    const { service, pubSub } = build();

    await service.publish(delta({ table: 'contributors' }));

    const topics = pubSub.publish.mock.calls.map((c: unknown[]) => c[0]);
    expect(topics).toEqual([
      chainChangesOwnerTopic('voskhod', 'capital', 'contributors', 'ant'),
      chainChangesStaffTopic('voskhod', 'capital', 'contributors'),
    ]);
  });

  it('снятая строка личной таблицы владельца не называет — только персонал', async () => {
    const { service, pubSub } = build();

    await service.publish(delta({ table: 'contributors', present: false, value: undefined }));

    expect(pubSub.publish.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      chainChangesStaffTopic('voskhod', 'capital', 'contributors'),
    ]);
  });

  it('необъявленная таблица и чужой кооператив — тишина', async () => {
    const { service, pubSub } = build();

    await service.publish(delta({ table: 'secrets' }));
    await service.publish(delta({ scope: 'other' }));

    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('кошельки пайщиков ядро объявляет само, как личную таблицу', () => {
    const { service } = build();

    expect(service.tableOf('ledger2', 'userwallets')).toEqual(
      expect.objectContaining({ owner_field: 'username' })
    );
  });

  it('сбой шины — предупреждение в журнал, разбор цепи не падает', async () => {
    const { service, pubSub } = build();
    pubSub.publish.mockRejectedValue(new Error('bus down'));

    await expect(service.publish(delta())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bus down'));
  });

  it('таблица базы узла: сигнал с блоком 0, владельцу строки и персоналу', async () => {
    const { service, pubSub } = build();
    service.declareLocalTables([{ code: 'edubridge', table: 'edubridge_lessons', owner_field: 'teacher_username' }]);

    await service.publishLocal('edubridge_lessons', '42', { teacher_username: 'teach', id: '42' });

    expect(pubSub.publish.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      chainChangesOwnerTopic('voskhod', 'edubridge', 'edubridge_lessons', 'teach'),
      chainChangesStaffTopic('voskhod', 'edubridge', 'edubridge_lessons'),
    ]);
    expect(pubSub.publish.mock.calls[0][1]).toEqual({
      chainChanges: { code: 'edubridge', table: 'edubridge_lessons', scope: 'voskhod', primary_key: '42', block_num: 0 },
    });
  });

  it('служебная таблица — только персоналу; необъявленная таблица базы — тишина', async () => {
    const { service, pubSub } = build();
    service.declareLocalTables([{ code: 'edubridge', table: 'edubridge_access_tasks', staff_only: true }]);

    await service.publishLocal('edubridge_access_tasks', '1', undefined);
    await service.publishLocal('edubridge_secrets', '1', undefined);

    expect(pubSub.publish.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      chainChangesStaffTopic('voskhod', 'edubridge', 'edubridge_access_tasks'),
    ]);
  });

  it('персонал: совет всегда, назначенные расширением — только в своём расширении', () => {
    const { service } = build();
    service.setStaff('edubridge', ['admin1']);

    expect(service.isStaff('edubridge', { username: 'boss', role: 'chairman' })).toBe(true);
    expect(service.isStaff('edubridge', { username: 'm', role: 'member' })).toBe(true);
    expect(service.isStaff('edubridge', { username: 'admin1', role: 'user' })).toBe(true);
    expect(service.isStaff('capital', { username: 'admin1', role: 'user' })).toBe(false);
    expect(service.isStaff('edubridge', { username: 'ant', role: 'user' })).toBe(false);

    service.setStaff('edubridge', []);
    expect(service.isStaff('edubridge', { username: 'admin1', role: 'user' })).toBe(false);
  });
});
