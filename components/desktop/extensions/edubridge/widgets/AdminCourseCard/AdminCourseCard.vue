<template lang="pug">
BaseCard.edu-admin-course(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-admin-course__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="2 / 1" fit="cover" no-spinner)
    .edu-admin-course__placeholder(v-else)
      q-icon(name="image" size="28px")
  //- Строка над названием: предмет с классом слева, состояние курса справа.
  //- Метка поверх снимка спорила с картинкой, чипы занимали целую строку.
  .edu-admin-course__meta
    span.t-sm.t-muted.ellipsis {{ course.subject }} · {{ course.grade }}
    BaseBadge(:variant="status.variant") {{ status.label }}
  .edu-admin-course__title {{ course.title }}
  .edu-admin-course__rows
    .edu-admin-course__row(v-if="course.schedule")
      q-icon(name="schedule" size="16px")
      span.ellipsis {{ course.schedule }}
    .edu-admin-course__row(v-if="course.teacher_usernames.length")
      q-icon(name="co_present" size="16px")
      span.ellipsis {{ course.teacher_usernames.join(', ') }}
  .edu-admin-course__fees
    div
      .t-meta.t-muted в месяц
      .edu-admin-course__amount.t-num {{ formatAsset2Digits(course.fee_month) }}
    div
      .t-meta.t-muted в год
      .edu-admin-course__amount.t-num {{ formatAsset2Digits(course.fee_year) }}
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseCard } from 'src/shared/ui/base';
import { COURSE_STATUS_LABELS, type ICourse } from '../../entities/Course';

/**
 * Курс в реестре администратора: обложка со статусом, преподаватели,
 * расписание и взносы. Карточка — только витрина и вход на страницу курса:
 * управление (правка, публикация) живёт там, а не под каждой карточкой.
 * Площадку здесь не показываем — это внутренняя привязка, она на странице.
 */
const props = defineProps<{ course: ICourse }>();
const emit = defineEmits<{ open: [] }>();

const status = computed(() => COURSE_STATUS_LABELS[props.course.status] ?? { label: props.course.status, variant: 'neutral' as const });
</script>

<style scoped>
.edu-admin-course {
  height: 100%;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  transition: border-color 0.15s ease;
}
.edu-admin-course:hover,
.edu-admin-course:focus-visible {
  border-color: var(--p-primary-line);
  outline: none;
}
.edu-admin-course__media {
  margin: calc(var(--p-4) * -1) calc(var(--p-4) * -1) var(--p-2);
  border-radius: var(--p-r-md) var(--p-r-md) 0 0;
  overflow: hidden;
  background: var(--p-surface-2);
}
.edu-admin-course__placeholder {
  aspect-ratio: 2 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-admin-course__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  min-width: 0;
}
.edu-admin-course__title {
  font-size: var(--p-fs-body, 15px);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.edu-admin-course__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
.edu-admin-course__row {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;
}
/* Взносы — итог карточки: отделены линией и прижаты к низу, чтобы карточки
   в сетке заканчивались на одной высоте. */
.edu-admin-course__fees {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
  margin-top: auto;
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
.edu-admin-course__amount {
  font-size: var(--p-fs-body, 15px);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--p-ink);
}
</style>
