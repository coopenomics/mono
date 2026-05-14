<template lang="pug">
.q-pa-md
  .row.items-center.q-mb-md
    .text-h6.col Доступные формы
    q-btn(flat dense icon='fa-solid fa-rotate' @click='loadReports' :loading='reportStore.loading')
      q-tooltip Обновить

  q-table(
    :rows='visibleReports'
    :columns='columns'
    row-key='type'
    flat
    :loading='reportStore.loading'
    hide-pagination
    :pagination='{ rowsPerPage: 0 }'
  )
    template(#body-cell-period='props')
      q-td(:props='props')
        q-chip(:color='periodColor(props.row.period)' text-color='white' dense) {{ periodLabel(props.row.period) }}

    template(#body-cell-ready='props')
      q-td(:props='props')
        q-icon(
          v-if='props.row.readyToGenerate'
          name='fa-solid fa-check-circle'
          color='positive'
          size='20px'
        )
          q-tooltip Реквизиты заполнены
        q-icon(
          v-else
          name='fa-solid fa-triangle-exclamation'
          color='warning'
          size='20px'
        )
          q-tooltip {{ missingTooltip(props.row) }}

    template(#body-cell-actions='props')
      q-td(:props='props')
        q-btn(
          v-if='props.row.readyToGenerate'
          flat dense
          icon='fa-solid fa-pen-to-square'
          color='primary'
          @click='openEditor(props.row)'
        )
          q-tooltip Открыть редактор формы
        q-btn(
          v-else
          flat dense
          icon='fa-solid fa-gear'
          color='warning'
          :to='{ name: "reports-settings", query: { focus: firstMissing(props.row) } }'
        )
          q-tooltip Заполнить реквизиты

  ReportEditorDialog(
    v-if='showEditor'
    v-model='showEditor'
    :report-type='editorReportType'
    :year='editorYear'
    :period='editorPeriod'
    @generated='onGenerated'
    @marked='onMarked'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { FailAlert } from 'src/shared/api'
import {
  useReportStore,
  type IAvailableReport,
  type IReportType,
} from 'src/entities/Report'
import ReportEditorDialog from './ReportEditorDialog.vue'

const MVP_REPORT_TYPES = ['BUHOTCH', 'NDFL6', 'RSV', 'PSV', 'FSS4'] as IReportType[]

const reportStore = useReportStore()
const { reports } = storeToRefs(reportStore)

const showEditor = ref(false)
const editorReportType = ref<IReportType | null>(null)
const editorYear = ref(new Date().getFullYear() - 1)
const editorPeriod = ref<number | null>(null)

const visibleReports = computed(() =>
  reports.value.filter((r) => MVP_REPORT_TYPES.includes(r.type as IReportType)),
)

const columns = [
  { name: 'name', label: 'Отчёт', field: 'name', align: 'left' as const, sortable: true },
  { name: 'period', label: 'Периодичность', field: 'period', align: 'center' as const },
  { name: 'deadline', label: 'Срок сдачи', field: 'deadline', align: 'left' as const },
  { name: 'ready', label: 'Готовность', field: 'readyToGenerate', align: 'center' as const },
  { name: 'actions', label: '', field: 'type', align: 'right' as const },
]

function periodLabel(p: string) {
  return ({ yearly: 'Ежегодно', quarterly: 'Ежеквартально', monthly: 'Ежемесячно' }[p] ?? p)
}

function periodColor(p: string) {
  return ({ yearly: 'deep-purple', quarterly: 'blue', monthly: 'teal' }[p] ?? 'grey')
}

function missingTooltip(r: IAvailableReport) {
  if (!r.missingFields || r.missingFields.length === 0) return 'Не все реквизиты заполнены'
  return `Не заполнено: ${r.missingFields.join(', ')}`
}

function firstMissing(r: IAvailableReport): string {
  return (r.missingFields && r.missingFields[0]) || ''
}

async function loadReports() {
  try {
    await reportStore.loadReports()
  } catch (e) {
    FailAlert(e, 'Ошибка загрузки')
  }
}

function defaultPeriodFor(p: string): number | null {
  if (p === 'yearly') return null
  return 1
}

function openEditor(r: IAvailableReport) {
  editorReportType.value = r.type as IReportType
  // yearly → предыдущий год (2026 → 2025), иначе текущий.
  editorYear.value = r.period === 'yearly'
    ? new Date().getFullYear() - 1
    : new Date().getFullYear()
  editorPeriod.value = defaultPeriodFor(r.period)
  showEditor.value = true
}

async function onGenerated() {
  await loadReports()
}

function onMarked() {
  showEditor.value = false
}

onMounted(() => loadReports())
</script>
