<template>
  <q-banner
    :class="['base-banner', `base-banner--${variant}`]"
    rounded
    dense
  >
    <template v-if="$slots.icon" #avatar>
      <slot name="icon" />
    </template>
    <slot />
    <template v-if="$slots.action" #action>
      <slot name="action" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import type { BaseBannerProps } from './BaseBanner.types';

withDefaults(defineProps<BaseBannerProps>(), {
  variant: 'neutral',
});
</script>

<style scoped>
.base-banner--info {
  background: var(--p-info-soft);
  color: var(--p-ink);
  border-left: 3px solid var(--p-info);
}
.base-banner--pos {
  background: var(--p-pos-soft);
  color: var(--p-ink);
  border-left: 3px solid var(--p-pos);
}
.base-banner--warn {
  background: var(--p-warn-soft);
  color: var(--p-ink);
  border-left: 3px solid var(--p-warn);
}
.base-banner--neg {
  background: var(--p-neg-soft);
  color: var(--p-ink);
  border-left: 3px solid var(--p-neg);
}
.base-banner--neutral {
  background: var(--p-surface-2);
  color: var(--p-ink);
  border-left: 3px solid var(--p-line-2);
}
</style>
