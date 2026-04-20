<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Реквизиты отчётности
    .hero-subtitle Поля, которые попадут в XML-формы ФНС/ФСС

  //- Индикаторы готовности по 5 формам
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6.q-mb-sm Готовность форм
      .row.q-gutter-sm
        .col-auto(v-for='r in readiness' :key='r.reportType')
          q-chip(
            :color='r.ready ? "positive" : "warning"'
            text-color='white'
            :icon='r.ready ? "fa-solid fa-check" : "fa-solid fa-triangle-exclamation"'
          )
            | {{ r.reportType }}
            q-tooltip(v-if='!r.ready && r.missingFields.length')
              .text-caption Не заполнено:
              ul
                li(v-for='f in r.missingFields' :key='f.key') {{ f.label }}

  //- Реквизиты организации (read-only)
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Реквизиты организации
      .text-caption.text-grey-7 Данные из блокчейна (read-only)

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-6.col-12(
          v-for='f in orgFields'
          :key='f.key'
          :id='`field-${f.key}`'
          :label='f.label'
          :value='getValue(f.key)'
          :source='getSource(f.key)'
          read-only
        )

  //- Классификаторы (ручной ввод)
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Классификаторы
      .text-caption.text-grey-7 Ручной ввод (ОКВЭД, ОКФС, ОКОПФ, ОКТМО, ОКПО)

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-4.col-12(
          v-for='f in classifierFields'
          :key='f.key'
          :id='`field-${f.key}`'
          :label='f.label'
          :value='manualInput[f.key]'
          :source='getSource(f.key)'
          :placeholder='f.placeholder'
          @update:value='v => manualInput[f.key] = v'
        )

  //- СФР (ЕФС-1)
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 СФР (для ЕФС-1)
      .text-caption.text-grey-7 Регистрационный номер СФР и должность председателя

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-6.col-12(
          id='field-sfrRegNumber'
          label='Рег. номер СФР'
          :value='manualInput.sfrRegNumber'
          :source='getSource("sfrRegNumber")'
          placeholder='XXX-XXX-XXXXXX'
          @update:value='v => manualInput.sfrRegNumber = v'
        )
        RequisiteField.col-md-6.col-12(
          id='field-chairmanPosition'
          label='Должность председателя'
          :value='manualInput.chairmanPosition'
          :source='getSource("chairmanPosition")'
          placeholder='Председатель'
          @update:value='v => manualInput.chairmanPosition = v'
        )

  //- Подписант
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Подписант
      .text-caption.text-grey-7 Кто подписывает отчёты (председатель или представитель)

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        .col-md-6.col-12
          q-select(
            v-model='signerType'
            :options='signerTypeOptions'
            label='Тип подписанта'
            dense outlined
            emit-value map-options
          )
        RequisiteField.col-md-6.col-12(
          id='field-signerSnils'
          label='СНИЛС подписанта'
          :value='manualInput.signerSnils'
          :source='getSource("signerSnils")'
          placeholder='XXX-XXX-XXX XX'
          @update:value='v => manualInput.signerSnils = v'
        )
        RequisiteField.col-12(
          v-if='signerType === "representative"'
          id='field-signerRepDoc'
          label='Документ представителя'
          :value='manualInput.signerRepDoc'
          :source='getSource("signerRepDoc")'
          placeholder='Доверенность № X от DD.MM.YYYY'
          @update:value='v => manualInput.signerRepDoc = v'
        )

  //- Кнопка сохранения
  .row.q-mt-md.q-mb-xl.justify-end
    q-btn(
      color='primary'
      icon='fa-solid fa-floppy-disk'
      label='Сохранить реквизиты'
      @click='save'
      :loading='saving'
    )
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { reportApi } from 'src/entities/Report'
import type {
  IReportRequisitesView,
  IReportReadinessView,
  IReportType,
} from 'src/entities/Report'
import RequisiteField from './RequisiteField.vue'

const route = useRoute()

const loading = ref(false)
const saving = ref(false)

const requisites = ref<IReportRequisitesView | null>(null)
const readiness = ref<IReportReadinessView[]>([])

const REPORT_TYPES_MVP = ['BUHOTCH', 'NDFL6', 'RSV', 'DUSN', 'FSS4'] as IReportType[]

type ManualKey =
  | 'okved'
  | 'okfs'
  | 'okopf'
  | 'oktmo'
  | 'okpo'
  | 'sfrRegNumber'
  | 'chairmanPosition'
  | 'signerSnils'
  | 'signerRepDoc'
  | 'phoneOverride'
  | 'addressOverride'

const manualInput = reactive<Record<ManualKey, string>>({
  okved: '',
  okfs: '',
  okopf: '',
  oktmo: '',
  okpo: '',
  sfrRegNumber: '',
  chairmanPosition: '',
  signerSnils: '',
  signerRepDoc: '',
  phoneOverride: '',
  addressOverride: '',
})

const signerType = ref<'chairman' | 'representative'>('chairman')

const orgFields: { key: keyof IReportRequisitesView; label: string }[] = [
  { key: 'inn', label: 'ИНН' },
  { key: 'kpp', label: 'КПП' },
  { key: 'ogrn', label: 'ОГРН' },
  { key: 'orgName', label: 'Наименование' },
  { key: 'address', label: 'Адрес' },
  { key: 'phone', label: 'Телефон' },
  { key: 'signerLastName', label: 'Фамилия подписанта' },
  { key: 'signerFirstName', label: 'Имя подписанта' },
  { key: 'signerMiddleName', label: 'Отчество подписанта' },
]

const classifierFields: { key: ManualKey; label: string; placeholder?: string }[] = [
  { key: 'okved', label: 'ОКВЭД', placeholder: '94.99' },
  { key: 'okfs', label: 'ОКФС', placeholder: '16' },
  { key: 'okopf', label: 'ОКОПФ', placeholder: '20200' },
  { key: 'oktmo', label: 'ОКТМО', placeholder: '' },
  { key: 'okpo', label: 'ОКПО', placeholder: '' },
]

const signerTypeOptions = [
  { label: 'Председатель', value: 'chairman' },
  { label: 'Представитель', value: 'representative' },
]

function getValue(key: keyof IReportRequisitesView): string {
  const v = requisites.value?.[key] as any
  if (v && typeof v === 'object' && 'value' in v) return String(v.value ?? '')
  return ''
}

function getSource(key: string): 'blockchain' | 'manual' | 'empty' {
  const v = (requisites.value as any)?.[key]
  if (v && typeof v === 'object' && 'source' in v) return v.source
  return 'empty'
}

async function loadRequisites() {
  loading.value = true
  try {
    const data = await reportApi.getReportRequisites()
    if (data) {
      requisites.value = data
      // Prefill manual inputs
      for (const key of Object.keys(manualInput) as ManualKey[]) {
        const v = (data as any)[key]
        if (v && typeof v === 'object' && 'value' in v && v.value) {
          manualInput[key] = String(v.value)
        }
      }
      // signerType — choice, не RequisiteField; default 'chairman' если бэк
      // не вернул значения (первый заход председателя).
      const serverSignerType = (data as any).signerType
      if (serverSignerType === 'chairman' || serverSignerType === 'representative') {
        signerType.value = serverSignerType
      }
    }
  } catch (e: any) {
    FailAlert(e, 'Ошибка загрузки реквизитов')
  } finally {
    loading.value = false
  }
}

async function loadReadiness() {
  try {
    const results = await Promise.all(
      REPORT_TYPES_MVP.map(async (rt) => {
        try {
          return await reportApi.checkReportReadiness(rt)
        } catch (e) {
          // Частичный фейл одной формы — не рушим список, но логируем чтобы
          // в DevTools был видимый сигнал, а не «пустой readiness из ниоткуда».
          console.error(`checkReportReadiness(${rt}) failed:`, e)
          return undefined
        }
      }),
    )
    readiness.value = results.filter((x): x is IReportReadinessView => !!x)
  } catch (e) {
    console.error('loadReadiness failed:', e)
  }
}

async function save() {
  // Для representative-подписанта без доверенности XML пойдёт с пустым
  // НаимДок — ФНС/СФР отклонит. Блокируем до заполнения.
  if (signerType.value === 'representative' && !manualInput.signerRepDoc?.trim()) {
    FailAlert(new Error('Для подписанта «Представитель» нужно указать документ (доверенность)'))
    return
  }

  saving.value = true
  try {
    const input: Record<string, string | null> = {}
    for (const key of Object.keys(manualInput) as ManualKey[]) {
      const v = manualInput[key]
      input[key] = v && v.length > 0 ? v : null
    }
    input.signerType = signerType.value
    await reportApi.updateReportRequisites(input as any)
    SuccessAlert('Реквизиты сохранены')
    await Promise.all([loadRequisites(), loadReadiness()])
  } catch (e: any) {
    FailAlert(e, 'Ошибка сохранения')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadRequisites(), loadReadiness()])
  if (route.query.focus) {
    await nextTick()
    const el = document.getElementById(`field-${route.query.focus}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>
