<template lang="pug">
q-btn(
  v-if='canShare'
  flat
  dense
  no-caps
  icon='share'
  label='Поделиться'
  @click='showDialog = true'
)

ShareDialog(v-model='showDialog' :pagePath='currentPath' :pageName='currentPageName')
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import ShareDialog from './ShareDialog.vue'

const session = useSessionStore()
const route = useRoute()
const showDialog = ref(false)

const canShare = computed(() => session.isChairman || session.isMember)
const currentPath = computed(() => route.fullPath)
const currentPageName = computed(() => (route.meta?.title as string) || route.name?.toString() || '')
</script>
