<template lang="pug">
q-icon.private-shield(
  v-if='show'
  name='shield'
  size='14px'
  :title='tooltip'
)
  q-tooltip {{ tooltip }}
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    show?: boolean;
    tooltip?: string;
  }>(),
  {
    show: true,
    tooltip: 'Личное — видно только вам',
  }
);
</script>

<style scoped>
.private-shield {
  color: var(--p-ink-3);
  flex-shrink: 0;
  opacity: 0.9;
}
</style>
