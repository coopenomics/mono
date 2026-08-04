<template lang="pug">
.measures-page
  .banner.banner--info
    q-icon.banner__icon(name='info' size='20px')
    .banner__body
      | Централизованный справочник мер. Состав и волны задаются деплоем; здесь — мониторинг и включение или выключение.

  TableSkeleton(
    v-if='loading && !measures.length',
    :columns='skeletonColumns',
    :rows='8',
    min-width='640px'
  )

  EmptyState(
    v-else-if='!measures.length',
    title='Справочник пуст',
    body='Меры появятся после миграции или первого запроса к каталогу.'
  )
    template(#icon)
      q-icon(name='straighten' size='32px')

  .measures-page__catalog(v-else)
    .measures-page__section(v-for='section in sections', :key='section.tag')
      .measures-page__section-title {{ section.label }}
      .measures-page__rows
        .measures-page__row(
          v-for='m in section.items',
          :key='m.measure_hash',
          :class='{ "measures-page__row--off": m.status === archivedStatus }'
        )
          .measures-page__row-main
            .measures-page__title {{ m.title }}
            .measures-page__meta.t-sm
              span.measures-page__meta-item
                span.measures-page__meta-label Единица:
                |
                | {{ m.unit }}
              span.measures-page__meta-sep ·
              span.measures-page__meta-item
                span.measures-page__meta-label Режим:
                |
                | {{ seriesModeLabel(m.series_mode) }}
              span.measures-page__meta-sep ·
              span.measures-page__meta-item {{ waveLabel(m.wave_period) }}
          .measures-page__row-aside
            BaseBadge(:variant='statusVariant(m.status)') {{ statusLabel(m.status) }}
            q-toggle(
              :model-value='m.status === activeStatus',
              color='primary',
              dense,
              :disable='togglingHash === m.measure_hash',
              @update:model-value='(on) => toggleActive(m, on)'
            )
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IMeasure } from 'app/extensions/capital/entities/ComponentMetric/model';

const { info } = useSystemStore();

const loading = ref(false);
const togglingHash = ref<string | null>(null);
const measures = ref<IMeasure[]>([]);

const activeStatus = Zeus.MetricStatus.ACTIVE;
const archivedStatus = Zeus.MetricStatus.ARCHIVED;

const skeletonColumns = [
  { label: 'Мера', width: '28%' },
  { label: 'Единица', width: '14%' },
  { label: 'Режим', width: '16%' },
  { label: 'Волна', width: '16%' },
  { label: 'Статус', width: '14%', cell: 'badge' as const },
  { label: '', width: '12%', cell: 'icon' as const },
];

const tagOrder: Array<{
  tag: Zeus.ModelTypes['MeasureCatalogTag'];
  label: string;
}> = [
  { tag: Zeus.MeasureCatalogTag.PERSONAL, label: 'Личное' },
  { tag: Zeus.MeasureCatalogTag.PRODUCT, label: 'Продукт' },
  { tag: Zeus.MeasureCatalogTag.CONTENT, label: 'Контент' },
  { tag: Zeus.MeasureCatalogTag.COOPERATIVE, label: 'Кооператив' },
  { tag: Zeus.MeasureCatalogTag.QUALITY, label: 'Качество' },
];

const waveLabels: Record<string, string> = {
  [Zeus.MetricSeriesPeriod.MINUTE]: 'минутная волна',
  [Zeus.MetricSeriesPeriod.MINUTE_5]: '5-минутная волна',
  [Zeus.MetricSeriesPeriod.MINUTE_15]: '15-минутная волна',
  [Zeus.MetricSeriesPeriod.HOUR]: 'часовая волна',
  [Zeus.MetricSeriesPeriod.DAY]: 'дневная волна',
  [Zeus.MetricSeriesPeriod.WEEK]: 'недельная волна',
  [Zeus.MetricSeriesPeriod.MONTH]: 'месячная волна',
};

const seriesModeLabel = (mode: Zeus.ModelTypes['MetricSeriesMode']) =>
  mode === Zeus.MetricSeriesMode.LEVEL ? 'Уровень' : 'Изменения';

const waveLabel = (period: Zeus.ModelTypes['MetricSeriesPeriod']) =>
  waveLabels[period] ?? String(period);

const statusLabel = (status: Zeus.ModelTypes['MetricStatus']) =>
  status === Zeus.MetricStatus.ARCHIVED ? 'Выключена' : 'Активна';

const statusVariant = (status: Zeus.ModelTypes['MetricStatus']): BaseBadgeVariant =>
  status === Zeus.MetricStatus.ARCHIVED ? 'neutral' : 'pos';

const sections = computed(() =>
  tagOrder
    .map((group) => ({
      tag: group.tag,
      label: group.label,
      items: measures.value.filter((m) => m.tag === group.tag),
    }))
    .filter((section) => section.items.length > 0),
);

const load = async () => {
  loading.value = true;
  try {
    measures.value = await api.getMeasures({ coopname: info.coopname });
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};

const toggleActive = async (m: IMeasure, on: boolean) => {
  togglingHash.value = m.measure_hash;
  try {
    await api.updateMeasure({
      measure_hash: m.measure_hash,
      status: on ? Zeus.MetricStatus.ACTIVE : Zeus.MetricStatus.ARCHIVED,
    });
    SuccessAlert(on ? 'Мера включена' : 'Мера выключена');
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    togglingHash.value = null;
  }
};

onMounted(load);
</script>

<style lang="scss" scoped>
.measures-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding-left: var(--p-4);
  padding-right: var(--p-4);
}

.measures-page__catalog {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}

.measures-page__section-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
  margin-bottom: var(--p-2);
}

.measures-page__rows {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-top: 1px solid var(--p-line);
}

.measures-page__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  width: 100%;
  padding: var(--p-3) 0;
  border-bottom: 1px solid var(--p-line);
}

.measures-page__row--off {
  .measures-page__title {
    color: var(--p-ink-3);
  }
}

.measures-page__row-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.measures-page__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}

.measures-page__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--p-1);
  color: var(--p-ink-2);
}

.measures-page__meta-label {
  color: var(--p-ink-3);
}

.measures-page__meta-sep {
  color: var(--p-ink-3);
}

.measures-page__row-aside {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  flex-shrink: 0;
}
</style>
