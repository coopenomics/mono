import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler, type RootOperationNode } from 'kysely';
import { LocalChangesPlugin, type LocalChange } from '~/infrastructure/database/kysely/local-changes.plugin';
import { configureLocalChangePublisher, inTransaction, pendingLocalChanges } from '@coopenomics/extension-kit';
import { recordingKysely } from '../helpers/kysely-recorder';

/**
 * Сигналы ленты изменений для таблиц, записанных через Kysely (C28-81):
 * плагин заменяет подписчика TypeORM у переведённых доменов.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new Kysely<any>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (instance) => new PostgresIntrospector(instance),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

function makePlugin() {
  const changes: LocalChange[] = [];
  const plugin = new LocalChangesPlugin(
    (table) => table === 'membership_exit_requests' || table === 'pair',
    (table) => (table === 'pair' ? ['coopname', 'username'] : ['id']),
    (change) => changes.push(change)
  );
  return { plugin, changes };
}

async function run(plugin: LocalChangesPlugin, node: RootOperationNode, rows: Record<string, unknown>[]) {
  const queryId = { queryId: Math.random().toString() };
  const transformed = plugin.transformQuery({ node, queryId });
  await plugin.transformResult({ queryId, result: { rows } });
  return transformed as unknown as { returning?: unknown };
}

describe('LocalChangesPlugin: сигналы ленты для записей Kysely', () => {
  it('вставка в наблюдаемую таблицу: строка запрошена целиком, сигнал несёт ключ и строку', async () => {
    const { plugin, changes } = makePlugin();
    const node = db.insertInto('membership_exit_requests').values({ username: 'ant' }).toOperationNode();
    const row = { id: 'a1', username: 'ant' };

    const transformed = await run(plugin, node, [row]);

    expect(transformed.returning).toBeDefined();
    expect(changes).toEqual([{ table: 'membership_exit_requests', primary_key: 'a1', row }]);
  });

  it('правка и удаление дают сигнал по каждой затронутой строке', async () => {
    const { plugin, changes } = makePlugin();
    const update = db.updateTable('membership_exit_requests').set({ token: 't' }).where('id', '=', 'a1').toOperationNode();
    const remove = db.deleteFrom('membership_exit_requests').where('username', '=', 'ant').toOperationNode();

    expect((await run(plugin, update, [{ id: 'a1' }])).returning).toBeDefined();
    expect((await run(plugin, remove, [{ id: 'a1' }, { id: 'a2' }])).returning).toBeDefined();

    expect(changes.map((c) => c.primary_key)).toEqual(['a1', 'a1', 'a2']);
  });

  it('свой RETURNING запроса не подменяется', async () => {
    const { plugin, changes } = makePlugin();
    const node = db.insertInto('membership_exit_requests').values({ username: 'ant' }).returning('id').toOperationNode();

    const transformed = await run(plugin, node, [{ id: 'a1' }]);

    expect(transformed).toBe(node);
    expect(changes).toHaveLength(1);
  });

  it('составной ключ собирается через двоеточие', async () => {
    const { plugin, changes } = makePlugin();
    const node = db.insertInto('pair').values({ coopname: 'voskhod', username: 'ant' }).toOperationNode();

    await run(plugin, node, [{ coopname: 'voskhod', username: 'ant' }]);

    expect(changes[0].primary_key).toBe('voskhod:ant');
  });

  it('чтение и запись в ненаблюдаемую таблицу сигнала не дают и запрос не меняют', async () => {
    const { plugin, changes } = makePlugin();
    const select = db.selectFrom('membership_exit_requests').selectAll().toOperationNode();
    const insert = db.insertInto('users').values({ username: 'ant' }).toOperationNode();

    expect(await run(plugin, select, [{ id: 'a1' }])).toBe(select);
    expect(await run(plugin, insert, [])).toBe(insert);
    expect(changes).toEqual([]);
  });
});

/**
 * Транзакция каркаса (`inTransaction` из extension-kit): сигналы ленты копятся
 * до фиксации. Стол по сигналу перечитывает данные — сигнал до фиксации показал
 * бы прежнее состояние, а сигнал откаченной записи — то, чего в базе нет.
 */
describe('inTransaction: сигналы ленты уходят после фиксации', () => {
  const change = { table: 'marketplace_inventory', primary_key: 'inv-1', row: { id: 'inv-1' } };

  it('изменение внутри транзакции публикуется только после её завершения', async () => {
    const published: unknown[] = [];
    configureLocalChangePublisher((item) => published.push(item));
    const { db: recording } = recordingKysely();

    const result = await inTransaction(recording, async () => {
      pendingLocalChanges.getStore()?.push(change);
      expect(published).toEqual([]);
      return 'готово';
    });

    expect(result).toBe('готово');
    expect(published).toEqual([change]);
  });

  it('откаченная транзакция сигналов не даёт', async () => {
    const published: unknown[] = [];
    configureLocalChangePublisher((item) => published.push(item));
    const { db: recording } = recordingKysely();

    await expect(
      inTransaction(recording, async () => {
        pendingLocalChanges.getStore()?.push(change);
        throw new Error('сбой записи');
      })
    ).rejects.toThrow('сбой записи');

    expect(published).toEqual([]);
  });

  it('вне транзакции копить некуда — изменение публикуется сразу тем, кто его записал', () => {
    expect(pendingLocalChanges.getStore()).toBeUndefined();
  });
});
