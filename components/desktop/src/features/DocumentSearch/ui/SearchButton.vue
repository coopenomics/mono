<template lang="pug">
q-btn(
  v-if='isSearchEnabled'
  flat
  round
  dense
  icon='search'
  @click='showSearch = true'
)
  q-tooltip {{ $t('documentSearch.searchButton.tooltip') }}

DocumentSearchDialog(v-model='showSearch')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import DocumentSearchDialog from './DocumentSearchDialog.vue'

const system = useSystemStore()
const showSearch = ref(false)

const isSearchEnabled = computed(() => {
  return (system.info as any)?.features?.search === true
})
</script>
