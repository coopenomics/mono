<template lang="pug">
span.base-counter(:class="`base-counter--${variant}`") {{ shown }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseCounterProps } from './BaseCounter.types';

/**
 * Счётчик дел, которые ждут действия: число в заметной плашке у пункта меню,
 * вкладки или заголовка. Один вид на всю платформу — где стоит такая плашка,
 * там есть что сделать. Справочные числа (сколько всего) — вариант `neutral`.
 */
const props = withDefaults(defineProps<BaseCounterProps>(), {
  variant: 'accent',
  max: 99,
});

const shown = computed(() => (typeof props.value === 'number' && props.value > props.max ? `${props.max}+` : String(props.value)));
</script>

<style scoped>
.base-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}
.base-counter--accent {
  background: var(--p-primary);
  color: var(--p-ink-on-primary);
}
.base-counter--neg {
  background: var(--p-neg);
  color: var(--p-ink-on-primary);
}
.base-counter--neutral {
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}
</style>
