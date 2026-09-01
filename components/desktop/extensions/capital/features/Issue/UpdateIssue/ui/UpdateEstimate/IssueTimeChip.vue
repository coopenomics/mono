<template lang="pug">
.issue-time-chip(@click.stop)
  .time-trigger(
    :class='{ readonly: isReadonly, empty: !hasAny, running: timerActiveHere }'
    role='button'
  )
    q-icon.time-icon(
      :name='timerActiveHere ? (isPaused ? "pause_circle" : "timer") : "schedule"'
      size='14px'
      :color='triggerIconColor'
    )
    span.time-text(v-if='hasAny') {{ inlineLabel }}

    q-tooltip(
      v-if='!menuOpen'
      anchor='bottom middle'
      self='top middle'
    ) {{ tooltipText }}

    q-menu(
      v-if='!isMenuDisabled'
      v-model='menuOpen'
      anchor='bottom middle'
      self='top middle'
      :offset='[0, 6]'
    )
      .time-popup(@click.stop)
        .popup-header Время задачи

        .popup-row
          .popup-label План, ч
          BaseInput.popup-input(
            v-if='!isReadonly'
            v-model='estimateInput'
            type='number'
            flat
            @keydown.enter='saveEstimate'
            @blur='saveEstimate'
          )
          .popup-readonly-value(v-else) {{ formatHours(displayEstimate) }}

        .popup-row
          .popup-label Факт, ч
          .popup-readonly-value
            | {{ factDisplay }}
            span.popup-live(v-if='timerActiveHere')  +{{ clockLabel }}
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

        template(v-if='canManageTime')
          q-separator.popup-sep

          .popup-timer(v-if='timerActiveHere')
            q-icon(
              :name='isPaused ? "pause_circle" : "timer"'
              size='18px'
              :color='isPaused ? "warning" : "primary"'
            )
            .popup-timer-clock.t-mono {{ clockLabel }}
            .popup-timer-state {{ isPaused ? 'пауза' : 'идёт' }}

          .popup-actions
            BaseButton(
              size='sm'
              :variant='timerActiveHere ? "danger" : "primary"'
              :loading='timerBusy'
              :disabled='timerBusyElsewhere'
              @click='onToggleTimer'
            )
              template(#icon-left)
                q-icon(:name='timerActiveHere ? "stop" : "play_arrow"', size='14px')
              | {{ timerActiveHere ? 'Стоп' : 'Таймер' }}

            BaseButton(
              v-if='timerActiveHere'
              size='sm'
              variant='secondary'
              :loading='timerBusy'
              @click='onTogglePause'
            )
              template(#icon-left)
                q-icon(:name='isPaused ? "play_arrow" : "pause"', size='14px')
              | {{ isPaused ? 'Продолжить' : 'Пауза' }}

            BaseButton(
              v-if='!addFormOpen'
              size='sm'
              variant='ghost'
              @click='openAddForm'
            )
              template(#icon-left)
                q-icon(name='add', size='14px')
              | Факт

          .popup-hint(v-if='timerBusyElsewhere')
            | Таймер уже идёт по другой задаче{{ isPaused ? ' (пауза)' : '' }}

          .popup-add(v-if='addFormOpen')
            BaseInput.popup-add-input(
              v-model='worklogHours'
              type='number'
              flat
              autofocus
              suffix='ч'
              @keydown.enter='submitWorklog'
            )
            BaseButton(
              size='sm'
              variant='primary'
              :loading='worklogSaving'
              :disabled='!isWorklogValid'
              @click='submitWorklog'
            ) Добавить
            BaseButton(
              size='sm'
              variant='ghost'
              icon-only
              aria-label='Отменить'
              @click='closeAddForm'
            )
              q-icon(name='close', size='14px')

          .popup-error(v-if='worklogError') {{ worklogError }}

        q-separator.popup-sep(v-if='recentEntries.length')

        .popup-entries(v-if='recentEntries.length')
          .popup-entries-title Последние записи
          .popup-entry(v-for='entry in recentEntries', :key='entry._id')
            span.popup-entry-hours {{ formatHours(Number(entry.hours) || 0) }}
            span.popup-entry-sep ·
            span.popup-entry-date {{ formatEntryDate(entry.date) }}
            span.popup-entry-type(v-if='entryTypeLabel(entry.entry_type)') {{ entryTypeLabel(entry.entry_type) }}

        .popup-loading(v-else-if='entriesLoading')
          q-spinner(color='primary', size='16px')

        .popup-hint(v-else-if='!canManageTime')
          | Записи времени добавляют исполнители задачи.
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUpdateIssue } from '../../model';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';
import { useIssueTimeTracking } from 'app/extensions/capital/features/Issue/TrackTime';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseInput } from 'src/shared/ui/base';

interface Props {
  issueHash: string;
  /** Явный hash проекта/компонента — обязателен на вложенных списках мастерской, где в URL нет project_hash */
  // null допустим: у свободной задачи проекта нет (IIssue.project_hash
  // приходит из GraphQL как string | null). Пустое значение компонент
  // обрабатывает сам — ниже по коду.
  projectHash?: string | null;
  estimate?: number | null;
  fact?: number | null;
  /** Исполнители задачи — по ним решается, доступны ли таймер и добавление факта */
  creators?: string[] | null;
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
const estimateInput = ref<number | string>(props.estimate ?? 0);
/** Оптимистичное значение — сразу в чипе, пока стор не догонит */
const optimisticEstimate = ref<number | null>(null);
const isSaving = ref(false);

const addFormOpen = ref(false);
const worklogHours = ref<string | number>('1');
const worklogError = ref('');

// Записи и таймер грузятся лениво: чип рендерится в каждой строке списка задач,
// поэтому до открытия меню сеть не трогаем (кроме общей сессии таймера — она
// одна на пользователя и приезжает единственным дедуплицированным запросом).
const {
  rows,
  loading: entriesLoading,
  timerBusy,
  worklogSaving,
  timerActiveHere,
  timerBusyElsewhere,
  isPaused,
  clockLabel,
  factHours,
  canManageTime,
  loaded: entriesLoaded,
  ensureLoaded,
  refreshOpenTimer,
  addWorklog,
  toggleTimer,
  togglePause,
} = useIssueTimeTracking({
  issueHash: () => props.issueHash,
  creators: () => props.creators,
});

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
  if (open) {
    void ensureLoaded().catch((error) => {
      console.error('IssueTimeChip: failed to load time entries', error);
    });
    return;
  }
  if (wasOpen) {
    closeAddForm();
    void saveEstimate();
  }
});

const isReadonly = computed(() => props.readonly);
/** Меню открывается и ради факта: смотреть/добавлять время можно и без права на план. */
const isMenuDisabled = computed(() => isReadonly.value && !canManageTime.value);

/** Пока записи не загружены — опираемся на факт из задачи, дальше на сумму записей. */
const effectiveFact = computed(() =>
  entriesLoaded.value ? factHours.value : Number(props.fact) || 0
);

const hasEstimate = computed(() => {
  const value = Number(displayEstimate.value);
  return Number.isFinite(value) && value > 0;
});
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
    return `${formatHours(effectiveFact.value)} / ${formatHours(Number(displayEstimate.value))}`;
  }
  if (hasFact.value) return formatHours(effectiveFact.value);
  if (hasEstimate.value) return formatHours(Number(displayEstimate.value));
  return '';
});

const factDisplay = computed(() => formatHours(effectiveFact.value));

const progressValue = computed(() => {
  if (!hasEstimate.value) return 0;
  const ratio = effectiveFact.value / (Number(displayEstimate.value) || 1);
  return Math.min(1, Math.max(0, ratio));
});

const progressColor = computed(() => {
  if (!hasEstimate.value) return 'grey-6';
  if (effectiveFact.value > Number(displayEstimate.value) + 1e-6) return 'warning';
  return 'primary';
});

const triggerIconColor = computed(() => {
  if (timerActiveHere.value) return isPaused.value ? 'warning' : 'primary';
  return hasAny.value ? progressColor.value : 'grey-6';
});

const progressLabel = computed(() => {
  if (!hasEstimate.value) return '';
  return `${formatHours(effectiveFact.value)} из ${formatHours(Number(displayEstimate.value))}`;
});

const tooltipText = computed(() => {
  if (timerActiveHere.value) {
    return isPaused.value ? 'Таймер на паузе' : 'Таймер идёт';
  }
  if (isMenuDisabled.value) {
    if (hasAny.value) return `Время: ${inlineLabel.value}`;
    return 'Время не задано';
  }
  return 'Время задачи: план, факт, таймер';
});

/** В строке списка достаточно трёх крайних записей — остальное на странице задачи. */
const recentEntries = computed(() => rows.value.slice(0, 3));

const entryTypeLabel = (type?: unknown) => {
  switch (type) {
    case 'manual':
      return 'вручную';
    case 'timer':
      return 'таймер';
    case 'estimate':
      return 'оценка';
    case 'hourly':
      return 'учёт';
    default:
      return '';
  }
};

const formatEntryDate = (date?: string | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
};

const isWorklogValid = computed(() => {
  const hours = Number(String(worklogHours.value).replace(',', '.'));
  return Number.isFinite(hours) && hours > 0;
});

const openAddForm = () => {
  worklogHours.value = '1';
  worklogError.value = '';
  addFormOpen.value = true;
};

const closeAddForm = () => {
  addFormOpen.value = false;
  worklogError.value = '';
};

/** Факт задачи считает backend — после записи времени перечитываем саму задачу. */
const refreshIssueFact = async () => {
  const projectHash = resolvedProjectHash.value;
  if (!projectHash) return;
  try {
    await issueStore.updateIssueByHash(projectHash, props.issueHash);
  } catch (error) {
    console.error('IssueTimeChip: failed to refresh issue fact', error);
  }
};

const submitWorklog = async () => {
  const hours = Number(String(worklogHours.value).replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) {
    worklogError.value = 'Укажите положительное число часов';
    return;
  }
  worklogError.value = '';
  try {
    await addWorklog(hours);
    SuccessAlert('Время добавлено');
    closeAddForm();
    await refreshIssueFact();
  } catch (error) {
    console.error(error);
    FailAlert(error, 'Не удалось добавить время');
  }
};

const onToggleTimer = async () => {
  const wasRunning = timerActiveHere.value;
  try {
    await toggleTimer();
    SuccessAlert(wasRunning ? 'Таймер остановлен' : 'Таймер включён');
    if (wasRunning) await refreshIssueFact();
  } catch (error) {
    console.error(error);
    FailAlert(error);
  }
};

const onTogglePause = async () => {
  const wasPaused = isPaused.value;
  try {
    await togglePause();
    SuccessAlert(wasPaused ? 'Таймер продолжен' : 'Таймер на паузе');
  } catch (error) {
    console.error(error);
    FailAlert(error);
  }
};

const saveEstimate = async () => {
  if (isReadonly.value) return;
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

// Идущий таймер видно прямо в строке списка. Запрос один на всё приложение:
// сессия у участника одна, стор дедуплицирует одновременные обращения.
onMounted(() => {
  void refreshOpenTimer(false);
});
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
  border-radius: var(--p-r-sm);
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

  // Идущий таймер видно, не открывая меню
  &.running {
    background-color: var(--p-primary-soft);
    color: var(--p-primary);
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
  min-width: 268px;
  padding: var(--p-3);
  background-color: var(--p-surface);
  border-radius: var(--p-r-sm);
}

.popup-header {
  font-size: var(--p-fs-eyebrow);
  font-weight: 600;
  color: var(--p-ink-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--p-2);
}

.popup-row {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}

.popup-label {
  width: 64px;
  flex-shrink: 0;
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.popup-input {
  flex: 1;
  min-width: 0;
}

.popup-readonly-value {
  flex: 1;
  font-size: var(--p-fs-body-sm);
  font-variant-numeric: tabular-nums;
  color: var(--p-ink);
}

.popup-live {
  color: var(--p-primary);
  font-family: var(--p-mono);
}

.popup-progress {
  margin-top: var(--p-1);
  margin-bottom: var(--p-2);
}

.popup-progress-text {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-top: var(--p-1);
  font-variant-numeric: tabular-nums;
}

.popup-sep {
  margin: var(--p-2) 0;
}

.popup-timer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-bottom: var(--p-2);
}

.popup-timer-clock {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}

.popup-timer-state {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
}

.popup-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2);
}

.popup-add {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-2);
}

.popup-add-input {
  width: 84px;
  flex-shrink: 0;
}

.popup-error {
  margin-top: var(--p-1);
  font-size: var(--p-fs-eyebrow);
  color: var(--p-neg);
}

.popup-entries {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.popup-entries-title {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}

.popup-entry {
  display: flex;
  align-items: baseline;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  font-variant-numeric: tabular-nums;
}

.popup-entry-hours {
  color: var(--p-ink);
  font-weight: 500;
}

.popup-entry-sep {
  opacity: 0.5;
}

.popup-entry-type {
  margin-left: auto;
  color: var(--p-ink-3);
}

.popup-loading {
  display: flex;
  justify-content: center;
  padding: var(--p-2) 0;
}

.popup-hint {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  line-height: 1.3;
}
</style>
