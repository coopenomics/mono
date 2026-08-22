import { ref } from 'vue';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IArchiveComponentMetricInput } from 'app/extensions/capital/entities/ComponentMetric/model';
import { SuccessAlert, FailAlert } from 'src/shared/api';

/**
 * Чтение целей по мерам на компоненте.
 *
 * Создание метрик отсюда убрано: цель заводится в диалоге «План»
 * (SetPlanDialog), где мера вписывается текстом. Панель остаётся
 * только для просмотра, дублировать ввод меры здесь незачем.
 */
export function useManageComponentMetrics(projectHash: string) {
  const store = useComponentMetricStore();
  const isLoading = ref(false);

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

  // Пока не вызывается из интерфейса, но, в отличие от создания, действие
  // рабочее: архивация идёт по metric_hash и справочника мер не касается.
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
    isLoading,
    metrics,
    loadMetrics,
    archiveMetric,
  };
}
