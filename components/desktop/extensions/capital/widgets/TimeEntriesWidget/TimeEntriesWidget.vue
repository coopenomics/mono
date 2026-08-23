<template lang="pug">
.time-entries(v-if="issueHash")
  .time-entries__live(v-if='timerActiveHere && openTimer')
    q-icon.time-entries__live-icon(
      :name='openTimer.is_paused ? "pause_circle" : "timer"'
      size='22px'
    )
    .time-entries__live-body
      .time-entries__live-clock.t-mono {{ clockLabel }}
      .time-entries__live-meta.t-sm.t-muted
        | {{ openTimer.is_paused ? 'пауза' : 'идёт' }}
        span(v-if='pendingFactLabel')  · накоплено {{ pendingFactLabel }}

  .time-entries__toolbar(v-if='canManageTime')
    BaseButton(
      size='sm'
      variant='secondary'
      :loading='worklogSaving'
      @click='openWorklogDialog'
    )
      template(#icon-left)
        q-icon(name='add', size='16px')
      | Добавить время

    BaseButton(
      size='sm'
      :variant='timerActiveHere ? "danger" : "primary"'
      :loading='timerBusy'
      @click='onToggleTimer'
    )
      template(#icon-left)
        q-icon(:name='timerActiveHere ? "stop" : "play_arrow"', size='16px')
      | {{ timerActiveHere ? 'Остановить таймер' : 'Включить таймер' }}

    BaseButton(
      v-if='timerActiveHere && openTimer'
      size='sm'
      variant='secondary'
      :loading='timerBusy'
      @click='onTogglePause'
    )
      template(#icon-left)
        q-icon(:name='openTimer.is_paused ? "play_arrow" : "pause"', size='16px')
      | {{ openTimer.is_paused ? 'Продолжить' : 'Пауза' }}

    span.time-entries__timer-hint.t-sm.t-muted(v-if='openTimer && !timerActiveHere')
      | Таймер уже идёт по другой задаче{{ openTimer.is_paused ? ' (пауза)' : '' }}

  .time-entries__empty.t-sm.t-muted(v-if="!loading && !rows.length")
    | Записей рабочего времени пока нет

  .time-entries__list(v-else-if="rows.length")
    .time-entries__row(v-for="row in rows", :key="row._id")
      .time-entries__who {{ contributorLabel(row.contributor_hash) }}
      .time-entries__meta
        span.time-entries__hours {{ formatHours(row.hours) }}
        span.time-entries__sep ·
        span.time-entries__date {{ formatDate(row.date) }}
        template(v-if='entryTypeLabel(row.entry_type)')
          span.time-entries__sep ·
          span.time-entries__type {{ entryTypeLabel(row.entry_type) }}
      BaseBadge.time-entries__commit(v-if="row.commit_hash", variant="accent")
        | {{ String(row.commit_hash).substring(0, 8) }}

  .row.justify-center.q-py-sm(v-if="loading")
    q-spinner(color="primary", size="24px")

  BaseDialog(
    v-model='showWorklogDialog',
    title='Добавить время',
    size='sm'
  )
    BaseForm(:loading='worklogSaving', @submit='submitWorklog')
      BaseInput(
        v-model='worklogHours'
        type='number'
        label='Часы'
        hint='Фактические часы по этой задаче'
        suffix='ч'
        required
        :error='worklogError'
      )
    template(#footer)
      BaseButton(variant='ghost', type='button', @click='closeWorklogDialog') Отменить
      BaseButton(
        variant='primary'
        type='button'
        :loading='worklogSaving'
        :disabled='!isWorklogValid'
        @click='submitWorklog'
      ) Добавить
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model'
import { useIssueTimeTracking } from 'app/extensions/capital/features/Issue/TrackTime'
import { formatHours } from 'src/shared/lib/utils'
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base'

const props = defineProps<{
  issueHash: string
  coopname?: string
  username?: string
  /** Исполнители задачи (username). Без списка кнопки таймера скрыты. */
  creators?: string[] | null
}>()

const { info } = useSystemStore()
const session = useSessionStore()
const contributorStore = useContributorStore()

const showWorklogDialog = ref(false)
const worklogHours = ref<string | number>('1')
const worklogError = ref('')

const coopname = computed(() => props.coopname || info.coopname)
const username = computed(() => props.username || session.username)

const myContributorHash = computed(() => {
  const me = (username.value || '').toLowerCase()
  for (const c of contributorStore.contributors?.items ?? []) {
    if (String(c.username || '').toLowerCase() === me) return c.contributor_hash as string
  }
  return ''
})

// Таймер и записи времени живут в общем composable — та же логика работает во
// всплывающем чипе времени в строке задачи, и состояние между ними не расходится.
const {
  rows,
  loading,
  timerBusy,
  worklogSaving,
  openTimer,
  timerActiveHere,
  isPaused,
  clockLabel,
  pendingFactHours,
  canManageTime,
  reload,
  addWorklog,
  toggleTimer,
  togglePause,
} = useIssueTimeTracking({
  issueHash: () => props.issueHash,
  creators: () => props.creators,
  coopname,
  username,
  contributorHash: myContributorHash,
  immediate: true,
})

const pendingFactLabel = computed(() => {
  if (pendingFactHours.value <= 0) return ''
  return formatHours(pendingFactHours.value)
})

const isWorklogValid = computed(() => {
  const hours = Number(String(worklogHours.value).replace(',', '.'))
  return Number.isFinite(hours) && hours > 0
})

const contributorByHash = computed(() => {
  const map = new Map<string, string>()
  for (const c of contributorStore.contributors?.items ?? []) {
    if (c.contributor_hash) {
      map.set(c.contributor_hash, c.display_name || c.username || c.contributor_hash)
    }
  }
  return map
})

const contributorLabel = (hash?: string) => {
  if (!hash) return 'Участник'
  return contributorByHash.value.get(hash) || `${hash.slice(0, 8)}…`
}

const entryTypeLabel = (type?: unknown) => {
  switch (type) {
    case 'manual':
      return 'вручную'
    case 'timer':
      return 'таймер'
    case 'estimate':
      return 'оценка'
    case 'hourly':
      return 'учёт'
    default:
      return ''
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const openWorklogDialog = () => {
  worklogHours.value = '1'
  worklogError.value = ''
  showWorklogDialog.value = true
}

const closeWorklogDialog = () => {
  showWorklogDialog.value = false
  worklogError.value = ''
}

const submitWorklog = async () => {
  const hours = Number(String(worklogHours.value).replace(',', '.'))
  if (!Number.isFinite(hours) || hours <= 0) {
    worklogError.value = 'Укажите положительное число часов'
    return
  }
  worklogError.value = ''
  try {
    await addWorklog(hours)
    SuccessAlert('Время добавлено')
    closeWorklogDialog()
  } catch (error) {
    console.error(error)
    FailAlert(error, 'Не удалось добавить время')
  }
}

const onToggleTimer = async () => {
  const wasRunning = timerActiveHere.value
  try {
    await toggleTimer()
    SuccessAlert(wasRunning ? 'Таймер остановлен' : 'Таймер включён')
  } catch (error) {
    console.error(error)
    FailAlert(error)
  }
}

const onTogglePause = async () => {
  const wasPaused = isPaused.value
  try {
    await togglePause()
    SuccessAlert(wasPaused ? 'Таймер продолжен' : 'Таймер на паузе')
  } catch (error) {
    console.error(error)
    FailAlert(error)
  }
}

onMounted(async () => {
  if (!contributorStore.contributors?.items?.length) {
    try {
      await contributorStore.loadContributors({})
    } catch {
      // имена подтянем позже
    }
  }
  try {
    await reload()
  } catch (error) {
    console.error('Ошибка при загрузке записей времени:', error)
    FailAlert('Не удалось загрузить записи времени')
  }
})
</script>

<style lang="scss" scoped>
.time-entries__live {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-bottom: var(--p-3);
  padding: var(--p-3);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
}

.time-entries__live-icon {
  color: var(--p-primary);
  flex-shrink: 0;
}

.time-entries__live-body {
  min-width: 0;
}

.time-entries__live-clock {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.time-entries__live-meta {
  color: var(--p-ink-3);
}

.time-entries__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2);
  margin-bottom: var(--p-2);
}

.time-entries__timer-hint {
  color: var(--p-ink-3);
}

.time-entries__empty {
  padding: var(--p-2) 0;
}

.time-entries__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.time-entries__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--p-2);
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);

  &:last-child {
    border-bottom: 0;
  }
}

.time-entries__who {
  font-weight: 500;
  color: var(--p-ink);
  min-width: 8rem;
}

.time-entries__meta {
  color: var(--p-ink-2);
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}

.time-entries__hours {
  color: var(--p-ink);
  font-weight: 500;
}

.time-entries__sep {
  opacity: 0.5;
}

.time-entries__type {
  color: var(--p-ink-3);
}

.time-entries__commit {
  margin-left: auto;
}
</style>
