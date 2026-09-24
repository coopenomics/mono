<template lang="pug">
.row.items-center(
  :style="{ minHeight: '24px', padding: '0px !important' }"
)
  q-icon(
    v-if="showSuccessIcon"
    name="far fa-circle"
    color="positive"
    class="q-mr-xs"
  )
  .text-caption(
    :class="statusTextClass"
    style='transition: opacity 0.3s ease'
  )
    | {{ statusText }}

</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from 'src/shared/i18n';

interface Props {
  isAutoSaving?: boolean
  autoSaveError?: string | null
  savingText?: string
  errorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  isAutoSaving: false,
  autoSaveError: null,
  savingText: t('ui.autoSaveIndicator.saving'),
  errorText: t('ui.autoSaveIndicator.error')
})


// Класс для текста статуса
const statusTextClass = computed(() => ({
  'text-grey-6': props.isAutoSaving,
  'text-negative': props.autoSaveError
}))

// Показывать ли зеленый кружочек (только во время сохранения)
const showSuccessIcon = computed(() => props.isAutoSaving && !props.autoSaveError)

// Текст статуса
const statusText = computed(() => {
  if (props.isAutoSaving) return props.savingText
  if (props.autoSaveError) return props.autoSaveError
  return '' // Пустой текст когда ничего не происходит
})
</script>

<style scoped>

</style>
