<template>
  <div class="empty">
    <div v-if="$slots.icon" class="empty__icon"><slot name="icon" /></div>
    <div class="empty__title">{{ title }}</div>
    <div v-if="body" class="empty__body">{{ body }}</div>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
import type { EmptyStateProps } from './EmptyState.types';

defineProps<EmptyStateProps>();
</script>
