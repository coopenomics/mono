/**
 * Сборщик выборки из фрагментов SQL с именованными параметрами (C28-81).
 * Значения уходят только параметрами; текст запроса собирается из фрагментов,
 * которые пишет разработчик.
 */
import { TableStore, bindNamed } from '@coopenomics/extension-kit';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';

interface Segment {
  _id: string;
  username: string;
  project_hash: string;
}

function setup(results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { store: new TableStore<Segment>(db, { table: 'capital_segments', primaryKey: ['_id'], sameNames: true }), queries };
}

describe('bindNamed', () => {
  it('именованные параметры становятся нумерованными, перечень разворачивается', () => {
    const { text, values } = bindNamed('a = :a AND b IN (:...list) AND c = :a', { a: 1, list: ['x', 'y'] });

    expect(text).toBe('a = $1 AND b IN ($2, $3) AND c = $4');
    expect(values).toEqual([1, 'x', 'y', 1]);
  });

  it('приведение типа и время в строке параметрами не считаются', () => {
    const { text, values } = bindNamed("programs @> :program::jsonb AND at > '2026-01-01 10:30:00'", { program: '[]' });

    expect(text).toBe("programs @> $1::jsonb AND at > '2026-01-01 10:30:00'");
    expect(values).toEqual(['[]']);
  });

  it('пустой перечень не подходит ни одной строке и запрос не ломает', () => {
    expect(bindNamed('id IN (:...ids)', { ids: [] }).text).toBe('id IN (NULL)');
  });

  it('параметр без значения — ошибка до обращения к базе', () => {
    expect(() => bindNamed('a = :missing', {})).toThrow('SQL parameter :missing is not provided');
  });
});

describe('SqlBuilder', () => {
  it('выборка записей: соединение, условия, порядок и страница', async () => {
    const { store, queries } = setup([{ rows: [{ _id: 's1', username: 'ant', project_hash: 'p1' }] }]);

    const records = await store
      .sqlBuilder('s')
      .select('s')
      .leftJoin('capital_projects', 'project', 'project.project_hash = s.project_hash')
      .where('1=1')
      .andWhere('s.username = :username', { username: 'ant' })
      .andWhere('project.parent_hash = :parent', { parent: 'root' })
      .orderBy('s._created_at', 'DESC')
      .offset(20)
      .limit(10)
      .getMany();

    expect(records).toEqual([{ _id: 's1', username: 'ant', project_hash: 'p1' }]);
    expect(queries[0].sql).toBe(
      'SELECT s.* FROM capital_segments s LEFT JOIN capital_projects project ON project.project_hash = s.project_hash ' +
        'WHERE (1=1) AND (s.username = $1) AND (project.parent_hash = $2) ORDER BY s._created_at DESC LIMIT 10 OFFSET 20'
    );
    expect(queries[0].parameters).toEqual(['ant', 'root']);
  });

  it('счёт идёт по записям своей таблицы: соединение их не размножает, страница на счёт не влияет', async () => {
    const { store, queries } = setup([{ rows: [{ count: '7' }] }]);

    const total = await store.sqlBuilder('s').innerJoin('capital_votes', 'v', 'v.voter = s.username').where('s.username = :u', { u: 'ant' }).limit(5).getCount();

    expect(total).toBe(7);
    expect(queries[0].sql).toBe('SELECT COUNT(DISTINCT (s."_id")) AS count FROM capital_segments s INNER JOIN capital_votes v ON v.voter = s.username WHERE (s.username = $1)');
  });

  it('сырая выборка: колонка без своего имени называется по псевдониму таблицы и колонке', async () => {
    const { store, queries } = setup([{ rows: [{ s_username: 'ant', total: '3' }] }]);

    const rows = await store.sqlBuilder('s').select(['s.username', 'COUNT(*) as total']).groupBy('s.username').getRawMany();

    expect(rows).toEqual([{ s_username: 'ant', total: '3' }]);
    expect(queries[0].sql).toBe('SELECT s.username AS "s_username", COUNT(*) as total FROM capital_segments s GROUP BY s.username');
  });

  it('одна запись: берётся первая, без совпадений — пусто', async () => {
    const { store, queries } = setup([{ rows: [] }]);

    await expect(store.sqlBuilder('s').where('s._id = :id', { id: 'нет' }).getOne()).resolves.toBeNull();
    expect(queries[0].sql).toContain('LIMIT 1');
  });
});
