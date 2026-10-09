<template lang="pug">
BaseCard.edu-course-card(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-course-card__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-course-card__placeholder(v-else)
      q-icon(name="school" size="32px")
  .edu-course-card__body
    .t-eyebrow {{ courseSectionLabel(course.section_title, course.level_title) }}
    .edu-course-card__title {{ course.title }}
    .edu-course-card__facts
      .edu-course-card__fact(v-if="course.schedule")
        q-icon(name="schedule" size="16px")
        span.ellipsis {{ course.schedule }}
      .edu-course-card__fact(v-if="months")
        q-icon(name="date_range" size="16px")
        span.ellipsis {{ months }}
    //- Деньги — отдельным блоком из подписанных чисел. У программы на месяц
    //- взнос один — «за курс». У длинной — взнос в месяц и полный взнос за весь
    //- курс: со скидкой, если кооператив принимает его разом, иначе сумма помесячных.
    .edu-course-card__fees
      .edu-course-card__fee
        .edu-course-card__fee-label {{ singleMonth ? $t('edubridge.courseCard.feeWholeLabel') : $t('edubridge.courseCard.feeMonthLabel') }}
        FeeAmount(:value="course.fee_month" size="md")
      .edu-course-card__fee(v-if="!singleMonth && feeCourse")
        //- Насколько взнос разом меньше помесячного за те же месяцы — значком у подписи.
        .edu-course-card__fee-label
          span {{ $t('edubridge.courseCard.feeCourseLabel') }}
          BaseBadge(v-if="saving" variant="pos") −{{ saving }}%
        FeeAmount(:value="feeCourse" size="md")
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge, BaseCard } from 'src/shared/ui/base';
import { courseSectionLabel, type ICatalogCourse } from '../../entities/Course';
import { programSpanLabel } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Карточка курса в каталоге: обложка (или заглушка), раздел и уровень, название,
 * расписание, длительность программы, членский взнос за месяц и за весь курс. Тип направления и
 * площадка посетителю не показываются — суть курса читается из заголовка.
 */
const props = defineProps<{ course: ICatalogCourse }>();
const emit = defineEmits<{ open: [] }>();

/** Длительность программы — тем же расчётом, что в форме и на странице курса. */
const months = computed(() => programSpanLabel(props.course.lessons_per_month, props.course.lessons_total));
/** Программа на один месяц: взнос за месяц и есть взнос за курс. */
const singleMonth = computed(() => Number(props.course.course_months) === 1);
/** Полный взнос за весь курс: разом со скидкой, а когда разом не принимается — сумма помесячных. */
const feeCourse = computed(() => props.course.fee_course ?? props.course.fee_course_base ?? null);

/** Выгода взноса за весь курс против помесячного за те же месяцы, целые проценты; ноль — значок не нужен. */
const saving = computed(() => {
  const base = parseFloat(props.course.fee_course_base ?? '');
  const once = parseFloat(props.course.fee_course ?? '');
  if (!(base > 0) || !(once > 0) || once >= base) return 0;
  return Math.round((1 - once / base) * 100);
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
/* Деньги — итог карточки: отделены линией и прижаты к низу, чтобы карточки в
   сетке заканчивались на одной высоте. Каждое число под своей подписью. */
.edu-course-card__fees {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3) var(--p-6);
  margin-top: auto;
  padding-top: var(--p-4);
}
.edu-course-card__fees::before {
  content: '';
  flex: 0 0 100%;
  border-top: 1px solid var(--p-line);
}
.edu-course-card__fee {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.edu-course-card__fee-label {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-meta, 12px);
  line-height: 1.3;
  color: var(--p-ink-3);
}
</style>
