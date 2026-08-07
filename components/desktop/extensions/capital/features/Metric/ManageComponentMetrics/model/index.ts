import { ref } from 'vue';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IArchiveComponentMetricInput } from 'app/extensions/capital/entities/ComponentMetric/model';
import { SuccessAlert, FailAlert } from 'src/shared/api';

/**
 * Чтение целей по мерам на компоненте.
 *
 * Создание метрик отсюда убрано. Меры перешли на централизованный справочник:
 * бэкенд требует measure_hash, а title и unit помечены «не используется»
 * (controller: create-component-metric-input.dto.ts). Форма же собирала
 * свободный текст и measure_hash не отправляла — то есть создание падало бы
 * на валидации. Вызывать её при этом было неоткуда: ComponentMetricsPanel
 * берёт только чтение, а завести цель можно в диалоге «План»
 * (SetPlanDialog), где выбор меры из справочника уже реализован.
 *
 * Убран именно мёртвый и сломанный путь; дублировать селектор меры здесь
 * незачем, пока панель остаётся только для просмотра.
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
