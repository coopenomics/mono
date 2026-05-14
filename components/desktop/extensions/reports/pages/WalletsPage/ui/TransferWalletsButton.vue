<template lang="pug">
q-btn(
  size='md'
  flat
  color='secondary'
  icon='fa-solid fa-arrow-right-arrow-left'
  label='Перевести'
  @click='onClick'
)
  q-tooltip Корректировка: перевод между кошельками одного бух.счёта
</template>

<script setup lang="ts">
defineProps<{
  /** Колбэк, который дёрнется при клике. */
  onClick: () => void
}>()
</script>
