<template lang="pug">
.otp-input(:class='{ "otp-input--error": !!error, "otp-input--disabled": disabled }')
  .otp-input__cells(role='group', :aria-label='`Код подтверждения, ${length} цифр`')
    input.otp-input__cell(
      v-for='(_, idx) in cells',
      :key='idx',
      :ref='(el) => setRef(idx, el)',
      type='text',
      inputmode='numeric',
      autocomplete='one-time-code',
      maxlength='1',
      :value='cells[idx]',
      :disabled='disabled',
      :aria-label='`Цифра ${idx + 1}`',
      :name='name ? `${name}-${idx}` : undefined',
      @input='(e) => onInput(idx, e)',
      @keydown='(e) => onKeydown(idx, e)',
      @paste='onPaste',
      @focus='onFocus'
    )
  .otp-input__error(v-if='error') {{ error }}
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { OtpInputProps } from './OtpInput.types';

const props = withDefaults(defineProps<OtpInputProps>(), {
  length: 6,
  disabled: false,
  autofocus: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  complete: [value: string];
}>();

const refs = ref<Array<HTMLInputElement | null>>([]);

const cells = computed<string[]>(() => {
  const src = (props.modelValue ?? '').slice(0, props.length).split('');
  return Array.from({ length: props.length }, (_, i) => src[i] ?? '');
});

watch(
  () => props.length,
  () => {
    refs.value = [];
  },
);

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => {
      refs.value[0]?.focus();
    });
  }
});

function commit(next: string[]): void {
  const value = next.join('');
  emit('update:modelValue', value);
  if (value.length === props.length && next.every((c) => /^\d$/.test(c))) {
    emit('complete', value);
  }
}

function setRef(idx: number, el: Element | ComponentPublicInstance | null): void {
  refs.value[idx] = el as HTMLInputElement | null;
}

function onInput(idx: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const raw = input.value;
  const digit = raw.replace(/\D/g, '').slice(-1);
  const next = [...cells.value];
  next[idx] = digit;
  input.value = digit;
  commit(next);
  if (digit && idx < props.length - 1) {
    nextTick(() => refs.value[idx + 1]?.focus());
  }
}

function onKeydown(idx: number, event: KeyboardEvent): void {
  if (event.key === 'Backspace') {
    if (cells.value[idx]) {
      const next = [...cells.value];
      next[idx] = '';
      commit(next);
    } else if (idx > 0) {
      event.preventDefault();
      const next = [...cells.value];
      next[idx - 1] = '';
      commit(next);
      refs.value[idx - 1]?.focus();
    }
    return;
  }
  if (event.key === 'ArrowLeft' && idx > 0) {
    event.preventDefault();
    refs.value[idx - 1]?.focus();
    return;
  }
  if (event.key === 'ArrowRight' && idx < props.length - 1) {
    event.preventDefault();
    refs.value[idx + 1]?.focus();
  }
}

function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text') ?? '';
  const digits = text.replace(/\D/g, '').slice(0, props.length).split('');
  if (!digits.length) return;
  const next = Array.from({ length: props.length }, (_, i) => digits[i] ?? '');
  commit(next);
  nextTick(() => {
    const focusIdx = Math.min(digits.length, props.length - 1);
    refs.value[focusIdx]?.focus();
  });
}

function onFocus(event: FocusEvent): void {
  const input = event.target as HTMLInputElement;
  input.select();
}
</script>

<style scoped>
.otp-input {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.otp-input__cells {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.otp-input__cell {
  width: 48px;
  height: 56px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  color: var(--p-ink);
  font-family: var(--p-mono);
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard), box-shadow var(--p-dur-fast, 120ms) var(--p-ease-standard);
  caret-color: var(--p-primary);
}
.otp-input__cell:hover:not(:disabled) {
  border-color: var(--p-line-2);
}
.otp-input__cell:focus {
  border-color: var(--p-primary);
  box-shadow: var(--p-focus-ring);
}
.otp-input__cell:disabled {
  background: var(--p-surface-2);
  color: var(--p-ink-3);
  cursor: not-allowed;
}

.otp-input--error .otp-input__cell {
  border-color: var(--p-neg);
}
.otp-input--error .otp-input__cell:focus {
  box-shadow: 0 0 0 3px var(--p-neg-soft);
}

.otp-input__error {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  color: var(--p-neg);
  min-height: var(--p-lh-body-sm, 20px);
}
</style>
