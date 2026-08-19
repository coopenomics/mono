<template lang="pug">
.pin-pad
  //- Ячейки те же, что у кода из письма: набор с обычной клавиатуры, стрелки,
  //- Backspace и вставка уже работают там как надо. Отличие одно — набранное
  //- скрыто точками: PIN вводят при посторонних.
  OtpInput(
    ref='cellsRef',
    :model-value='modelValue ?? ""',
    :length='length',
    :error='error',
    :disabled='disabled',
    :autofocus='autofocus',
    masked,
    @update:model-value='onCells',
    @complete='(v) => emit("complete", v)'
  )

  //- Экранные кнопки — не замена клавиатуре, а второй способ ввода: с телефона и
  //- планшета цифры набирают пальцем, а сидящему за столом привычнее клавиши.
  //- Работают оба сразу: кнопка не забирает курсор из ячейки (mousedown.prevent),
  //- поэтому набор можно продолжить с клавиатуры, не целясь в поле мышью.
  .pin-pad__keys(role='group', aria-label='Клавиатура PIN-кода')
    button.pin-pad__key(
      v-for='key in KEYS',
      :key='key',
      type='button',
      :disabled='disabled',
      :aria-label='`Цифра ${key}`',
      @mousedown.prevent,
      @click='append(key)'
    ) {{ key }}

    span.pin-pad__key.pin-pad__key--empty(aria-hidden='true')

    button.pin-pad__key(
      type='button',
      :disabled='disabled',
      aria-label='Цифра 0',
      @mousedown.prevent,
      @click="append('0')"
    ) 0

    button.pin-pad__key.pin-pad__key--action(
      type='button',
      :disabled='disabled || !value.length',
      aria-label='Стереть последнюю цифру',
      @mousedown.prevent,
      @click='backspace'
    )
      q-icon(name='backspace', size='20px')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { OtpInput } from '../OtpInput';
import type { PinPadProps } from './PinPad.types';

const props = withDefaults(defineProps<PinPadProps>(), {
  length: 6,
  disabled: false,
  autofocus: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  complete: [value: string];
}>();

/** Наружу от ячеек нужен один метод — поставить курсор (см. `focusCell` в OtpInput). */
const cellsRef = ref<{ focusCell: (index?: number) => void } | null>(null);

const value = computed(() => props.modelValue ?? '');

/** Кнопки идут тремя рядами по три; ноль и стирание — отдельным нижним рядом. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function commit(next: string): void {
  emit('update:modelValue', next);
  // Курсор — в первую незаполненную ячейку: набор продолжается с клавиатуры
  // ровно с того места, где остановился набор пальцем, и наоборот.
  cellsRef.value?.focusCell(next.length);
  if (next.length === props.length) emit('complete', next);
}

function onCells(next: string): void {
  emit('update:modelValue', next);
}

function append(digit: string): void {
  if (props.disabled || value.value.length >= props.length) return;
  commit(value.value + digit);
}

function backspace(): void {
  if (props.disabled || !value.value.length) return;
  commit(value.value.slice(0, -1));
}

/** Поставить курсор в ячейку (по умолчанию — в первую). Нужен владельцу
 *  двухшагового набора: после «придумайте» → «повторите» набор начинается
 *  заново, а фокус без этого остаётся на последней заполненной ячейке. */
function focusCell(index = 0): void {
  cellsRef.value?.focusCell(index);
}

defineExpose({ focusCell });
</script>

<style scoped>
.pin-pad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-4);
}

.pin-pad__keys {
  display: grid;
  grid-template-columns: repeat(3, 64px);
  gap: var(--p-2);
}

.pin-pad__key {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--p-mono);
  font-size: var(--p-fs-h5);
  color: var(--p-ink);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  cursor: pointer;
  transition:
    background var(--p-dur-fast, 120ms) ease,
    border-color var(--p-dur-fast, 120ms) ease;
}
.pin-pad__key:hover:not(:disabled) {
  background: var(--p-primary-soft);
  border-color: var(--p-primary-line);
}
.pin-pad__key:active:not(:disabled) {
  background: var(--p-primary-soft);
  border-color: var(--p-primary);
}
.pin-pad__key:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Пустая клетка слева от нуля: сетка держит строй, а нажимать там нечего. */
.pin-pad__key--empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
}

.pin-pad__key--action {
  color: var(--p-ink-2);
}
</style>
