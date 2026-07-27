import { ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  IMetricSeries,
  ILogMetricContributionInput,
} from 'app/extensions/capital/entities/ComponentMetric/model';
import { SuccessAlert, FailAlert } from 'src/shared/api';

export function useMetricSeries(
  metricHash: () => string,
  onUpdated?: () => void,
) {
  const series = ref<IMetricSeries | null>(null);
  const isLoading = ref(false);
  const isLogging = ref(false);
  const period = ref(Zeus.MetricSeriesPeriod.WEEK);
  const manualDelta = ref<number | string>(1);

  const loadSeries = async () => {
    const hash = metricHash();
    if (!hash) return;
    isLoading.value = true;
    try {
      series.value = await api.getMetricSeries({
        metric_hash: hash,
        period: period.value,
      });
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  const logContribution = async () => {
    const hash = metricHash();
    const delta = Number(manualDelta.value);
    if (!hash || !Number.isFinite(delta) || delta === 0) return;
    isLogging.value = true;
    try {
      const data: ILogMetricContributionInput = {
        metric_hash: hash,
        delta,
      };
      await api.logMetricContribution(data);
      SuccessAlert('Вклад записан');
      await loadSeries();
      onUpdated?.();
    } catch (error) {
      FailAlert(error);
    } finally {
      isLogging.value = false;
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
    isLoading,
    isLogging,
    period,
    manualDelta,
    loadSeries,
    logContribution,
  };
}
