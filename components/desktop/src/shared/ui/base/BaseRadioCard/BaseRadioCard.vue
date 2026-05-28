<template lang="pug">
button.base-radio-card(
  type='button',
  :class='{ "base-radio-card--selected": isSelected, "base-radio-card--disabled": disabled }',
  :aria-pressed='isSelected',
  :aria-disabled='disabled || undefined',
  :disabled='disabled',
  @click='onClick'
)
  .base-radio-card__body
    .base-radio-card__title(v-if='title || $slots.title')
      slot(name='title') {{ title }}
    .base-radio-card__description(v-if='description || $slots.default')
      slot {{ description }}
    .base-radio-card__meta(v-if='meta || $slots.meta')
      slot(name='meta') {{ meta }}

  span.base-radio-card__indicator(:class='{ "base-radio-card__indicator--checked": isSelected }')
    span.base-radio-card__dot
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseRadioCardProps } from './BaseRadioCard.types';

const props = withDefaults(defineProps<BaseRadioCardProps>(), {
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const isSelected = computed(() => props.modelValue === props.value);

function onClick(): void {
  if (props.disabled) return;
  if (isSelected.value) return;
  emit('update:modelValue', props.value);
}
</script>

<style scoped>
.base-radio-card {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
  width: 100%;
  padding: var(--p-4, 16px);
  margin: 0;
  background: var(--p-canvas);
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-md, 8px);
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.base-radio-card:hover {
  border-color: var(--p-primary-soft, var(--p-primary));
  background: var(--p-surface);
}
.base-radio-card:focus-visible {
  outline: 2px solid var(--p-primary);
  outline-offset: 2px;
}
.base-radio-card--selected {
  border-color: var(--p-primary);
  background: var(--p-primary-soft, rgba(13, 148, 136, 0.08));
}
.base-radio-card--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.base-radio-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  flex: 1;
  min-width: 0;
}
.base-radio-card__title {
  font-size: var(--p-fs-h6, 16px);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}
.base-radio-card__description {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
  color: var(--p-ink-2);
}
.base-radio-card__meta {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.4;
  color: var(--p-primary);
  font-weight: 500;
  margin-top: var(--p-1, 4px);
}

.base-radio-card__indicator {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--p-line-2, var(--p-line));
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  background: var(--p-canvas);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.base-radio-card__indicator--checked {
  border-color: var(--p-primary);
}
.base-radio-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--p-primary);
  transform: scale(0);
  transition: transform 0.15s ease;
}
.base-radio-card__indicator--checked .base-radio-card__dot {
  transform: scale(1);
}
</style>
