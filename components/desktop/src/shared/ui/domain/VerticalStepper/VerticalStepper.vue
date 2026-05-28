<template lang="pug">
ol.vertical-stepper
  li.vertical-stepper__step(
    v-for='(step, idx) in steps',
    :key='step.key',
    :class='classFor(step)'
  )
    .vertical-stepper__indicator
      button.vertical-stepper__circle(
        type='button',
        :class='circleClass(step)',
        :disabled='!isClickable(step)',
        :aria-current='step.key === activeKey ? "step" : undefined',
        @click='onClick(step)'
      )
        q-icon(v-if='isCompleted(step)', name='check', size='16px')
        q-icon(v-else-if='isErrored(step)', name='priority_high', size='16px')
        span(v-else) {{ idx + 1 }}
      .vertical-stepper__line(v-if='idx < steps.length - 1', :class='{ "vertical-stepper__line--past": isCompleted(step) }')
    .vertical-stepper__body
      button.vertical-stepper__label(
        type='button',
        :class='labelClass(step)',
        :disabled='!isClickable(step)',
        @click='onClick(step)'
      )
        span {{ step.label }}
        span.vertical-stepper__optional(v-if='step.optional') (опционально)
      .vertical-stepper__desc(v-if='step.description') {{ step.description }}
      .vertical-stepper__slot(v-if='step.key === activeKey && hasActiveSlot')
        slot(name='active', :step='step')
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { StepperStep, VerticalStepperProps } from './VerticalStepper.types';

const props = withDefaults(defineProps<VerticalStepperProps>(), {
  completed: () => [],
  errored: () => [],
  clickableCompleted: true,
});

const emit = defineEmits<{
  change: [key: string];
}>();

const slots = useSlots();
const hasActiveSlot = computed(() => Boolean(slots.active));

function isCompleted(step: StepperStep): boolean {
  return props.completed.includes(step.key);
}

function isErrored(step: StepperStep): boolean {
  return props.errored.includes(step.key);
}

function isActive(step: StepperStep): boolean {
  return step.key === props.activeKey;
}

function isClickable(step: StepperStep): boolean {
  if (step.disabled) return false;
  if (isCompleted(step) && props.clickableCompleted) return true;
  return isActive(step);
}

function onClick(step: StepperStep): void {
  if (!isClickable(step)) return;
  if (step.key === props.activeKey) return;
  emit('change', step.key);
}

function classFor(step: StepperStep): Record<string, boolean> {
  return {
    'vertical-stepper__step--active': isActive(step),
    'vertical-stepper__step--completed': isCompleted(step),
    'vertical-stepper__step--errored': isErrored(step),
    'vertical-stepper__step--disabled': !!step.disabled,
  };
}

function circleClass(step: StepperStep): Record<string, boolean> {
  return {
    'vertical-stepper__circle--active': isActive(step),
    'vertical-stepper__circle--completed': isCompleted(step),
    'vertical-stepper__circle--errored': isErrored(step),
  };
}

function labelClass(step: StepperStep): Record<string, boolean> {
  return {
    'vertical-stepper__label--active': isActive(step),
    'vertical-stepper__label--completed': isCompleted(step),
    'vertical-stepper__label--clickable': isClickable(step) && !isActive(step),
  };
}
</script>

<style scoped>
.vertical-stepper {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.vertical-stepper__step {
  display: grid;
  grid-template-columns: 32px 1fr;
  column-gap: var(--p-3, 12px);
  row-gap: 0;
  align-items: start;
  min-height: 56px;
}

.vertical-stepper__indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.vertical-stepper__circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--p-line-2);
  background: var(--p-surface);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.vertical-stepper__circle:disabled {
  cursor: default;
}
.vertical-stepper__circle--active {
  border-color: var(--p-accent);
  color: var(--p-accent);
  box-shadow: 0 0 0 3px var(--p-accent-soft, rgba(217, 95, 89, 0.12));
}
.vertical-stepper__circle--completed {
  background: var(--p-accent);
  border-color: var(--p-accent);
  color: var(--p-on-accent, #fff);
}
.vertical-stepper__circle--errored {
  background: var(--p-neg);
  border-color: var(--p-neg);
  color: #fff;
}

.vertical-stepper__line {
  flex: 1 1 auto;
  width: 2px;
  margin-top: var(--p-1, 4px);
  margin-bottom: var(--p-1, 4px);
  background: var(--p-line);
  min-height: 24px;
}
.vertical-stepper__line--past {
  background: var(--p-accent);
}

.vertical-stepper__body {
  padding-bottom: var(--p-4, 16px);
  min-width: 0;
}

.vertical-stepper__label {
  display: inline-flex;
  align-items: baseline;
  gap: var(--p-2, 8px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  text-align: left;
  cursor: default;
}
.vertical-stepper__label--clickable {
  cursor: pointer;
  color: var(--p-ink-1);
}
.vertical-stepper__label--clickable:hover {
  color: var(--p-primary);
}
.vertical-stepper__label--active {
  color: var(--p-ink);
}
.vertical-stepper__label--completed {
  color: var(--p-ink-1);
}

.vertical-stepper__optional {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 400;
  color: var(--p-ink-3);
  letter-spacing: 0.01em;
}

.vertical-stepper__desc {
  margin-top: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  color: var(--p-ink-2);
}

.vertical-stepper__slot {
  margin-top: var(--p-3, 12px);
}

.vertical-stepper__step--disabled .vertical-stepper__label,
.vertical-stepper__step--disabled .vertical-stepper__desc {
  opacity: 0.5;
}
</style>
