import { computed, ref, type Ref, type ComputedRef } from 'vue';

/** Список, к которому относятся настройки: у каждого свои фильтры и сортировка. */
export type CapitalListScope = 'projects' | 'components' | 'issues';

export interface ICapitalListFilters {
  /** Статусы задач: на списке задач — сам фильтр, в дереве — «есть задачи в статусах» */
  issueStatuses: string[];
  /** Приоритеты задач */
  issuePriorities: string[];
  /** Исполнители задач */
  creators: string[];
  /** Мастер проекта или компонента */
  master?: string;
  /** Статусы самого проекта или компонента */
  entityStatuses: string[];
}

export interface ICapitalListSort {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface ICapitalListPreferences {
  filters: Ref<ICapitalListFilters>;
  sort: Ref<ICapitalListSort>;
  setFilters: (filters: ICapitalListFilters) => void;
  setSort: (sort: ICapitalListSort) => void;
  resetFilters: () => void;
  hasActiveFilters: ComputedRef<boolean>;
}

/** Поля сортировки, разрешённые бэкендом (см. whitelist в репозиториях capital). */
export const CAPITAL_SORT_FIELDS: Record<CapitalListScope, Array<{ value: string; label: string }>> = {
  projects: [
    { value: '_created_at', label: 'Дата создания' },
    { value: '_updated_at', label: 'Дата изменения' },
    { value: 'title', label: 'Название' },
    { value: 'status', label: 'Статус' },
  ],
  components: [
    { value: '_created_at', label: 'Дата создания' },
    { value: '_updated_at', label: 'Дата изменения' },
    { value: 'title', label: 'Название' },
    { value: 'status', label: 'Статус' },
  ],
  issues: [
    { value: '_created_at', label: 'Дата создания' },
    { value: '_updated_at', label: 'Дата изменения' },
    { value: 'title', label: 'Название' },
    { value: 'status', label: 'Статус' },
    { value: 'priority', label: 'Приоритет' },
  ],
};

const STORAGE_PREFIX = 'capital_list_prefs_';

const emptyFilters = (): ICapitalListFilters => ({
  issueStatuses: [],
  issuePriorities: [],
  creators: [],
  master: undefined,
  entityStatuses: [],
});

const defaultSort = (): ICapitalListSort => ({
  sortBy: '_created_at',
  sortOrder: 'DESC',
});

type StoredPreferences = {
  filters?: Partial<ICapitalListFilters>;
  sort?: Partial<ICapitalListSort>;
};

function readStored(scope: CapitalListScope): StoredPreferences {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scope}`);
    return raw ? (JSON.parse(raw) as StoredPreferences) : {};
  } catch {
    // Битое или чужое значение в хранилище не должно ронять список
    return {};
  }
}

function writeStored(
  scope: CapitalListScope,
  filters: ICapitalListFilters,
  sort: ICapitalListSort,
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${scope}`, JSON.stringify({ filters, sort }));
  } catch {
    // Переполненное или заблокированное хранилище — фильтры просто не переживут перезагрузку
  }
}

/**
 * Настройки живут в модуле, а не в компоненте: кнопки фильтра и сортировки
 * регистрируются в шапке (отдельное поддерево), список рендерится страницей —
 * общее состояние обязано быть одним на scope.
 */
const registry = new Map<CapitalListScope, ICapitalListPreferences>();

function createPreferences(scope: CapitalListScope): ICapitalListPreferences {
  const stored = readStored(scope);

  const filters = ref<ICapitalListFilters>({
    ...emptyFilters(),
    ...(stored.filters || {}),
  });
  const sort = ref<ICapitalListSort>({
    ...defaultSort(),
    ...(stored.sort || {}),
  });

  const persist = () => writeStored(scope, filters.value, sort.value);

  const setFilters = (next: ICapitalListFilters) => {
    filters.value = { ...next };
    persist();
  };

  const setSort = (next: ICapitalListSort) => {
    sort.value = { ...next };
    persist();
  };

  const resetFilters = () => {
    filters.value = emptyFilters();
    persist();
  };

  const hasActiveFilters = computed(
    () =>
      filters.value.issueStatuses.length > 0 ||
      filters.value.issuePriorities.length > 0 ||
      filters.value.creators.length > 0 ||
      filters.value.entityStatuses.length > 0 ||
      !!filters.value.master,
  );

  return { filters, sort, setFilters, setSort, resetFilters, hasActiveFilters };
}

export function useListPreferences(scope: CapitalListScope): ICapitalListPreferences {
  let preferences = registry.get(scope);
  if (!preferences) {
    preferences = createPreferences(scope);
    registry.set(scope, preferences);
  }
  return preferences;
}
