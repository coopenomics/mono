import { TableStore, isNull, lessThan, notEqual, notNull, oneOf } from '@coopenomics/extension-kit';
import { recordingKysely } from '../helpers/kysely-recorder';

interface Session {
  id: string;
  cardId: string;
  state: string;
  memberships: string[];
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const make = (results: Parameters<typeof recordingKysely>[0] = []) => {
  const { db, queries } = recordingKysely(results);
  const store = new TableStore<Session>(db, { table: 'sessions', primaryKey: ['id'], json: ['memberships'], updatedAt: 'updatedAt' });
  return { store, queries };
};

/** Шлюз таблицы: записи целиком, запросы — обычные запросы Kysely. */
describe('TableStore', () => {
  it('запись без ключа вставляется; объект дополняется ключом и умолчаниями базы', async () => {
    const { store, queries } = make([{ rows: [{ id: 's1', card_id: 'c1', state: 'new', memberships: [], created_at: new Date(0) }] }]);
    const record = store.create({ cardId: 'c1', memberships: ['voskhod'] });

    const saved = await store.save(record);

    expect(queries[0].sql).toBe('insert into "sessions" ("card_id", "memberships") values ($1, $2) returning *');
    expect(queries[0].parameters).toEqual(['c1', '["voskhod"]']);
    // Вернулся тот же объект: код после сохранения читает из него ключ.
    expect(saved).toBe(record);
    expect(record).toMatchObject({ id: 's1', cardId: 'c1', state: 'new' });
  });

  it('запись с ключом правится на месте: ключ не переписывается, время правки ставит база', async () => {
    const { store, queries } = make([{ rows: [{ id: 's1', card_id: 'c1', state: 'done' }] }]);

    await store.save({ id: 's1', cardId: 'c1', state: 'done', lastError: null });

    expect(queries[0].sql).toContain('on conflict ("id") do update set "card_id" = $5, "state" = $6, "last_error" = $7, "updated_at" = now()');
    expect(queries[0].sql).not.toContain('set "id"');
  });

  it('незаданное поле в запрос не попадает — прежнее значение не затирается', async () => {
    const { store, queries } = make([{ affected: 1 }]);

    expect(await store.update({ id: 's1' }, { state: 'done', lastError: undefined })).toBe(1);

    expect(queries[0].sql).toBe('update "sessions" set "state" = $1, "updated_at" = now() where "id" = $2');
  });

  it('отбор: равенство полей, пустое значение, условия и «или» между группами', async () => {
    const { store, queries } = make();
    const border = new Date('2026-10-01T00:00:00Z');

    await store.find(
      [
        { state: 'pending', lastError: null },
        { state: notEqual('revoked'), lastError: notNull(), createdAt: lessThan(border) },
        { cardId: oneOf(['c1', 'c2']), lastError: isNull() },
      ],
      { order: { updatedAt: 'DESC' }, limit: 5 }
    );

    expect(queries[0].sql).toBe(
      'select * from "sessions" where (("state" = $1 and "last_error" is null) ' +
        'or ("state" <> $2 and "last_error" is not null and "created_at" < $3) ' +
        'or ("card_id" in ($4, $5) and "last_error" is null)) order by "updated_at" desc limit $6'
    );
    expect(queries[0].parameters).toEqual(['pending', 'revoked', border, 'c1', 'c2', 5]);
  });

  it('пустой перечень значений не находит ничего и не ломает запрос', async () => {
    const { store, queries } = make();

    await store.find({ cardId: oneOf([]) });

    expect(queries[0].sql).toBe('select * from "sessions" where false');
  });

  it('удаление и счёт отдают числа, запись читается с полями домена', async () => {
    const { store } = make([{ affected: 2 }, { rows: [{ count: '3' }] }, { rows: [{ id: 's1', card_id: 'c1', last_error: null }] }]);

    expect(await store.delete({ cardId: 'c1' })).toBe(2);
    expect(await store.count({ state: 'new' })).toBe(3);
    expect(await store.findOne({ id: 's1' })).toEqual({ id: 's1', cardId: 'c1', lastError: null });
  });
});
