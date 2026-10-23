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
  q-icon.direction-cell__move(
    v-else
    name='fa-solid fa-right-left'
    size='xs'
  )
  span.text-caption {{ label }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../../i18n';

const props = defineProps<{
  direction: 'in' | 'out' | 'move'
}>()

const label = computed(() => {
  if (props.direction === 'in') return t('reports.directionCell.direction.incoming')
  if (props.direction === 'out') return t('reports.directionCell.direction.outgoing')
  return t('reports.directionCell.direction.transfer')
})
</script>

<style scoped lang="scss">
.direction-cell__move {
  color: var(--p-ink-3);
}
</style>
