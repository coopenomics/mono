<template lang="pug">
.filter-bar
  .filter-bar__row
    q-input.filter-bar__search(
      v-if='!hideSearch'
      outlined
      dense
      clearable
      color='primary'
      :model-value='searchLocal',
      :placeholder='searchPlaceholder ?? "Поиск"',
      @update:model-value='onSearchInput',
      @clear='onSearchInput("")'
    )
      template(#prepend)
        q-icon(name='search', color='grey-7')
    q-select.filter-bar__filter(
      v-for='f in filters',
      :key='f.key',
      outlined
      dense
      map-options
      emit-value
      clearable
      color='primary',
      :options='f.options ?? []',
      :model-value='modelValue?.[f.key] ?? null',
      :label='f.label',
      :placeholder='f.placeholder',
      option-label='label',
      option-value='value',
      @update:model-value='(val) => onFilterChange(f.key, val)'
    )
    .filter-bar__actions(v-if='!hideReset && hasActiveValues')
      button.filter-bar__reset(type='button', @click='resetAll')
        q-icon(name='close', size='16px')
        | Сбросить
  .filter-bar__chips(v-if='activeChips.length')
    BaseChip(
      v-for='chip in activeChips',
      :key='chip.key',
      variant='accent',
      size='sm'
    )
      span {{ chip.label }}
      button.filter-bar__chip-remove(
        type='button',
        :aria-label='`Сбросить фильтр ${chip.filterLabel}`',
        @click='removeFilter(chip.key)'
      )
        q-icon(name='close', size='14px')
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import type { FilterBarProps, FilterValues } from './FilterBar.types';

const props = withDefaults(defineProps<FilterBarProps>(), {
  hideSearch: false,
  hideReset: false,
  searchDebounce: 300,
  filters: () => [],
});

const emit = defineEmits<{
  'update:search': [value: string];
  'update:modelValue': [value: FilterValues];
  reset: [];
}>();

const searchLocal = ref<string>(props.search ?? '');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.search,
  (next) => {
    if (next !== searchLocal.value) {
      searchLocal.value = next ?? '';
    }
  },
);

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

function onSearchInput(value: string | number | null): void {
  const str = value == null ? '' : String(value);
  searchLocal.value = str;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    emit('update:search', str);
  }, props.searchDebounce);
}

function onFilterChange(key: string, value: unknown): void {
  const next: FilterValues = { ...(props.modelValue ?? {}) };
  if (value == null || value === '') {
    delete next[key];
  } else {
    next[key] = value as string | number;
  }
  emit('update:modelValue', next);
}

function resetAll(): void {
  emit('update:modelValue', {});
  if (props.search) emit('update:search', '');
  searchLocal.value = '';
  emit('reset');
}

function removeFilter(key: string): void {
  const next: FilterValues = { ...(props.modelValue ?? {}) };
  delete next[key];
  emit('update:modelValue', next);
}

const hasActiveValues = computed((): boolean => {
  const m = props.modelValue ?? {};
  return Object.values(m).some((v) => v != null && v !== '');
});

interface ActiveChip {
  key: string;
  label: string;
  filterLabel: string;
}

const activeChips = computed<ActiveChip[]>(() => {
  const values = props.modelValue ?? {};
  const out: ActiveChip[] = [];
  for (const f of props.filters) {
    const v = values[f.key];
    if (v == null || v === '') continue;
    const opt = f.options?.find((o) => o.value === v);
    const label = opt ? `${f.label}: ${opt.label}` : `${f.label}: ${v}`;
    out.push({ key: f.key, label, filterLabel: f.label });
  }
  return out;
});
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.filter-bar__row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
}

.filter-bar__search {
  flex: 1 1 280px;
  min-width: 220px;
}

.filter-bar__filter {
  flex: 0 1 220px;
  min-width: 180px;
}

.filter-bar__actions {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
}

.filter-bar__reset {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  padding: 0 var(--p-3, 12px);
  height: 40px;
  background: transparent;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.filter-bar__reset:hover {
  background: var(--p-surface-2);
  color: var(--p-ink);
}

.filter-bar__chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2, 8px);
}

.filter-bar__chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: var(--p-1, 4px);
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.85;
  cursor: pointer;
  border-radius: 50%;
}
.filter-bar__chip-remove:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.18);
}
</style>
