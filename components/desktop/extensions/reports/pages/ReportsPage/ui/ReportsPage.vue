<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Отчёты ФНС
    .hero-subtitle Генерация и управление налоговыми отчётами кооператива

  //- Расписание отчётов
  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Расписание отчётов

    q-separator

    q-card-section
      q-table(
        :rows='reports'
        :columns='columns'
        row-key='type'
        flat
        :loading='loading'
      )
        template(#body-cell-period='props')
          q-td(:props='props')
            q-chip(
              :color='periodColor(props.row.period)'
              text-color='white'
              dense
            ) {{ periodLabel(props.row.period) }}

        template(#body-cell-actions='props')
          q-td(:props='props')
            q-btn(
              flat
              dense
              icon='fa-solid fa-file-export'
              color='primary'
              @click='openGenerate(props.row)'
              :disable='generating'
            )
              q-tooltip Сгенерировать отчёт

      .text-center.text-grey-5.q-pa-lg(v-if='reports.length === 0 && !loading')
        q-icon(name='fa-solid fa-file-lines' size='48px')
        .q-mt-sm Загрузка расписания...

  //- Диалог генерации
  q-dialog(v-model='showGenerate')
    q-card(style='min-width: 550px')
      q-card-section
        .text-h6 Генерация: {{ selectedReport?.name }}

      q-card-section
        .row.q-gutter-md
          .col-6
            q-input(v-model.number='genYear' label='Год' type='number' dense outlined)
          .col-6
            q-input(
              v-if='selectedReport?.period !== "yearly"'
              v-model.number='genPeriod'
              :label='selectedReport?.period === "monthly" ? "Месяц (1-12)" : "Квартал (1-4)"'
              type='number'
              dense
              outlined
            )

        q-separator.q-my-md

        .text-subtitle2.q-mb-sm Данные организации
        .row.q-gutter-sm
          .col-6
            q-input(v-model='orgData.inn' label='ИНН' dense outlined)
          .col-6
            q-input(v-model='orgData.kpp' label='КПП' dense outlined)
          .col-12
            q-input(v-model='orgData.orgName' label='Наименование' dense outlined)
          .col-6
            q-input(v-model='orgData.ogrn' label='ОГРН' dense outlined)
          .col-6
            q-input(v-model='orgData.okved' label='ОКВЭД' dense outlined)
          .col-6
            q-input(v-model='orgData.oktmo' label='ОКТМО' dense outlined)
          .col-6
            q-input(v-model='orgData.okfs' label='ОКФС' dense outlined)

        q-separator.q-my-md

        .text-subtitle2.q-mb-sm Подписант
        .row.q-gutter-sm
          .col-4
            q-input(v-model='orgData.signerLastName' label='Фамилия' dense outlined)
          .col-4
            q-input(v-model='orgData.signerFirstName' label='Имя' dense outlined)
          .col-4
            q-input(v-model='orgData.signerMiddleName' label='Отчество' dense outlined)

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
import { ref, onMounted, reactive } from 'vue'
import { client } from 'src/shared/api/client'
import { Notify } from 'quasar'

interface AvailableReport {
  type: string
  name: string
  period: string
  deadline: string
}

interface GeneratedReport {
  reportType: string
  xml: string
  fileName: string
  errors: string[]
  isValid: boolean
}

const reports = ref<AvailableReport[]>([])
const loading = ref(false)
const generating = ref(false)
const showGenerate = ref(false)
const showResult = ref(false)
const selectedReport = ref<AvailableReport | null>(null)
const result = ref<GeneratedReport | null>(null)
const genYear = ref(new Date().getFullYear() - 1)
const genPeriod = ref(1)

const orgData = reactive({
  inn: '',
  kpp: '',
  orgName: '',
  ogrn: '',
  okved: '94.99',
  oktmo: '',
  okfs: '16',
  okopf: '20200',
  signerLastName: '',
  signerFirstName: '',
  signerMiddleName: '',
})

const columns = [
  { name: 'name', label: 'Отчёт', field: 'name', align: 'left' as const, sortable: true },
  { name: 'period', label: 'Периодичность', field: 'period', align: 'center' as const },
  { name: 'deadline', label: 'Срок сдачи', field: 'deadline', align: 'left' as const },
  { name: 'actions', label: '', field: 'type', align: 'right' as const },
]

function periodLabel(p: string) {
  if (p === 'yearly') return 'Ежегодно'
  if (p === 'quarterly') return 'Ежеквартально'
  if (p === 'monthly') return 'Ежемесячно'
  return p
}

function periodColor(p: string) {
  if (p === 'yearly') return 'deep-purple'
  if (p === 'quarterly') return 'blue'
  if (p === 'monthly') return 'teal'
  return 'grey'
}

onMounted(async () => {
  await loadReports()
})

async function loadReports() {
  loading.value = true
  try {
    const { getAvailableReports } = await client.Query({
      getAvailableReports: {
        type: true,
        name: true,
        period: true,
        deadline: true,
      },
    })
    reports.value = getAvailableReports || []
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Ошибка загрузки отчётов: ' + (e?.message || '') })
  }
  loading.value = false
}

function openGenerate(report: AvailableReport) {
  selectedReport.value = report
  showGenerate.value = true
}

async function generate() {
  if (!selectedReport.value) return
  generating.value = true

  try {
    const { generateReport } = await client.Mutation({
      generateReport: [{
        data: {
          reportType: selectedReport.value.type as any,
          year: genYear.value,
          period: genPeriod.value,
        },
        organization: {
          inn: orgData.inn,
          kpp: orgData.kpp,
          orgName: orgData.orgName,
          ogrn: orgData.ogrn,
          okved: orgData.okved,
          oktmo: orgData.oktmo,
          okfs: orgData.okfs,
          okopf: orgData.okopf,
          signerLastName: orgData.signerLastName,
          signerFirstName: orgData.signerFirstName,
          signerMiddleName: orgData.signerMiddleName,
        },
      }, {
        reportType: true,
        xml: true,
        fileName: true,
        errors: true,
        isValid: true,
      }],
    })

    result.value = generateReport
    showGenerate.value = false
    showResult.value = true

    if (generateReport.isValid) {
      Notify.create({ type: 'positive', message: 'Отчёт сгенерирован успешно' })
    }
  } catch (e: any) {
    Notify.create({ type: 'negative', message: 'Ошибка генерации: ' + (e?.message || '') })
  }

  generating.value = false
}

function downloadXml() {
  if (!result.value) return
  const blob = new Blob([result.value.xml], { type: 'application/xml;charset=windows-1251' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.value.fileName + '.xml'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
