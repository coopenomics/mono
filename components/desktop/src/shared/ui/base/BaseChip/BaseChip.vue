<template>
  <q-chip
    :color="resolvedColor"
    :text-color="resolvedTextColor"
    :dense="size === 'sm'"
    :size="size === 'lg' ? 'lg' : undefined"
    square
    :class="['base-chip', `base-chip--${variant}`]"
  >
    <slot />
  </q-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseChipProps } from './BaseChip.types';

const props = withDefaults(defineProps<BaseChipProps>(), {
  variant: 'neutral',
  size: 'sm',
});

const variantToQuasarColor: Record<NonNullable<BaseChipProps['variant']>, string | undefined> = {
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
