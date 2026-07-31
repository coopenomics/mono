import { ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model/store';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  ICreateComponentMetricInput,
  IArchiveComponentMetricInput,
} from 'app/extensions/capital/entities/ComponentMetric/model';
import { SuccessAlert, FailAlert } from 'src/shared/api';

export function useManageComponentMetrics(projectHash: string) {
  const store = useComponentMetricStore();
  const isSubmitting = ref(false);
  const isLoading = ref(false);

  const initialForm: ICreateComponentMetricInput = {
    coopname: '',
    project_hash: '',
    title: '',
    unit: '',
    target_value: 0,
    series_mode: Zeus.MetricSeriesMode.RATE,
  };

  const form = ref<ICreateComponentMetricInput>({ ...initialForm });

  const resetForm = () => {
    Object.assign(form.value, { ...initialForm });
  };

  const loadMetrics = async () => {
    isLoading.value = true;
    try {
      await store.loadMetrics({ project_hash: projectHash });
    } catch (error) {
      FailAlert(error);
    } finally {
      isLoading.value = false;
    }
  };

  const createMetric = async () => {
    const { info } = useSystemStore();
    isSubmitting.value = true;
    try {
      const data: ICreateComponentMetricInput = {
        coopname: info.coopname,
        project_hash: projectHash,
        title: form.value.title,
        unit: form.value.unit,
        target_value: Number(form.value.target_value),
        series_mode: form.value.series_mode,
        deadline: form.value.deadline,
      };
      const result = await api.createComponentMetric(data);
      store.addMetric(result);
      SuccessAlert('Метрика создана');
      resetForm();
    } catch (error) {
      FailAlert(error);
    } finally {
      isSubmitting.value = false;
    }
  };

  const archiveMetric = async (metricHash: string) => {
    try {
      const data: IArchiveComponentMetricInput = {
        metric_hash: metricHash,
      };
      const result = await api.archiveComponentMetric(data);
      store.updateMetric(result);
      SuccessAlert('Метрика архивирована');
    } catch (error) {
      FailAlert(error);
    }
  };

  const metrics = () => store.getMetricsByProject(projectHash);

  return {
    form,
    isSubmitting,
    isLoading,
    metrics,
    loadMetrics,
    createMetric,
    archiveMetric,
    resetForm,
  };
}
