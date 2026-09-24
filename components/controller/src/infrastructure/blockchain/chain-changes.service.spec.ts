/**
 * Лента изменений цепи: кому уходит сигнал об изменении строки.
 *
 * Инварианты:
 *   - только объявленные таблицы своего кооператива;
 *   - таблица, открытая всем, — общий канал;
 *   - личная таблица — канал владельца строки и канал совета, не общий;
 *   - снятая строка личной таблицы владельца не называет — только совет;
 *   - в сигнале нет данных строки;
 *   - сбой шины разбор цепи не роняет.
 */
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import {
  ChainChangesService,
  chainChangesCouncilTopic,
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

  it('личная таблица: владельцу строки и совету, в общий канал — нет', async () => {
    const { service, pubSub } = build();

    await service.publish(delta({ table: 'contributors' }));

    const topics = pubSub.publish.mock.calls.map((c: unknown[]) => c[0]);
    expect(topics).toEqual([
      chainChangesOwnerTopic('voskhod', 'capital', 'contributors', 'ant'),
      chainChangesCouncilTopic('voskhod', 'capital', 'contributors'),
    ]);
  });

  it('снятая строка личной таблицы владельца не называет — только совет', async () => {
    const { service, pubSub } = build();

    await service.publish(delta({ table: 'contributors', present: false, value: undefined }));

    expect(pubSub.publish.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      chainChangesCouncilTopic('voskhod', 'capital', 'contributors'),
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
});
