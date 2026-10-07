<template lang="pug">
//- Полоса показателей: несколько чисел в одной карточке, у каждого свой значок,
//- подпись над числом и пояснение под ним. Порядок слева направо — путь денег
//- или важность. Разделитель между ячейками — волосяная линия фона сетки,
//- поэтому при переносе на узком экране линии остаются и по горизонтали.
BaseCard.edu-stats(variant="default" :class="{ 'edu-stats--compact': compact }")
  .edu-stats__grid
    .edu-stats__item(v-for="it in items" :key="it.key")
      span.edu-stats__icon(:class="`edu-stats__icon--${it.tone || 'neutral'}`")
        q-icon(:name="it.icon" :size="compact ? '18px' : '20px'")
      .edu-stats__body
        .edu-stats__caption
          span.t-eyebrow {{ it.caption }}
          q-icon.edu-stats__hint(v-if="it.hint" name="help_outline" size="14px")
            q-tooltip(max-width="320px") {{ it.hint }}
        .edu-stats__value
          template(v-if="loading") —
          template(v-else)
            | {{ it.value }}
            span.edu-stats__ccy(v-if="it.symbol") {{ it.symbol }}
        .edu-stats__sub(v-if="it.sub") {{ it.sub }}
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base';
import type { StatStripItem } from './StatStrip.types';

withDefaults(defineProps<{ items: StatStripItem[]; loading?: boolean; compact?: boolean }>(), { loading: false, compact: false });
</script>

<style scoped>
.edu-stats :deep(.base-card__body) {
  padding: 0;
}
.edu-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1px;
  background: var(--p-line);
  border-radius: inherit;
  overflow: hidden;
}
.edu-stats__item {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-5);
  min-width: 0;
  background: var(--p-surface);
}
.edu-stats__icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}
.edu-stats__icon--primary {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.edu-stats__icon--info {
  background: var(--p-info-soft);
  color: var(--p-info);
}
.edu-stats__icon--warn {
  background: var(--p-warn-soft);
  color: var(--p-warn);
}
.edu-stats__icon--pos {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.edu-stats__body {
  min-width: 0;
}
.edu-stats__caption {
  display: flex;
  align-items: center;
  gap: var(--p-1);
}
.edu-stats__hint {
  color: var(--p-ink-3);
  cursor: help;
}
.edu-stats__value {
  margin-top: var(--p-1);
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}
.edu-stats__ccy {
  margin-left: 0.3em;
  font-size: var(--p-fs-body-sm);
  font-weight: 400;
  letter-spacing: 0;
  color: var(--p-ink-3);
}
.edu-stats__sub {
  margin-top: 2px;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.edu-stats--compact .edu-stats__grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.edu-stats--compact .edu-stats__item {
  padding: var(--p-3) var(--p-4);
  gap: var(--p-2);
}
.edu-stats--compact .edu-stats__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--p-r-sm);
}
.edu-stats--compact .edu-stats__value {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
}
</style>
