<template lang="pug">
BaseCard.edu-course-card(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-course-card__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-course-card__placeholder(v-else)
      q-icon(name="school" size="36px")
  .row.q-gutter-xs
    BaseChip(variant="neutral" size="sm") {{ course.subject }}
    BaseChip(variant="neutral" size="sm") {{ course.grade }}
  .text-subtitle1.text-weight-medium.q-mt-sm.edu-course-card__title {{ course.title }}
  .edu-course-card__meta.q-mt-xs
    .row.items-center.no-wrap.t-sm.t-muted(v-if="course.schedule")
      q-icon.q-mr-xs(name="schedule" size="16px")
      span.ellipsis {{ course.schedule }}
    .row.items-center.no-wrap.t-sm.t-muted(v-if="course.teacher_usernames.length")
      q-icon.q-mr-xs(name="co_present" size="16px")
      span.ellipsis.t-mono {{ course.teacher_usernames.join(', ') }}
  .edu-course-card__fees.q-mt-md
    div
      .t-sm.t-muted в месяц
      .text-subtitle2.t-mono {{ formatAsset2Digits(course.fee_month) }}
    div
      .t-sm.t-muted в год
      .text-subtitle2.t-mono {{ formatAsset2Digits(course.fee_year) }}
</template>

<script setup lang="ts">
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseCard, BaseChip } from 'src/shared/ui/base';
import type { ICatalogCourse } from '../../entities/Course';

/**
 * Карточка курса в каталоге: обложка (или заглушка), предмет и класс, название,
 * расписание, преподаватели, членский взнос за месяц и год. Тип направления и
 * площадка посетителю не показываются — суть курса читается из заголовка.
 */
defineProps<{ course: ICatalogCourse }>();
const emit = defineEmits<{ open: [] }>();
</script>

<style scoped>
.edu-course-card {
  cursor: pointer;
  height: 100%;
  transition: border-color 0.15s ease;
}
.edu-course-card:hover,
.edu-course-card:focus-visible {
  border-color: var(--p-primary-line);
  outline: none;
}
/* Обложка вылезает на поля карточки: ширина секции q-card равна --p-4 с каждой стороны. */
.edu-course-card__media {
  margin: calc(var(--p-4) * -1) calc(var(--p-4) * -1) var(--p-4);
  border-radius: var(--p-r-md) var(--p-r-md) 0 0;
  overflow: hidden;
  background: var(--p-surface-2);
}
.edu-course-card__placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-course-card__title {
  line-height: var(--p-lh-tight, 1.3);
}
.edu-course-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-course-card__fees {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
</style>
