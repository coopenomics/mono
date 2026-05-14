<template lang="pug">
.row.items-center.no-wrap.q-gutter-xs
  q-icon(
    v-if='direction === "in"'
    name='fa-solid fa-arrow-down'
    color='positive'
    size='xs'
  )
  q-icon(
    v-else-if='direction === "out"'
    name='fa-solid fa-arrow-up'
    color='negative'
    size='xs'
  )
  q-icon(
    v-else
    name='fa-solid fa-right-left'
    color='grey-6'
    size='xs'
  )
  span.text-caption {{ label }}
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  direction: 'in' | 'out' | 'move'
}>()

const label = computed(() => {
  if (props.direction === 'in') return 'Входящий'
  if (props.direction === 'out') return 'Исходящий'
  return 'Перевод'
})
</script>
