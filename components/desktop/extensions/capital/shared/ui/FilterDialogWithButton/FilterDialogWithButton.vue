<template lang="pug">
div
  //- Canon header-кнопка: на мобильном — иконка-only + tooltip.
  q-btn(
    :size='isMobile ? "sm" : "md"',
    flat,
    :dense='isMobile',
    icon='filter_list',
    :label='isMobile ? undefined : "Фильтры"',
    :stretch='stretch',
    :style='style',
    no-wrap,
    @click='handleClick'
  )
    q-badge(
      v-if='hasActiveFilters'
      color='red'
      floating
      rounded
    )
    q-tooltip(v-if='isMobile') Фильтры

  //- Диалог фильтров
  FilterDialog(
    ref='filterDialogRef'
    :scope='scope'
    :coopname='coopname'
    :project-hash='projectHash'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FilterDialog } from 'app/extensions/capital/features/FilterDialog';
import {
  useListPreferences,
  type CapitalListScope,
} from 'app/extensions/capital/shared/lib/listPreferences';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();

const props = withDefaults(
  defineProps<{
    /** Какому списку принадлежат фильтры */
    scope?: CapitalListScope;
    coopname?: string;
    projectHash?: string;
    // Props для стилизации из header
    stretch?: boolean;
    style?: Record<string, any>;
  }>(),
  {
    scope: 'projects',
  },
);

const { hasActiveFilters } = useListPreferences(props.scope);

const filterDialogRef = ref<{ openDialog: () => void } | null>(null);

const handleClick = () => {
  filterDialogRef.value?.openDialog();
};
</script>
