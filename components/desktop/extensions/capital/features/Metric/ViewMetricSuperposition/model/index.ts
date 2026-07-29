import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  IMetricSuperpositionFrame,
  IMetricSuperpositionHistory,
} from 'app/extensions/capital/entities/ComponentMetric/model';
import { FailAlert } from 'src/shared/api';

const EPS = 1e-6;

/** Первый кадр, где уже есть факт/движение — без пустого «хвоста» до появления данных. */
function firstDataFrameIndex(frames: IMetricSuperpositionFrame[]): number {
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (Math.abs(f.fact_sum) > EPS) return i;
    if (f.activity > EPS || f.growth > EPS) return i;
    if (f.items?.some((it) => Math.abs(it.fact) > EPS || it.amplitude > EPS)) {
      return i;
    }
  }
  return Math.max(0, frames.length - 1);
}

export function useMetricSuperposition(projectHash: () => string) {
  const history = ref<IMetricSuperpositionHistory | null>(null);
  const isLoading = ref(false);
  const period = ref(Zeus.MetricSeriesPeriod.DAY);
  const frameIndex = ref(0);

  /** Кадры от начала данных до сейчас (без пустого префикса окна периода). */
  const frames = computed(() => {
    const raw = history.value?.frames ?? [];
    if (raw.length <= 1) return raw;
    const start = firstDataFrameIndex(raw);
    return raw.slice(start);
  });

  const frame = computed<IMetricSuperpositionFrame | null>(() => {
    const list = frames.value;
    if (!list.length) return null;
    const idx = Math.max(0, Math.min(frameIndex.value, list.length - 1));
    return list[idx] ?? null;
  });

  /** Кадр как срез резонанса для мишени и статов */
  const data = computed(() => {
    const f = frame.value;
    const h = history.value;
    if (!f || !h) return null;
    return {
      project_hash: h.project_hash,
      period: h.period,
      fact_sum: f.fact_sum,
      target_sum: f.target_sum,
      up_count: f.up_count,
      down_count: f.down_count,
      flat_count: f.flat_count,
      activity: f.activity,
      coherence: f.coherence,
      balance: f.balance,
      growth: f.growth,
      resultant_re: f.resultant_re,
      resultant_im: f.resultant_im,
      resultant_magnitude: f.resultant_magnitude,
      resultant_angle: f.resultant_angle,
      items: f.items,
      components: [],
      disclaimer: '',
    };
  });

  const load = async () => {
    const hash = projectHash();
    if (!hash) return;
    isLoading.value = true;
    try {
      history.value = await api.getMetricSuperpositionHistory({
        project_hash: hash,
        period: period.value,
      });
      const raw = history.value.frames ?? [];
      const start = raw.length ? firstDataFrameIndex(raw) : 0;
      const trimmedLen = Math.max(0, raw.length - start);
      frameIndex.value = Math.max(0, trimmedLen - 1);
    } catch (error) {
      FailAlert(error);
      history.value = null;
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

  return {
    data,
    history,
    frames,
    frame,
    frameIndex,
    isLoading,
    period,
    load,
  };
}
