/**
 * Отметки применённых событий цепи: защита от повторной доставки.
 *
 * Инварианты: наличие отметки читается по ключу события; повторная отметка не
 * падает (ON CONFLICT DO NOTHING); номер блока пишется строкой (bigint), у
 * старых вызовов без блока — пусто; форк снимает отметки после блока.
 */
import { ConsumerDedupKyselyRepository } from '~/infrastructure/database/kysely/repositories/consumer-dedup.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

describe('ConsumerDedupKyselyRepository', () => {
  it('isApplied → true, когда метка найдена', async () => {
    const { db, queries } = recordingKysely([{ rows: [{ event_id: 'e1' }] }]);
    expect(await new ConsumerDedupKyselyRepository(db).isApplied('e1')).toBe(true);
    expect(queries[0].sql).toBe('select "event_id" from "consumer_dedup" where "event_id" = $1');
    expect(queries[0].parameters).toEqual(['e1']);
  });

  it('isApplied → false, когда метки нет', async () => {
    const { db } = recordingKysely();
    expect(await new ConsumerDedupKyselyRepository(db).isApplied('e1')).toBe(false);
  });

  it('markApplied без номера блока пишет пустой блок, повтор не падает', async () => {
    const { db, queries } = recordingKysely();

    await new ConsumerDedupKyselyRepository(db).markApplied('e1');

    expect(queries[0].sql).toBe(
      'insert into "consumer_dedup" ("event_id", "block_num") values ($1, $2) on conflict do nothing'
    );
    expect(queries[0].parameters).toEqual(['e1', null]);
  });

  it('markApplied с номером блока пишет его строкой', async () => {
    const { db, queries } = recordingKysely();

    await new ConsumerDedupKyselyRepository(db).markApplied('e1', 12345);

    expect(queries[0].parameters).toEqual(['e1', '12345']);
  });

  it('deleteOlderThan возвращает число удалённых строк', async () => {
    const { db, queries } = recordingKysely([{ affected: 7 }]);
    const cutoff = new Date('2026-10-01T00:00:00Z');

    expect(await new ConsumerDedupKyselyRepository(db).deleteOlderThan(cutoff)).toBe(7);
    expect(queries[0].sql).toBe('delete from "consumer_dedup" where "applied_at" < $1');
    expect(queries[0].parameters).toEqual([cutoff]);
  });

  it('deleteAfterBlock снимает отметки после блока и возвращает их число', async () => {
    const { db, queries } = recordingKysely([{ affected: 3 }]);

    expect(await new ConsumerDedupKyselyRepository(db).deleteAfterBlock(1000)).toBe(3);
    expect(queries[0].sql).toBe('delete from "consumer_dedup" where "block_num" > $1');
    expect(queries[0].parameters).toEqual(['1000']);
  });

  it('deleteAfterBlock возвращает 0 при пустом результате и когда драйвер не сообщил число строк', async () => {
    expect(await new ConsumerDedupKyselyRepository(recordingKysely([{ affected: 0 }]).db).deleteAfterBlock(999)).toBe(0);
    expect(await new ConsumerDedupKyselyRepository(recordingKysely().db).deleteAfterBlock(999)).toBe(0);
  });
});
