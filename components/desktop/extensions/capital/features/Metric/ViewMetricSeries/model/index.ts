import { ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  IMetricSeries,
  IMetricWave,
} from 'app/extensions/capital/entities/ComponentMetric/model';
import { FailAlert } from 'src/shared/api';

/**
 * На UI сейчас только два сценария коридора текущего периода:
 * optimistic (0.382) и base/скромный (0.5).
 * Пессимистичный 0.618 и мульти-ТФ волны не грузим — веер не нужен.
 */
export function useMetricSeries(metricHash: () => string) {
  const series = ref<IMetricSeries | null>(null);
  const wave = ref<IMetricWave | null>(null);
  const isLoading = ref(false);
  const period = ref(Zeus.MetricSeriesPeriod.WEEK);

  const loadSeries = async () => {
    const hash = metricHash();
    if (!hash) return;
    isLoading.value = true;
    try {
      const [nextSeries, nextWave] = await Promise.all([
        api.getMetricSeries({
          metric_hash: hash,
          period: period.value,
        }),
        api.getMetricWave({
          metric_hash: hash,
          period: period.value,
        }),
      ]);
      series.value = nextSeries;
      wave.value = nextWave;
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => [metricHash(), period.value] as const,
    () => {
      void loadSeries();
    },
    { immediate: true },
  );

  return {
    series,
    wave,
    isLoading,
    period,
    loadSeries,
  };
}
