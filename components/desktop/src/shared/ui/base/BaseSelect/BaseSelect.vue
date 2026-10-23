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
    :options="withInput ? visibleOptions : allOptions"
    :use-input="withInput"
    :hide-selected="withInput"
    :fill-input="withInput"
    :clearable="clearable"
    input-debounce="0"
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
    @filter="onFilter"
    @input-value="onInputValue"
    @blur="onBlur"
    v-bind="newValueBinding"
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
    <!-- Пояснение к варианту (caption) — в списке справа от подписи. -->
    <template v-else-if="hasCaptions" #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="scope.opt.caption" side>
          <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template v-if="$slots['selected-item']" #selected-item="scope">
      <slot name="selected-item" v-bind="scope" />
    </template>
  </q-select>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import type { BaseSelectOption, BaseSelectProps } from './BaseSelect.types';

const props = withDefaults(defineProps<BaseSelectProps>(), {
  disabled: false,
  required: false,
  searchable: false,
  clearable: false,
  creatable: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null];
}>();

const autoId = useId();
const resolvedId = computed(() => props.id ?? `base-select-${autoId}`);

const hasCaptions = computed(() => props.options.some((o) => Boolean(o.caption)));
const withInput = computed(() => props.searchable || props.creatable);

// В пополняемом списке введённое значение может ещё не быть среди вариантов —
// добавляем его, чтобы поле и список показывали выбранное.
const allOptions = computed<BaseSelectOption[]>(() => {
  const v = props.modelValue;
  if (!props.creatable || v === null || v === undefined || v === '') return props.options;
  return props.options.some((o) => o.value === v) ? props.options : [...props.options, { value: v, label: String(v) }];
});

// Поиск идёт по подписи варианта и по подстроке, а не с начала: код бокса
// человек помнит хвостом («0001»), а не префиксом.
const visibleOptions = ref<BaseSelectOption[]>([...allOptions.value]);
watch(allOptions, (next) => {
  visibleOptions.value = [...next];
});

function onFilter(needle: string, update: (fn: () => void) => void): void {
  update(() => {
    const query = needle.trim().toLowerCase();
    visibleOptions.value = query
      ? allOptions.value.filter(
          (o) =>
            o.label.toLowerCase().includes(query) ||
            Boolean(o.caption && o.caption.toLowerCase().includes(query)),
        )
      : [...allOptions.value];
  });
}

function onUpdate(value: unknown): void {
  emit('update:modelValue', value as string | number | null);
}

/** Введённое совпадает с вариантом без учёта регистра — берём вариант. */
function resolveTyped(text: string): string | number {
  const typed = text.trim();
  const same = props.options.find((o) => o.label.trim().toLowerCase() === typed.toLowerCase());
  return same ? same.value : typed;
}

function onNewValue(text: string, done: (value?: string | number, mode?: 'add' | 'add-unique' | 'toggle') => void): void {
  if (!text.trim()) return done();
  // Сам список не пополняем: значение приходит обратно через modelValue.
  emit('update:modelValue', resolveTyped(text));
  done();
}

// Quasar включает добавление по Enter самим наличием обработчика, поэтому
// у обычного списка его нет вовсе.
const newValueBinding = computed(() => (props.creatable ? { onNewValue } : {}));

// Ввод без Enter тоже не теряем: ушли из поля — введённое становится значением.
const typedText = ref('');
function onInputValue(text: string): void {
  typedText.value = text;
}
function onBlur(): void {
  if (!props.creatable) return;
  const text = typedText.value.trim();
  const current = props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue);
  const currentLabel = allOptions.value.find((o) => o.value === props.modelValue)?.label ?? current;
  if (text && text !== currentLabel) emit('update:modelValue', resolveTyped(text));
}
</script>

<style scoped>
/*
 * Узкое поле: выбранное обрезается многоточием, а не режется по букве —
 * «Бокс BX-000» без хвоста читается как другой код.
 */
.base-select :deep(.q-field__input),
.base-select :deep(.q-field__native) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
