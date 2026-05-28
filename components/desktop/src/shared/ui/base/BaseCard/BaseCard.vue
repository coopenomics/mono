<template>
  <q-card flat :class="['base-card', `base-card--${variant ?? 'default'}`]">
    <q-card-section v-if="hasHead" class="base-card__head">
      <slot name="head">
        <div>
          <div v-if="title" class="base-card__title">{{ title }}</div>
          <div v-if="subtitle" class="base-card__sub">{{ subtitle }}</div>
        </div>
      </slot>
      <slot name="actions" />
    </q-card-section>
    <q-card-section class="base-card__body">
      <slot />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { BaseCardProps } from './BaseCard.types';

const props = withDefaults(defineProps<BaseCardProps>(), {
  variant: 'default',
});

const slots = useSlots();
const hasHead = computed(() => !!(props.title || props.subtitle || slots.head || slots.actions));
</script>

<style scoped>
.base-card--flat {
  border: 0;
  background: var(--p-surface-2);
}
.base-card--inset {
  background: var(--p-canvas-2);
  border: 0;
}
.base-card--quiet {
  background: transparent;
  border: 0;
}
.base-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding-bottom: 0;
}
.base-card__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3);
  color: var(--p-ink);
}
.base-card__sub {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  margin-top: 2px;
}
</style>
