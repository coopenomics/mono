<template lang="pug">
.reports-shell
  PageTabs(:tabs='tabs')
  .reports-shell__content
    router-view
</template>

<script setup lang="ts">
import { PageTabs } from 'src/shared/ui/layout'
import { t } from '../../../i18n';

// Shell-страница «Отчётность»: канон-меню второго уровня
// (Календарь / Список форм / Архив). Содержимое — через <router-view>.
const tabs = [
  { key: 'reports-documents-calendar', routeName: 'reports-documents-calendar', label: t('reports.documentsPage.tab.calendar'), icon: 'calendar_month' },
  { key: 'reports-documents-forms', routeName: 'reports-documents-forms', label: t('reports.documentsPage.tab.forms'), icon: 'list' },
  { key: 'reports-documents-archive', routeName: 'reports-documents-archive', label: t('reports.documentsPage.tab.archive'), icon: 'inventory_2' },
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
