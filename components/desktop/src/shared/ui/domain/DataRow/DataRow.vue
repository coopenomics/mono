<template lang="pug">
.data-row(:class='[`data-row--${align}`, { "data-row--mono": mono }]')
  .data-row__label {{ label }}
  .data-row__value
    template(v-if='$slots["value-override"]')
      slot(name='value-override')
    template(v-else)
      span.data-row__value-text {{ displayValue }}
    button.data-row__copy(
      v-if='copyable && canCopy',
      type='button',
      aria-label='Скопировать значение',
      @click.stop.prevent='onCopy'
    )
      q-icon(name='content_copy' size='14px')
  .data-row__hint(v-if='hint') {{ hint }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import type { DataRowProps } from './DataRow.types';

const props = withDefaults(defineProps<DataRowProps>(), {
  copyable: false,
  mono: false,
  align: 'horizontal',
});

const emit = defineEmits<{
  copy: [value: string];
}>();

const displayValue = computed((): string => {
  const v = props.value;
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
});

const canCopy = computed((): boolean => {
  const v = props.value;
  return v !== null && v !== undefined && v !== '';
});

async function onCopy(): Promise<void> {
  const text = String(props.value ?? '').trim();
  if (!text) return;
  try {
    await copyToClipboard(text);
    emit('copy', text);
    Notify.create({ type: 'positive', message: 'Скопировано', timeout: 1200, position: 'top' });
  } catch {
    Notify.create({ type: 'negative', message: 'Не удалось скопировать', timeout: 2000, position: 'top' });
  }
}
</script>

<style scoped>
.data-row {
  display: grid;
  align-items: baseline;
  row-gap: var(--p-1, 4px);
  column-gap: var(--p-5, 20px);
  padding: var(--p-2, 8px) 0;
  border-bottom: 1px solid var(--p-line);
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}
.data-row:last-child {
  border-bottom: none;
}

.data-row--horizontal {
  grid-template-columns: minmax(160px, 1fr) 2fr;
}
.data-row--vertical {
  grid-template-columns: 1fr;
}

.data-row__label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  padding-right: var(--p-2, 8px);
}

.data-row__value {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  min-width: 0;
  color: var(--p-ink);
}

.data-row__value-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.data-row--mono .data-row__value-text {
  font-family: var(--p-mono);
  font-feature-settings: 'tnum' 1;
  font-size: var(--p-fs-mono, 13px);
}

.data-row__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--p-ink-3);
  border-radius: var(--p-r-xs, 6px);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.data-row__copy:hover {
  background: var(--p-line-1);
  color: var(--p-ink-1);
}
.data-row__copy:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

.data-row__hint {
  grid-column: 1 / -1;
  color: var(--p-ink-3);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
}
</style>
