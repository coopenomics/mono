<template lang="pug">
//- Иконка идёт слотом #icon-left: в шапке на узком экране канон скрывает
//- подпись кнопки вместе со всем её содержимым.
BaseButton(
  variant='ghost',
  size='sm',
  :aria-label='`${buttonLabel}: выбор состояний`'
)
  template(#icon-left)
    q-icon(name='filter_list', size='18px')
  | {{ buttonLabel }}
  BaseBadge.q-ml-sm(v-if='activeCount', variant='info') {{ activeCount }}

  //- Меню — отдельным слотом: так его триггером остаётся вся кнопка целиком.
  template(#menu)
    q-menu(anchor='bottom right', self='top right')
      q-list.status-filter(dense)
        q-item(clickable, @click='reset')
          q-item-section(avatar)
            q-icon(name='filter_alt_off', size='18px')
          q-item-section Показать все
        q-separator
        q-item(
          v-for='option in props.options',
          :key='option.key',
          clickable,
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
 * Фильтр списка по состоянию — кнопкой в шапке страницы (канон: главные
 * действия страницы живут в топбаре). Раньше реестры выкладывали все статусы
 * чипами над таблицей: полтора десятка чипов занимали пол-экрана прежде, чем
 * начинались данные. Здесь то же самое меню с галочками, а сколько состояний
 * выбрано, видно счётчиком на кнопке.
 */
import { computed } from 'vue';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import type { StatusFilterButtonProps, StatusFilterOption } from './StatusFilterButton.types';

const props = defineProps<StatusFilterButtonProps>();

const buttonLabel = computed(() => props.label ?? 'Фильтр');

const activeCount = computed(() => props.options.filter((o) => isActive(o)).length);

function isActive(option: StatusFilterOption): boolean {
  return option.statuses.every((s) => props.selected.includes(s));
}

function toggle(option: StatusFilterOption): void {
  const next = isActive(option)
    ? props.selected.filter((s) => !option.statuses.includes(s))
    : [...props.selected, ...option.statuses];
  props.onChange?.(next);
}

function reset(): void {
  props.onChange?.([]);
}
</script>

<style scoped lang="scss">
.status-filter {
  min-width: 260px;
}
</style>
