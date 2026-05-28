<template>
  <div class="page-head">
    <div v-if="eyebrow" class="t-eyebrow">{{ eyebrow }}</div>
    <div class="page-head__row">
      <div class="page-head__title">{{ title }}</div>
      <div v-if="$slots.actions" class="page-head__actions">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="subtitle" class="page-head__sub">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
import type { PageHeadProps } from './PageHead.types';

defineProps<PageHeadProps>();
</script>
