<template lang="pug">
.meet-info-card
  //- Единая calm-поверхность с тремя секциями через hairline (вместо
  //- трёх вложенных цветных карточек). Заголовок собрания не дублируем —
  //- он в шапке страницы.
  .meet-info
    section.meet-info__sec
      .meet-info__sec-head
        q-icon(name='event', size='18px')
        span Даты проведения
      .meet-info__rows
        .meet-info__row
          span.meet-info__label Открытие
          span.meet-info__value {{ meetStatus.formattedOpenDate }} ({{ timezoneLabel }})
        .meet-info__row
          span.meet-info__label Закрытие
          span.meet-info__value {{ meetStatus.formattedCloseDate }} ({{ timezoneLabel }})

    section.meet-info__sec
      .meet-info__sec-head
        q-icon(name='people', size='18px')
        span Ведущие
      .meet-info__rows
        .meet-info__row
          span.meet-info__label Председатель собрания
          span.meet-info__value {{ getNameFromCertificate(meet.processing?.meet?.presider_certificate) || 'Не назначен' }}
        .meet-info__row
          span.meet-info__label Секретарь собрания
          span.meet-info__value {{ getNameFromCertificate(meet.processing?.meet?.secretary_certificate) || 'Не назначен' }}

    section.meet-info__sec
      .meet-info__sec-head
        q-icon(name='pie_chart', size='18px')
        span Явка и кворум
      .meet-info__metrics
        .meet-info__metric
          span.meet-info__label Кворум
          span.meet-info__num {{ meet.processing?.meet?.quorum_percent }}%
        .meet-info__metric
          span.meet-info__label Явка
          span.meet-info__num {{ turnoutPercent }}%
      .meet-info__note Собрание состоится при явке не менее {{ meet.processing?.meet?.quorum_percent }}% пайщиков

  MeetStatusBanner.meet-info-card__banner(:meet='meet')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IMeet } from 'src/entities/Meet';
import { useMeetStatus } from 'src/shared/lib/composables';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { MeetStatusBanner } from 'src/shared/ui/MeetStatusBanner';
import { getTimezoneLabel } from 'src/shared/lib/utils/dates/timezone';

const props = defineProps<{
  meet: IMeet;
}>();

const timezoneLabel = getTimezoneLabel();
const meetStatus = useMeetStatus(props.meet);

const turnoutPercent = computed(() => {
  const v = props.meet.processing?.meet?.current_quorum_percent ?? 0;
  return (Math.round(v * 10) / 10).toFixed(1);
});
</script>

<style lang="scss" scoped>
.meet-info {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
}

.meet-info__sec {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-5, 20px);
}
/* Разделители-волоски между секциями (вертикальные на десктопе). */
.meet-info__sec + .meet-info__sec {
  border-left: 1px solid var(--p-line);
}

@media (max-width: 768px) {
  .meet-info {
    grid-template-columns: 1fr;
  }
  .meet-info__sec + .meet-info__sec {
    border-left: 0;
    border-top: 1px solid var(--p-line);
  }
}

.meet-info__sec-head {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
}

.meet-info__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.meet-info__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.meet-info__label {
  font-size: var(--p-fs-meta, 12px);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.meet-info__value {
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  line-height: 1.4;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}

.meet-info__metrics {
  display: flex;
  gap: var(--p-4, 16px);
}
.meet-info__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.meet-info__num {
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--p-ink);
}
.meet-info__note {
  font-size: var(--p-fs-meta, 12px);
  line-height: 1.45;
  color: var(--p-ink-3);
}

.meet-info-card__banner {
  margin-top: var(--p-4, 16px);
}
</style>
