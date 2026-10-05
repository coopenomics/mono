/**
 * Версии записей зеркал цепи и откат форка на Kysely (C28-81).
 *
 * Версия хранит состояние записи ДО изменения и блок самого изменения. После
 * форка запись возвращается к состоянию перед самым ранним изменением с блоком
 * больше блока форка; запись, которой форк не коснулся, остаётся как есть.
 */
import { ChainVersioningService } from '@coopenomics/extension-kit/sync';
import { TableStore } from '@coopenomics/extension-kit';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';

interface Mirror {
  _id: string;
  block_num: number;
  present: boolean;
  title: string;
}

function setup(results: ScriptedResult[]) {
  const { db, queries } = recordingKysely(results);
  const store = new TableStore<Mirror>(db, { table: 'capital_projects', primaryKey: ['_id'], sameNames: true });
  return { service: new ChainVersioningService(db as never), store, queries };
}

describe('ChainVersioningService', () => {
  it('перед изменением существующей записи её состояние уходит в версии с блоком изменения', async () => {
    const current = { _id: 'p1', block_num: 10, present: true, title: 'до' };
    const { service, store, queries } = setup([{ rows: [current] }, { rows: [] }]);

    await service.saveVersionBeforeUpdate(store, { _id: 'p1', title: 'после' }, 12, 'save');

    expect(queries[1].sql).toContain('insert into "entity_versions"');
    expect(queries[1].parameters).toEqual(expect.arrayContaining(['capital_projects', 'p1', JSON.stringify(current), 12, 'save']));
  });

  it('новой записи и записи без ключа версионировать нечего', async () => {
    const { service, store, queries } = setup([{ rows: [] }]);

    await service.saveVersionBeforeUpdate(store, { title: 'без ключа' }, 12, 'save');
    await service.saveVersionBeforeUpdate(store, { _id: 'новая' }, 12, 'save');

    // Без ключа запроса нет вовсе; по ключу — одно чтение и ни одной записи.
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('select');
  });

  it('откат форка: запись возвращается к состоянию перед самым ранним отменённым изменением', async () => {
    const versions = [
      { id: 'v1', entity_table: 'capital_projects', entity_id: 'p1', block_num: 11, previous_data: { _id: 'p1', block_num: 9, present: true, title: 'на блоке форка' } },
      { id: 'v2', entity_table: 'capital_projects', entity_id: 'p1', block_num: 12, previous_data: { _id: 'p1', block_num: 11, present: true, title: 'уже после форка' } },
    ];
    const { service, store, queries } = setup([
      { rows: versions },
      { rows: [{ _id: 'p1', block_num: 12, present: true, title: 'сейчас' }] },
      { rows: [{ _id: 'p1', block_num: 9, present: true, title: 'на блоке форка' }] },
    ]);

    await service.restoreVersionsAfterFork(store, 10);

    expect(queries[0].sql).toContain('"block_num" > $2');
    expect(queries).toHaveLength(3);
    expect(queries[2].sql).toContain('insert into "capital_projects"');
    expect(queries[2].parameters).toEqual(expect.arrayContaining(['p1', 9, 'на блоке форка']));
  });

  it('запись, появившаяся после форка, не воскрешается; запись без отменённых изменений не трогается', async () => {
    const versions = [
      { id: 'v1', entity_table: 'capital_projects', entity_id: 'p2', block_num: 13, previous_data: { _id: 'p2', block_num: 12, present: true, title: 'создана после форка' } },
    ];
    const { service, store, queries } = setup([{ rows: versions }]);

    await service.restoreVersionsAfterFork(store, 10);

    expect(queries).toHaveLength(1);
  });

  it('откат форка: из нескольких записей возвращается только та, что менялась после форка, по самому раннему изменению', async () => {
    // Версии читаются от ранних к поздним, только с блоком больше блока форка:
    // запись без таких версий и локальное изменение без блока сюда не попадают.
    const versions = [
      { id: 'v1', entity_table: 'capital_projects', entity_id: 'p1', block_num: 11, previous_data: { _id: 'p1', block_num: 9, present: true, title: 'на блоке форка' } },
      { id: 'v2', entity_table: 'capital_projects', entity_id: 'p1', block_num: 11, previous_data: { _id: 'p1', block_num: 11, present: true, title: 'второе изменение того же блока' } },
      { id: 'v3', entity_table: 'capital_projects', entity_id: 'p4', block_num: 14, previous_data: { _id: 'p4', block_num: 13, present: true, title: 'создана после форка' } },
    ];
    const { service, store, queries } = setup([{ rows: versions }, { rows: [] }, { rows: [{ _id: 'p1', block_num: 9, present: true, title: 'на блоке форка' }] }]);

    await service.restoreVersionsAfterFork(store, 10);

    expect(queries[0].sql).toContain('"block_num" > $2');
    expect(queries[0].sql).toContain('order by "entity_id" asc, "block_num" asc, "created_at" asc');
    // Одно чтение живой записи и одна запись — только для p1.
    expect(queries).toHaveLength(3);
    expect(queries[2].parameters).toEqual(expect.arrayContaining(['p1', 9, 'на блоке форка']));
    expect(queries[2].parameters).not.toEqual(expect.arrayContaining(['p4']));
  });

  it('архив форка: отменённые записи переносятся в архив и убираются из таблицы', async () => {
    const rows = [{ _id: 'p3', block_num: 14, present: true, title: 'отменена' }];
    const { service, store, queries } = setup([{ rows }, { rows: [] }, { affected: 1 }]);

    await expect(service.archiveAndDeleteLiveAfterFork(store, 10, 'fork-1')).resolves.toBe(1);

    expect(queries[1].sql).toContain('insert into "invalidated_entities"');
    expect(queries[1].parameters).toEqual(['capital_projects', 'p3', JSON.stringify(rows[0]), 10, 'fork-1']);
    expect(queries[2].sql).toContain('delete from "capital_projects"');
    expect(queries[2].sql).toContain('"block_num" > $1');
  });

  it('архив форка без отменённых записей ничего не пишет', async () => {
    const { service, store, queries } = setup([{ rows: [] }]);

    await expect(service.archiveAndDeleteLiveAfterFork(store, 10)).resolves.toBe(0);
    expect(queries).toHaveLength(1);
  });
});
