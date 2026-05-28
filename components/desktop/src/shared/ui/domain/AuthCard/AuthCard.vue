<template lang="pug">
.auth-card-shell(:style='shellStyle')
  q-card.auth-card(flat)
    q-card-section.auth-card__head(v-if='title || subtitle || $slots.head')
      slot(name='head')
        div
          h1.auth-card__title(v-if='title') {{ title }}
          p.auth-card__sub(v-if='subtitle') {{ subtitle }}

    q-card-section.auth-card__body
      slot

    q-card-actions.auth-card__footer(v-if='$slots.footer', align='center')
      slot(name='footer')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AuthCardProps } from './AuthCard.types';

const props = defineProps<AuthCardProps>();

const shellStyle = computed(() => ({
  maxWidth: `${props.maxWidth ?? 480}px`,
}));
</script>

<style scoped>
.auth-card-shell {
  width: 100%;
  margin: 0 auto;
}
.auth-card {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  /* Auth-карточка — hero-element auth-страницы. Усиливаем shadow поверх
     canon-минималистского q-card — без этого светлая тема выглядит плоской
     (canvas и surface почти неразличимы). На тёмной shadow поверх чёрного
     фона остаётся ненавязчивой — лишнего шума не даёт. */
  box-shadow:
    0 1px 2px rgba(9, 9, 11, 0.04),
    0 8px 24px rgba(9, 9, 11, 0.06);
  border-color: var(--p-line-1);
  position: relative;
  overflow: hidden;
}
/* Статичный accent-стрип сверху — визуальный якорь без анимации. */
.auth-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--p-primary);
  z-index: 1;
}
[data-theme="dark"] .auth-card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 12px 32px rgba(0, 0, 0, 0.32);
}
.auth-card__head {
  padding: var(--p-6, 24px) var(--p-6, 24px) var(--p-2, 8px);
  text-align: center;
}
.auth-card__title {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  color: var(--p-ink);
  margin: 0;
}
.auth-card__sub {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  margin: 6px 0 0;
}
.auth-card__body {
  padding: var(--p-3, 12px) var(--p-6, 24px) var(--p-5, 20px);
}
.auth-card__footer {
  border-top: 1px solid var(--p-line);
  padding: var(--p-4, 16px) var(--p-6, 24px);
  gap: var(--p-3, 12px);
  font-size: var(--p-fs-body-sm);
}
</style>
