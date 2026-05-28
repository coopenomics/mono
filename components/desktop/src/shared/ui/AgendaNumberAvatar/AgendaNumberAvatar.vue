<template lang="pug">
//- Canon-нумератор вопроса повестки: нейтральный квадрат (не teal-аватар).
span.agenda-num {{ number }}
</template>

<script setup lang="ts">
defineProps({
  number: {
    type: [String, Number],
    required: true,
  },
})
</script>

<style lang="scss" scoped>
.agenda-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  color: var(--p-ink-1);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  line-height: 1;
}
</style>
