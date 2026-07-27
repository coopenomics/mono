import { ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IMetricSuperposition } from 'app/extensions/capital/entities/ComponentMetric/model';
import { FailAlert } from 'src/shared/api';

export function useMetricSuperposition(projectHash: () => string) {
  const data = ref<IMetricSuperposition | null>(null);
  const isLoading = ref(false);
  const period = ref(Zeus.MetricSeriesPeriod.WEEK);

  const load = async () => {
    const hash = projectHash();
    if (!hash) return;
    isLoading.value = true;
    try {
      data.value = await api.getMetricSuperposition({
        project_hash: hash,
        period: period.value,
      });
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => [projectHash(), period.value] as const,
    () => {
      void load();
    },
    { immediate: true },
  );

  return { data, isLoading, period, load };
}
