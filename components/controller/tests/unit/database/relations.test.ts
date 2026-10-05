/**
 * Подгрузка связанной записи к перечню записей (C28-81): замена соединения
 * «ради чтения имени» явным вторым запросом.
 */
import { TableStore, attachOne } from '@coopenomics/extension-kit';
import { recordingKysely } from '../helpers/kysely-recorder';

interface Contributor {
  coopname: string;
  username: string;
  display_name: string;
}

describe('attachOne', () => {
  it('связь по двум полям: один запрос, пара сводится в памяти, запись без пары остаётся без поля', async () => {
    const { db, queries } = recordingKysely([
      { rows: [{ coopname: 'voskhod', username: 'ant', display_name: 'Ант' }, { coopname: 'other', username: 'bob', display_name: 'Чужой Боб' }] },
    ]);
    const contributors = new TableStore<Contributor>(db, { table: 'capital_contributors', primaryKey: ['username'], sameNames: true });
    const commits: Array<Record<string, unknown>> = [
      { coopname: 'voskhod', username: 'ant' },
      { coopname: 'voskhod', username: 'bob' },
    ];

    await attachOne(commits, contributors, 'contributor', { coopname: 'coopname', username: 'username' });

    expect(queries).toHaveLength(1);
    expect(queries[0].parameters).toEqual(['voskhod', 'ant', 'bob']);
    expect(commits[0].contributor).toMatchObject({ display_name: 'Ант' });
    // Боб есть только в другом кооперативе — к записи своего кооператива он не подходит.
    expect(commits[1].contributor).toBeUndefined();
  });

  it('пустой перечень записей и записи без значения связи в базу не ходят', async () => {
    const { db, queries } = recordingKysely();
    const contributors = new TableStore<Contributor>(db, { table: 'capital_contributors', primaryKey: ['username'], sameNames: true });

    await attachOne([], contributors, 'contributor', { username: 'voter' });
    await attachOne([{ voter: null }], contributors, 'contributor', { username: 'voter' });

    expect(queries).toHaveLength(0);
  });
});
