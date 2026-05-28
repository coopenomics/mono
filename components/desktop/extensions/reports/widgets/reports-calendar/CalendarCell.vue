<template lang="pug">
.cell-month(:class='classes' @click='onClick')
  .cell-inner(v-if='entry')
    .ci-label {{ entry.label }}
    //- Submitted (реальный XML) + submitted_externally (отметка о внешней сдаче) —
    //- оба рендерим как зелёную точку; различие только в тултипе.
    //- Для остальных статусов — семантическая иконка, фон красится через класс.
    span.ci-dot(v-if='isSubmittedLike(entry.status)')
    q-icon.ci-icon(v-else :name='statusIcon(entry.status)')
    q-tooltip {{ tooltip }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import type { IReportCalendarPeriodEntry, IReportCalendarRow } from 'src/entities/Report'

const props = defineProps<{
  row: IReportCalendarRow
  month: number
  entry: IReportCalendarPeriodEntry | undefined
}>()

const emit = defineEmits<(e: 'click') => void>()

// Wire-значения enum'а — на шине GraphQL KEYS uppercase (Zeus так типизирует).

// before_registration — период приходился до даты регистрации кооператива:
// сдавать не нужно, ячейка некликабельна, выглядит нейтрально-серой.
function isBeforeRegistration(status: string): boolean {
  return status === Zeus.CalendarEntryStatus.BEFORE_REGISTRATION
}

// Для CSS-класса и словаря подписей используем строковое представление
// status как есть (`DRAFT`/`OVERDUE`/`NOT_REQUIRED`/`EMPTY`/`SUBMITTED`/`SUBMITTED_EXTERNALLY`/`BEFORE_REGISTRATION`).
const classes = computed<Record<string, boolean>>(() => ({
  active: !!props.entry && !isBeforeRegistration(props.entry.status),
  [`status-${props.entry?.status ?? 'EMPTY'}`]: !!props.entry,
}))

const STATUS_RU: Record<string, string> = {
  [Zeus.CalendarEntryStatus.SUBMITTED]: 'Сдан',
  [Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY]: 'Сдан (отметка)',
  [Zeus.CalendarEntryStatus.DRAFT]: 'Черновик',
  [Zeus.CalendarEntryStatus.OVERDUE]: 'Просрочен',
  [Zeus.CalendarEntryStatus.NOT_REQUIRED]: 'Не надо сдавать',
  [Zeus.CalendarEntryStatus.EMPTY]: 'Не сдан',
  [Zeus.CalendarEntryStatus.BEFORE_REGISTRATION]: 'Не требуется (до регистрации)',
}

const tooltip = computed(() => {
  if (!props.entry) return ''
  const s = STATUS_RU[props.entry.status] ?? props.entry.status
  return `${props.row.shortName}: ${props.entry.label}\nСрок: ${props.entry.dueDate}\nСтатус: ${s}`
})

function isSubmittedLike(status: string): boolean {
  return (
    status === Zeus.CalendarEntryStatus.SUBMITTED ||
    status === Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY
  )
}

function statusIcon(status: string): string {
  switch (status) {
    case Zeus.CalendarEntryStatus.DRAFT: return 'fa-solid fa-pen'
    case Zeus.CalendarEntryStatus.OVERDUE: return 'fa-solid fa-triangle-exclamation'
    case Zeus.CalendarEntryStatus.NOT_REQUIRED: return 'fa-solid fa-circle-xmark'
    case Zeus.CalendarEntryStatus.BEFORE_REGISTRATION: return 'fa-solid fa-minus'
    default: return 'fa-regular fa-circle'
  }
}

function onClick() {
  // before_registration — статичная ячейка, открывать диалог нечего
  // (ни редактора отчёта, ни ручной отметки на ней не существует).
  if (!props.entry) return
  if (isBeforeRegistration(props.entry.status)) return
  emit('click')
}
</script>

<style scoped lang="scss">
// Цвета через канон-токены MONO Platform — сами адаптируются к тёмной теме.
// SUBMITTED/DRAFT/OVERDUE сохраняют семантические оттенки (pos/warn/neg),
// нейтральные статусы (EMPTY/NOT_REQUIRED/BEFORE_REGISTRATION) — приглушённый ink.
.cell-month {
  background: var(--p-surface);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: background var(--p-dur-fast, 150ms);

  .cell-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border-radius: var(--p-r-xs, 4px);
    min-width: 48px;
  }
  .ci-label {
    font-size: 10px;
    line-height: 1;
  }
  .ci-icon {
    font-size: 14px;
  }
  .ci-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--p-pos);
    box-shadow: 0 0 0 2px var(--p-pos-soft);
  }

  &.active {
    cursor: pointer;
    &:hover { background: var(--p-primary-soft); }
  }

  // Submitted и submitted_externally: фон не заливаем, только зелёная точка
  // внутри — как в СБИС/Контуре. Различие только в тултипе; externally —
  // точка-кольцо и чуть меньшая насыщенность, чтобы глаз отличал при сравнении.
  &.status-SUBMITTED .cell-inner {
    color: var(--p-pos);
    background: transparent;
  }
  &.status-SUBMITTED_EXTERNALLY .cell-inner {
    color: var(--p-pos);
    background: transparent;
    opacity: 0.85;
  }
  &.status-SUBMITTED_EXTERNALLY .ci-dot {
    background: transparent;
    border: 2px solid var(--p-pos);
    box-shadow: 0 0 0 2px var(--p-pos-soft);
  }

  // Draft: мягкий оранжевый, сигнал «в работе».
  &.status-DRAFT .cell-inner {
    color: var(--p-warn);
    background: var(--p-warn-soft);
  }

  // Overdue (не сдан + срок прошёл) — насыщенный красный fill, видно издалека.
  &.status-OVERDUE .cell-inner {
    color: #fff;
    background: var(--p-neg);
    font-weight: 600;
  }
  &.status-OVERDUE .ci-icon {
    color: #fff;
  }

  // Not required: нейтральный серый, чтобы не кричал. Клик всё ещё открывает
  // диалог (можно снять отметку).
  &.status-NOT_REQUIRED .cell-inner {
    color: var(--p-ink-2);
    background: var(--p-surface-2);
    opacity: 0.85;
  }

  // Empty (период будущий/активный, отчёт ещё не нужен) — нейтрально.
  &.status-EMPTY .cell-inner {
    color: var(--p-ink-3);
    background: var(--p-surface-2);
  }

  // Before registration: период до регистрации кооператива. Ничего не сдавали
  // и сдавать не надо — ровный приглушённый серый, без hover-обводки.
  &.status-BEFORE_REGISTRATION {
    cursor: default;
    .cell-inner {
      color: var(--p-ink-3);
      background: var(--p-surface);
    }
    &:hover { background: inherit; }
  }
}
</style>
