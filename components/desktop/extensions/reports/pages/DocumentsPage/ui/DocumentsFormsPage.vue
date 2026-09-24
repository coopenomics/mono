<template lang="pug">
.documents-forms
  .row.items-center.q-mb-md
    .text-h6.col {{ $t('reports.documentsFormsPage.title') }}
    q-btn(flat dense icon='fa-solid fa-rotate' @click='loadReports' :loading='reportStore.loading')
      q-tooltip {{ $t('reports.documentsFormsPage.refreshLabel') }}

  q-card(flat)
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
          BaseBadge(:variant='periodVariant(props.row.period)') {{ periodLabel(props.row.period) }}

      template(#body-cell-ready='props')
        q-td(:props='props')
          q-icon(
            v-if='props.row.readyToGenerate'
            name='fa-solid fa-check-circle'
            color='positive'
            size='20px'
          )
            q-tooltip {{ $t('reports.documentsFormsPage.requisitesFilledLabel') }}
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
            q-tooltip {{ $t('reports.documentsFormsPage.openEditorLabel') }}
          q-btn(
            v-else
            flat dense
            icon='fa-solid fa-gear'
            color='warning'
            :to='{ name: "reports-settings", query: { focus: firstMissing(props.row) } }'
          )
            q-tooltip {{ $t('reports.documentsFormsPage.fillRequisitesLabel') }}

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
import { useLiveReload } from 'src/shared/lib/realtime'
import { REPORT_DOCS_LIVE_TABLES } from 'app/extensions/reports/shared/lib/live'
import { storeToRefs } from 'pinia'
import { FailAlert } from 'src/shared/api'
import {
  useReportStore,
  type IAvailableReport,
  type IReportType,
} from 'src/entities/Report'
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import type { BaseBadgeProps } from 'src/shared/ui/base/BaseBadge/BaseBadge.types'
import ReportEditorDialog from './ReportEditorDialog.vue'
import { t } from '../../../i18n';

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
  { name: 'name', label: t('reports.documentsFormsPage.column.report'), field: 'name', align: 'left' as const, sortable: true },
  { name: 'period', label: t('reports.documentsFormsPage.column.periodicity'), field: 'period', align: 'center' as const },
  { name: 'deadline', label: t('reports.documentsFormsPage.column.deadline'), field: 'deadline', align: 'left' as const },
  { name: 'ready', label: t('reports.documentsFormsPage.column.readiness'), field: 'readyToGenerate', align: 'center' as const },
  { name: 'actions', label: '', field: 'type', align: 'right' as const },
]

function periodLabel(p: string) {
  return ({ yearly: t('reports.documentsFormsPage.periodicity.yearly'), quarterly: t('reports.documentsFormsPage.periodicity.quarterly'), monthly: t('reports.documentsFormsPage.periodicity.monthly') }[p] ?? p)
}

function periodVariant(p: string): BaseBadgeProps['variant'] {
  return ({ yearly: 'accent', quarterly: 'info', monthly: 'pos' }[p] ?? 'neutral') as BaseBadgeProps['variant']
}

function missingTooltip(r: IAvailableReport) {
  if (!r.missingFields || r.missingFields.length === 0) return t('reports.documentsFormsPage.requisitesIncompleteLabel')
  return t('reports.documentsFormsPage.missingFieldsLabel', { fields: r.missingFields.join(', ') })
}

function firstMissing(r: IAvailableReport): string {
  return (r.missingFields && r.missingFields[0]) || ''
}

async function loadReports() {
  try {
    await reportStore.loadReports()
  } catch (e) {
    FailAlert(e, t('reports.documentsFormsPage.loadError'))
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

// Формы отчётности живут по ленте: черновики и сформированные отчёты.
useLiveReload(REPORT_DOCS_LIVE_TABLES, loadReports)
</script>
