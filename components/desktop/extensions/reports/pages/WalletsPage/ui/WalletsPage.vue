<template lang="pug">
.reports-shell
  SecondLevelTabs(:tabs='tabs')
  .reports-shell__content
    router-view
</template>

<script setup lang="ts">
import { SecondLevelTabs } from 'src/shared/ui/SecondLevelTabs'

// Shell-страница «Реестр кошельков»: канон-меню второго уровня
// (Кооператив / Пайщики). Кнопка «Перевести» живёт в топбаре —
// её регистрирует дочерняя CoopWalletsPage через useHeaderActions.
const tabs = [
  { routeName: 'reports-wallets-coop', label: 'Кооператив', icon: 'fa-solid fa-building' },
  { routeName: 'reports-wallets-participants', label: 'Пайщики', icon: 'fa-solid fa-users' },
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
