<template lang="pug">
//- Вкладка «Ключ установки»: нужен один раз, при установке, поэтому не стоит
//- над счётом, которым пользуются каждый день.
PlatformKeyCard(:site-url="siteUrl")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { PlatformKeyCard } from 'src/widgets/ConnectionDashboard'

// Адрес кооператива грузит DomainCard из реестра сети; карточка ключа ссылается на сайт кооператива.
const coop = useCooperativeStore()
const siteUrl = computed(() => {
  const announce = coop.publicCooperativeData?.announce
  return announce ? `https://${announce}` : undefined
})
</script>
