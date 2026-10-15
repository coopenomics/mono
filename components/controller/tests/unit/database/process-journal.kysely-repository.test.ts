import { ProcessJournalKyselyRepository } from '~/infrastructure/database/kysely/repositories/process-journal.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

const HASH = 'ab'.repeat(32);
const COOP = 'voskhod';

/** Журнал цепи для реестра процессов: что именно уходит в базу. */
describe('ProcessJournalKyselyRepository', () => {
  it('действия нитки: хэш без учёта регистра, свой кооператив, порядок цепи', async () => {
    const { db, queries } = recordingKysely();

    await new ProcessJournalKyselyRepository(db).findActionsByProcess(HASH, COOP);

    expect(queries[0].sql).toContain(`LOWER(data ->> 'process_hash') = $1`);
    expect(queries[0].sql).toContain(`data ->> 'coopname' = $2`);
    expect(queries[0].sql).toContain('order by "block_num" asc, "global_sequence" asc');
    expect(queries[0].parameters).toEqual([HASH, COOP]);
  });

  it('изменения сущностной таблицы: кооператив — в области либо в значении', async () => {
    const { db, queries } = recordingKysely();

    await new ProcessJournalKyselyRepository(db).findEntityDeltas(
      { code: 'marketplace', table: 'orders', field: 'hash' },
      HASH,
      COOP
    );

    expect(queries[0].sql).toContain('"code" = $1 and "table" = $2');
    expect(queries[0].sql).toContain('LOWER(value ->> $3) = $4');
    expect(queries[0].sql).toContain(`("scope" = $5 or value ->> 'coopname' = $6)`);
    expect(queries[0].parameters).toEqual(['marketplace', 'orders', 'hash', HASH, COOP, COOP]);
  });

  it('действия с документами ограничены окном процесса, кооперативом и хэшем, учётный контракт исключён', async () => {
    const { db, queries } = recordingKysely();

    await new ProcessJournalKyselyRepository(db).findDocumentActions({
      hash: HASH,
      coopname: COOP,
      fromBlock: 100,
      toBlock: 250,
      excludeAccount: 'ledger2',
    });

    expect(queries[0].sql).toContain('"block_num" >= $1 and "block_num" <= $2 and "account" <> $3');
    expect(queries[0].sql).toContain(`data ->> 'coopname' = $4`);
    expect(queries[0].sql).toContain('data::text ILIKE $5');
    expect(queries[0].parameters).toEqual(['100', '250', 'ledger2', COOP, `%${HASH}%`]);
  });

  it('строка журнала отдаётся с числовым номером блока', async () => {
    const { db } = recordingKysely([{ rows: [{ id: 'a1', block_num: '4808', block_time: null, console: null }] }]);

    const [action] = await new ProcessJournalKyselyRepository(db).findActionsByProcess(HASH, COOP);

    expect(action.block_num).toBe(4808);
  });
});
