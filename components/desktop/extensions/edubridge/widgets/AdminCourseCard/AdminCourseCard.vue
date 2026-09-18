<template lang="pug">
BaseCard.edu-admin-course(variant="default" role="link" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')")
  .edu-admin-course__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="2 / 1" fit="cover" no-spinner)
    .edu-admin-course__placeholder(v-else)
      q-icon(name="image" size="32px")
    BaseBadge.edu-admin-course__status(:variant="status.variant") {{ status.label }}
  .row.q-gutter-xs
    BaseChip(variant="neutral" size="sm") {{ course.subject }}
    BaseChip(variant="neutral" size="sm") {{ course.grade }}
  .text-subtitle2.text-weight-medium.q-mt-sm.ellipsis-2-lines {{ course.title }}
  .edu-admin-course__rows.q-mt-sm
    .row.items-center.no-wrap.t-sm.t-muted(v-if="course.teacher_usernames.length")
      q-icon.q-mr-xs(name="co_present" size="16px")
      span.t-mono.ellipsis {{ course.teacher_usernames.join(', ') }}
    .row.items-center.no-wrap.t-sm.t-muted(v-if="course.schedule")
      q-icon.q-mr-xs(name="schedule" size="16px")
      span.ellipsis {{ course.schedule }}
  .edu-admin-course__fees.q-mt-md
    div
      .t-sm.t-muted в месяц
      .text-subtitle2.t-mono {{ formatAsset2Digits(course.fee_month) }}
    div
      .t-sm.t-muted в год
      .text-subtitle2.t-mono {{ formatAsset2Digits(course.fee_year) }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseCard, BaseChip } from 'src/shared/ui/base';
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
}
.edu-admin-course:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}
.edu-admin-course__media {
  position: relative;
  margin: calc(var(--p-4) * -1) calc(var(--p-4) * -1) var(--p-4);
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
.edu-admin-course__status {
  position: absolute;
  top: var(--p-3);
  left: var(--p-3);
}
.edu-admin-course__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-admin-course__fees {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
</style>
