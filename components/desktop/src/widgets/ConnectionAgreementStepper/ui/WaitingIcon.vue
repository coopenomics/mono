<script setup lang="ts">
/**
 * Значок шага ожидания слева от заголовка: часы пульсируют, пока ждём внешнее
 * событие (запись DNS, решение совета), галочка — когда оно наступило.
 */
defineProps<{ done: boolean }>()
</script>

<template lang="pug">
.waiting-icon(:class="{ 'waiting-icon--done': done }")
  q-icon(:name="done ? 'check' : 'schedule'" size="24px")
</template>

<style scoped>
.waiting-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--p-warn-soft);
  color: var(--p-warn);
}
.waiting-icon--done {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.waiting-icon:not(.waiting-icon--done)::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--p-warn);
  animation: waiting-icon-pulse 2.4s ease-out infinite;
}
@keyframes waiting-icon-pulse {
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(1.4); opacity: 0; }
}
</style>
