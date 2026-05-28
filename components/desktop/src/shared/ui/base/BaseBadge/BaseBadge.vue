<template>
  <q-badge
    :color="resolvedColor"
    :text-color="resolvedTextColor"
    :class="['base-badge', `base-badge--${variant}`, { 'base-badge--dot': dot }]"
  >
    <slot v-if="!dot" />
  </q-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseBadgeProps } from './BaseBadge.types';

const props = withDefaults(defineProps<BaseBadgeProps>(), {
  variant: 'neutral',
  dot: false,
});

const variantToQuasarColor: Record<NonNullable<BaseBadgeProps['variant']>, string | undefined> = {
  neutral: undefined,
  accent: 'primary',
  pos: 'positive',
  neg: 'negative',
  warn: 'warning',
  info: 'info',
};

const resolvedColor = computed(() => variantToQuasarColor[props.variant]);
const resolvedTextColor = computed(() =>
  props.variant === 'neutral' ? undefined : 'white',
);
</script>

<style scoped>
.base-badge--dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  padding: 0;
  border-radius: 50%;
}
</style>
