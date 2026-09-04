<template>
  <q-banner
    :class="['base-banner', `base-banner--${variant}`]"
    rounded
    dense
  >
    <template v-if="$slots.icon" #avatar>
      <slot name="icon" />
    </template>
    <slot />
    <template v-if="$slots.action" #action>
      <slot name="action" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import type { BaseBannerProps } from './BaseBanner.types';

withDefaults(defineProps<BaseBannerProps>(), {
  variant: 'neutral',
});
</script>

<style scoped>
/*
 * Один в один прототип-класс `.banner` канона (components.css): мягкая заливка по смыслу,
 * без рамки и без цветного рельса слева. Рельс был акцентной полосой на карточке — канон
 * такие запрещает, и баннер выбивался из остальных экранов (владелец 03.09.2026).
 */
.base-banner {
  padding: 12px 14px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
}
.base-banner--info {
  background: var(--p-info-soft);
  border-color: transparent;
}
.base-banner--pos {
  background: var(--p-pos-soft);
  border-color: transparent;
}
.base-banner--warn {
  background: var(--p-warn-soft);
  border-color: transparent;
}
.base-banner--neg {
  background: var(--p-neg-soft);
  border-color: transparent;
}
.base-banner--neutral {
  background: var(--p-surface-2);
}
/* Цвет значка — по смыслу баннера, как в каноне: он и остаётся единственным акцентом. */
.base-banner--info :deep(.q-icon) { color: var(--p-info); }
.base-banner--pos :deep(.q-icon) { color: var(--p-pos); }
.base-banner--warn :deep(.q-icon) { color: var(--p-warn); }
.base-banner--neg :deep(.q-icon) { color: var(--p-neg); }
.base-banner--neutral :deep(.q-icon) { color: var(--p-ink-2); }
</style>
