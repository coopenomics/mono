/**
 * Unit-тесты выбора колонки сортировки в списках Благороста.
 *
 * Что здесь защищается. Поле сортировки приходит от клиента (кнопка
 * «Сортировка» на списках проектов, компонентов и задач) и подставляется в
 * `ORDER BY` строкой — параметром его передать нельзя. Значит подстановка
 * обязана пропускать только поля самой записи, а всё остальное —
 * опечатку клиента, устаревшее имя поля, попытку дописать SQL — молча менять
 * на умолчание, не роняя список.
 *
 * Реестр случаев: test-registry/capital.list-filters-sort.yaml
 */

import { TableStore } from '@coopenomics/extension-kit';
import { recordingKysely } from '../helpers/kysely-recorder';

interface Issue {
  _id: string;
  _created_at: Date;
  title: string;
  status: string;
}

const store = (columns: Array<keyof Issue & string>) =>
  new TableStore<Issue>(recordingKysely().db, { table: 'capital_issues', primaryKey: ['_id'], sameNames: true, columns });

const issues = store(['_created_at', 'title', 'status']);

describe('TableStore.sortField', () => {
  it('пропускает поле записи', () => {
    expect(issues.sortField('title', '_created_at')).toBe('title');
  });

  it('без поля сортировки — умолчание', () => {
    expect(issues.sortField(undefined, '_created_at')).toBe('_created_at');
    expect(issues.sortField('', '_created_at')).toBe('_created_at');
  });

  it('имя вне полей записи заменяется умолчанием', () => {
    expect(issues.sortField('estimate_snapshot', '_created_at')).toBe('_created_at');
  });

  it('попытка дописать SQL до запроса не доходит', () => {
    expect(issues.sortField('title; DROP TABLE capital_issues', '_created_at')).toBe('_created_at');
    expect(issues.sortField('(SELECT 1) --', '_created_at')).toBe('_created_at');
  });

  it('шлюз без перечня полей пропускает только умолчание', () => {
    const bare = new TableStore<Issue>(recordingKysely().db, { table: 'capital_issues', primaryKey: ['_id'], sameNames: true });
    expect(bare.sortField('title', '_created_at')).toBe('_created_at');
  });
});
