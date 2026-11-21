<template>
  <span :class="classes" :aria-label="name">
    <img v-if="src" :src="src" :alt="name ?? ''" />
    <template v-else-if="initials.text">{{ initials.text }}</template>
    //- A legal-form-only name gets a generic icon instead of an empty circle.
    q-icon(v-else-if="initials.organization" name="apartment", size="1.4em", aria-hidden="true")
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { avatarInitials } from 'src/shared/lib/utils/generateInitials';
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

const initials = computed(() => avatarInitials(props.name));
</script>
