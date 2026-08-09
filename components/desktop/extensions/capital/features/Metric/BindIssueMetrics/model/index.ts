import { ref, computed } from 'vue';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IIssueMetricBinding } from 'app/extensions/capital/entities/ComponentMetric/model';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';

export function useBindIssueMetrics(issueHash: string, projectHash: string) {
  const store = useComponentMetricStore();
  const isLoading = ref(false);
  const isSaving = ref(false);
  const bindings = ref<IIssueMetricBinding[]>([]);
  const deltaByMetric = ref<Record<string, number | string>>({});
  /** Снимок сохранённых delta — чтобы не сейвить без изменений */
  const savedDeltaByMetric = ref<Record<string, number>>({});

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const activeMetrics = computed(() =>
    store
      .getMetricsByProject(projectHash)
      .filter((m) => m.status !== Zeus.MetricStatus.ARCHIVED),
  );

  const loadAll = async () => {
    isLoading.value = true;
    try {
      if (!store.getMetricsByProject(projectHash).length) {
        await store.loadMetrics({ project_hash: projectHash });
      }
      const result = await api.getIssueMetricBindings({ issue_hash: issueHash });
      bindings.value = result ?? [];
      deltaByMetric.value = {};
      savedDeltaByMetric.value = {};
      for (const b of bindings.value) {
        deltaByMetric.value[b.metric_hash] = b.delta;
        savedDeltaByMetric.value[b.metric_hash] = b.delta;
      }
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  const buildBindingsPayload = () =>
    Object.entries(deltaByMetric.value)
      .map(([metric_hash, delta]) => ({
        metric_hash,
        delta: Number(delta),
      }))
      .filter((b) => !Number.isNaN(b.delta) && b.delta !== 0);

  const hasChanges = () => {
    const next = buildBindingsPayload();
    const prevHashes = Object.keys(savedDeltaByMetric.value).filter(
      (h) => savedDeltaByMetric.value[h] !== 0,
    );
    if (next.length !== prevHashes.length) return true;
    return next.some((b) => savedDeltaByMetric.value[b.metric_hash] !== b.delta);
  };

  const performSave = async () => {
    if (isSaving.value || !hasChanges()) return;
    isSaving.value = true;
    try {
      const metricBindings = buildBindingsPayload();
      const result = await api.setIssueMetricBindings({
        issue_hash: issueHash,
        bindings: metricBindings,
      });
      bindings.value = result ?? [];
      savedDeltaByMetric.value = {};
      for (const b of bindings.value) {
        savedDeltaByMetric.value[b.metric_hash] = b.delta;
      }
    } catch (error) {
      FailAlert(error);
    } finally {
      isSaving.value = false;
    }
  };

  const debounceSave = (delay = 800) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void performSave();
    }, delay);
  };

  const onDeltaChange = (metricHash: string, value: string | number | null) => {
    const numeric =
      typeof value === 'string' ? parseFloat(value) : value === null ? 0 : value;
    const valid = Number.isNaN(numeric) ? 0 : numeric;
    deltaByMetric.value[metricHash] = valid;
    debounceSave();
  };

  return {
    activeMetrics,
    deltaByMetric,
    bindings,
    isLoading,
    isSaving,
    loadAll,
    onDeltaChange,
  };
}
