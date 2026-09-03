<template lang="pug">
BaseCard.edu-admin-course(variant="default")
  .edu-admin-course__media
    q-img(v-if="course.image_url" :src="course.image_url" :ratio="16 / 9" fit="cover" no-spinner)
    .edu-admin-course__placeholder(v-else)
      q-icon(name="image" size="32px")
    BaseBadge.edu-admin-course__status(:variant="status.variant") {{ status.label }}
  .row.q-gutter-xs
    BaseChip(variant="neutral" size="sm") {{ course.subject }}
    BaseChip(variant="neutral" size="sm") {{ course.grade }}
  .text-subtitle1.text-weight-medium.q-mt-sm {{ course.title }}
  .edu-admin-course__rows.q-mt-sm
    .row.items-center.no-wrap.t-sm.t-muted
      q-icon.q-mr-xs(name="hub" size="16px")
      span {{ carrierLabel }}
      span.q-mx-xs(v-if="course.external_ref") ·
      span.t-mono.ellipsis(v-if="course.external_ref" :title="course.external_ref") {{ course.external_ref }}
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
  .row.items-center.justify-end.q-gutter-xs.q-mt-md
    BaseButton(variant="ghost" size="sm" icon-only aria-label="Изменить" @click="emit('edit')")
      template(#icon-left)
        q-icon(name="edit" size="18px")
    BaseButton(v-if="published" variant="ghost" size="sm" :loading="busy" @click="emit('unpublish')") Снять с публикации
    BaseButton(v-else variant="secondary" size="sm" :loading="busy" @click="emit('publish')") Опубликовать
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseChip } from 'src/shared/ui/base';
import { CARRIER_LABELS, COURSE_STATUS_LABELS, type ICourse } from '../../entities/Course';

/**
 * Курс глазами администратора: обложка со статусом, привязка к площадке,
 * преподаватели, взносы и действия. Карточка вместо таблицы — у таблицы
 * действия уезжали за край экрана.
 */
const props = defineProps<{ course: ICourse; busy?: boolean }>();
const emit = defineEmits<{ edit: []; publish: []; unpublish: [] }>();

const status = computed(() => COURSE_STATUS_LABELS[props.course.status] ?? { label: props.course.status, variant: 'neutral' as const });
const published = computed(() => props.course.status === Zeus.EduCourseStatus.PUBLISHED);
const carrierLabel = computed(() => CARRIER_LABELS[props.course.carrier] ?? props.course.carrier);
</script>

<style scoped>
.edu-admin-course {
  height: 100%;
}
.edu-admin-course__media {
  position: relative;
  margin: calc(var(--p-4) * -1) calc(var(--p-4) * -1) var(--p-4);
  border-radius: var(--p-r-md) var(--p-r-md) 0 0;
  overflow: hidden;
  background: var(--p-surface-2);
}
.edu-admin-course__placeholder {
  aspect-ratio: 16 / 9;
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
