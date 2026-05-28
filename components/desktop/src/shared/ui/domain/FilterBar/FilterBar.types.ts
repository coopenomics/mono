export type FilterType = 'select' | 'date' | 'range';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

export type FilterValues = Record<string, string | number | null | undefined>;

export interface FilterBarProps {
  /** Текущее значение поиска */
  search?: string;
  /** Плейсхолдер поля поиска */
  searchPlaceholder?: string;
  /** Скрыть поле поиска */
  hideSearch?: boolean;
  /** Описание фильтров */
  filters?: FilterDefinition[];
  /** Текущие значения фильтров: key → value */
  modelValue?: FilterValues;
  /** Debounce для search:update в мс. По умолчанию 300 */
  searchDebounce?: number;
  /** Скрыть кнопку «сбросить всё» */
  hideReset?: boolean;
}
