<template lang="pug">
//- Меню и подсказка висят на обёртке, а не внутри кнопки: BaseButton в режиме
//- icon-only не рендерит слот по умолчанию, и вложенный туда q-menu не
//- создавался — кнопка молча ничего не открывала
.sort-menu-button
  //- Header-кнопка иконкой: подпись съедала место, а значок сортировки узнаваем сам
  BaseButton(
    variant='ghost',
    :size='isMobile ? "sm" : "md"',
    icon-only,
    :aria-label='$t("capital.sortMenuButton.ariaLabel")',
    :style='style'
  )
    template(#icon-left)
      q-icon(name='sort', size='20px')

  q-tooltip {{ $t('capital.sortMenuButton.title') }}

  q-menu(anchor='bottom right', self='top right')
    q-list(dense, style='min-width: 220px')
      q-item-label.sort-menu__caption(header) {{ $t('capital.sortMenuButton.fieldLabel') }}
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

      q-item-label.sort-menu__caption(header) {{ $t('capital.sortMenuButton.orderLabel') }}
      q-item(
        clickable,
        v-close-popup,
        :active='sort.sortOrder === "DESC"',
        @click='selectOrder("DESC")'
      )
        q-item-section {{ $t('capital.sortMenuButton.descending') }}
        q-item-section(side, v-if='sort.sortOrder === "DESC"')
          q-icon(name='check', size='18px', color='primary')
      q-item(
        clickable,
        v-close-popup,
        :active='sort.sortOrder === "ASC"',
        @click='selectOrder("ASC")'
      )
        q-item-section {{ $t('capital.sortMenuButton.ascending') }}
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
// Обёртка — якорь меню и подсказки; в потоке шапки ведёт себя как кнопка
.sort-menu-button {
  display: inline-flex;
}

.sort-menu__caption {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
}
</style>
