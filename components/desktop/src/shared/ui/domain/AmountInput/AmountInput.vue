<template lang="pug">
.amount-input
  q-input.amount-input__field(
    outlined
    dense
    color='primary'
    reserve-hint-space
    no-error-icon
    inputmode='decimal'
    :model-value='displayValue',
    :label='label',
    :hint='hint',
    :error='!!error',
    :error-message='error',
    :placeholder='placeholder',
    :readonly='readonly',
    :disable='disabled',
    :name='name',
    :for='resolvedId',
    :suffix='symbol',
    input-class='amount-input__native',
    @update:model-value='onInput',
    @blur='onBlur'
  )
    template(v-if='showMax && balance != null' #after)
      button.amount-input__max(
        type='button',
        :disabled='disabled || readonly',
        @click='applyMax'
      ) макс
  .amount-input__balance(v-if='showBalance && balance != null')
    span.amount-input__balance-label Баланс:
    span.amount-input__balance-value {{ formatNumber(toNumber(balance)) }}
    span.amount-input__balance-symbol(v-if='symbol') {{ symbol }}
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import type { AmountInputProps } from './AmountInput.types';

const props = withDefaults(defineProps<AmountInputProps>(), {
  precision: 2,
  showMax: false,
  showBalance: false,
  disabled: false,
  readonly: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  blur: [];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `amount-input-${autoId}`);

const displayValue = ref<string>(formatForDisplay(toNumber(props.modelValue)));

watch(
  () => props.modelValue,
  (next) => {
    const parsed = toNumber(next);
    if (parsed !== parseEditing(displayValue.value)) {
      displayValue.value = formatForDisplay(parsed);
    }
  },
);

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseEditing(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number | null): string {
  if (n == null) return '';
  const fixed = n.toFixed(props.precision);
  const [intPart, fracPart] = fixed.split('.');
  const withSep = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fracPart != null ? `${withSep},${fracPart}` : withSep;
}

function formatForDisplay(n: number | null): string {
  if (n == null) return '';
  return formatNumber(n);
}

function sanitizeInput(raw: string): string {
  const allowed = raw.replace(/[^\d.,\s]/g, '');
  const dotsRemoved = allowed.replace(/\./g, ',');
  const firstComma = dotsRemoved.indexOf(',');
  let result = firstComma === -1
    ? dotsRemoved
    : dotsRemoved.slice(0, firstComma + 1) + dotsRemoved.slice(firstComma + 1).replace(/,/g, '');
  if (props.precision === 0) {
    result = result.replace(/,.*$/, '');
  } else {
    result = result.replace(new RegExp(`(,\\d{${props.precision}}).*$`), '$1');
  }
  const [intPart = '', fracPart] = result.split(',');
  const digitsOnly = intPart.replace(/\s/g, '');
  const grouped = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fracPart != null ? `${grouped},${fracPart}` : grouped;
}

function onInput(value: string | number | null): void {
  const raw = value == null ? '' : String(value);
  const sanitized = sanitizeInput(raw);
  displayValue.value = sanitized;
  const numeric = parseEditing(sanitized);
  const clamped = clamp(numeric);
  emit('update:modelValue', clamped);
}

function clamp(n: number | null): number | null {
  if (n == null) return null;
  if (props.max != null && n > props.max) return props.max;
  if (props.min != null && n < props.min) return props.min;
  return n;
}

function onBlur(): void {
  const parsed = parseEditing(displayValue.value);
  displayValue.value = formatForDisplay(parsed);
  emit('blur');
}

function applyMax(): void {
  const max = toNumber(props.balance);
  if (max == null) return;
  displayValue.value = formatForDisplay(max);
  emit('update:modelValue', max);
}
</script>

<style scoped>
.amount-input {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.amount-input__field {
  width: 100%;
}

.amount-input :deep(.amount-input__native) {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  text-align: right;
  font-weight: 500;
}

.amount-input__max {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--p-3, 12px);
  height: 32px;
  margin-left: var(--p-2, 8px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface);
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.amount-input__max:hover:not(:disabled) {
  background: var(--p-primary-soft);
  border-color: var(--p-primary);
}
.amount-input__max:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.amount-input__balance {
  display: inline-flex;
  align-items: baseline;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  color: var(--p-ink-2);
  margin-top: calc(-1 * var(--p-2, 8px));
}
.amount-input__balance-value {
  color: var(--p-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-input__balance-symbol {
  color: var(--p-ink-2);
}
</style>
