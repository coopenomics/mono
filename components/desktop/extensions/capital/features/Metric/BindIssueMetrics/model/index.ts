import { ref, computed } from 'vue';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IIssueMetricBinding } from 'app/extensions/capital/entities/ComponentMetric/model';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';

export function useBindIssueMetrics(issueHash: string, projectHash: string) {
  const store = useComponentMetricStore();
  const isLoading = ref(false);
  const isSaving = ref(false);
  const bindings = ref<IIssueMetricBinding[]>([]);

  const activeMetrics = computed(() =>
    store
      .getMetricsByProject(projectHash)
      .filter((m) => m.status !== Zeus.MetricStatus.ARCHIVED),
  );

  const deltaByMetric = ref<Record<string, number | string>>({});

  const loadAll = async () => {
    isLoading.value = true;
    try {
      if (!store.getMetricsByProject(projectHash).length) {
        await store.loadMetrics({ project_hash: projectHash });
      }
      const result = await api.getIssueMetricBindings({ issue_hash: issueHash });
      bindings.value = result ?? [];
      deltaByMetric.value = {};
      for (const b of bindings.value) {
        deltaByMetric.value[b.metric_hash] = b.delta;
      }
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  const saveBindings = async () => {
    isSaving.value = true;
    try {
      const metricBindings = Object.entries(deltaByMetric.value)
        .map(([metric_hash, delta]) => ({
          metric_hash,
          delta: Number(delta),
        }))
        .filter((b) => !Number.isNaN(b.delta) && b.delta !== 0);

      const result = await api.setIssueMetricBindings({
        issue_hash: issueHash,
        bindings: metricBindings,
      });

      bindings.value = result ?? [];
      SuccessAlert('Привязки метрик сохранены');
    } catch (error) {
      FailAlert(error);
    } finally {
      isSaving.value = false;
    }
  };

  return {
    activeMetrics,
    deltaByMetric,
    bindings,
    isLoading,
    isSaving,
    loadAll,
    saveBindings,
  };
}
