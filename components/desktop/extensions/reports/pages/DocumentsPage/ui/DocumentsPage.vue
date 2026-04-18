<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Отчётность
    .hero-subtitle Генерация налоговых отчётов и архив сданных форм

  //- Расписание отчётов
  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Доступные формы
        q-btn(flat dense icon='fa-solid fa-rotate' @click='loadAll' :loading='loading')
          q-tooltip Обновить

    q-separator

    q-card-section
      q-table(
        :rows='visibleReports'
        :columns='columns'
        row-key='type'
        flat
        :loading='loading'
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
              icon='fa-solid fa-file-export'
              color='primary'
              @click='openGenerate(props.row)'
              :disable='generating'
            )
              q-tooltip Сгенерировать
            q-btn(
              v-else
              flat dense
              icon='fa-solid fa-gear'
              color='warning'
              :to='{ name: "reports-settings", query: { focus: firstMissing(props.row) } }'
            )
              q-tooltip Заполнить реквизиты

  //- Архив
  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Архив отчётов

    q-separator

    q-card-section
      .row.q-gutter-sm.items-end.q-mb-md
        q-select.col-md-3.col-12(
          v-model='archiveFilter.reportType'
          :options='archiveTypeOptions'
          label='Тип отчёта'
          dense
          outlined
          clearable
          emit-value
          map-options
          @update:model-value='loadArchive'
        )
        q-input.col-md-2.col-12(
          v-model.number='archiveFilter.year'
          label='Год'
          type='number'
          dense
          outlined
          clearable
          @update:model-value='loadArchive'
        )

      q-table(
        :rows='archiveItems'
        :columns='archiveColumns'
        row-key='id'
        flat
        :loading='archiveLoading'
        :pagination='archivePagination'
        @request='onArchiveRequest'
      )
        template(#body-cell-valid='props')
          q-td(:props='props')
            q-chip(
              :color='props.row.isValid ? "positive" : "negative"'
              text-color='white'
              dense
              size='sm'
            ) {{ props.row.isValid ? 'Валиден' : 'Ошибки' }}

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
              q-tooltip Скачать XML

  //- Диалог генерации
  q-dialog(v-model='showGenerate' persistent)
    q-card(style='min-width: 600px; max-width: 90vw')
      q-card-section
        .text-h6 Генерация: {{ selectedReport?.name }}

      q-card-section
        .row.q-gutter-md
          .col-6
            q-input(v-model.number='genYear' label='Год' type='number' dense outlined)
          .col-6(v-if='selectedReport?.period !== "yearly"')
            q-input(
              v-model.number='genPeriod'
              :label='selectedReport?.period === "monthly" ? "Месяц (1-12)" : "Квартал (1-4)"'
              type='number'
              dense
              outlined
            )

        //- Форма корректировок — только для BUHOTCH
        q-expansion-item.q-mt-md(
          v-if='selectedReport?.type === "BUHOTCH"'
          icon='fa-solid fa-scale-balanced'
          label='Корректировка прошлых периодов'
          :default-opened='corrections.length > 0'
        )
          .q-pa-sm
            .text-caption.text-grey-7.q-mb-sm
              | Остатки на 31 декабря прошлого и позапрошлого года для счетов баланса.
            q-table(
              :rows='corrections'
              :columns='correctionsColumns'
              row-key='accountDisplayId'
              flat
              dense
              hide-pagination
              :pagination='{ rowsPerPage: 0 }'
            )
              template(#body-cell-displayId='props')
                q-td(:props='props')
                  q-input(
                    v-model='props.row.accountDisplayId'
                    dense
                    borderless
                    placeholder='86.01'
                  )
              template(#body-cell-prev='props')
                q-td(:props='props')
                  q-input(
                    v-model.number='props.row.balancePrevious'
                    type='number'
                    dense
                    borderless
                  )
              template(#body-cell-preprev='props')
                q-td(:props='props')
                  q-input(
                    v-model.number='props.row.balancePrePrevious'
                    type='number'
                    dense
                    borderless
                  )
              template(#body-cell-remove='props')
                q-td(:props='props')
                  q-btn(
                    flat dense size='sm'
                    icon='fa-solid fa-trash'
                    color='negative'
                    @click='removeCorrectionRow(props.rowIndex)'
                  )
            q-btn.q-mt-sm(
              flat dense size='sm' icon='fa-solid fa-plus'
              label='Добавить счёт'
              @click='addCorrectionRow'
            )

      q-card-actions(align='right')
        q-btn(flat label='Отмена' @click='showGenerate = false')
        q-btn(flat label='Сгенерировать' color='primary' @click='generate' :loading='generating')

  //- Диалог результата
  q-dialog(v-model='showResult')
    q-card(style='min-width: 600px; max-width: 90vw')
      q-card-section
        .row.items-center
          .text-h6.col Результат генерации
          q-chip(
            :color='result?.isValid ? "positive" : "negative"'
            text-color='white'
          ) {{ result?.isValid ? 'Валиден' : 'Ошибки' }}

      q-card-section(v-if='result?.errors?.length')
        q-banner.bg-negative.text-white(v-for='err in result.errors' :key='err')
          | {{ err }}

      q-card-section
        .text-caption.text-grey Файл: {{ result?.fileName }}
        q-input.q-mt-sm(
          :modelValue='result?.xml'
          readonly
          outlined
          type='textarea'
          rows='12'
        )

      q-card-actions(align='right')
        q-btn(flat label='Скачать XML' icon='download' color='primary' @click='downloadXml')
        q-btn(flat label='Закрыть' @click='showResult = false')
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { Notify } from 'quasar'
import { reportApi } from 'src/entities/Report'
import type {
  IAvailableReport,
  IGeneratedReport,
  IReportHistoryPage,
  IReportType,
} from 'src/entities/Report'

const MVP_REPORT_TYPES: IReportType[] = ['BUHOTCH', 'NDFL6', 'RSV', 'DUSN', 'FSS4']

interface CorrectionRow {
  accountDisplayId: string
  balancePrevious: number
  balancePrePrevious: number
}

const loading = ref(false)
const reports = ref<IAvailableReport[]>([])

const showGenerate = ref(false)
const showResult = ref(false)
const generating = ref(false)
const selectedReport = ref<IAvailableReport | null>(null)
const result = ref<IGeneratedReport | null>(null)

const genYear = ref(new Date().getFullYear() - 1)
const genPeriod = ref(1)
const corrections = ref<CorrectionRow[]>([])

const archive = reactive<{ items: IReportHistoryPage['items']; total: number }>({ items: [], total: 0 })
const archiveItems = computed(() => archive.items ?? [])
const archiveLoading = ref(false)
const archivePagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })
const archiveFilter = reactive<{ reportType: IReportType | null; year: number | null }>({
  reportType: null,
  year: null,
})

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

const archiveColumns = [
  { name: 'reportType', label: 'Тип', field: 'reportType', align: 'left' as const },
  { name: 'year', label: 'Год', field: 'year', align: 'center' as const },
  { name: 'period', label: 'Период', field: 'period', align: 'center' as const },
  { name: 'fileName', label: 'Файл', field: 'fileName', align: 'left' as const },
  { name: 'valid', label: 'Валидация', field: 'isValid', align: 'center' as const },
  { name: 'createdAt', label: 'Сгенерирован', field: 'createdAt', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

const archiveTypeOptions = MVP_REPORT_TYPES.map((t) => ({ label: t, value: t }))

const correctionsColumns = [
  { name: 'displayId', label: 'Счёт', field: 'accountDisplayId', align: 'left' as const },
  { name: 'prev', label: `На 31.12.${genYear.value - 1}`, field: 'balancePrevious', align: 'right' as const },
  { name: 'preprev', label: `На 31.12.${genYear.value - 2}`, field: 'balancePrePrevious', align: 'right' as const },
  { name: 'remove', label: '', field: 'remove', align: 'right' as const },
]

function periodLabel(p: string) {
  return ({ yearly: 'Ежегодно', quarterly: 'Ежеквартально', monthly: 'Ежемесячно' }[p] ?? p)
}

function periodColor(p: string) {
  return ({ yearly: 'deep-purple', quarterly: 'blue', monthly: 'teal' }[p] ?? 'grey')
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function missingTooltip(r: IAvailableReport) {
  if (!r.missingFields || r.missingFields.length === 0) return 'Не все реквизиты заполнены'
  return `Не заполнено: ${r.missingFields.join(', ')}`
}

function firstMissing(r: IAvailableReport): string {
  return (r.missingFields && r.missingFields[0]) || ''
}

async function loadAll() {
  await Promise.all([loadReports(), loadArchive()])
}

async function loadReports() {
  loading.value = true
  try {
    reports.value = await reportApi.getAvailableReports()
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Ошибка загрузки: ' + (e?.message || '') })
  } finally {
    loading.value = false
  }
}

async function loadArchive() {
  archiveLoading.value = true
  try {
    const page = await reportApi.getReportHistory({
      reportType: archiveFilter.reportType ?? undefined,
      year: archiveFilter.year ?? undefined,
      limit: archivePagination.value.rowsPerPage,
      offset: (archivePagination.value.page - 1) * archivePagination.value.rowsPerPage,
    })
    if (page) {
      archive.items = page.items ?? []
      archive.total = page.total ?? 0
      archivePagination.value.rowsNumber = archive.total
    }
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Архив: ' + (e?.message || '') })
  } finally {
    archiveLoading.value = false
  }
}

function onArchiveRequest(props: { pagination: typeof archivePagination.value }) {
  archivePagination.value = props.pagination
  loadArchive()
}

async function downloadArchive(id: string) {
  try {
    const r = await reportApi.getReport(id)
    if (!r) throw new Error('Не удалось получить отчёт')
    triggerDownload(r.xml, r.fileName)
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Ошибка скачивания: ' + (e?.message || '') })
  }
}

function triggerDownload(xml: string, fileName: string) {
  const blob = new Blob([xml], { type: 'application/xml;charset=windows-1251' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xml') ? fileName : fileName + '.xml'
  a.click()
  URL.revokeObjectURL(url)
}

function openGenerate(r: IAvailableReport) {
  selectedReport.value = r
  corrections.value = []
  showGenerate.value = true
}

function addCorrectionRow() {
  corrections.value.push({
    accountDisplayId: '',
    balancePrevious: 0,
    balancePrePrevious: 0,
  })
}

function removeCorrectionRow(i: number) {
  corrections.value.splice(i, 1)
}

async function generate() {
  if (!selectedReport.value) return
  generating.value = true
  try {
    const data = {
      reportType: selectedReport.value.type as IReportType,
      year: genYear.value,
      period: selectedReport.value.period === 'yearly' ? undefined : genPeriod.value,
      corrections: corrections.value
        .filter((c) => c.accountDisplayId)
        .map((c) => ({
          accountDisplayId: c.accountDisplayId,
          balancePrevious: c.balancePrevious,
          balancePrePrevious: c.balancePrePrevious,
        })),
    }
    const out = await reportApi.generateReport(data)
    if (!out) throw new Error('Пустой ответ от сервера')

    result.value = out
    showGenerate.value = false
    showResult.value = true

    if (out.isValid) {
      Notify.create({ type: 'positive', message: 'Отчёт сгенерирован' })
      await Promise.all([loadArchive(), loadReports()])
    }
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Ошибка генерации: ' + (e?.message || '') })
  } finally {
    generating.value = false
  }
}

function downloadXml() {
  if (!result.value) return
  triggerDownload(result.value.xml, result.value.fileName)
}

onMounted(async () => {
  await loadAll()
})
</script>
