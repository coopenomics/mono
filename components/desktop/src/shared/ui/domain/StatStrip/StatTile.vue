<template lang="pug">
//- Плитка числа — одна на все столы: подпись сверху, число крупно,
//- пояснение снизу. Значок, если есть, стоит справа от подписи одним цветом;
//- правка числа — карандашом у значения.
.stat-tile
  .stat-tile__top
    .stat-tile__caption
      span {{ caption }}
      q-icon.stat-tile__hint(v-if="hint" name="help_outline" size="14px")
        q-tooltip(max-width="320px") {{ hint }}
    q-icon.stat-tile__icon(v-if="icon" :name="icon" size="18px")
  .stat-tile__value
    template(v-if="loading") —
    slot(v-else)
      | {{ value }}
      span.stat-tile__ccy(v-if="symbol") {{ symbol }}
    BaseButton.stat-tile__edit(v-if="editLabel && !loading" variant="ghost" size="sm" icon-only :aria-label="editLabel" @click="emit('edit')")
      template(#icon-left)
        q-icon(name="edit" size="16px")
  .stat-tile__sub(v-if="sub") {{ sub }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

withDefaults(
  defineProps<{
    caption: string;
    value?: string | number;
    symbol?: string;
    sub?: string;
    hint?: string;
    icon?: string;
    editLabel?: string;
    loading?: boolean;
  }>(),
  { loading: false },
);
const emit = defineEmits<{ edit: [] }>();
</script>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  /* Чистая карточка: фон поверхности и тонкая рамка, без серой заливки. */
  background: var(--p-surface);
}
.stat-tile__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-2);
}
.stat-tile__caption {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--p-ink-2);
}
.stat-tile__hint {
  color: var(--p-ink-3);
  cursor: help;
}
.stat-tile__icon {
  flex: none;
  color: var(--p-ink-3);
}
.stat-tile__value {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}
.stat-tile__ccy {
  margin-left: 0.3em;
  font-size: var(--p-fs-body-sm);
  font-weight: 400;
  letter-spacing: 0;
  color: var(--p-ink-3);
}
.stat-tile__edit {
  flex: none;
  color: var(--p-ink-3);
}
.stat-tile__sub {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
</style>
