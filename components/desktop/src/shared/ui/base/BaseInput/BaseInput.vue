<template>
  <q-input
    outlined
    dense
    color="primary"
    reserve-hint-space
    no-error-icon
    :model-value="modelValue ?? ''"
    :label="label"
    :hint="hint"
    :error="!!error"
    :error-message="error"
    :placeholder="placeholder"
    :type="type"
    :prefix="prefix"
    :suffix="suffix"
    :readonly="readonly"
    :disable="disabled"
    :clearable="clearable"
    :autocomplete="autocomplete"
    :name="name"
    :for="resolvedId"
    :input-class="mono ? 'base-input__native--mono' : undefined"
    class="base-input"
    @update:model-value="onUpdate"
    @clear="$emit('clear')"
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
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  clear: [];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `base-input-${autoId}`);

function onUpdate(value: string | number | null): void {
  emit('update:modelValue', value == null ? '' : String(value));
}
</script>

<style scoped>
.base-input :deep(.base-input__native--mono) {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono);
}
</style>
