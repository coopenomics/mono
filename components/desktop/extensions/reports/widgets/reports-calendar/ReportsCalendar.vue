<template lang="pug">
.reports-calendar
  .calendar-header
    .row.items-center.q-gutter-sm
      .text-subtitle2.col {{ $t('reports.reportsCalendar.title', { year }) }}
      q-btn-group(flat dense)
        q-btn(
          flat dense
          icon='chevron_left'
          @click='changeYear(-1)'
          :aria-label='$t("reports.reportsCalendar.prevYearLabel")'
        )
          q-tooltip {{ $t('reports.reportsCalendar.prevYearLabel') }}
        q-btn(
          flat dense
          :label='String(year)'
          @click='resetYear'
        )
          q-tooltip {{ $t('reports.reportsCalendar.currentYearLabel') }}
        q-btn(
          flat dense
          icon='chevron_right'
          @click='changeYear(1)'
          :aria-label='$t("reports.reportsCalendar.nextYearLabel")'
        )
          q-tooltip {{ $t('reports.reportsCalendar.nextYearLabel') }}
      q-btn(flat dense icon='refresh' @click='reload' :loading='loading')
        q-tooltip {{ $t('reports.reportsCalendar.refreshLabel') }}

  q-inner-loading(:showing='loading')
    q-spinner(size='40px' color='primary')

  .calendar-scroll(v-if='rows.length')
    .calendar-grid
      .ch-corner
      .ch-month(v-for='(m, i) in MONTH_LABELS' :key='i') {{ m }}

      template(v-for='row in rows' :key='row.reportType')
        .cell-name
          .rt-short {{ row.shortName }}
          .rt-kind {{ kindLabel(row.periodKind) }}

        //- Одна ячейка на месяц у всех форм. У уведомления по НДФЛ в месяц
        //- может попадать несколько сроков — тогда ячейка предлагает выбор,
        //- а не растит строку вверх.
        CalendarCell(
          v-for='month in 12'
          :key='month'
          :row='row'
          :month='month'
          :entries='cellsAtMonth(row, month)'
          @select='entry => onEntryClick(row, entry)'
        )

  .empty-state(v-else-if='!loading')
    q-icon(name='event_busy' size='32px' color='grey-5')
    .text-caption.q-mt-sm {{ $t('reports.reportsCalendar.emptyState') }}
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { REPORT_DOCS_LIVE_TABLES } from 'app/extensions/reports/shared/lib/live'
import { FailAlert } from 'src/shared/api'
import {
  useReportStore,
  type IReportCalendarRow,
  type IReportCalendarPeriodEntry,
  type IReportType,
} from 'src/entities/Report'
import CalendarCell from './CalendarCell.vue'
import { t } from '../../i18n';

const MONTH_LABELS = [
  t('reports.reportsCalendar.month.jan'), t('reports.reportsCalendar.month.feb'), t('reports.reportsCalendar.month.mar'), t('reports.reportsCalendar.month.apr'), t('reports.reportsCalendar.month.may'), t('reports.reportsCalendar.month.jun'),
  t('reports.reportsCalendar.month.jul'), t('reports.reportsCalendar.month.aug'), t('reports.reportsCalendar.month.sep'), t('reports.reportsCalendar.month.oct'), t('reports.reportsCalendar.month.nov'), t('reports.reportsCalendar.month.dec'),
]

const reportStore = useReportStore()

const emit = defineEmits<{
  (e: 'select', payload: { reportType: IReportType; year: number; period: number | null }): void
}>()

const year = ref(new Date().getFullYear())
const rows = ref<IReportCalendarRow[]>([])
const loading = ref(false)

async function reload(): Promise<void> {
  loading.value = true
  try {
    rows.value = await reportStore.loadCalendar(year.value)
  } catch (e) {
    FailAlert(e, t('reports.reportsCalendar.loadError'))
  } finally {
    loading.value = false
  }
}

function changeYear(delta: number): void {
  year.value += delta
}

function resetYear(): void {
  year.value = new Date().getFullYear()
}

watch(year, () => void reload())
onMounted(() => void reload())

/** Сроки, приходящиеся на месяц: пусто, один или несколько. */
function cellsAtMonth(row: IReportCalendarRow, month: number): IReportCalendarPeriodEntry[] {
  return row.periods.filter((p) => p.dueMonth === month)
}

function kindLabel(kind: string): string {
  return (
    {
      yearly: t('reports.reportsCalendar.periodKind.yearly'),
      quarterly: t('reports.reportsCalendar.periodKind.quarterly'),
      monthly: t('reports.reportsCalendar.periodKind.monthly'),
      'semi-monthly': t('reports.reportsCalendar.periodKind.semiMonthly'),
    }[kind] ?? kind
  )
}

function onEntryClick(row: IReportCalendarRow, entry: IReportCalendarPeriodEntry): void {
  // year виджета — это календарный год СДАЧИ. entry.reportYear — год,
  // ЗА который отчитываемся (для Q4/годовых он = year-1).
  // В форму шлём именно reportYear из ячейки, а не year виджета —
  // иначе в 2026 БУХОТЧ откроется за 2026 вместо 2025.
  emit('select', {
    reportType: row.reportType as IReportType,
    year: entry.reportYear,
    period: entry.periodCode ?? null,
  })
}

// Экспонируем reload() для родителя: после закрытия редактора / постановки
// mark'а нужно обновить rows, иначе статус ячейки обновится только при
// ре-маунте страницы (переход между табами и обратно).
defineExpose({ reload })

// Календарь сдачи живёт по ленте: отметка о сдаче и сформированный отчёт
// сразу меняют статус срока.
useLiveReload(REPORT_DOCS_LIVE_TABLES, reload)
</script>

<style scoped lang="scss">
// Канон-токены MONO Platform — сами адаптируются к тёмной теме, без rgba-хардкода.
.reports-calendar {
  position: relative;
  font-size: var(--p-fs-body-sm, 13px);
}

.calendar-header {
  margin-bottom: var(--p-3, 12px);
}

// На мобильнике 5×12 не влезает по ширине — оборачиваем грид в горизонтальный
// скролл. Фиксированная min-width у грида гарантирует, что ячейки не «спрессуются»
// до нечитаемости; пользователь свайпает горизонтально.
.calendar-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 180px repeat(12, minmax(54px, 1fr));
  gap: 1px;
  background: var(--p-line);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: 1px;
  min-width: 900px;
  overflow: hidden;
}

.ch-corner {
  background: var(--p-surface-2);
}

.ch-month {
  background: var(--p-surface-2);
  padding: 8px 4px;
  text-align: center;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-ink-3);
}

.cell-name {
  background: var(--p-surface);
  padding: 8px 10px;
  .rt-short {
    font-weight: 600;
    color: var(--p-ink);
  }
  .rt-kind {
    font-size: 11px;
    color: var(--p-ink-3);
  }
}

.empty-state {
  text-align: center;
  padding: var(--p-7, 40px);
  color: var(--p-ink-3);
}
</style>
