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
import { t } from '../../../../i18n';
withDefaults(
  defineProps<{
    show?: boolean;
    tooltip?: string;
  }>(),
  {
    show: true,
    tooltip: t('capital.privateShieldIcon.tooltip'),
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
