<template lang="pug">
div(:id='id')
  .row.items-center.q-gutter-x-sm
    q-input.col(
      :label='label'
      :model-value='value'
      :placeholder='placeholder'
      :readonly='readOnly'
      dense
      outlined
      @update:model-value='v => emit("update:value", String(v ?? ""))'
    )
    .col-auto
      q-chip(dense size='sm' :color='badgeColor' text-color='white') {{ badgeLabel }}
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id: string
  label: string
  value: string
  source?: 'blockchain' | 'manual' | 'empty'
  placeholder?: string
  readOnly?: boolean
}>()

const emit = defineEmits<{ 'update:value': [value: string] }>()

const badgeColor = computed(() => {
  if (props.source === 'blockchain') return 'blue'
  if (props.source === 'manual') return 'teal'
  return 'orange'
})

const badgeLabel = computed(() => {
  if (props.source === 'blockchain') return '🔗 Блокчейн'
  if (props.source === 'manual') return '✏️ Ручной ввод'
  return '⚠️ Не заполнено'
})
</script>
