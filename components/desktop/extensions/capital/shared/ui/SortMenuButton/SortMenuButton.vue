<template lang="pug">
div
  //- Canon header-кнопка: на мобильном — иконка-only + tooltip.
  BaseButton(
    variant='ghost',
    :size='isMobile ? "sm" : "md"',
    :icon-only='isMobile',
    aria-label='Сортировка',
    :style='style'
  )
    template(#icon-left)
      q-icon(name='sort', size='20px')
    | Сортировка
    q-tooltip(v-if='isMobile') Сортировка

    q-menu(anchor='bottom right', self='top right')
      q-list(dense, style='min-width: 220px')
        q-item-label.sort-menu__caption(header) Поле
        q-item(
          v-for='field in fields',
          :key='field.value',
          clickable,
          v-close-popup,
          :active='sort.sortBy === field.value',
          @click='selectField(field.value)'
        )
          q-item-section {{ field.label }}
          q-item-section(side, v-if='sort.sortBy === field.value')
            q-icon(name='check', size='18px', color='primary')

        q-separator

        q-item-label.sort-menu__caption(header) Порядок
        q-item(
          clickable,
          v-close-popup,
          :active='sort.sortOrder === "DESC"',
          @click='selectOrder("DESC")'
        )
          q-item-section Сначала новые
          q-item-section(side, v-if='sort.sortOrder === "DESC"')
            q-icon(name='check', size='18px', color='primary')
        q-item(
          clickable,
          v-close-popup,
          :active='sort.sortOrder === "ASC"',
          @click='selectOrder("ASC")'
        )
          q-item-section Сначала старые
          q-item-section(side, v-if='sort.sortOrder === "ASC"')
            q-icon(name='check', size='18px', color='primary')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  useListPreferences,
  CAPITAL_SORT_FIELDS,
  type CapitalListScope,
  type ICapitalListSort,
} from 'app/extensions/capital/shared/lib/listPreferences';
import { BaseButton } from 'src/shared/ui/base';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();

const props = withDefaults(
  defineProps<{
    /** Какому списку принадлежит сортировка */
    scope?: CapitalListScope;
    // Props для стилизации из header
    stretch?: boolean;
    style?: Record<string, any>;
  }>(),
  {
    scope: 'projects',
  },
);

const { sort, setSort } = useListPreferences(props.scope);

const fields = computed(() => CAPITAL_SORT_FIELDS[props.scope]);

const selectField = (sortBy: string) => {
  setSort({ ...sort.value, sortBy });
};

const selectOrder = (sortOrder: ICapitalListSort['sortOrder']) => {
  setSort({ ...sort.value, sortOrder });
};
</script>

<style lang="scss" scoped>
.sort-menu__caption {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
}
</style>
