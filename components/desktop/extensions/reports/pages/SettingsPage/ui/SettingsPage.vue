<template lang="pug">
q-form.page-shell(@submit.prevent='save' @validation-error='onValidationError' greedy)
  //- Реквизиты организации (read-only — берутся из профиля кооператива)
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 Реквизиты организации
      .text-caption.text-grey-7 Справочные данные кооператива — не редактируются

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-6.col-12(
          v-for='f in orgFields'
          :key='f.key'
          :id='`field-${f.key}`'
          :label='f.label'
          :value='getValue(f.key)'
          read-only
        )

  //- Классификаторы (ручной ввод, обязательные)
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 Классификаторы
      .text-caption.text-grey-7 ОКВЭД, ОКФС, ОКОПФ, ОКТМО, ОКПО — обязательны для большинства отчётов ФНС

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-4.col-12(
          v-for='f in classifierFields'
          :key='f.key'
          :id='`field-${f.key}`'
          :label='f.label'
          :value='manualInput[f.key]'
          :placeholder='f.placeholder'
          :mask='f.mask'
          :digits-dots-only='f.digitsDotsOnly'
          :max-length='f.maxLength'
          :exact-lengths='f.exactLengths'
          :pattern='f.pattern'
          :pattern-message='f.patternMessage'
          required
          @update:value='v => (manualInput[f.key] = v)'
        )

  //- СФР (ЕФС-1)
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 СФР (для ЕФС-1)
      .text-caption.text-grey-7 Регистрационный номер СФР и должность председателя

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-6.col-12(
          id='field-sfrRegNumber'
          label='Рег. номер СФР'
          :value='manualInput.sfrRegNumber'
          placeholder='XXX-XXX-XXXXXX'
          mask='###-###-######'
          :pattern='SFR_REG_PATTERN'
          pattern-message='Формат: XXX-XXX-XXXXXX (12 цифр)'
          required
          @update:value='v => (manualInput.sfrRegNumber = v)'
        )
        RequisiteField.col-md-6.col-12(
          id='field-chairmanPosition'
          label='Должность председателя'
          :value='manualInput.chairmanPosition'
          placeholder='Председатель'
          :max-length='100'
          required
          @update:value='v => (manualInput.chairmanPosition = v)'
        )

  //- Подписант
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 Подписант
      .text-caption.text-grey-7 Кто подписывает отчёты: председатель или представитель (по доверенности)

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
          placeholder='XXX-XXX-XXX XX'
          mask='###-###-### ##'
          :pattern='SNILS_PATTERN'
          pattern-message='Формат: XXX-XXX-XXX XX (11 цифр)'
          required
          @update:value='v => (manualInput.signerSnils = v)'
        )
        RequisiteField.col-12(
          v-if='signerType === "representative"'
          id='field-signerRepDoc'
          label='Документ представителя'
          :value='manualInput.signerRepDoc'
          placeholder='Доверенность № X от DD.MM.YYYY'
          :max-length='200'
          required
          @update:value='v => (manualInput.signerRepDoc = v)'
        )

  //- Sticky save-bar внизу страницы. Единственная точка сохранения —
  //- кнопка ниже. Валидация срабатывает перед отправкой на сервер: если
  //- хоть одно поле красное, @submit не вызывается, летит @validation-error.
  .save-bar
    .save-bar-status(v-if='saveStatus === "saved"')
      q-icon(name='fa-solid fa-circle-check' color='positive' size='16px')
      span Реквизиты сохранены
    .save-bar-status.text-negative(v-else-if='saveStatus === "error"')
      q-icon(name='fa-solid fa-triangle-exclamation' size='16px')
      span Ошибка сохранения
    q-space
    q-btn(
      type='submit'
      color='primary'
      icon='fa-solid fa-floppy-disk'
      label='Сохранить реквизиты'
      :loading='saveStatus === "saving"'
      :disable='saveStatus === "saving"'
      no-caps
      unelevated
    )
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useReportStore } from 'src/entities/Report'
import type { IReportRequisitesView, IUpdateReportRequisitesInput } from 'src/entities/Report'
import RequisiteField from './RequisiteField.vue'

const route = useRoute()
const reportStore = useReportStore()

const requisites = ref<IReportRequisitesView | null>(null)

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
const saveStatus = ref<SaveStatus>('idle')

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

interface ClassifierField {
  key: ManualKey
  label: string
  placeholder?: string
  mask?: string
  digitsDotsOnly?: boolean
  maxLength?: number
  exactLengths?: number[]
  pattern?: RegExp
  patternMessage?: string
}

// Placeholder'ы — правило ввода (кол-во цифр), а не конкретные примеры.
// Для цифровых полей фиксированной/короткой длины — используем Quasar-mask
// (`#` = только цифра, буквы блокируются на keypress нативно).
// Для ОКВЭД (цифры + точка переменной длины) — digitsDotsOnly с @keydown-блокером.
const classifierFields: ClassifierField[] = [
  {
    key: 'okved',
    label: 'ОКВЭД',
    placeholder: 'XX.XX или XX.XX.XX',
    digitsDotsOnly: true,
    maxLength: 8,
    pattern: /^\d{2}(\.\d{1,2}){0,2}$/,
    patternMessage: 'Формат: XX.XX или XX.XX.XX',
  },
  {
    key: 'okfs',
    label: 'ОКФС',
    placeholder: '1–3 цифры',
    mask: '###',
    maxLength: 3,
  },
  {
    key: 'okopf',
    label: 'ОКОПФ',
    placeholder: '5 цифр',
    mask: '#####',
    maxLength: 5,
    exactLengths: [5],
  },
  {
    key: 'oktmo',
    label: 'ОКТМО',
    placeholder: '8 или 11 цифр',
    mask: '###########',
    maxLength: 11,
    exactLengths: [8, 11],
  },
  {
    key: 'okpo',
    label: 'ОКПО',
    placeholder: '8 или 10 цифр',
    mask: '##########',
    maxLength: 10,
    exactLengths: [8, 10],
  },
]

const signerTypeOptions = [
  { label: 'Председатель', value: 'chairman' },
  { label: 'Представитель', value: 'representative' },
]

// Паттерны полных значений под фиксированные маски — ловят случай, когда
// пользователь прожал пару цифр и нажал «Сохранить»: mask не мешает
// сохранить частичный ввод, паттерн-правило блокирует.
const SNILS_PATTERN = /^\d{3}-\d{3}-\d{3} \d{2}$/
const SFR_REG_PATTERN = /^\d{3}-\d{3}-\d{6}$/

function getValue(key: keyof IReportRequisitesView): string {
  const v = requisites.value?.[key] as any
  if (v && typeof v === 'object' && 'value' in v) return String(v.value ?? '')
  return ''
}

async function loadRequisites() {
  try {
    const data = await reportStore.loadRequisites()
    if (data) {
      requisites.value = data
      for (const key of Object.keys(manualInput) as ManualKey[]) {
        const v = (data as any)[key]
        if (v && typeof v === 'object' && 'value' in v && v.value) {
          manualInput[key] = String(v.value)
        }
      }
      const serverSignerType = (data as any).signerType
      if (serverSignerType === 'chairman' || serverSignerType === 'representative') {
        signerType.value = serverSignerType
      }
    }
  } catch (e: any) {
    FailAlert(e, 'Ошибка загрузки реквизитов')
  }
}

async function save() {
  // @submit у q-form сам не вызывается, если валидация не прошла (greedy
  // прогоняет все поля за раз, подсветит всё разом). Значит здесь мы уже
  // гарантированно валидны.
  saveStatus.value = 'saving'
  try {
    const input: Record<string, string | null> = {}
    for (const key of Object.keys(manualInput) as ManualKey[]) {
      const v = manualInput[key]
      input[key] = v && v.length > 0 ? v : null
    }
    input.signerType = signerType.value
    await reportStore.updateRequisites(input as IUpdateReportRequisitesInput)
    saveStatus.value = 'saved'
    SuccessAlert('Реквизиты сохранены')
  } catch (e: any) {
    saveStatus.value = 'error'
    FailAlert(e, 'Ошибка сохранения')
  }
}

function onValidationError() {
  // q-form нашёл поле с ошибкой — фокусит первое красное сам.
  FailAlert(new Error('Проверьте выделенные поля — есть незаполненные или некорректные значения'))
}

onMounted(async () => {
  await loadRequisites()
  if (route.query.focus) {
    await nextTick()
    const el = document.getElementById(`field-${route.query.focus}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>

<style scoped lang="scss">
.save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.save-bar-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #2e7d32;
}

.body--dark .save-bar {
  background: #1d1d1d;
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
