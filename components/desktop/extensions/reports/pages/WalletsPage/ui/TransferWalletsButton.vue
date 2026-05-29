<template lang="pug">
//- Canon header-кнопка: на мобильном — только иконка + tooltip.
q-btn(
  @click='onClick',
  :color='isMobile ? "accent" : "primary"',
  :flat='isMobile',
  :dense='isMobile',
  :size='isMobile ? "sm" : undefined',
  no-caps,
  no-wrap,
  unelevated
)
  q-icon(name='fa-solid fa-arrow-right-arrow-left', :size='isMobile ? "14px" : "15px"')
  span.q-ml-sm(v-if='!isMobile') Перевести
  q-tooltip Корректировка: перевод между кошельками одного бух.счёта
</template>

<script setup lang="ts">
import { useWindowSize } from 'src/shared/hooks'

defineProps<{
  /** Колбэк, который дёрнется при клике. */
  onClick: () => void
}>()

const { isMobile } = useWindowSize()
</script>
