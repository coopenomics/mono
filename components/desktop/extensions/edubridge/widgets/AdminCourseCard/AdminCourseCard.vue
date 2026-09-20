<template lang="pug">
BaseCard.edu-admin-course(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-admin-course__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-admin-course__placeholder(v-else)
      q-icon(name="school" size="32px")
  .edu-admin-course__body
    //- Предмет с классом слева, состояние курса справа — одной строкой над названием.
    .edu-admin-course__meta
      .t-eyebrow.ellipsis {{ course.subject }} · {{ course.grade }}
      BaseBadge(:variant="status.variant") {{ status.label }}
    .edu-admin-course__title {{ course.title }}
    .edu-admin-course__facts
      .edu-admin-course__fact(v-if="course.schedule")
        q-icon(name="schedule" size="16px")
        span.ellipsis {{ course.schedule }}
      .edu-admin-course__fact
        q-icon(name="co_present" size="16px")
        span.ellipsis(v-if="teachers.length") {{ teachers.join(', ') }}
        span.ellipsis.t-muted(v-else) Преподаватель не назначен
    //- Помесячный взнос — главная строка: столько участник вносит на самом деле.
    //- Ниже длительность курса и взнос разом, если кооператив его принимает.
    .edu-admin-course__fees
      FeeAmount(:value="course.fee_month" size="md" per="в месяц")
      .edu-admin-course__full(v-if="months")
        span {{ months }}
        template(v-if="course.fee_course")
          span ·
          span за курс разом
          FeeAmount(:value="course.fee_course" size="sm")
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge, BaseCard } from 'src/shared/ui/base';
import { COURSE_STATUS_LABELS, type ICourse } from '../../entities/Course';
import { courseMonthsLabel } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Курс в реестре администратора: обложка, состояние, расписание, преподаватели
 * и взносы. Карточка — только витрина и вход на страницу курса: управление
 * (правка, публикация) живёт там, а не под каждой карточкой.
 * Имена преподавателей отдаёт страница реестра: она догружает их одним заходом
 * на весь список, карточка сама за ними не ходит.
 */
const props = defineProps<{ course: ICourse; teacherNames?: Record<string, string> }>();
const emit = defineEmits<{ open: [] }>();

const status = computed(() => COURSE_STATUS_LABELS[props.course.status] ?? { label: props.course.status, variant: 'neutral' as const });
const teachers = computed(() => props.course.teacher_usernames.map((u) => props.teacherNames?.[u] || u));

const months = computed(() => courseMonthsLabel(props.course.course_months));
</script>

<style scoped>
.edu-admin-course {
  height: 100%;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--p-dur-fast, 120ms) ease, box-shadow var(--p-dur-fast, 120ms) ease;
}
.edu-admin-course:hover,
.edu-admin-course:focus-visible {
  border-color: var(--p-primary-line);
  box-shadow: 0 6px 20px -12px rgba(0, 0, 0, 0.25);
  outline: none;
}
/* Обложка идёт от края до края карточки, поэтому поля секции снимаем и
   раскладываем содержимое сами: снимок, под ним текст со своими полями. */
.edu-admin-course :deep(.base-card__body) {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.edu-admin-course__media {
  background: var(--p-surface-2);
  border-bottom: 1px solid var(--p-line);
}
.edu-admin-course__placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-admin-course__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--p-4) var(--p-5) var(--p-5);
}
.edu-admin-course__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  min-width: 0;
  min-height: 22px;
}
.edu-admin-course__title {
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
.edu-admin-course__facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-top: var(--p-3);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
.edu-admin-course__fact {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
.edu-admin-course__fact .q-icon {
  flex-shrink: 0;
  color: var(--p-ink-3);
}
/* Взносы — итог карточки: отделены линией и прижаты к низу, чтобы карточки
   в сетке заканчивались на одной высоте. Месячный взнос крупно, длительность и взнос разом под ним. */
.edu-admin-course__fees {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin-top: auto;
  padding-top: var(--p-4);
}
.edu-admin-course__fees::before {
  content: '';
  align-self: stretch;
  border-top: 1px solid var(--p-line);
  margin-bottom: var(--p-3);
}
.edu-admin-course__full {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}
</style>
