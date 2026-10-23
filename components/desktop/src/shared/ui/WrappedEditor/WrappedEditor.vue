<template lang="pug">
label.q-field.row.no-wrap.items-start.q-input.q-field--labeled.q-field--with-bottom(
  :class="fieldClasses"
  :style="standoutStyle"
  :for="inputId"
)
  .q-field__inner.relative-position.col.self-stretch
    .q-field__control.relative-position.row.no-wrap(tabindex="-1")
      .q-field__control-container.col.relative-position.row.no-wrap.q-anchor--skip
        .editor-input-wrapper
          Editor(
            :model-value="modelValue",
            :readonly="readonly",
            :placeholder="placeholder || $t('ui.wrappedEditor.placeholder')",
            :min-height="minHeight || 150",
            :show-focus-ring="true"
            @update:modelValue="emit('update:modelValue', $event)"
            @change="handleChange"
            @ready="handleReady"
          )
        .q-field__label.no-pointer-events.absolute.ellipsis(v-if="label")
          | {{ label }}
    .q-field__bottom.row.items-start.q-field__bottom--animated
      .q-field__messages.col
        .q-field__messages--error(v-if="errorMessage")
          | {{ errorMessage }}
      .q-field__counter(v-if="counter")
        | {{ counterText }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Editor } from '../Editor'

interface Props {
  modelValue: string | null | undefined
  label?: string
  placeholder?: string
  readonly?: boolean
  minHeight?: number
  rules?: ((val: any) => string | boolean)[]
  counter?: boolean
  maxlength?: number
  standout?: string
  dark?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change'): void
  (e: 'ready'): void
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  minHeight: 150,
})

const emit = defineEmits<Emits>()

// Генерируем уникальный ID для label
const inputId = `f_${Math.random().toString(36).substr(2, 9)}`

const errorMessage = ref('')
const hasError = computed(() => !!errorMessage.value)

const fieldClasses = computed(() => ({
  'q-field--standout': props.standout,
  'q-field--dark': props.dark,
  'q-field--error': hasError.value,
  'q-field--readonly': props.readonly
}))

const standoutStyle = computed(() => {
  if (props.standout) {
    return { background: props.standout }
  }
  return {}
})

const counterText = computed(() => {
  if (!props.counter || !props.modelValue) return ''
  const length = props.modelValue.length
  return props.maxlength ? `${length}/${props.maxlength}` : `${length}`
})

const validate = () => {
  if (!props.rules) return

  for (const rule of props.rules) {
    const result = rule(props.modelValue)
    if (result !== true) {
      errorMessage.value = result as string
      return
    }
  }
  errorMessage.value = ''
}

const handleChange = () => {
  validate()
  emit('change')
}

const handleReady = () => {
  emit('ready')
}

watch(() => props.modelValue, () => {
  if (hasError.value) {
    validate()
  }
})
</script>

<style scoped>
.editor-input-wrapper {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

/* Стили для интеграции Editor с q-field */
.q-field__control-container {
  padding: 0;
  min-height: 56px; /* Минимальная высота как у q-input */
}

.q-field__label {
  z-index: 1;
  transition: all 0.3s ease;
}

/* Когда редактор имеет контент, лейбл должен быть вверху */
.q-field--labeled .q-field__label {
  top: 8px;
  left: 12px;
  font-size: 12px;
  transform: translateY(-8px);
}
</style>
