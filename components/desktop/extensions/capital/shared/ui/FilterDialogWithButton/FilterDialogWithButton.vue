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
    title='Фильтры проектов'
    @filters-applied='handleFiltersApplied'
  )
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { FilterDialog } from 'app/extensions/capital/features/FilterDialog';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();

// Props для стилизации из header
defineProps<{
  stretch?: boolean;
  style?: Record<string, any>;
}>();

// Используем store для фильтров
const projectStore = useProjectStore();

// Refs
const filterDialogRef = ref<any>();

// Computed для проверки активных фильтров
const hasActiveFilters = computed(() => projectStore.hasActiveProjectFilters);

// Обработчик клика по кнопке
const handleClick = () => {
  filterDialogRef.value?.openDialog();
};

// Обработчик применения фильтров
const handleFiltersApplied = (filters: any) => {
  projectStore.setProjectFilters(filters);
};
</script>

<style lang="sass" scoped>
@import 'src/app/styles/variables'
</style>
