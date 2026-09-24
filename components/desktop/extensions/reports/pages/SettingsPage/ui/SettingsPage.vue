<template lang="pug">
q-form.settings-page(@submit.prevent='save' @validation-error='onValidationError' greedy)
  //- Реквизиты организации (read-only — берутся из профиля кооператива)
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 {{ $t('reports.settingsPage.orgRequisitesTitle') }}
      .text-caption.t-muted {{ $t('reports.settingsPage.orgRequisitesHint') }}

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
      .text-h6 {{ $t('reports.settingsPage.classifiersTitle') }}
      .text-caption.t-muted {{ $t('reports.settingsPage.classifiersHint') }}

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
          :digits-extra-chars='f.digitsExtraChars'
          :max-length='f.maxLength'
          :exact-lengths='f.exactLengths'
          :pattern='f.pattern'
          :pattern-message='f.patternMessage'
          required
          @update:value='v => (manualInput[f.key] = v)'
        )

  //- СФР/ПФР (ЕФС-1)
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 {{ $t('reports.settingsPage.sfrTitle') }}
      .text-caption.t-muted {{ $t('reports.settingsPage.sfrHint') }}

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        RequisiteField.col-md-6.col-12(
          id='field-sfrRegNumber'
          :label='$t("reports.settingsPage.sfrNumberLabel")'
          :value='manualInput.sfrRegNumber'
          :placeholder='$t("reports.settingsPage.sfrNumberPlaceholder")'
          mask='##########'
          :max-length='10'
          :exact-lengths='[10]'
          :pattern='SFR_REG_PATTERN'
          :pattern-message='$t("reports.settingsPage.sfrNumberFormatError")'
          required
          @update:value='v => (manualInput.sfrRegNumber = v)'
        )
        RequisiteField.col-md-6.col-12(
          id='field-pfrRegNumber'
          :label='$t("reports.settingsPage.pfrNumberLabel")'
          :value='manualInput.pfrRegNumber'
          placeholder='XXX-XXX-XXXXXX'
          mask='###-###-######'
          :max-length='14'
          :pattern='PFR_REG_PATTERN'
          :pattern-message='$t("reports.settingsPage.pfrNumberFormatError")'
          required
          @update:value='v => (manualInput.pfrRegNumber = v)'
        )
        RequisiteField.col-md-6.col-12(
          id='field-chairmanPosition'
          :label='$t("reports.settingsPage.chairmanPositionLabel")'
          :value='manualInput.chairmanPosition'
          :placeholder='$t("reports.settingsPage.chairmanPositionPlaceholder")'
          :max-length='100'
          required
          @update:value='v => (manualInput.chairmanPosition = v)'
        )

  //- Подписант
  q-card.q-mt-md(flat)
    q-card-section.q-py-sm
      .text-h6 {{ $t('reports.settingsPage.signerTitle') }}
      .text-caption.t-muted {{ $t('reports.settingsPage.signerHint') }}

    q-separator

    q-card-section
      .row.q-col-gutter-sm
        .col-md-6.col-12
          q-select(
            v-model='signerType'
            :options='signerTypeOptions'
            :label='$t("reports.settingsPage.signerTypeLabel")'
            dense outlined
            emit-value map-options
          )
        RequisiteField.col-md-6.col-12(
          id='field-signerSnils'
          :label='$t("reports.settingsPage.signerSnilsLabel")'
          :value='manualInput.signerSnils'
          placeholder='XXX-XXX-XXX XX'
          mask='###-###-### ##'
          :pattern='SNILS_PATTERN'
          :pattern-message='$t("reports.settingsPage.signerSnilsFormatError")'
          required
          @update:value='v => (manualInput.signerSnils = v)'
        )
        RequisiteField.col-md-6.col-12(
          id='field-signerInn'
          :label='$t("reports.settingsPage.signerInnLabel")'
          :value='manualInput.signerInn'
          :placeholder='$t("reports.settingsPage.signerInnPlaceholder")'
          mask='############'
          :max-length='12'
          :exact-lengths='[12]'
          :pattern='INN_FL_PATTERN'
          :pattern-message='$t("reports.settingsPage.signerInnFormatError")'
          required
          @update:value='v => (manualInput.signerInn = v)'
        )
        RequisiteField.col-12(
          v-if='signerType === "representative"'
          id='field-signerRepDoc'
          :label='$t("reports.settingsPage.signerRepDocLabel")'
          :value='manualInput.signerRepDoc'
          :placeholder='$t("reports.settingsPage.signerRepDocPlaceholder")'
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
      span {{ $t('reports.settingsPage.saveSuccess') }}
    .save-bar-status.text-negative(v-else-if='saveStatus === "error"')
      q-icon(name='fa-solid fa-triangle-exclamation' size='16px')
      span {{ $t('reports.settingsPage.saveError') }}
    q-space
    q-btn(
      type='submit'
      color='primary'
      icon='fa-solid fa-floppy-disk'
      :label='$t("reports.settingsPage.saveButtonLabel")'
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
import { t } from '../../../i18n';

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
  | 'pfrRegNumber'
  | 'chairmanPosition'
  | 'signerSnils'
  | 'signerInn'
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
  pfrRegNumber: '',
  chairmanPosition: '',
  signerSnils: '',
  signerInn: '',
  signerRepDoc: '',
  phoneOverride: '',
  addressOverride: '',
})

const signerType = ref<'chairman' | 'representative'>('chairman')

const orgFields: { key: keyof IReportRequisitesView; label: string }[] = [
  { key: 'inn', label: t('reports.settingsPage.field.inn') },
  { key: 'kpp', label: t('reports.settingsPage.field.kpp') },
  { key: 'ogrn', label: t('reports.settingsPage.field.ogrn') },
  { key: 'orgName', label: t('reports.settingsPage.field.orgName') },
  { key: 'address', label: t('reports.settingsPage.field.address') },
  { key: 'phone', label: t('reports.settingsPage.field.phone') },
  { key: 'signerLastName', label: t('reports.settingsPage.field.signerLastName') },
  { key: 'signerFirstName', label: t('reports.settingsPage.field.signerFirstName') },
  { key: 'signerMiddleName', label: t('reports.settingsPage.field.signerMiddleName') },
]

interface ClassifierField {
  key: ManualKey
  label: string
  placeholder?: string
  mask?: string
  digitsExtraChars?: string
  maxLength?: number
  exactLengths?: number[]
  pattern?: RegExp
  patternMessage?: string
}

// Placeholder'ы — правило ввода (кол-во цифр), а не конкретные примеры.
// Для цифровых полей фиксированной/короткой длины — используем Quasar-mask
// (`#` = только цифра, буквы блокируются на keypress нативно).
// Для ОКВЭД (цифры + точка переменной длины) — digitsExtraChars='.' с @keydown-блокером.
const classifierFields: ClassifierField[] = [
  {
    key: 'okved',
    label: t('reports.settingsPage.classifier.okvedLabel'),
    placeholder: t('reports.settingsPage.classifier.okvedPlaceholder'),
    digitsExtraChars: '.',
    maxLength: 8,
    pattern: /^\d{2}(\.\d{1,2}){0,2}$/,
    patternMessage: t('reports.settingsPage.classifier.okvedFormatError'),
  },
  {
    key: 'okfs',
    label: t('reports.settingsPage.classifier.okfsLabel'),
    placeholder: t('reports.settingsPage.classifier.okfsPlaceholder'),
    mask: '###',
    maxLength: 3,
  },
  {
    key: 'okopf',
    label: t('reports.settingsPage.classifier.okopfLabel'),
    placeholder: t('reports.settingsPage.classifier.okopfPlaceholder'),
    mask: '#####',
    maxLength: 5,
    exactLengths: [5],
  },
  {
    key: 'oktmo',
    label: t('reports.settingsPage.classifier.oktmoLabel'),
    placeholder: t('reports.settingsPage.classifier.oktmoPlaceholder'),
    mask: '###########',
    maxLength: 11,
    exactLengths: [8, 11],
  },
  {
    key: 'okpo',
    label: t('reports.settingsPage.classifier.okpoLabel'),
    placeholder: t('reports.settingsPage.classifier.okpoPlaceholder'),
    mask: '##########',
    maxLength: 10,
    exactLengths: [8, 10],
  },
]

const signerTypeOptions = [
  { label: t('reports.settingsPage.signerType.chairman'), value: 'chairman' },
  { label: t('reports.settingsPage.signerType.representative'), value: 'representative' },
]

// Паттерны полных значений под фиксированные маски — ловят случай, когда
// пользователь прожал пару цифр и нажал «Сохранить»: mask не мешает
// сохранить частичный ввод, паттерн-правило блокирует.
const SNILS_PATTERN = /^\d{3}-\d{3}-\d{3} \d{2}$/
const INN_FL_PATTERN = /^\d{12}$/
const SFR_REG_PATTERN = /^\d{10}$/
const PFR_REG_PATTERN = /^\d{3}-\d{3}-\d{6}$/

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
    FailAlert(e, t('reports.settingsPage.loadError'))
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
    SuccessAlert(t('reports.settingsPage.saveSuccess'))
  } catch (e: any) {
    saveStatus.value = 'error'
    FailAlert(e, t('reports.settingsPage.saveError'))
  }
}

function onValidationError() {
  // q-form нашёл поле с ошибкой — фокусит первое красное сам.
  FailAlert(new Error(t('reports.error.requisitesValidationFailed')))
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
// Top-level страница сама задаёт канон-отступы (как WalletPage).
.settings-page {
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}

.save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  margin-top: var(--p-4, 16px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-top: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px) var(--p-r-md, 12px) 0 0;
}

.save-bar-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-pos);
}
</style>
