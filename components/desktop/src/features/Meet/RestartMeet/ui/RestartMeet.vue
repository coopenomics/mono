<template lang="pug">
div
  q-btn(
    v-if="showButton"
    color="primary"
    icon="fa-solid fa-rotate"
    :label="$t('meet.restartMeet.label')"
    @click="showRestartDialog = true"
    :loading="loading || isProcessing"
  )

  RestartMeetForm(
    v-model="showRestartDialog"
    :loading="loading || isProcessing"
    @restart="handleRestart"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RestartMeetForm } from '.';

defineProps<{
  showButton?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'restart', data: any): void
}>()

const showRestartDialog = ref(false)
const isProcessing = ref(false)

const handleRestart = async (data: any) => {
  isProcessing.value = true
  try {
    await emit('restart', data)
    showRestartDialog.value = false
  } finally {
    isProcessing.value = false
  }
}
</script>
