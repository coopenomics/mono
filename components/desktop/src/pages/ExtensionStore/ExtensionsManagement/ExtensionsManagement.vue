<template lang="pug">
.catalog-shell
  //- На карточке расширения (one-extension) табы каталога не показываем —
  //- видна только подстраница приложения с кнопкой «Назад» в топбаре.
  PageTabs(v-if='showTabs', :tabs='tabs')
  .catalog-shell__content
    router-view
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { PageTabs } from 'src/shared/ui/layout';

// Shell-страница «Каталог приложений»: канон-меню второго уровня
// (Витрина / Установленные) вместо кнопок в топбаре.
const tabs = [
  { key: 'extstore-showcase', routeName: 'extstore-showcase', label: 'Витрина', icon: 'storefront' },
  { key: 'appstore-installed', routeName: 'appstore-installed', label: 'Установленные', icon: 'check_circle' },
];

const route = useRoute();
// На странице конкретного приложения и его подстраницах табы каталога прячем.
const showTabs = computed(() =>
  !route.matched.some((m) => m.name === 'one-extension'),
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
