<template lang="pug">
.catalog-shell
  //- На карточке расширения (one-extension) табы каталога не показываем —
  //- видна только подстраница приложения с кнопкой «Назад» в топбаре.
  SecondLevelTabs(v-if='showTabs', :tabs='tabs')
  .catalog-shell__content
    router-view
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { SecondLevelTabs } from 'src/shared/ui/SecondLevelTabs';

// Shell-страница «Каталог приложений»: канон-меню второго уровня
// (Витрина / Установленные) вместо кнопок в топбаре.
const tabs = [
  { routeName: 'extstore-showcase', label: 'Витрина', icon: 'fa-solid fa-store' },
  { routeName: 'appstore-installed', label: 'Установленные', icon: 'fa-solid fa-circle-check' },
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
