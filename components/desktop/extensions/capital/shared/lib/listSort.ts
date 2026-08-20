import { Zeus } from '@coopenomics/sdk';

/** Порядок приоритетов «сверху вниз» — совпадает с ORDER BY enum на бэкенде (ASC = срочный первым). */
const PRIORITY_ORDER: string[] = [
  Zeus.IssuePriority.URGENT,
  Zeus.IssuePriority.HIGH,
  Zeus.IssuePriority.MEDIUM,
  Zeus.IssuePriority.LOW,
];

type SortableRow = {
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  _created_at?: string | Date | null;
  _updated_at?: string | Date | null;
};

const timeOf = (value: string | Date | null | undefined): number => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const priorityIndex = (priority: string | null | undefined): number => {
  const idx = PRIORITY_ORDER.indexOf(priority || '');
  return idx === -1 ? PRIORITY_ORDER.length : idx;
};

type Comparator = (a: SortableRow, b: SortableRow) => number;

const COMPARATORS: Record<string, Comparator> = {
  title: (a, b) => (a.title || '').localeCompare(b.title || '', 'ru'),
  status: (a, b) => (a.status || '').localeCompare(b.status || ''),
  priority: (a, b) => priorityIndex(a.priority) - priorityIndex(b.priority),
  _updated_at: (a, b) => timeOf(a._updated_at) - timeOf(b._updated_at),
  _created_at: (a, b) => timeOf(a._created_at) - timeOf(b._created_at),
};

/**
 * Локальная сортировка списков Благороста тем же полем, что и серверная —
 * для вложенных наборов (например, компоненты внутри раскрытого проекта),
 * которые приходят с бэкенда без ORDER BY.
 */
export function sortCapitalList<T extends SortableRow>(
  items: T[] | undefined | null,
  sortBy: string,
  sortOrder: 'ASC' | 'DESC',
): T[] {
  const compare = COMPARATORS[sortBy] || COMPARATORS._created_at;
  const dir = sortOrder === 'DESC' ? -1 : 1;
  return [...(items || [])].sort((a, b) => dir * compare(a, b));
}
