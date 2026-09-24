<template lang="pug">
.documents-archive
  .row.items-center.q-mb-md
    .text-h6.col {{ $t('reports.documentsArchivePage.title') }}

  .row.q-gutter-sm.items-end.q-mb-md
    q-select.col-md-3.col-12(
      v-model='archiveFilter.reportType'
      :options='archiveTypeOptions'
      :label='$t("reports.documentsArchivePage.reportTypeFilterLabel")'
      dense
      outlined
      clearable
      emit-value
      map-options
      @update:model-value='onFilterChange'
    )
    q-input.col-md-2.col-12(
      v-model.number='archiveFilter.year'
      :label='$t("reports.documentsArchivePage.yearFilterLabel")'
      type='number'
      dense
      outlined
      clearable
      :min='2000'
      :max='2100'
      debounce='400'
      @update:model-value='onFilterChange'
    )

  q-card(flat)
    q-table(
      :rows='reportStore.archive.items'
      :columns='archiveColumns'
      row-key='id'
      flat
      :loading='reportStore.archiveLoading'
      v-model:pagination='archivePagination'
      @request='onArchiveRequest'
    )
      template(#body-cell-valid='props')
        q-td(:props='props')
          BaseBadge(:variant='props.row.isValid ? "pos" : "neg"') {{ props.row.isValid ? $t('reports.documentsArchivePage.validLabel') : $t('reports.documentsArchivePage.errorsLabel') }}

      template(#body-cell-createdAt='props')
        q-td(:props='props') {{ formatDate(props.row.createdAt) }}

      template(#body-cell-actions='props')
        q-td(:props='props')
          q-btn(
            flat dense
            icon='fa-solid fa-download'
            color='primary'
            @click='downloadArchive(props.row.id)'
          )
            q-tooltip {{ $t('reports.documentsArchivePage.downloadXmlLabel') }}
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { uiLocale } from 'src/shared/i18n';
import { storeToRefs } from 'pinia'
import { FailAlert } from 'src/shared/api'
import {
  useReportStore,
  type IReportType,
} from 'src/entities/Report'
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import { t as i18nT } from '../../../i18n';

const MVP_REPORT_TYPES = ['BUHOTCH', 'NDFL6', 'RSV', 'PSV', 'FSS4'] as IReportType[]

const REPORT_TYPE_LABELS: Record<string, string> = {
  BUHOTCH: i18nT('reports.documentsArchivePage.reportType.buhotch'),
  NDFL6: i18nT('reports.documentsArchivePage.reportType.ndfl6'),
  RSV: i18nT('reports.documentsArchivePage.reportType.rsv'),
  DUSN: i18nT('reports.documentsArchivePage.reportType.dusn'),
  FSS4: i18nT('reports.documentsArchivePage.reportType.efs1'),
  PSV: i18nT('reports.documentsArchivePage.reportType.psv'),
  UV_VZNOSY: i18nT('reports.documentsArchivePage.reportType.uvVznosy'),
  UUSN: i18nT('reports.documentsArchivePage.reportType.usn'),
}

function reportLabel(type: string, fallbackName?: string): string {
  return REPORT_TYPE_LABELS[type] ?? fallbackName ?? type
}

const reportStore = useReportStore()
const { reports } = storeToRefs(reportStore)

const archivePagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })
const archiveFilter = reactive<{ reportType: IReportType | null; year: number | null }>({
  reportType: null,
  year: null,
})

watch(
  () => reportStore.archive.total,
  (n) => {
    archivePagination.value.rowsNumber = n
  },
)

const archiveColumns = [
  { name: 'reportType', label: i18nT('reports.documentsArchivePage.column.type'), field: 'reportType', align: 'left' as const },
  { name: 'year', label: i18nT('reports.documentsArchivePage.column.year'), field: 'year', align: 'center' as const },
  { name: 'period', label: i18nT('reports.documentsArchivePage.column.period'), field: 'period', align: 'center' as const },
  { name: 'fileName', label: i18nT('reports.documentsArchivePage.column.file'), field: 'fileName', align: 'left' as const },
  { name: 'valid', label: i18nT('reports.documentsArchivePage.column.validation'), field: 'isValid', align: 'center' as const },
  { name: 'createdAt', label: i18nT('reports.documentsArchivePage.column.generatedAt'), field: 'createdAt', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

const archiveTypeOptions = computed(() =>
  MVP_REPORT_TYPES.map((t) => {
    const found = reports.value.find((r) => r.type === t)
    return { label: reportLabel(t, found?.name), value: t }
  }),
)

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString(uiLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function loadArchive() {
  // UI-валидация year: бэк требует @Min(2000)/@Max(2100); иначе keystroke
  // «2026 → 202» рождает 400 и красный toast.
  const yr = archiveFilter.year
  if (yr !== null && yr !== undefined && (yr < 2000 || yr > 2100)) {
    reportStore.archive.items = []
    reportStore.archive.total = 0
    archivePagination.value.rowsNumber = 0
    return
  }
  try {
    await reportStore.loadArchive({
      reportType: archiveFilter.reportType ?? undefined,
      year: archiveFilter.year ?? undefined,
      limit: archivePagination.value.rowsPerPage,
      offset: (archivePagination.value.page - 1) * archivePagination.value.rowsPerPage,
    })
  } catch (e) {
    FailAlert(e, i18nT('reports.documentsArchivePage.column.archive'))
  }
}

function onFilterChange() {
  archivePagination.value.page = 1
  loadArchive()
}

function onArchiveRequest(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }) {
  archivePagination.value = {
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
    rowsNumber: props.pagination.rowsNumber ?? archivePagination.value.rowsNumber,
  }
  loadArchive()
}

async function downloadArchive(id: string) {
  try {
    const r = await reportStore.getReport(id)
    if (!r) throw new Error(i18nT('reports.error.fetchReportFailed'))
    reportStore.triggerDownload(r.xml, r.fileName)
  } catch (e) {
    FailAlert(e, i18nT('reports.documentsArchivePage.downloadError'))
  }
}

onMounted(async () => {
  // reports нужны для archiveTypeOptions (lookup по type.name)
  if (reports.value.length === 0) {
    await reportStore.loadReports().catch(() => {})
  }
  await loadArchive()
})
</script>
