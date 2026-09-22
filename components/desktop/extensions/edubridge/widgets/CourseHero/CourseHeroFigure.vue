<template lang="pug">
//- Число курса: значение, под ним подпись и, если нужно, приглушённое пояснение.
.edu-figure
  .edu-figure__value
    slot {{ value }}
  .edu-figure__caption {{ caption }}
  .edu-figure__note(v-if="note") {{ note }}
</template>

<script setup lang="ts">
defineProps<{
  caption: string;
  value?: string | number;
  note?: string;
}>();
</script>

<style scoped>
.edu-figure {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-figure__value {
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
}
.edu-figure__caption {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.edu-figure__note {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
}
</style>
