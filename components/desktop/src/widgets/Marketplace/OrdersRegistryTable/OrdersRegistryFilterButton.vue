<template lang="pug">
BaseButton(
  variant='ghost',
  :size='isMobile ? "sm" : "md"',
  aria-label='Фильтр по состоянию заказа'
)
  template(#icon-left)
    q-icon(name='filter_list', size='18px')
  span(v-if='!isMobile') Фильтр
  BaseBadge.q-ml-sm(v-if='activeCount', variant='info') {{ activeCount }}

  q-menu(anchor='bottom right', self='top right')
    q-list.orders-filter(dense)
      q-item(clickable, v-close-popup='false', @click='reset')
        q-item-section(avatar)
          q-icon(name='filter_alt_off', size='18px')
        q-item-section Показать все
      q-separator
      q-item(
        v-for='option in ORDER_REGISTRY_FILTERS',
        :key='option.key',
        clickable,
        v-close-popup='false',
        @click='toggle(option)'
      )
        q-item-section(avatar)
          q-icon(
            :name='isActive(option) ? "check_box" : "check_box_outline_blank"',
            :color='isActive(option) ? "primary" : undefined',
            size='18px'
          )
        q-item-section {{ option.label }}
</template>

<script setup lang="ts">
/**
 * Фильтр реестра заказов — кнопка в шапке страницы (канон: главные действия
 * страницы живут в топбаре). Раньше четырнадцать чипов-статусов лежали над
 * таблицей и занимали половину экрана, а два из них назывались одинаково.
 * Здесь это меню с галочками: выбранные состояния видны счётчиком на кнопке.
 */
import { computed } from 'vue';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import { useWindowSize } from 'src/shared/hooks';
import {
  ORDER_REGISTRY_FILTERS,
  type OrderRegistryFilterOption,
  type OrderRegistryStatusView,
} from './lib/types';

const props = defineProps<{
  /** Текущий набор статусов (плоский — его же ждёт запрос к серверу). */
  statuses: OrderRegistryStatusView[];
  /** Header-action рендерится через useHeaderActions: emit оттуда не проходит, поэтому колбэк. */
  onChange?: (statuses: OrderRegistryStatusView[]) => void;
}>();

const { isMobile } = useWindowSize();

const activeCount = computed(
  () => ORDER_REGISTRY_FILTERS.filter((o) => isActive(o)).length,
);

function isActive(option: OrderRegistryFilterOption): boolean {
  return option.statuses.every((s) => props.statuses.includes(s));
}

function toggle(option: OrderRegistryFilterOption): void {
  const next = isActive(option)
    ? props.statuses.filter((s) => !option.statuses.includes(s))
    : [...props.statuses, ...option.statuses];
  props.onChange?.(next);
}

function reset(): void {
  props.onChange?.([]);
}
</script>

<style scoped lang="scss">
.orders-filter {
  min-width: 260px;
}
</style>
