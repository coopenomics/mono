<template>
  <div class="mp-barcode-display" :class="`mp-barcode-display--${size}`">
    <svg
      class="mp-barcode-display__svg"
      :viewBox="`0 0 ${totalWidth} ${barHeight}`"
      :width="totalWidth"
      :height="barHeight"
      :aria-label="`Штрих-код ${code}`"
      role="img"
    >
      <rect
        v-for="(bar, i) in bars"
        :key="i"
        :x="bar.x"
        y="0"
        :width="bar.w"
        :height="barHeight"
        fill="#111"
      />
    </svg>
    <div class="mp-barcode-display__code">{{ display }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

/**
 * Простой визуальный рендер штрих-кода (mock-Code128).
 * Не предназначен для считывания сканером — для печатной формы используется
 * jsbarcode на стадии функциональной реализации Эпика 6 (Story 6.x).
 * Здесь — единственно визуальная согласованность UI.
 */
const props = defineProps({
  code: { type: String, required: true },
  size: { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'md' },
  showText: { type: Boolean, default: true },
})

const barHeight = computed(() => ({ sm: 36, md: 64, lg: 96 })[props.size])

/**
 * Псевдо-генерация ширин из символов кода — стабильна для одного code,
 * визуально похожа на реальный штрих-код. Чёрные полосы + промежутки.
 */
const bars = computed(() => {
  const widths: Array<{ x: number; w: number }> = []
  let x = 4
  for (let i = 0; i < props.code.length; i++) {
    const ch = props.code.charCodeAt(i)
    const blackW = ((ch * 7) % 4) + 1
    const gapW   = ((ch * 11) % 3) + 1
    widths.push({ x, w: blackW })
    x += blackW + gapW
    // Иногда сразу пара полос (имитация плотности)
    if (i % 2 === 0) {
      widths.push({ x, w: 1 })
      x += 2
    }
  }
  return widths
})

const totalWidth = computed(() => {
  const last = bars.value[bars.value.length - 1]
  return (last ? last.x + last.w : 100) + 8
})

const display = computed(() => (props.showText ? props.code : ''))
</script>

<style scoped lang="scss">
.mp-barcode-display {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  padding: var(--mp-space-sm);
  border-radius: 4px;

  &--sm { font-size: 12px; }
  &--md { font-size: 14px; }
  &--lg { font-size: 16px; }

  &__svg {
    display: block;
  }

  &__code {
    margin-top: 4px;
    font-family: 'Courier New', monospace;
    letter-spacing: 2px;
    color: #111;
  }
}
</style>
