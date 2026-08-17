<template lang="pug">
.cell-month(:class='classes' @click='onClick')
  .cell-inner(v-if='primary')
    .ci-label {{ label }}
    //- Submitted (реальный XML) + submitted_externally (отметка о внешней сдаче) —
    //- оба рендерим как зелёную точку; различие только в тултипе.
    //- Для остальных статусов — семантическая иконка, фон красится через класс.
    span.ci-dot(v-if='isSubmittedLike(primary.status)')
    q-icon.ci-icon(v-else :name='statusIcon(primary.status)')
    q-tooltip {{ tooltip }}

    //- Несколько сроков в одном месяце бывает только у уведомления по НДФЛ:
    //- налог удерживают дважды в месяц, и каждый период сдаётся отдельно.
    //- Ячейка остаётся одна, как у прочих форм, а выбор срока открывается
    //- по клику — иначе строка раздувается втрое и календарь не читается.
    q-menu(v-if='entries.length > 1' anchor='bottom left' self='top left')
      q-list(dense style='min-width: 220px')
        q-item-label(header) Сроки месяца
        q-item(
          v-for='entry in entries'
          :key='entry.periodCode ?? entry.label'
          clickable
          v-close-popup
          @click='emit("select", entry)'
        )
          q-item-section
            q-item-label {{ entry.label }}
            q-item-label(caption) до {{ entry.dueDate }} · {{ statusLabel(entry.status) }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import type { IReportCalendarPeriodEntry, IReportCalendarRow } from 'src/entities/Report'

const props = defineProps<{
  row: IReportCalendarRow
  month: number
  /** Сроки, приходящиеся на этот месяц: пусто, один или несколько. */
  entries: IReportCalendarPeriodEntry[]
}>()

const emit = defineEmits<(e: 'select', entry: IReportCalendarPeriodEntry) => void>()

// Wire-значения enum'а — на шине GraphQL KEYS uppercase (Zeus так типизирует).

/**
 * Что показывать, когда сроков несколько: берём самый «громкий» статус, чтобы
 * ячейка не выглядела спокойной, пока один из периодов просрочен.
 */
const STATUS_PRIORITY: string[] = [
  Zeus.CalendarEntryStatus.OVERDUE,
  Zeus.CalendarEntryStatus.DRAFT,
  Zeus.CalendarEntryStatus.EMPTY,
  Zeus.CalendarEntryStatus.SUBMITTED,
  Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY,
  Zeus.CalendarEntryStatus.NOT_REQUIRED,
  Zeus.CalendarEntryStatus.NO_DATA,
  Zeus.CalendarEntryStatus.BEFORE_REGISTRATION,
]

const primary = computed<IReportCalendarPeriodEntry | undefined>(() => {
  if (!props.entries.length) return undefined
  return [...props.entries].sort(
    (a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status),
  )[0]
})

// При одном сроке — его собственная подпись; при нескольких она не влезает и
// не нужна: месяц ясен из колонки, а разбивка видна в меню.
const label = computed(() =>
  props.entries.length > 1 ? `${props.entries.length} срока` : (primary.value?.label ?? ''),
)

// before_registration — период приходился до даты регистрации кооператива:
// сдавать не нужно, ячейка некликабельна, выглядит нейтрально-серой.
function isBeforeRegistration(status: string): boolean {
  return status === Zeus.CalendarEntryStatus.BEFORE_REGISTRATION
}

// Для CSS-класса и словаря подписей используем строковое представление
// status как есть (`DRAFT`/`OVERDUE`/`NOT_REQUIRED`/`EMPTY`/`SUBMITTED`/`SUBMITTED_EXTERNALLY`/`BEFORE_REGISTRATION`).
const classes = computed<Record<string, boolean>>(() => ({
  active: !!primary.value && !isBeforeRegistration(primary.value.status),
  [`status-${primary.value?.status ?? 'EMPTY'}`]: !!primary.value,
}))

const STATUS_RU: Record<string, string> = {
  [Zeus.CalendarEntryStatus.SUBMITTED]: 'Сдан',
  [Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY]: 'Сдан (отметка)',
  [Zeus.CalendarEntryStatus.DRAFT]: 'Черновик',
  [Zeus.CalendarEntryStatus.OVERDUE]: 'Просрочен',
  [Zeus.CalendarEntryStatus.NOT_REQUIRED]: 'Не надо сдавать',
  [Zeus.CalendarEntryStatus.EMPTY]: 'Не сдан',
  [Zeus.CalendarEntryStatus.BEFORE_REGISTRATION]: 'Не требуется (до регистрации)',
  [Zeus.CalendarEntryStatus.NO_DATA]: 'Нечего подавать — выплат не было',
}

function statusLabel(status: string): string {
  return STATUS_RU[status] ?? status
}

const tooltip = computed(() => {
  if (!primary.value) return ''
  if (props.entries.length > 1) {
    const lines = props.entries.map(
      (e) => `${e.label} — до ${e.dueDate}, ${statusLabel(e.status)}`,
    )
    return `${props.row.shortName}\n${lines.join('\n')}`
  }
  return (
    `${props.row.shortName}: ${primary.value.label}\n` +
    `Срок: ${primary.value.dueDate}\nСтатус: ${statusLabel(primary.value.status)}`
  )
})

function isSubmittedLike(status: string): boolean {
  return (
    status === Zeus.CalendarEntryStatus.SUBMITTED ||
    status === Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY
  )
}

function statusIcon(status: string): string {
  switch (status) {
    case Zeus.CalendarEntryStatus.DRAFT: return 'edit'
    case Zeus.CalendarEntryStatus.OVERDUE: return 'warning'
    case Zeus.CalendarEntryStatus.NOT_REQUIRED: return 'cancel'
    case Zeus.CalendarEntryStatus.BEFORE_REGISTRATION: return 'remove'
    case Zeus.CalendarEntryStatus.NO_DATA: return 'do_not_disturb_alt'
    default: return 'radio_button_unchecked'
  }
}

function onClick() {
  // before_registration — статичная ячейка, открывать диалог нечего
  // (ни редактора отчёта, ни ручной отметки на ней не существует).
  const entry = primary.value
  if (!entry) return
  if (isBeforeRegistration(entry.status)) return
  // При нескольких сроках клик открывает меню (q-menu ловит его сам) —
  // выбирать за пользователя, какой из периодов он имел в виду, нельзя.
  if (props.entries.length > 1) return
  emit('select', entry)
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
    text-align: center;
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

  // No data: за период не было выплат, подавать нечего. Гаснет и загорается
  // само по данным, поэтому выглядит спокойнее ручной отметки «не надо сдавать».
  &.status-NO_DATA .cell-inner {
    color: var(--p-ink-3);
    background: var(--p-surface-2);
    opacity: 0.7;
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
