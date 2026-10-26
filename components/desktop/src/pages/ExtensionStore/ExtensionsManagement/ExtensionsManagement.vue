<template lang="pug">
.catalog-shell
  //- На странице приложения (one-extension) табы не показываем — видна
  //- только она сама с кнопкой «Назад». На страницах подключения у оператора
  //- свои вкладки.
  PageTabs(v-if='showTabs', :tabs='tabs')
  .catalog-shell__content
    router-view
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { PageTabs } from 'src/shared/ui/layout';
import { t } from 'src/shared/i18n';

// Оболочка стола «Приложения»: канон-меню второго уровня
// (Каталог / Установленные / Подписки) вместо кнопок в топбаре.
const tabs = [
  { key: 'extstore-showcase', routeName: 'extstore-showcase', label: t('extensionStore.extensionsManagement.showcaseTab'), icon: 'storefront' },
  { key: 'appstore-installed', routeName: 'appstore-installed', label: t('extensionStore.extensionsManagement.installedTab'), icon: 'check_circle' },
  { key: 'apps-subscriptions', routeName: 'apps-subscriptions', label: t('extensionStore.extensionsManagement.subscriptionsTab'), icon: 'receipt_long' },
];

const route = useRoute();
const showTabs = computed(() =>
  !route.matched.some((m) => m.name === 'one-extension' || m.name === 'connect'),
);
</script>

<style scoped lang="scss">
.catalog-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.catalog-shell__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
