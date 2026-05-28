<template>
  <span :class="classes" :aria-label="name">
    <img v-if="src" :src="src" :alt="name ?? ''" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AvatarProps } from './Avatar.types';

const props = withDefaults(defineProps<AvatarProps>(), {
  size: 'md',
  tone: 'neutral',
});

const classes = computed(() => [
  'avatar',
  props.size !== 'md' && `avatar--${props.size}`,
  props.tone !== 'neutral' && `avatar--${props.tone}`,
].filter(Boolean));

const initials = computed(() => {
  if (!props.name) return '';
  const parts = props.name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
});
</script>
