<template lang="pug">
//- Карточка курса — первое, что видно на странице курса: обложка, что это за
//- курс, в каком он состоянии, главное действие справа и под тонкой линией —
//- числа курса. Одна и та же у администратора и в каталоге ученика.
BaseCard.edu-hero(variant="default")
  q-img.edu-hero__cover(v-if="imageUrl" :src="imageUrl" :ratio="4 / 1" fit="cover" no-spinner)
  .edu-hero__body
    .edu-hero__head
      .edu-hero__text
        .edu-hero__subject {{ courseSectionLabel(section, level, ', ') }}
        h1.edu-hero__title {{ title }}
        .edu-hero__facts(v-if="$slots.facts")
          slot(name="facts")
      .edu-hero__actions(v-if="$slots.actions")
        slot(name="actions")
    .edu-hero__figures(v-if="$slots.default")
      slot
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base';
import { courseSectionLabel } from '../../entities/Course';

defineProps<{
  title: string;
  section: string;
  level: string;
  imageUrl?: string | null;
}>();
</script>

<style scoped>
.edu-hero {
  overflow: hidden;
  margin-bottom: var(--p-5);
}
.edu-hero :deep(.base-card__body) {
  padding: 0;
}
.edu-hero__cover {
  border-bottom: 1px solid var(--p-line);
  background: var(--p-surface-2);
}
.edu-hero__body {
  padding: var(--p-6);
}
.edu-hero__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-4) var(--p-6);
  flex-wrap: wrap;
}
.edu-hero__text {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}
.edu-hero__subject {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);
}
.edu-hero__title {
  margin: 0;
  font-size: var(--p-fs-display);
  line-height: var(--p-lh-display);
  letter-spacing: var(--p-ls-display);
  font-weight: 600;
  color: var(--p-ink);
}
.edu-hero__facts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2) var(--p-3);
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  font-feature-settings: 'tnum' 1;
}
.edu-hero__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-2);
}
/* Числа курса под тонкой линией, равными колонками одного веса. */
.edu-hero__figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--p-5) var(--p-6);
  margin-top: var(--p-6);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
</style>
