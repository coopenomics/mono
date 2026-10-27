<template lang="pug">
//- Вкладка «Настройки»: адрес кооператива и ключ установки — то, что меняют
//- редко и что не должно стоять над кошельками (27.10.2026).
.conn-settings
  DomainCard
  PlatformKeyCard(:site-url="siteUrl")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { DomainCard, PlatformKeyCard } from 'src/widgets/ConnectionDashboard'

const coop = useCooperativeStore()
const siteUrl = computed(() => {
  const announce = coop.publicCooperativeData?.announce
  return announce ? `https://${announce}` : undefined
})
</script>

<style scoped>
.conn-settings {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
