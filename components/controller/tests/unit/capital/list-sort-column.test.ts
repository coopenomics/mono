/**
 * Unit-тесты выбора колонки сортировки в списках Благороста.
 *
 * Что здесь защищается. Поле сортировки приходит от клиента (кнопка
 * «Сортировка» на списках проектов, компонентов и задач) и подставляется в
 * `ORDER BY` строкой — параметром его передать нельзя. Значит подстановка
 * обязана пропускать только колонки самой сущности, а всё остальное —
 * опечатку клиента, устаревшее имя поля, попытку дописать SQL — молча менять
 * на умолчание, не роняя список.
 *
 * Реестр случаев: test-registry/capital.list-filters-sort.yaml
 */

import { resolveSortColumn } from '~/extensions/capital/infrastructure/repositories/sort-column.util';

function makeRepository(columns: Array<{ propertyName: string; databaseName: string }>) {
  return { metadata: { columns } } as any;
}

const issueRepository = makeRepository([
  { propertyName: '_created_at', databaseName: '_created_at' },
  { propertyName: 'title', databaseName: 'title' },
  { propertyName: 'status', databaseName: 'status' },
]);

describe('resolveSortColumn', () => {
  it('пропускает колонку сущности', () => {
    expect(resolveSortColumn(issueRepository, 'title', '_created_at')).toBe('title');
  });

  it('без поля сортировки отдаёт умолчание', () => {
    expect(resolveSortColumn(issueRepository, undefined, '_created_at')).toBe('_created_at');
  });

  it('неизвестное поле заменяет умолчанием, а не падает', () => {
    expect(resolveSortColumn(issueRepository, 'estimate_snapshot', '_created_at')).toBe(
      '_created_at'
    );
  });

  it('не пропускает дописанный SQL', () => {
    expect(
      resolveSortColumn(issueRepository, 'title; DROP TABLE capital_issues', '_created_at')
    ).toBe('_created_at');
    expect(
      resolveSortColumn(issueRepository, '(SELECT 1) --', '_created_at')
    ).toBe('_created_at');
  });

  it('принимает имя колонки в базе, если оно отличается от имени свойства', () => {
    const repository = makeRepository([
      { propertyName: 'createdAt', databaseName: 'created_at' },
    ]);
    expect(resolveSortColumn(repository, 'created_at', 'createdAt')).toBe('created_at');
  });

  it('пустую строку считает отсутствием сортировки', () => {
    expect(resolveSortColumn(issueRepository, '', '_created_at')).toBe('_created_at');
  });
});
