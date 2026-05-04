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
            q-tooltip Факт фиксируется автоматически из учёта рабочего времени

        .popup-progress(v-if='hasEstimate')
          q-linear-progress(
            :value='progressValue'
            :color='progressColor'
            track-color='grey-3'
            size='4px'
            rounded
          )
          .popup-progress-text {{ progressLabel }}

        .popup-hint Факт нельзя задать вручную — он считается из учёта времени.
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUpdateIssue } from '../../model';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';

interface Props {
  issueHash: string;
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
const projectHash = computed(() => route.params.project_hash as string);

const { debounceSave } = useUpdateIssue();
const issueStore = useIssueStore();

const menuOpen = ref(false);
const estimateInput = ref<number>(props.estimate ?? 0);

watch(
  () => props.estimate,
  (v) => {
    estimateInput.value = v ?? 0;
  }
);

const isReadonly = computed(() => props.readonly);

const hasEstimate = computed(
  () => props.estimate != null && !Number.isNaN(props.estimate) && (props.estimate as number) > 0
);
const hasFact = computed(
  () => props.fact != null && !Number.isNaN(props.fact) && (props.fact as number) > 0
);
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
    return `${formatHours(props.fact)}/${formatHours(props.estimate)}`;
  }
  if (hasFact.value) return formatHours(props.fact);
  if (hasEstimate.value) return formatHours(props.estimate);
  return '';
});

const factDisplay = computed(() =>
  hasFact.value ? formatHours(props.fact) : '—'
);

const progressValue = computed(() => {
  if (!hasEstimate.value) return 0;
  const ratio = (props.fact ?? 0) / (props.estimate ?? 1);
  return Math.min(1, Math.max(0, ratio));
});

const progressColor = computed(() => {
  if (!hasEstimate.value) return 'grey-6';
  const fact = props.fact ?? 0;
  const est = props.estimate ?? 0;
  if (fact > est + 1e-6) return 'orange-7';
  return 'teal-7';
});

const progressLabel = computed(() => {
  if (!hasEstimate.value) return '';
  const fact = props.fact ?? 0;
  const est = props.estimate ?? 0;
  return `${formatHours(fact)} из ${formatHours(est)}`;
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
  try {
    await debounceSave(
      { issue_hash: props.issueHash, estimate: next },
      projectHash.value
    );
    await issueStore.updateIssueByHash(projectHash.value, props.issueHash);
  } catch (error) {
    console.error('IssueTimeChip: failed to save estimate', error);
    estimateInput.value = current;
  }
};
</script>

<style lang="scss" scoped>
.issue-time-chip {
  display: inline-flex;
  align-items: center;
}

// Триггер фиксированной ширины — title не прыгает между задачами
// с разными значениями времени.
.time-trigger {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  height: 22px;
  width: 86px;
  box-sizing: border-box;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--q-grey-7, #616161);
  cursor: pointer;
  transition: background-color 0.12s ease;
  white-space: nowrap;
  overflow: hidden;

  &:hover:not(.readonly) {
    background-color: rgba(0, 0, 0, 0.04);
  }

  &.readonly {
    cursor: default;
  }

  &.empty {
    color: var(--q-grey-6, #757575);
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
  background-color: var(--q-color-white, #fff);
  border-radius: 8px;
}

.popup-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--q-grey-7, #616161);
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
  color: var(--q-grey-7, #616161);
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
  color: var(--q-grey-8, #424242);
}

.popup-progress {
  margin-top: 4px;
  margin-bottom: 8px;
}

.popup-progress-text {
  font-size: 11px;
  color: var(--q-grey-6, #757575);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.popup-hint {
  font-size: 10px;
  color: var(--q-grey-6, #757575);
  line-height: 1.3;
  font-style: italic;
}
</style>
