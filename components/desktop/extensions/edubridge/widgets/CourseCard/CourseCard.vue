<template lang="pug">
BaseCard.edu-course-card(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-course-card__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-course-card__placeholder(v-else)
      q-icon(name="school" size="32px")
  .edu-course-card__body
    .t-eyebrow.ellipsis {{ course.subject }} · {{ course.grade }}
    .edu-course-card__title {{ course.title }}
    .edu-course-card__facts
      .edu-course-card__fact(v-if="course.schedule")
        q-icon(name="schedule" size="16px")
        span.ellipsis {{ course.schedule }}
      .edu-course-card__fact(v-if="course.lessons_per_month")
        q-icon(name="event_available" size="16px")
        span.ellipsis {{ lessons }}
    .edu-course-card__fees
      FeeAmount(:value="course.fee_month" size="md" per="в месяц")
      FeeAmount(:value="course.fee_year" size="sm" per="в год")
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { pluralize } from 'src/shared/lib/utils';
import { BaseCard } from 'src/shared/ui/base';
import type { ICatalogCourse } from '../../entities/Course';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Карточка курса в каталоге: обложка (или заглушка), предмет и класс, название,
 * расписание, нагрузка в месяц, членский взнос за месяц и год. Тип направления и
 * площадка посетителю не показываются — суть курса читается из заголовка.
 */
const props = defineProps<{ course: ICatalogCourse }>();
const emit = defineEmits<{ open: [] }>();

const lessons = computed(() => {
  const n = Number(props.course.lessons_per_month);
  return `${n} ${pluralize(n, ['занятие', 'занятия', 'занятий'])} в месяц по ${props.course.lesson_minutes} мин`;
});
</script>

<style scoped>
.edu-course-card {
  height: 100%;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--p-dur-fast, 120ms) ease, box-shadow var(--p-dur-fast, 120ms) ease;
}
.edu-course-card:hover,
.edu-course-card:focus-visible {
  border-color: var(--p-primary-line);
  box-shadow: 0 6px 20px -12px rgba(0, 0, 0, 0.25);
  outline: none;
}
/* Обложка идёт от края до края карточки, поэтому поля секции снимаем и
   раскладываем содержимое сами: снимок, под ним текст со своими полями. */
.edu-course-card :deep(.base-card__body) {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.edu-course-card__media {
  background: var(--p-surface-2);
  border-bottom: 1px solid var(--p-line);
}
.edu-course-card__placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-course-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--p-4) var(--p-5) var(--p-5);
}
.edu-course-card__title {
  margin-top: var(--p-2);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--p-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.edu-course-card__facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-top: var(--p-3);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
.edu-course-card__fact {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
.edu-course-card__fact .q-icon {
  flex-shrink: 0;
  color: var(--p-ink-3);
}
/* Взносы — итог карточки: отделены линией и прижаты к низу, чтобы карточки
   в сетке заканчивались на одной высоте. Месячный взнос крупно, годовой под ним. */
.edu-course-card__fees {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin-top: auto;
  padding-top: var(--p-4);
}
.edu-course-card__fees::before {
  content: '';
  align-self: stretch;
  border-top: 1px solid var(--p-line);
  margin-bottom: var(--p-3);
}
</style>
