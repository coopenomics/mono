<template>
  <q-input
    :outlined="!flat"
    :borderless="flat"
    dense
    color="primary"
    :reserve-hint-space="!flat"
    no-error-icon
    :model-value="modelValue ?? ''"
    :label="label"
    :stack-label="stackLabel"
    :hint="hint"
    :error="!!error"
    :error-message="error"
    :placeholder="placeholder"
    :type="type"
    :autogrow="autogrow"
    :mask="mask"
    :prefix="prefix"
    :suffix="suffix"
    :autofocus="autofocus"
    :readonly="readonly"
    :disable="disabled"
    :clearable="clearable"
    :autocomplete="autocomplete"
    :name="name"
    :for="resolvedId"
    :input-class="mono ? 'base-input__native--mono' : undefined"
    :input-style="rowsStyle"
    :class="['base-input', { 'base-input--flat': flat }]"
    @update:model-value="onUpdate"
    @clear="$emit('clear')"
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
  >
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
    <template v-if="$slots.before" #before>
      <slot name="before" />
    </template>
    <template v-if="$slots.after" #after>
      <slot name="after" />
    </template>
    <template v-if="$slots.hint" #hint>
      <slot name="hint" />
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import type { BaseInputProps } from './BaseInput.types';

const props = withDefaults(defineProps<BaseInputProps>(), {
  type: 'text',
  mono: false,
  readonly: false,
  disabled: false,
  required: false,
  autogrow: false,
  stackLabel: false,
});

// Quasar QInput форвардит нативные blur/focus как обычный Event, не строго
// FocusEvent — типизация здесь под то, что реально приходит из q-input.
const emit = defineEmits<{
  'update:modelValue': [value: string];
  clear: [];
  blur: [event: Event];
  focus: [event: Event];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `base-input-${autoId}`);

/**
 * Стартовая высота многострочного поля. Ставим min-height, а не height:
 * при autogrow Quasar пишет height в inline-стиль каждой правкой, и height
 * отсюда был бы затёрт.
 */
const rowsStyle = computed(() =>
  props.rows ? { minHeight: `${props.rows * 1.5}em` } : undefined,
);

function onUpdate(value: string | number | null): void {
  emit('update:modelValue', value == null ? '' : String(value));
}
</script>

<style scoped>
.base-input :deep(.base-input__native--mono) {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono);
}

/* Безрамочный (flat) режим: поле выглядит как текст в ячейке. В покое — едва
   заметная штриховая нижняя линия (иначе поле неотличимо от статичного
   текста — жалоба 2026-08-02), на наведении — мягкий фон и линия сплошная,
   на фокусе — нижняя линия акцентом, чтобы видеть, что поле активно. */
.base-input--flat :deep(.q-field__control) {
  border-radius: var(--p-r-sm, 8px);
  border-bottom: 1px dashed var(--p-line-2);
  transition:
    background var(--p-dur-fast, 120ms) var(--p-ease-standard),
    border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.base-input--flat:hover :deep(.q-field__control) {
  background: var(--p-surface-2);
  border-bottom-style: solid;
  border-bottom-color: var(--p-primary-line);
}
.base-input--flat.q-field--focused :deep(.q-field__control) {
  background: var(--p-surface-2);
  border-bottom-color: transparent;
  box-shadow: inset 0 -2px 0 var(--p-primary);
}
</style>
