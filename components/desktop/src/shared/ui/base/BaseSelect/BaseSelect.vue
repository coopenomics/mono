<template>
  <q-select
    outlined
    dense
    color="primary"
    reserve-hint-space
    map-options
    emit-value
    no-error-icon
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    option-disable="disabled"
    :label="label"
    :hint="hint"
    :placeholder="placeholder"
    :error="!!error"
    :error-message="error"
    :disable="disabled"
    :name="name"
    :for="resolvedId"
    class="base-select"
    @update:model-value="onUpdate"
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
    <template v-if="$slots.option" #option="scope">
      <slot name="option" v-bind="scope" />
    </template>
    <template v-if="$slots['selected-item']" #selected-item="scope">
      <slot name="selected-item" v-bind="scope" />
    </template>
  </q-select>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import type { BaseSelectProps } from './BaseSelect.types';

const props = withDefaults(defineProps<BaseSelectProps>(), {
  disabled: false,
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `base-select-${autoId}`);

function onUpdate(value: unknown): void {
  emit('update:modelValue', value as string | number | null);
}
</script>
