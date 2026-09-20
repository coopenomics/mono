<template lang="pug">
BaseCard.edu-course-card(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-course-card__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-course-card__placeholder(v-else)
      q-icon(name="school" size="32px")
  .t-sm.t-muted.ellipsis {{ course.subject }} · {{ course.grade }}
  .edu-course-card__title {{ course.title }}
  .edu-course-card__meta
    .edu-course-card__row(v-if="course.schedule")
      q-icon(name="schedule" size="16px")
      span.ellipsis {{ course.schedule }}
    .edu-course-card__row(v-if="course.lessons_per_month")
      q-icon(name="event_available" size="16px")
      span.ellipsis {{ course.lessons_per_month }} занятий в месяц по {{ course.lesson_minutes }} минут
  .edu-course-card__fees
    div
      .t-meta.t-muted в месяц
      .edu-course-card__amount.t-num {{ formatAsset2Digits(course.fee_month) }}
    div
      .t-meta.t-muted в год
      .edu-course-card__amount.t-num {{ formatAsset2Digits(course.fee_year) }}
</template>
<script setup lang="ts">
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseCard } from 'src/shared/ui/base';
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
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  transition: border-color 0.15s ease;
}
.edu-course-card:hover,
.edu-course-card:focus-visible {
  border-color: var(--p-primary-line);
  outline: none;
}
/* Обложка вылезает на поля карточки: ширина секции q-card равна --p-4 с каждой стороны. */
.edu-course-card__media {
  margin: calc(var(--p-4) * -1) calc(var(--p-4) * -1) var(--p-2);
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
  font-size: var(--p-fs-h5, 17px);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--p-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.edu-course-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
.edu-course-card__row {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;
}
.edu-course-card__fees {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
  margin-top: auto;
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
.edu-course-card__amount {
  font-size: var(--p-fs-body, 15px);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--p-ink);
}
</style>
