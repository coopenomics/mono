<template lang="pug">
//- Возврат к списку — первой крошкой в строке контекста карточки сущности:
//- отдельной строкой над карточкой он висел на голом фоне и отлипал от страницы.
button.edu-back-link(type="button" @click="emit('click')")
  q-icon(name="arrow_back" size="14px")
  span {{ label }}
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.edu-back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--p-ink-2);
  cursor: pointer;
}
.edu-back-link:hover {
  color: var(--p-primary);
}
.edu-back-link:focus-visible {
  outline: 1px solid var(--p-primary);
  outline-offset: var(--p-1);
  border-radius: var(--p-r-sm);
}
</style>
