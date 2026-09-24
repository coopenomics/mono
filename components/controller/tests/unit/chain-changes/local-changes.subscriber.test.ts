/**
 * Сигналы ленты для таблиц базы узла: подписчик TypeORM.
 *
 * Инварианты:
 *   - запись в объявленную таблицу внутри транзакции — сигнал только после
 *     фиксации, со строкой (владелец) и ключом;
 *   - откат транзакции — сигнала нет;
 *   - запись вне транзакции уже зафиксирована — сигнал сразу;
 *   - необъявленная таблица — тишина;
 *   - удаление: ключ и владелец из прежней строки.
 */
import { LocalChangesSubscriber } from '~/infrastructure/blockchain/local-changes.subscriber';

const LESSONS = 'edubridge_lessons';

function metadata(tableName: string) {
  return {
    tableName,
    primaryColumns: [{ getEntityValue: (row: Record<string, unknown>) => row.id }],
  } as any;
}

function build() {
  const dataSource = { subscribers: [] as unknown[] } as any;
  const feed = {
    localTableOf: jest.fn((t: string) => (t === LESSONS ? { code: 'edubridge', table: LESSONS } : undefined)),
    publishLocal: jest.fn().mockResolvedValue(undefined),
  } as any;
  const subscriber = new LocalChangesSubscriber(dataSource, feed);
  return { subscriber, feed, dataSource };
}

describe('LocalChangesSubscriber', () => {
  it('регистрируется подписчиком источника данных', () => {
    const { subscriber, dataSource } = build();
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('в транзакции: сигнал только после фиксации', () => {
    const { subscriber, feed } = build();
    const queryRunner = { isTransactionActive: true } as any;
    const row = { id: '7', teacher_username: 'teach' };

    subscriber.afterInsert({ metadata: metadata(LESSONS), queryRunner, entity: row } as any);
    expect(feed.publishLocal).not.toHaveBeenCalled();

    subscriber.afterTransactionCommit({ queryRunner } as any);
    expect(feed.publishLocal).toHaveBeenCalledWith(LESSONS, '7', row);
  });

  it('откат транзакции — сигнала нет', () => {
    const { subscriber, feed } = build();
    const queryRunner = { isTransactionActive: true } as any;

    subscriber.afterUpdate({ metadata: metadata(LESSONS), queryRunner, entity: { id: '7' }, databaseEntity: { id: '7' } } as any);
    subscriber.afterTransactionRollback({ queryRunner } as any);
    subscriber.afterTransactionCommit({ queryRunner } as any);

    expect(feed.publishLocal).not.toHaveBeenCalled();
  });

  it('вне транзакции — сигнал сразу', () => {
    const { subscriber, feed } = build();

    subscriber.afterUpdate({
      metadata: metadata(LESSONS),
      queryRunner: { isTransactionActive: false },
      entity: { status: 'DONE' },
      databaseEntity: { id: '9', teacher_username: 'teach' },
    } as any);

    expect(feed.publishLocal).toHaveBeenCalledWith(LESSONS, '9', { id: '9', teacher_username: 'teach', status: 'DONE' });
  });

  it('удаление: ключ и владелец из прежней строки', () => {
    const { subscriber, feed } = build();

    subscriber.afterRemove({
      metadata: metadata(LESSONS),
      queryRunner: { isTransactionActive: false },
      entity: undefined,
      databaseEntity: { id: '5', teacher_username: 'teach' },
    } as any);

    expect(feed.publishLocal).toHaveBeenCalledWith(LESSONS, '5', { id: '5', teacher_username: 'teach' });
  });

  it('необъявленная таблица — тишина', () => {
    const { subscriber, feed } = build();

    subscriber.afterInsert({ metadata: metadata('users'), queryRunner: { isTransactionActive: false }, entity: { id: '1' } } as any);

    expect(feed.publishLocal).not.toHaveBeenCalled();
  });
});
