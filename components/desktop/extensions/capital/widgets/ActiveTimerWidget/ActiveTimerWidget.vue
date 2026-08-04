<template lang="pug">
BaseCard.active-timer(variant='flat')
  .active-timer__row(v-if='!loading && !session')
    .active-timer__icon.active-timer__icon--idle
      q-icon(name='timer', size='28px')
    .active-timer__copy
      .active-timer__label.t-sm.t-muted Таймер
      .active-timer__empty-title Сейчас ничего не учитывается
      .active-timer__empty-body.t-sm.t-muted
        | Выберите задачу в мастерской и включите таймер на ней.

  .active-timer__row(v-else-if='session')
    .active-timer__icon(:class='{ "active-timer__icon--paused": session.is_paused }')
      q-icon(:name='session.is_paused ? "pause_circle" : "timer"', size='28px')
    .active-timer__main
      .active-timer__head
        .active-timer__label.t-sm.t-muted Таймер
        BaseBadge(:variant='session.is_paused ? "warn" : "accent"')
          | {{ session.is_paused ? 'пауза' : 'идёт' }}
      button.active-timer__task-link(@click='goToIssue') {{ taskTitle }}
      .active-timer__clock.t-mono {{ clockLabel }}
    .active-timer__actions
      BaseButton(
        v-if='session.is_paused'
        size='sm'
        variant='primary'
        :loading='busy'
        @click='onResume'
      )
        template(#icon-left)
          q-icon(name='play_arrow', size='16px')
        | Продолжить
      BaseButton(
        v-else
        size='sm'
        variant='secondary'
        :loading='busy'
        @click='onPause'
      )
        template(#icon-left)
          q-icon(name='pause', size='16px')
        | Пауза
      BaseButton(
        size='sm'
        variant='danger'
        :loading='busy'
        @click='onStop'
      )
        template(#icon-left)
          q-icon(name='stop', size='16px')
        | Стоп

  .active-timer__loading(v-if='loading')
    q-spinner(color='primary', size='20px')
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base'
import { useTimeEntriesStore } from 'app/extensions/capital/entities/TimeEntries/model'

type OpenTimerSession = {
  _id: string
  issue_hash: string
  project_hash: string
  started_at: string | Date
  paused_at?: string | Date | null
  total_paused_ms?: number
  is_paused: boolean
  elapsed_seconds: number
  issue_title?: string | null
}

const props = defineProps<{
  coopname?: string
  username?: string
}>()

const router = useRouter()
const { info } = useSystemStore()
const sessionStore = useSessionStore()
const timeEntriesStore = useTimeEntriesStore()

const loading = ref(false)
const busy = ref(false)
const session = ref<OpenTimerSession | null>(null)
const tickNow = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const coopname = computed(() => props.coopname || info.coopname)
const username = computed(() => props.username || sessionStore.username)

const taskTitle = computed(() => {
  if (!session.value) return ''
  return session.value.issue_title?.trim() || `Задача ${session.value.issue_hash.slice(0, 8)}…`
})

const displayElapsedSeconds = computed(() => {
  if (!session.value) return 0
  if (session.value.is_paused) return Math.max(0, session.value.elapsed_seconds || 0)

  const startedAt = new Date(session.value.started_at).getTime()
  const totalPaused = Number(session.value.total_paused_ms || 0)
  const wall = tickNow.value - startedAt - totalPaused
  return Math.max(0, Math.floor(wall / 1000))
})

const clockLabel = computed(() => formatClock(displayElapsedSeconds.value))

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function syncTick() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  if (session.value && !session.value.is_paused) {
    tickNow.value = Date.now()
    tickTimer = setInterval(() => {
      tickNow.value = Date.now()
    }, 1000)
  }
}

async function refresh() {
  if (!username.value || !coopname.value) {
    session.value = null
    return
  }
  loading.value = true
  try {
    session.value = (await timeEntriesStore.getOpenTimer({
      coopname: coopname.value,
      username: username.value,
    })) as OpenTimerSession | null
    tickNow.value = Date.now()
    syncTick()
  } catch (error) {
    console.error(error)
    session.value = null
  } finally {
    loading.value = false
  }
}

async function onPause() {
  busy.value = true
  try {
    session.value = (await timeEntriesStore.pauseTimer({
      coopname: coopname.value,
      username: username.value,
    })) as OpenTimerSession
    SuccessAlert('Таймер на паузе')
    syncTick()
  } catch (error) {
    FailAlert(error)
  } finally {
    busy.value = false
  }
}

async function onResume() {
  busy.value = true
  try {
    session.value = (await timeEntriesStore.resumeTimer({
      coopname: coopname.value,
      username: username.value,
    })) as OpenTimerSession
    tickNow.value = Date.now()
    SuccessAlert('Таймер продолжен')
    syncTick()
  } catch (error) {
    FailAlert(error)
  } finally {
    busy.value = false
  }
}

async function onStop() {
  busy.value = true
  try {
    await timeEntriesStore.stopTimer({
      coopname: coopname.value,
      username: username.value,
    })
    session.value = null
    SuccessAlert('Таймер остановлен')
    syncTick()
  } catch (error) {
    FailAlert(error)
  } finally {
    busy.value = false
  }
}

function goToIssue() {
  if (!session.value) return
  router.push({
    name: 'component-issue',
    params: {
      project_hash: session.value.project_hash,
      issue_hash: session.value.issue_hash,
    },
  })
}

onMounted(() => {
  void refresh()
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

watch([coopname, username], () => {
  void refresh()
})

defineExpose({ refresh })
</script>

<style lang="scss" scoped>
.active-timer__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-4);
}

.active-timer__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--p-r-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.active-timer__icon--idle {
  background: var(--p-surface-3);
  color: var(--p-ink-3);
}

.active-timer__icon--paused {
  background: var(--p-warn-soft);
  color: var(--p-warn);
}

.active-timer__copy,
.active-timer__main {
  flex: 1 1 12rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.active-timer__head {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.active-timer__label {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.active-timer__empty-title {
  color: var(--p-ink);
  font-weight: 500;
}

.active-timer__task-link {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  color: var(--p-ink);
  font-weight: 500;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--p-primary);
  }
}

.active-timer__clock {
  font-size: var(--p-fs-h2, 1.5rem);
  font-weight: 600;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.active-timer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
  margin-left: auto;
}

.active-timer__loading {
  display: flex;
  justify-content: center;
  padding: var(--p-2) 0;
}
</style>
