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
      @click='toggleTimer'
    )
      template(#icon-left)
        q-icon(:name='timerActiveHere ? "stop" : "play_arrow"', size='16px')
      | {{ timerActiveHere ? 'Остановить таймер' : 'Включить таймер' }}

    BaseButton(
      v-if='timerActiveHere && openTimer'
      size='sm'
      variant='secondary'
      :loading='timerBusy'
      @click='togglePause'
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useTimeEntriesStore } from 'app/extensions/capital/entities/TimeEntries/model'
import type { ITimeEntriesPagination } from 'app/extensions/capital/entities/TimeEntries/model/types'
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model'
import { formatHours } from 'src/shared/lib/utils'
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base'

type OpenTimerSession = {
  issue_hash?: string
  _id?: string
  is_paused?: boolean
  started_at?: string | Date
  paused_at?: string | Date | null
  total_paused_ms?: number
  elapsed_seconds?: number
}

const props = defineProps<{
  issueHash: string
  coopname?: string
  username?: string
  /** Исполнители задачи (username). Без списка кнопки таймера скрыты. */
  creators?: string[] | null
}>()

const { info } = useSystemStore()
const session = useSessionStore()
const timeEntriesStore = useTimeEntriesStore()
const contributorStore = useContributorStore()

// Тип из SDK, а не Record<string, unknown>: иначе каждое поле записи —
// unknown, и обращения в шаблоне не проходят проверку типов.
const timeEntries = ref<ITimeEntriesPagination | null>(null)
const loading = ref(false)
const worklogSaving = ref(false)
const timerBusy = ref(false)
const openTimer = ref<OpenTimerSession | null>(null)
const tickNow = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const showWorklogDialog = ref(false)
const worklogHours = ref<string | number>('1')
const worklogError = ref('')

const rows = computed(() => timeEntries.value?.items ?? [])
const coopname = computed(() => props.coopname || info.coopname)
const username = computed(() => props.username || session.username)

const canManageTime = computed(() => {
  const creators = props.creators
  if (creators == null) return true
  const me = (username.value || '').toLowerCase()
  if (!me) return false
  return creators.some((c) => String(c).toLowerCase() === me)
})

const timerActiveHere = computed(
  () => !!openTimer.value?.issue_hash && openTimer.value.issue_hash.toLowerCase() === props.issueHash.toLowerCase()
)

const myContributorHash = computed(() => {
  const me = (username.value || '').toLowerCase()
  for (const c of contributorStore.contributors?.items ?? []) {
    if (String(c.username || '').toLowerCase() === me) return c.contributor_hash as string
  }
  return ''
})

const displayElapsedSeconds = computed(() => {
  if (!timerActiveHere.value || !openTimer.value) return 0
  if (openTimer.value.is_paused) return Math.max(0, Number(openTimer.value.elapsed_seconds || 0))
  const startedAt = new Date(openTimer.value.started_at || 0).getTime()
  if (!startedAt) return Math.max(0, Number(openTimer.value.elapsed_seconds || 0))
  const totalPaused = Number(openTimer.value.total_paused_ms || 0)
  return Math.max(0, Math.floor((tickNow.value - startedAt - totalPaused) / 1000))
})

const clockLabel = computed(() => formatClock(displayElapsedSeconds.value))

/** Незакоммиченный факт по задаче + живой тик текущего таймера (если здесь). */
const pendingFactHours = computed(() => {
  const hash = myContributorHash.value
  let sum = 0
  for (const row of rows.value) {
    if (row.is_committed) continue
    if (hash && row.contributor_hash && String(row.contributor_hash) !== hash) continue
    sum += Number(row.hours || 0)
  }
  if (timerActiveHere.value) {
    sum += displayElapsedSeconds.value / 3600
  }
  return sum
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

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function syncTick() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  if (timerActiveHere.value && openTimer.value && !openTimer.value.is_paused) {
    tickNow.value = Date.now()
    tickTimer = setInterval(() => {
      tickNow.value = Date.now()
    }, 1000)
  }
}

const loadTimeEntries = async () => {
  if (!props.issueHash) return
  loading.value = true
  try {
    const entries = await timeEntriesStore.loadTimeEntries({
      filter: {
        coopname: coopname.value,
        issue_hash: props.issueHash,
        username: props.username,
      },
      options: {
        page: 1,
        limit: 100,
        sortBy: '_created_at',
        sortOrder: 'DESC',
      },
    })
    timeEntries.value = entries
  } catch (error) {
    console.error('Ошибка при загрузке записей времени:', error)
    FailAlert('Не удалось загрузить записи времени')
  } finally {
    loading.value = false
  }
}

const refreshOpenTimer = async () => {
  if (!username.value || !coopname.value) return
  try {
    openTimer.value = (await timeEntriesStore.getOpenTimer({
      coopname: coopname.value,
      username: username.value,
    })) as OpenTimerSession | null
    tickNow.value = Date.now()
    syncTick()
  } catch {
    openTimer.value = null
    syncTick()
  }
}

const togglePause = async () => {
  if (!canManageTime.value || !openTimer.value || !timerActiveHere.value) return
  timerBusy.value = true
  try {
    if (openTimer.value.is_paused) {
      openTimer.value = (await timeEntriesStore.resumeTimer({
        coopname: coopname.value,
        username: username.value,
      })) as OpenTimerSession
      SuccessAlert('Таймер продолжен')
    } else {
      openTimer.value = (await timeEntriesStore.pauseTimer({
        coopname: coopname.value,
        username: username.value,
      })) as OpenTimerSession
      SuccessAlert('Таймер на паузе')
    }
    tickNow.value = Date.now()
    syncTick()
  } catch (error) {
    console.error(error)
    FailAlert(error)
  } finally {
    timerBusy.value = false
  }
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
  worklogSaving.value = true
  try {
    await timeEntriesStore.addWorklog({
      coopname: coopname.value,
      username: username.value,
      issue_hash: props.issueHash,
      hours,
    })
    SuccessAlert('Время добавлено')
    closeWorklogDialog()
    await loadTimeEntries()
  } catch (error) {
    console.error(error)
    FailAlert(error, 'Не удалось добавить время')
  } finally {
    worklogSaving.value = false
  }
}

const toggleTimer = async () => {
  if (!canManageTime.value) return
  timerBusy.value = true
  try {
    if (timerActiveHere.value) {
      await timeEntriesStore.stopTimer({
        coopname: coopname.value,
        username: username.value,
      })
      SuccessAlert('Таймер остановлен')
    } else {
      openTimer.value = (await timeEntriesStore.startTimer({
        coopname: coopname.value,
        username: username.value,
        issue_hash: props.issueHash,
      })) as OpenTimerSession
      SuccessAlert('Таймер включён')
    }
    await refreshOpenTimer()
    await loadTimeEntries()
  } catch (error) {
    console.error(error)
    FailAlert(error)
  } finally {
    timerBusy.value = false
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
  await Promise.all([loadTimeEntries(), refreshOpenTimer()])
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

watch(
  () => props.issueHash,
  () => {
    loadTimeEntries()
    refreshOpenTimer()
  },
)

watch(timerActiveHere, () => syncTick())
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
