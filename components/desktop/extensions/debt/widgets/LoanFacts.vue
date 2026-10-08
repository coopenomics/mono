<template lang="pug">
//- Числа, от которых зависит ввод суммы: подпись сверху, число под ней.
.loan-facts
  .loan-facts__item(v-for='item in items', :key='item.label')
    .loan-facts__label {{ item.label }}
    .loan-facts__value.t-num {{ item.value }}
</template>

<script setup lang="ts">
defineProps<{ items: { label: string; value: string }[] }>();
</script>

<style scoped lang="scss">
.loan-facts {
  display: flex;
  gap: var(--p-5);
  padding: var(--p-3) var(--p-4);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}

.loan-facts__item {
  flex: 1 1 0;
  min-width: 0;
}

.loan-facts__label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
}

.loan-facts__value {
  margin-top: var(--p-1);
  color: var(--p-ink);
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  font-weight: 700;
}
</style>
