<template>
  <q-badge
    :color="resolvedColor"
    :text-color="resolvedTextColor"
    :class="['base-badge', `base-badge--${variant}`, { 'base-badge--dot': dot }]"
  >
    <slot v-if="!dot" />
  </q-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseBadgeProps } from './BaseBadge.types';

const props = withDefaults(defineProps<BaseBadgeProps>(), {
  variant: 'neutral',
  dot: false,
});

const variantToQuasarColor: Record<NonNullable<BaseBadgeProps['variant']>, string | undefined> = {
  neutral: undefined,
  accent: 'primary',
  pos: 'positive',
  neg: 'negative',
  warn: 'warning',
  info: 'info',
};

const resolvedColor = computed(() => variantToQuasarColor[props.variant]);
const resolvedTextColor = computed(() =>
  props.variant === 'neutral' ? undefined : 'white',
);
</script>

<style scoped>
/* Бейдж — атомарная метка: никогда не переносится по буквам и не сжимается
   соседями в flex-строке. Иначе длинный статус («Ожидает обработки») воровал
   ширину у имени рядом, и имя рассыпалось в столбик. */
.base-badge {
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 100%;
}
.base-badge--dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  padding: 0;
  border-radius: 50%;
}
</style>
