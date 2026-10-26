<template lang="pug">
//- Узел кооператива: адрес и ключ установки. Нужны один раз, при установке,
//- поэтому живут отдельным пунктом меню, а не над счётом, которым пользуются каждый день.
div.row.q-pa-md
  div.col-md-12.col-xs-12
    ConnectionSectionGate
      .conn-node
        DomainCard
        PlatformKeyCard(:site-url="siteUrl")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { DomainCard, PlatformKeyCard } from 'src/widgets/ConnectionDashboard'
import ConnectionSectionGate from './ConnectionSectionGate.vue'

// Адрес кооператива грузит DomainCard из реестра сети; карточка ключа ссылается на сайт кооператива.
const coop = useCooperativeStore()
const siteUrl = computed(() => {
  const announce = coop.publicCooperativeData?.announce
  return announce ? `https://${announce}` : undefined
})
</script>

<style scoped>
.conn-node {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
