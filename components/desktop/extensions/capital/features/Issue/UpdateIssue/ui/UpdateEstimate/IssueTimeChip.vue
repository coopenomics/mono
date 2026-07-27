<template lang="pug">
.issue-time-chip(@click.stop)
  .time-trigger(
    :class='{ readonly: isReadonly, empty: !hasAny }'
    role='button'
  )
    q-icon.time-icon(
      name='schedule'
      size='14px'
      :color='hasAny ? progressColor : "grey-6"'
    )
    span.time-text(v-if='hasAny') {{ inlineLabel }}

    q-tooltip(
      v-if='!menuOpen'
      anchor='bottom middle'
      self='top middle'
    ) {{ tooltipText }}

    q-menu(
      v-if='!isReadonly'
      v-model='menuOpen'
      anchor='bottom middle'
      self='top middle'
      :offset='[0, 6]'
    )
      .time-popup(@click.stop)
        .popup-header Время задачи

        .popup-row
          .popup-label План, ч
          q-input(
            v-model.number='estimateInput'
            type='number'
            :min='0'
            :step='0.5'
            dense
            outlined
            input-class='popup-input-text'
            class='popup-input'
            @keydown.enter='saveEstimate'
            @blur='saveEstimate'
          )

        .popup-row
          .popup-label Факт, ч
          .popup-readonly-value
            | {{ factDisplay }}
            q-tooltip Факт = сумма записей учёта времени (таймер / ручной ввод)

        .popup-progress(v-if='hasEstimate')
          q-linear-progress(
            :value='progressValue'
            :color='progressColor'
            track-color='grey-3'
            size='4px'
            rounded
          )
          .popup-progress-text {{ progressLabel }}

        .popup-hint Факт из записей времени. Добавить — в блоке «История рабочего времени».
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUpdateIssue } from '../../model';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';

interface Props {
  issueHash: string;
  /** Явный hash проекта/компонента — обязателен на вложенных списках мастерской, где в URL нет project_hash */
  projectHash?: string;
  estimate?: number | null;
  fact?: number | null;
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  estimate: 0,
  fact: 0,
  readonly: false,
});

const route = useRoute();
/** Prop приоритетнее роута: на projects-list route.params.project_hash пуст */
const resolvedProjectHash = computed(
  () => props.projectHash || (route.params.project_hash as string) || ''
);

const { saveImmediately } = useUpdateIssue();
const issueStore = useIssueStore();

const menuOpen = ref(false);
const estimateInput = ref<number>(props.estimate ?? 0);
/** Оптимистичное значение — сразу в чипе, пока стор не догонит */
const optimisticEstimate = ref<number | null>(null);
const isSaving = ref(false);

const displayEstimate = computed(
  () => optimisticEstimate.value ?? props.estimate ?? 0
);

watch(
  () => props.estimate,
  (v) => {
    estimateInput.value = v ?? 0;
    if (optimisticEstimate.value != null && optimisticEstimate.value === (v ?? 0)) {
      optimisticEstimate.value = null;
    }
  }
);

// Закрытие меню кликом снаружи часто не даёт blur на input — сохраняем явно
watch(menuOpen, (open, wasOpen) => {
  if (wasOpen && !open) {
    void saveEstimate();
  }
});

const isReadonly = computed(() => props.readonly);

/** Факт = сумма TimeEntry; без подстановки плана (562-14). */
const effectiveFact = computed(() => Number(props.fact) || 0);

const hasEstimate = computed(
  () =>
    displayEstimate.value != null &&
    !Number.isNaN(displayEstimate.value) &&
    displayEstimate.value > 0
);
const hasFact = computed(() => effectiveFact.value > 0);
const hasAny = computed(() => hasEstimate.value || hasFact.value);

function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h) || h <= 0) return '0ч';
  if (h < 8) {
    const rounded = h % 1 === 0 ? h : parseFloat(h.toFixed(2));
    return `${rounded}ч`;
  }
  const days = Math.round((h / 8) * 10) / 10;
  return `${days}д`;
}

const inlineLabel = computed(() => {
  if (hasFact.value && hasEstimate.value) {
    return `${formatHours(effectiveFact.value)} / ${formatHours(displayEstimate.value)}`;
  }
  if (hasFact.value) return formatHours(effectiveFact.value);
  if (hasEstimate.value) return formatHours(displayEstimate.value);
  return '';
});

const factDisplay = computed(() => formatHours(effectiveFact.value));

const progressValue = computed(() => {
  if (!hasEstimate.value) return 0;
  const ratio = effectiveFact.value / (displayEstimate.value || 1);
  return Math.min(1, Math.max(0, ratio));
});

const progressColor = computed(() => {
  if (!hasEstimate.value) return 'grey-6';
  const fact = effectiveFact.value;
  const est = displayEstimate.value;
  if (fact > est + 1e-6) return 'warning';
  return 'primary';
});

const progressLabel = computed(() => {
  if (!hasEstimate.value) return '';
  return `${formatHours(effectiveFact.value)} из ${formatHours(displayEstimate.value)}`;
});

const tooltipText = computed(() => {
  if (isReadonly.value) {
    if (hasAny.value) return `Время: ${inlineLabel.value}`;
    return 'Время не задано';
  }
  return 'Задать время';
});

const saveEstimate = async () => {
  const next = Number(estimateInput.value) || 0;
  const current = Number(props.estimate ?? 0);
  if (next === current) return;
  // blur + закрытие меню часто стреляют подряд — не дублируем уже отправленное
  if (optimisticEstimate.value === next) return;

  const projectHash = resolvedProjectHash.value;
  if (!projectHash) {
    console.error('IssueTimeChip: projectHash is empty, cannot save estimate');
    estimateInput.value = current;
    return;
  }

  optimisticEstimate.value = next;
  isSaving.value = true;
  try {
    // Discrete-действие (как смена статуса) — без debounce 2с
    await saveImmediately(
      { issue_hash: props.issueHash, estimate: next },
      projectHash
    );
    await issueStore.updateIssueByHash(projectHash, props.issueHash);
  } catch (error) {
    console.error('IssueTimeChip: failed to save estimate', error);
    optimisticEstimate.value = null;
    estimateInput.value = current;
  } finally {
    isSaving.value = false;
  }
};
</script>

<style lang="scss" scoped>
.issue-time-chip {
  display: inline-flex;
  align-items: center;
}

// Триггер живёт в фиксированной колонке строки (.cell-time) и
// прижимается к её правому краю — время всех уровней в одной вертикали.
.time-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding: 2px 6px;
  height: 22px;
  box-sizing: border-box;
  border-radius: 4px;
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  font-weight: 500;
  color: var(--p-ink-2);
  cursor: pointer;
  transition: background-color 0.12s ease;
  white-space: nowrap;
  overflow: hidden;

  &:hover:not(.readonly) {
    background-color: var(--p-surface-2);
  }

  &.readonly {
    cursor: default;
  }

  &.empty {
    color: var(--p-ink-3);
    justify-content: flex-start;
  }
}

.time-icon {
  flex-shrink: 0;
}

.time-text {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Inline editor popup
.time-popup {
  min-width: 240px;
  padding: 12px;
  background-color: var(--p-surface);
  border-radius: 8px;
}

.popup-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-ink-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.popup-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.popup-label {
  width: 64px;
  font-size: 12px;
  color: var(--p-ink-2);
}

.popup-input {
  flex: 1;
  :deep(.q-field__control) {
    height: 32px;
    min-height: 32px;
  }
  :deep(.popup-input-text) {
    font-size: 13px;
  }
}

.popup-readonly-value {
  flex: 1;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--p-ink);
}

.popup-progress {
  margin-top: 4px;
  margin-bottom: 8px;
}

.popup-progress-text {
  font-size: 11px;
  color: var(--p-ink-3);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.popup-hint {
  font-size: 10px;
  color: var(--p-ink-3);
  line-height: 1.3;
  font-style: italic;
}
</style>
