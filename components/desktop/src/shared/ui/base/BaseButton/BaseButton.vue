<template>
  <q-btn
    :unelevated="isUnelevated"
    :outline="variant === 'secondary'"
    :flat="variant === 'ghost' || variant === 'danger'"
    :color="resolvedColor"
    :text-color="resolvedTextColor"
    :type="type"
    :disable="disabled"
    :loading="loading"
    :no-caps="true"
    :ripple="false"
    :dense="size === 'sm'"
    :class="['base-btn', `base-btn--${variant}`, { 'base-btn--block': block }]"
    :aria-label="ariaLabel"
    :size="resolvedSize"
  >
    <slot name="icon-left" />
    <span v-if="!iconOnly" class="base-btn__label"><slot /></span>
    <slot name="icon-right" />
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseButtonProps } from './BaseButton.types';

const props = withDefaults(defineProps<BaseButtonProps>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
  iconOnly: false,
});

const isUnelevated = computed(() => props.variant === 'primary' || props.variant === 'negative');
const resolvedColor = computed(() => {
  if (props.variant === 'primary') return 'primary';
  if (props.variant === 'danger' || props.variant === 'negative') return 'negative';
  return undefined;
});
const resolvedTextColor = computed(() => {
  if (props.variant === 'primary' || props.variant === 'negative') return 'white';
  return undefined;
});
const resolvedSize = computed(() => {
  if (props.size === 'sm') return 'sm';
  if (props.size === 'lg') return 'lg';
  return undefined;
});
</script>

<style scoped>
.base-btn--block {
  width: 100%;
}
.base-btn__label {
  display: inline-flex;
  align-items: center;
}
</style>
