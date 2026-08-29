<template lang="pug">
.reports-shell
  PageTabs(:tabs='tabs')
  .reports-shell__content
    router-view
</template>

<script setup lang="ts">
import { PageTabs } from 'src/shared/ui/layout'

// Shell-страница «Реестр кошельков»: канон-меню второго уровня
// (Кооператив / Пайщики). Кнопка «Перевести» живёт в топбаре —
// её регистрирует дочерняя CoopWalletsPage через useHeaderActions.
const tabs = [
  { key: 'reports-wallets-coop', routeName: 'reports-wallets-coop', label: 'Кооператив', icon: 'apartment' },
  { key: 'reports-wallets-participants', routeName: 'reports-wallets-participants', label: 'Пайщики', icon: 'groups' },
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
