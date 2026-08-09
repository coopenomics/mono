import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { api } from '../api';
import type {
  IComponentMetric,
  IGetComponentMetricsInput,
} from './types';

const namespace = 'componentMetricStore';

interface IComponentMetricStore {
  metricsByProject: Ref<Record<string, IComponentMetric[]>>;
  loadMetrics: (data: IGetComponentMetricsInput) => Promise<void>;
  getMetricsByProject: (projectHash: string) => IComponentMetric[];
  addMetric: (metric: IComponentMetric) => void;
  updateMetric: (metric: IComponentMetric) => void;
  removeMetric: (metricHash: string, projectHash: string) => void;
}

export const useComponentMetricStore = defineStore(
  namespace,
  (): IComponentMetricStore => {
    const metricsByProject = ref<Record<string, IComponentMetric[]>>({});

    const loadMetrics = async (data: IGetComponentMetricsInput): Promise<void> => {
      const items = await api.getComponentMetrics(data);
      metricsByProject.value[data.project_hash] = items;
    };

    const getMetricsByProject = (projectHash: string): IComponentMetric[] => {
      return metricsByProject.value[projectHash] ?? [];
    };

    const addMetric = (metric: IComponentMetric): void => {
      const list = metricsByProject.value[metric.project_hash];
      if (list) {
        const idx = list.findIndex((m) => m.metric_hash === metric.metric_hash);
        if (idx !== -1) {
          list[idx] = metric;
        } else {
          list.unshift(metric);
        }
      } else {
        metricsByProject.value[metric.project_hash] = [metric];
      }
    };

    const updateMetric = (metric: IComponentMetric): void => {
      const list = metricsByProject.value[metric.project_hash];
      if (!list) return;
      const idx = list.findIndex((m) => m.metric_hash === metric.metric_hash);
      if (idx !== -1) list[idx] = metric;
    };

    const removeMetric = (metricHash: string, projectHash: string): void => {
      const list = metricsByProject.value[projectHash];
      if (!list) return;
      const idx = list.findIndex((m) => m.metric_hash === metricHash);
      if (idx !== -1) list.splice(idx, 1);
    };

    return {
      metricsByProject,
      loadMetrics,
      getMetricsByProject,
      addMetric,
      updateMetric,
      removeMetric,
    };
  },
);
