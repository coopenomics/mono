<template lang="pug">
//- На мобильном — минимальная иконка (round dense, без подписи),
//- на десктопе — иконка с подписью «Поиск».
q-btn(
  flat
  no-caps
  :round='isMobile'
  :dense='isMobile'
  :size='isMobile ? "sm" : undefined'
  icon='search'
  :label='isMobile ? undefined : "Поиск"'
  @click='showSearch = true'
)
  q-tooltip(v-if='isMobile') Поиск

DocumentSearchDialog(v-model='showSearch')
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWindowSize } from 'src/shared/hooks'
import DocumentSearchDialog from './DocumentSearchDialog.vue'

const { isMobile } = useWindowSize()
const showSearch = ref(false)
</script>
