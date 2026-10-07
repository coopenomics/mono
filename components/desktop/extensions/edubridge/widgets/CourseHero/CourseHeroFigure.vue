<template lang="pug">
//- Число курса — плиткой: подпись сверху, число крупно. Плитки одного ряда
//- равны по высоте, поэтому ряд читается как панель, а не как россыпь цифр
//- на фоне карточки.
.edu-figure
  .edu-figure__caption {{ caption }}
  .edu-figure__value
    slot {{ value }}
</template>

<script setup lang="ts">
defineProps<{
  caption: string;
  value?: string | number;
}>();
</script>

<style scoped>
.edu-figure {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
.edu-figure__caption {
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--p-ink-2);
}
.edu-figure__value {
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}
</style>
