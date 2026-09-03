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
/*
 * Обычная карточка канона: волосяная рамка, без тени и без цветной полосы сверху. Полоса
 * была акцентным рельсом — канон такие запрещает, и экраны входа выглядели чужими среди
 * остальных (решение владельца 03.09.2026). Тень остаётся только у overlay-элементов.
 */
.auth-card {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
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
/*
 * Содержимое — колонка с ровным зазором. Без него соседние блоки слипались: баннер
 * упирался в кнопку под ним (владелец 03.09.2026). Зазор задаётся контейнером, а не
 * отступами у детей: содержимое приходит слотом из чужой области видимости, и scoped-правила
 * до него не достают.
 */
.auth-card__body {
  padding: var(--p-3, 12px) var(--p-6, 24px) var(--p-5, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
.auth-card__footer {
  border-top: 1px solid var(--p-line);
  padding: var(--p-4, 16px) var(--p-6, 24px);
  gap: var(--p-3, 12px);
  font-size: var(--p-fs-body-sm);
}
</style>
