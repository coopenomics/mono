<template lang="pug">
.zero-editor(v-if='editsValue')
  .editor-section
    h3.section-title {{ headerTitle }}

    .fields-grid
      q-input(
        label='Отчётный год'
        type='number'
        :model-value='editsValue.header.reportYear'
        @update:model-value='v => updateField("header.reportYear", clampInt(v, 2000, 2100))'
        dense filled
      )
      q-input(
        v-if='periodKind !== "none"'
        :label='periodKind === "quarter" ? "Квартал (1-4)" : "Месяц (1-12)"'
        type='number'
        :model-value='editsValue.header.period'
        @update:model-value='v => updateField("header.period", clampInt(v, 1, periodKind === "quarter" ? 4 : 12))'
        dense filled
      )
      q-input(
        label='Номер корректировки'
        type='number'
        :model-value='editsValue.header.correctionNumber'
        @update:model-value='v => updateField("header.correctionNumber", clampInt(v, 0, 999))'
        :rules='[v => (v >= 0 && v <= 999) || "0..999"]'
        :error='errFor("header.correctionNumber")'
        :error-message='msgFor("header.correctionNumber")'
        dense filled
      )

  .editor-section
    h3.section-title Организация

    q-input(
      label='Наименование организации'
      :model-value='editsValue.organization.orgName'
      @update:model-value='v => updateField("organization.orgName", v)'
      :rules='[reportRules.length(1, 1000)]'
      :error='errFor("organization.orgName")'
      :error-message='msgFor("organization.orgName")'
      dense filled
    )

    .fields-grid
      q-input(
        label='ИНН'
        :model-value='editsValue.organization.inn'
        @update:model-value='v => updateField("organization.inn", v)'
        :rules='[reportRules.innUl()]'
        :error='errFor("organization.inn")'
        :error-message='msgFor("organization.inn")'
        dense filled
      )
      q-input(
        label='КПП'
        :model-value='editsValue.organization.kpp'
        @update:model-value='v => updateField("organization.kpp", String(v || "").toUpperCase())'
        :rules='[reportRules.kpp()]'
        :error='errFor("organization.kpp")'
        :error-message='msgFor("organization.kpp")'
        dense filled
        maxlength='9'
      )
      q-input(
        v-if='needs.oktmo'
        label='ОКТМО'
        :model-value='editsValue.organization.oktmo || ""'
        @update:model-value='v => updateField("organization.oktmo", v || null)'
        :rules='[reportRules.oktmo()]'
        :error='errFor("organization.oktmo")'
        :error-message='msgFor("organization.oktmo")'
        dense filled
      )

    .fields-grid(v-if='needs.sfrExtras')
      q-input(
        label='ОКВЭД'
        :model-value='editsValue.organization.okved || ""'
        @update:model-value='v => updateField("organization.okved", v || null)'
        :rules='[reportRules.okved()]'
        :error='errFor("organization.okved")'
        :error-message='msgFor("organization.okved")'
        dense filled
      )
      q-input(
        label='ОГРН'
        :model-value='editsValue.organization.ogrn || ""'
        @update:model-value='v => updateField("organization.ogrn", v || null)'
        :rules='[reportRules.optionalRegex(/^\\d{13}$/, "ОГРН ЮЛ — 13 цифр")]'
        :error='errFor("organization.ogrn")'
        :error-message='msgFor("organization.ogrn")'
        dense filled
      )

  .editor-section
    h3.section-title Подписант

    q-option-group(
      :model-value='editsValue.signer.type'
      @update:model-value='v => updateField("signer.type", v)'
      :options='signerTypeOptions'
      inline
    )

    .fields-grid
      q-input(
        label='Фамилия'
        :model-value='editsValue.signer.lastName'
        @update:model-value='v => updateField("signer.lastName", v)'
        dense filled
        :rules='[v => !!v || "обязательно"]'
        :error='errFor("signer.lastName")'
        :error-message='msgFor("signer.lastName")'
      )
      q-input(
        label='Имя'
        :model-value='editsValue.signer.firstName'
        @update:model-value='v => updateField("signer.firstName", v)'
        dense filled
        :rules='[v => !!v || "обязательно"]'
        :error='errFor("signer.firstName")'
        :error-message='msgFor("signer.firstName")'
      )
      q-input(
        label='Отчество'
        :model-value='editsValue.signer.middleName || ""'
        @update:model-value='v => updateField("signer.middleName", v || null)'
        dense filled
      )

    q-input(
      v-if='editsValue.signer.type === "representative"'
      label='Документ, подтверждающий полномочия'
      :model-value='editsValue.signer.repDoc || ""'
      @update:model-value='v => updateField("signer.repDoc", v || null)'
      :rules='[reportRules.length(1, 120)]'
      :error='errFor("signer.repDoc")'
      :error-message='msgFor("signer.repDoc")'
      dense filled
    )

    q-input(
      v-if='needs.snils'
      label='СНИЛС председателя'
      :model-value='editsValue.signer.snils || ""'
      @update:model-value='v => updateField("signer.snils", v || null)'
      :rules='[reportRules.snils()]'
      :error='errFor("signer.snils")'
      :error-message='msgFor("signer.snils")'
      mask='###-###-### ##'
      hint='Обязателен для ПСВ — попадает в ПерсСвФЛ @СНИЛС'
      dense filled
    )

    q-input(
      v-if='needs.sfrExtras'
      label='Регистрационный номер СФР'
      :model-value='editsValue.signer.sfrRegNumber || ""'
      @update:model-value='v => updateField("signer.sfrRegNumber", v || null)'
      :rules='[reportRules.sfrRegNumber()]'
      :error='errFor("signer.sfrRegNumber")'
      :error-message='msgFor("signer.sfrRegNumber")'
      mask='###-###-######'
      hint='XXX-XXX-XXXXXX — обязателен для ЕФС-1'
      dense filled
    )

    q-input(
      v-if='needs.sfrExtras'
      label='Должность подписанта'
      :model-value='editsValue.signer.chairmanPosition || ""'
      @update:model-value='v => updateField("signer.chairmanPosition", v || null)'
      hint='По умолчанию — "Председатель Совета"'
      dense filled
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Selectors } from '@coopenomics/sdk'
import type { IReportType } from 'src/entities/Report'

const { reportRules } = Selectors

type SignerType = 'chairman' | 'representative'

interface ZeroReportEdits {
  header: {
    idFile: string
    versProgram: string
    docDate: string
    reportYear: number
    period: number | null
    correctionNumber: number
  }
  organization: {
    orgName: string
    inn: string
    kpp: string
    oktmo: string | null
    okved: string | null
    okfs: string | null
    okopf: string | null
    okpo: string | null
    ogrn: string | null
    address: string | null
  }
  signer: {
    type: SignerType
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
    snils: string | null
    sfrRegNumber: string | null
    chairmanPosition: string | null
  }
}

/**
 * defineModel для edits (Vue 3.4+). Родитель подключает v-model:edits.
 * Без этого раньше q-option-group (выбор типа подписанта) визуально
 * «не переключался»: управляемые контролы требуют, чтобы :model-value
 * реально сменился, а structuredClone+emit в старом паттерне давал
 * сбой (скорее всего на Vue-proxy + __v_raw).
 */
const editsModel = defineModel<ZeroReportEdits | null>('edits', { required: true })

const props = defineProps<{
  reportType: IReportType
  fieldErrors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  (e: 'dirty', path: string): void
}>()

const editsValue = computed(() => editsModel.value)

const signerTypeOptions = [
  { label: '1 — руководитель', value: 'chairman' },
  { label: '2 — уполномоченный представитель', value: 'representative' },
]

const headerTitle = computed(() => {
  const titles: Record<string, string> = {
    NDFL6: 'Расчёт 6-НДФЛ (КНД 1151100)',
    RSV: 'РСВ — Расчёт по страховым взносам (КНД 1151111)',
    PSV: 'ПСВ — Персонифицированные сведения (КНД 1151162)',
    FSS4: 'ЕФС-1 — СФР (приказ №1462)',
    DUSN: 'Декларация УСН (КНД 1152017)',
    UUSN: 'Уведомление об исчисленных суммах УСН (КНД 1110355)',
    UV_VZNOSY: 'Уведомление об исчисленных взносах (КНД 1110355)',
  }
  return titles[props.reportType] ?? props.reportType
})

// Тип периода: квартал (1..4), месяц (1..12) или нет.
const periodKind = computed<'quarter' | 'month' | 'none'>(() => {
  switch (props.reportType) {
    case 'NDFL6':
    case 'RSV':
    case 'UUSN':
    case 'FSS4':
      return 'quarter'
    case 'PSV':
    case 'UV_VZNOSY':
      return 'month'
    default:
      return 'none'
  }
})

// Флаги опциональных полей per-форме.
const needs = computed(() => ({
  oktmo: ['NDFL6', 'DUSN', 'UUSN', 'UV_VZNOSY'].includes(props.reportType),
  snils: props.reportType === 'PSV',
  sfrExtras: props.reportType === 'FSS4',
}))

function errFor(path: string): boolean {
  return (props.fieldErrors?.[path]?.length ?? 0) > 0
}

function msgFor(path: string): string {
  return props.fieldErrors?.[path]?.[0] ?? ''
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = current[part]
    if (next === null || next === undefined || typeof next !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

function updateField(path: string, value: unknown): void {
  const current = editsModel.value
  if (!current) return
  // JSON-clone: безопасно от Vue-proxy-обёрток, оставляет только POJO.
  const next = JSON.parse(JSON.stringify(current)) as Record<string, unknown>
  setByPath(next, path, value)
  editsModel.value = next as unknown as ZeroReportEdits
  emit('dirty', path)
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}
</script>

<style scoped lang="scss">
.zero-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.editor-section {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #222;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}
</style>
