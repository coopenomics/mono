<template lang="pug">
q-checkbox.base-checkbox(
  :model-value='modelValue ?? false',
  :label='$slots.default ? undefined : label',
  :disable='disabled',
  :name='name',
  :for='resolvedId',
  size='sm',
  color='primary',
  :class='{ "base-checkbox--block": block }',
  @update:model-value='onUpdate'
)
  template(v-if='$slots.default')
    span.base-checkbox__label
      slot
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import type { BaseCheckboxProps } from './BaseCheckbox.types';

const props = withDefaults(defineProps<BaseCheckboxProps>(), {
  disabled: false,
  block: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `base-checkbox-${autoId}`);

function onUpdate(value: boolean | null): void {
  emit('update:modelValue', Boolean(value));
}
</script>

<style scoped>
.base-checkbox {
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}

/* Заливка галочки: q-checkbox по умолчанию красит __bg в --q-primary.
   В dark теме это #2dd4bf — слишком ярко для маленького квадрата 18px,
   выглядит ядовито. Берём --p-primary-press: глубже, спокойнее, читается
   и в light, и в dark. Чек-символ остаётся белым. */
.base-checkbox :deep(.q-checkbox__inner--truthy .q-checkbox__bg),
.base-checkbox :deep(.q-checkbox__inner--indet .q-checkbox__bg) {
  background: var(--p-primary-press);
}

/* block-вариант: q-checkbox растягивается на всю ширину, label переносит
   длинный текст согласия многострочно. Не трогаем внутренний flex Quasar —
   он сам выравнивает inner и label по центру первой строки. */
.base-checkbox--block {
  width: 100%;
}
.base-checkbox--block :deep(.q-checkbox__label) {
  white-space: normal;
  padding-left: var(--p-2, 8px);
}

.base-checkbox__label {
  display: inline;
}
</style>
