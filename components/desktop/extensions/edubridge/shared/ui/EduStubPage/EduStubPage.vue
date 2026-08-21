<template lang="pug">
.q-pa-md
  PageHint(:storage-key="`edu:${storageKey}:banner-dismissed`")
    | {{ hint }}
  EmptyState(:title="title" :body="body")
    template(#icon)
      q-icon(:name="icon" size="40px")
</template>

<script setup lang="ts">
import { EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';

/**
 * Заглушка страницы каркаса «Образовательного моста» (E1): подсказка и пустое
 * состояние. Заменяется содержимым соответствующего эпика.
 */
defineProps<{
  storageKey: string;
  hint: string;
  title: string;
  body?: string;
  icon?: string;
}>();
</script>
