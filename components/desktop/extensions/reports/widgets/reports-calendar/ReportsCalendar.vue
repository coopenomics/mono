<template lang="pug">
.reports-calendar
  .calendar-header
    .row.items-center.q-gutter-sm
      .text-subtitle2.col Календарь отчётности {{ year }} год
      q-btn-group(flat dense)
        q-btn(
          flat dense
          icon='fa-solid fa-angle-left'
          @click='changeYear(-1)'
          aria-label='Предыдущий год'
        )
          q-tooltip Предыдущий год
        q-btn(
          flat dense
          :label='String(year)'
          @click='resetYear'
        )
          q-tooltip Текущий год
        q-btn(
          flat dense
          icon='fa-solid fa-angle-right'
          @click='changeYear(1)'
          aria-label='Следующий год'
        )
          q-tooltip Следующий год
      q-btn(flat dense icon='fa-solid fa-rotate' @click='reload' :loading='loading')
        q-tooltip Обновить

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

        template(v-for='month in 12' :key='month')
          CalendarCell(
            :row='row'
            :month='month'
            :entry='periodAtMonth(row, month)'
            @click='onCellClick(row, month)'
          )

  .empty-state(v-else-if='!loading')
    q-icon(name='fa-solid fa-calendar-xmark' size='32px' color='grey-5')
    .text-caption.q-mt-sm Нет данных по формам
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { FailAlert } from 'src/shared/api'
import {
  useReportStore,
  type IReportCalendarRow,
  type IReportCalendarPeriodEntry,
  type IReportType,
} from 'src/entities/Report'
import CalendarCell from './CalendarCell.vue'

const MONTH_LABELS = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
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
    FailAlert(e, 'Ошибка загрузки календаря')
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

function periodAtMonth(row: IReportCalendarRow, month: number): IReportCalendarPeriodEntry | undefined {
  return row.periods.find((p) => p.dueMonth === month)
}

function kindLabel(kind: string): string {
  return ({ yearly: 'годовая', quarterly: 'квартальная', monthly: 'ежемесячная' }[kind] ?? kind)
}

function onCellClick(row: IReportCalendarRow, month: number): void {
  const entry = periodAtMonth(row, month)
  if (!entry) return
  // year виджета — это календарный год СДАЧИ. entry.reportYear — год,
  // ЗА который отчитываемся (для Q4/годовых/декабря ПСВ он = year-1).
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
</script>

<style scoped lang="scss">
// Цвета через rgba + body--dark overrides — без хардкода hex, иначе на тёмной
// теме календарь выглядит светлым пятном.
.reports-calendar {
  position: relative;
  font-size: 13px;
}

.calendar-header {
  margin-bottom: 12px;
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
  gap: 2px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px;
  min-width: 900px;

  .body--dark & {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.16);
  }
}

.ch-corner {
  background: rgba(0, 0, 0, 0.04);
  .body--dark & { background: rgba(255, 255, 255, 0.06); }
}

.ch-month {
  background: rgba(0, 0, 0, 0.04);
  padding: 8px 4px;
  text-align: center;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);

  .body--dark & {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
  }
}

.cell-name {
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  .rt-short {
    font-weight: 600;
    color: rgba(0, 0, 0, 0.85);
  }
  .rt-kind {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
  }

  .body--dark & {
    background: rgba(255, 255, 255, 0.04);
    border-top-color: rgba(255, 255, 255, 0.08);
    .rt-short { color: rgba(255, 255, 255, 0.9); }
    .rt-kind { color: rgba(255, 255, 255, 0.55); }
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: rgba(0, 0, 0, 0.5);
  .body--dark & { color: rgba(255, 255, 255, 0.55); }
}
</style>
