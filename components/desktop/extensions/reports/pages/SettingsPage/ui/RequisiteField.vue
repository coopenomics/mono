<template lang="pug">
q-input(
  :id='id'
  :label='labelText'
  :model-value='value'
  :placeholder='placeholder'
  :readonly='readOnly'
  :disable='readOnly'
  :mask='mask'
  :fill-mask='fillMask'
  :maxlength='maxLength'
  :input-mode='inputModeComputed'
  :hint='hint'
  :rules='rules'
  lazy-rules
  dense
  outlined
  @update:model-value='onInput'
  @keydown='onKeydown'
  @paste='onPaste'
)
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id: string
  label: string
  value: string
  placeholder?: string
  readOnly?: boolean
  /** Поле обязательно; пустое → «Обязательное поле» (после blur). */
  required?: boolean
  /** Quasar mask. `#` = цифра, нативно блокирует не-цифры на keypress. */
  mask?: string
  /** Подставлять плейсхолдеры маски при вводе */
  fillMask?: boolean
  /** Разрешить только цифры + перечисленные доп. символы (напр. '.' для
   *  ОКВЭД: 94.99, 46.73.7; '-' для Рег. номера СФР). Блокирует
   *  keypress/paste — посторонние символы вообще не появляются в поле. */
  digitsExtraChars?: string
  /** HTML maxlength. */
  maxLength?: number
  /** Допустимые точные длины (ИЛИ). Напр. `[8, 11]` для ОКТМО. */
  exactLengths?: number[]
  /** Регекс финального значения; показываем `patternMessage` при несоответствии. */
  pattern?: RegExp
  /** Текст ошибки для `pattern`. */
  patternMessage?: string
  /** Подсказка под полем */
  hint?: string
}>()

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const labelText = computed(() =>
  props.required && !props.readOnly ? `${props.label} *` : props.label,
)

const inputModeComputed = computed<'numeric' | 'decimal' | 'text'>(() => {
  // '.' — десятичная клавиатура мобильных устройств её показывает; для
  // прочих доп.символов (напр. '-') нужна полная клавиатура — 'text'.
  if (props.digitsExtraChars === '.') return 'decimal'
  if (props.digitsExtraChars) return 'text'
  // mask из одних `#` = чистая цифровая клавиатура на мобиле.
  if (props.mask && /^#+$/.test(props.mask)) return 'numeric'
  return 'text'
})

/** Экранирует спецсимволы regex, чтобы вставить строку в символьный класс `[...]`. */
function escapeForCharClass(chars: string): string {
  return chars.replace(/[\]\\^-]/g, '\\$&')
}

const NAV_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Enter',
  'Escape',
])

// Блокируем keypress не-допустимых символов — буквы не попадают в поле даже
// на миллисекунды. Работает только для digitsExtraChars (для чисто цифровых
// полей используем Quasar-mask — он нативно блокирует не-# символы).
function onKeydown(e: KeyboardEvent): void {
  if (!props.digitsExtraChars) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (NAV_KEYS.has(e.key)) return
  const re = new RegExp(`^[\\d${escapeForCharClass(props.digitsExtraChars)}]$`)
  if (!re.test(e.key)) e.preventDefault()
}

function onPaste(e: ClipboardEvent): void {
  if (!props.digitsExtraChars) return
  const text = e.clipboardData?.getData('text') ?? ''
  const re = new RegExp(`^[\\d${escapeForCharClass(props.digitsExtraChars)}]*$`)
  if (!re.test(text)) e.preventDefault()
}

const rules = computed(() => {
  const rs: Array<(v: string) => true | string> = []
  if (props.required && !props.readOnly) {
    rs.push((v) => (!!v && String(v).trim() !== '') || 'Обязательное поле')
  }
  if (props.exactLengths && props.exactLengths.length > 0) {
    const expected = props.exactLengths
    rs.push((v) => {
      const s = String(v ?? '')
      if (!s) return true
      return (
        expected.includes(s.length) ||
        `Допустимая длина: ${expected.join(' или ')} цифр`
      )
    })
  }
  if (props.pattern) {
    const re = props.pattern
    const msg = props.patternMessage ?? 'Некорректный формат'
    rs.push((v) => {
      const s = String(v ?? '')
      if (!s) return true
      return re.test(s) || msg
    })
  }
  return rs
})

function onInput(raw: string | number | null): void {
  // Фоллбек-фильтр на случай programmatic ввода (drop/autofill). Для ручного
  // набора актуальна либо mask (q-input сам режет), либо keydown-блокер.
  let s = String(raw ?? '')
  if (props.digitsExtraChars) {
    const re = new RegExp(`[^\\d${escapeForCharClass(props.digitsExtraChars)}]+`, 'g')
    s = s.replace(re, '')
  }
  if (props.maxLength && s.length > props.maxLength) s = s.slice(0, props.maxLength)
  emit('update:value', s)
}
</script>
