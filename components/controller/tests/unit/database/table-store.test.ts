import { TableStore, isNull, lessThan, notEqual, notNull, oneOf } from '@coopenomics/extension-kit';
import { recordingKysely } from '../helpers/kysely-recorder';
import { LocalChangesPlugin } from '~/infrastructure/database/kysely/local-changes.plugin';

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

  /**
   * Таблица ленты изменений: слой базы дописывает запросу `RETURNING`, и база
   * отвечает строками вместо счётчика. До 04.10.2026 шлюз читал счётчик у
   * строки: правка и удаление отвечали «ничего не затронуто», а запрос без
   * совпадений падал.
   */
  describe('таблица ленты изменений: число затронутых строк считается по строкам', () => {
    const watched = (results: Parameters<typeof recordingKysely>[0]) => {
      const plugin = new LocalChangesPlugin(() => true, () => ['id'], () => undefined);
      const { db, queries } = recordingKysely(results, [plugin]);
      return { store: new TableStore<Session>(db, { table: 'sessions', primaryKey: ['id'] }), queries };
    };

    it('правка двух строк отвечает двойкой', async () => {
      const { store, queries } = watched([{ rows: [{ id: 's1' }, { id: 's2' }], affected: 2 }]);

      await expect(store.update({ state: 'new' }, { state: 'done' })).resolves.toBe(2);
      expect(queries[0].sql).toBe('update "sessions" set "state" = $1 where "state" = $2 returning *');
    });

    it('удаление одной строки отвечает единицей, без совпадений — нулём', async () => {
      const { store } = watched([{ rows: [{ id: 's1' }], affected: 1 }, { rows: [], affected: 0 }]);

      await expect(store.delete({ id: 's1' })).resolves.toBe(1);
      await expect(store.delete({ id: 'нет' })).resolves.toBe(0);
    });
  });

  it('незаданное значение в отборе условия не даёт — отбор идёт по остальным полям', async () => {
    const { store, queries } = make();

    await store.find({ state: 'new', lastError: undefined });

    expect(queries[0].sql).toBe('select * from "sessions" where "state" = $1');
    expect(queries[0].parameters).toEqual(['new']);
  });

  it('поле типа date в записи — строка ГГГГ-ММ-ДД, а не объект даты', async () => {
    const { db } = recordingKysely([{ rows: [{ id: 's1', day: new Date(2026, 9, 5), created_at: new Date(2026, 9, 5, 12, 30) }] }]);
    const store = new TableStore<{ id: string; day: string; createdAt: Date }>(db, { table: 'work', primaryKey: ['id'], dates: ['day'] });

    const [record] = await store.find();

    expect(record.day).toBe('2026-10-05');
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  /**
   * Подгруженная связь лежит в записи рядом с её полями. До 05.10.2026 шлюз
   * писал в базу все поля переданного объекта, и сохранение записи со связью
   * уходило с несуществующей колонкой (находка перевода образования).
   */
  it('перечень полей задан: подгруженная связь и прочие лишние поля в базу не пишутся', async () => {
    const { db, queries } = recordingKysely([{ rows: [{ id: 'c1', title: 'Курс' }] }, { affected: 1 }]);
    const store = new TableStore<{ id: string; title: string; section?: unknown }>(db, {
      table: 'courses',
      primaryKey: ['id'],
      sameNames: true,
      columns: ['id', 'title'],
    });

    await store.save({ id: 'c1', title: 'Курс', section: { id: 's1' } });
    await store.update({ id: 'c1' }, { title: 'Новый', section: { id: 's2' } });

    expect(queries[0].sql).toBe('insert into "courses" ("id", "title") values ($1, $2) on conflict ("id") do update set "title" = $3 returning *');
    expect(queries[1].sql).toBe('update "courses" set "title" = $1 where "id" = $2');
  });

  it('таблица вне ленты: число затронутых строк берётся из счётчика базы', async () => {
    const { store } = make([{ affected: 3 }, { affected: 0 }]);

    await expect(store.delete({ state: 'old' })).resolves.toBe(3);
    await expect(store.update({ state: 'old' }, { state: 'new' })).resolves.toBe(0);
  });
});
