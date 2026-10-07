<template lang="pug">
//- Число курса — плиткой: подпись сверху, число крупно, значок смысла в углу.
//- Плитки одного ряда равны по высоте, поэтому ряд читается как панель, а не
//- как россыпь цифр на фоне карточки.
.edu-figure
  .edu-figure__top
    .edu-figure__caption {{ caption }}
    span.edu-figure__icon(v-if="icon" :class="`edu-figure__icon--${tone}`")
      q-icon(:name="icon" size="18px")
  .edu-figure__value
    slot {{ value }}
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    caption: string;
    value?: string | number;
    /** Material-значок смысла числа: деньги, занятия, программа. */
    icon?: string;
    tone?: 'primary' | 'info' | 'pos' | 'neutral';
  }>(),
  { tone: 'neutral' },
);
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
.edu-figure__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-2);
}
.edu-figure__caption {
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--p-ink-2);
  padding-top: var(--p-1);
}
.edu-figure__icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}
.edu-figure__icon--primary {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.edu-figure__icon--info {
  background: var(--p-info-soft);
  color: var(--p-info);
}
.edu-figure__icon--pos {
  background: var(--p-pos-soft);
  color: var(--p-pos);
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
