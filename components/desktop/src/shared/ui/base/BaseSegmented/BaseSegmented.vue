<template lang="pug">
//- Выбор одного из нескольких равноправных вариантов одной дорожкой
//- сегментов: повторяемость расхода, вид контрагента. Выбранный сегмент поднят
//- поверхностью и рамкой; ширина сегмента — по подписи, дорожка тянется.
.base-segmented(
  role='radiogroup',
  :aria-label='ariaLabel',
  :aria-labelledby='ariaLabelledby'
)
  button.base-segmented__option(
    v-for='option in options',
    :key='option.value',
    type='button',
    role='radio',
    :aria-checked='modelValue === option.value',
    :disabled='disabled',
    :class='{ "base-segmented__option--active": modelValue === option.value }',
    @click='emit("update:modelValue", option.value)'
  ) {{ option.label }}
</template>

<script setup lang="ts">
import type { BaseSegmentedProps } from './BaseSegmented.types';

defineProps<BaseSegmentedProps>();
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();
</script>

<style lang="scss" scoped>
.base-segmented {
  display: flex;
  gap: var(--p-1);
  padding: var(--p-1);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}

.base-segmented__option {
  flex: 1 0 auto;
  min-height: var(--p-8);
  padding: var(--p-2) var(--p-3);
  border: 1px solid transparent;
  border-radius: var(--p-r-sm);
  background: transparent;
  color: var(--p-ink-2);
  font: inherit;
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--p-ink);
  }

  &:focus-visible {
    outline: 2px solid var(--p-primary);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.base-segmented__option--active {
  border-color: var(--p-line-2);
  background: var(--p-surface);
  color: var(--p-primary);
}

@media (max-width: 760px) {
  .base-segmented {
    flex-wrap: wrap;
  }

  .base-segmented__option {
    flex-basis: calc(50% - var(--p-1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-segmented__option {
    transition: none;
  }
}
</style>
