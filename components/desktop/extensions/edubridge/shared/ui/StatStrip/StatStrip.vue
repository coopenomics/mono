<template lang="pug">
//- Ряд плиток чисел. Плитка та же, что в шапке курса, поэтому числа на всех
//- экранах образования выглядят одинаково. На фоне страницы ряд лежит в
//- карточке (`framed`), внутри чужой карточки — сам по себе.
BaseCard.edu-stats(v-if="framed" variant="default")
  .edu-stats__grid
    StatTile(v-for="it in items" :key="it.key" v-bind="it" :loading="loading" @edit="emit('edit', it.key)")
.edu-stats__grid(v-else)
  StatTile(v-for="it in items" :key="it.key" v-bind="it" :loading="loading" @edit="emit('edit', it.key)")
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base';
import StatTile from './StatTile.vue';
import type { StatStripItem } from './StatStrip.types';

withDefaults(defineProps<{ items: StatStripItem[]; loading?: boolean; framed?: boolean }>(), { loading: false, framed: true });
const emit = defineEmits<{ edit: [key: string] }>();
</script>

<style scoped>
.edu-stats :deep(.base-card__body) {
  padding: var(--p-4);
}
.edu-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--p-3);
}
</style>
