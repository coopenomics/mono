<template lang="pug">
.reports-shell
  SecondLevelTabs(:tabs='tabs')
  .reports-shell__content
    router-view
</template>

<script setup lang="ts">
import { SecondLevelTabs } from 'src/shared/ui/SecondLevelTabs'

// Shell-страница «Отчётность»: канон-меню второго уровня
// (Календарь / Список форм / Архив). Содержимое — через <router-view>.
const tabs = [
  { routeName: 'reports-documents-calendar', label: 'Календарь', icon: 'fa-solid fa-calendar-days' },
  { routeName: 'reports-documents-forms', label: 'Список форм', icon: 'fa-solid fa-list' },
  { routeName: 'reports-documents-archive', label: 'Архив', icon: 'fa-solid fa-box-archive' },
]
</script>

<style scoped lang="scss">
.reports-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.reports-shell__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
