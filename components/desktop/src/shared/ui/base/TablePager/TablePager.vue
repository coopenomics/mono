<script setup lang="ts">
/**
 * Подвал реестра с серверной постраничностью: диапазон показанных строк и
 * переход по страницам.
 *
 * Канонная таблица намеренно ничего не знает о страницах — она показывает
 * строки, которые ей дали. Сколько их всего и какая это страница, знает только
 * экран, который ходит на бэкенд. Раньше эту машинерию тянул за собой сырой
 * `q-table` в каждом реестре, и они расходились в мелочах.
 */
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type { TablePagerProps } from './TablePager.types';

const props = withDefaults(defineProps<TablePagerProps>(), { label: 'Строки' });

const emit = defineEmits<{
  'update:page': [page: number];
}>();

const from = computed(() => (props.rowsNumber === 0 ? 0 : (props.page - 1) * props.rowsPerPage + 1));
const to = computed(() => Math.min(props.page * props.rowsPerPage, props.rowsNumber));
const hasPrev = computed(() => props.page > 1);
const hasNext = computed(() => to.value < props.rowsNumber);

function go(page: number): void {
  emit('update:page', page);
}
</script>

<template lang="pug">
.table-pager
  span {{ label }} {{ from }}–{{ to }} из {{ rowsNumber }}
  .table-pager__buttons
    BaseButton(variant='ghost', size='sm', :disabled='!hasPrev', @click='go(page - 1)')
      template(#icon-left)
        q-icon(name='chevron_left', size='18px')
      | Назад
    BaseButton(variant='ghost', size='sm', :disabled='!hasNext', @click='go(page + 1)')
      | Вперёд
      template(#icon-right)
        q-icon(name='chevron_right', size='18px')
</template>

<style scoped lang="scss">
.table-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  width: 100%;

  &__buttons {
    display: inline-flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }
}
</style>
