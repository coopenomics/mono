<template lang="pug">
q-btn(
  color='primary'
  no-caps
  no-wrap
  unelevated
  @click='onClick'
)
  q-icon.q-mr-sm(name='fa-solid fa-arrow-right-arrow-left' size='15px')
  span Перевести
  q-tooltip Корректировка: перевод между кошельками одного бух.счёта
</template>

<script setup lang="ts">
defineProps<{
  /** Колбэк, который дёрнется при клике. */
  onClick: () => void
}>()
</script>
