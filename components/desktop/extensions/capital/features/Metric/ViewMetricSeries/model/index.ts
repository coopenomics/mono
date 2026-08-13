import { ref, watch } from 'vue';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  IMetricSeries,
  IMetricWave,
} from 'app/extensions/capital/entities/ComponentMetric/model';
import { FailAlert } from 'src/shared/api';

/**
 * Ряд и волна считаются по дням — другого таймфрейма нет.
 * На UI только два сценария коридора: optimistic (0.382) и base/скромный (0.5);
 * пессимистичный 0.618 не грузим — веер не нужен.
 */
export function useMetricSeries(metricHash: () => string) {
  const series = ref<IMetricSeries | null>(null);
  const wave = ref<IMetricWave | null>(null);
  const isLoading = ref(false);

  const loadSeries = async () => {
    const hash = metricHash();
    if (!hash) return;
    isLoading.value = true;
    try {
      const [nextSeries, nextWave] = await Promise.all([
        api.getMetricSeries({ metric_hash: hash }),
        api.getMetricWave({ metric_hash: hash }),
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
    () => metricHash(),
    () => {
      void loadSeries();
    },
    { immediate: true },
  );

  return {
    series,
    wave,
    isLoading,
    loadSeries,
  };
}
