<template lang="pug">
.zero-editor(v-if='editsValue')
  .editor-section
    h3.section-title {{ headerTitle }}

    .fields-grid
      q-input(
        :label='$t("reports.zeroReportEditor.reportYearLabel")'
        type='number'
        :model-value='editsValue.header.reportYear'
        @update:model-value='v => updateField("header.reportYear", clampInt(v, 2000, 2100))'
        :error='errFor("header.reportYear")'
        :error-message='msgFor("header.reportYear")'
        dense filled
      )
      q-input(
        v-if='periodKind !== "none"'
        :label='periodLabel'
        type='number'
        :model-value='editsValue.header.period'
        @update:model-value='v => updateField("header.period", clampInt(v, 1, periodMax))'
        :error='errFor("header.period")'
        :error-message='msgFor("header.period")'
        dense filled
      )
      q-input(
        :label='$t("reports.zeroReportEditor.correctionNumberLabel")'
        type='number'
        :model-value='editsValue.header.correctionNumber'
        @update:model-value='v => updateField("header.correctionNumber", clampInt(v, 0, 999))'
        :rules='[v => (v >= 0 && v <= 999) || "0..999"]'
        :error='errFor("header.correctionNumber")'
        :error-message='msgFor("header.correctionNumber")'
        dense filled
      )

  .editor-section
    h3.section-title {{ $t('reports.zeroReportEditor.organizationTitle') }}
    .text-caption.t-muted.q-mb-sm {{ $t('reports.zeroReportEditor.readonlyHint') }}

    q-input.org-name(
      :label='$t("reports.zeroReportEditor.orgNameLabel")'
      :model-value='editsValue.organization.orgName'
      readonly disable
      dense filled
    )

    .fields-grid
      q-input(
        :label='$t("reports.zeroReportEditor.innLabel")'
        :model-value='editsValue.organization.inn'
        readonly disable
        dense filled
      )
      q-input(
        :label='$t("reports.zeroReportEditor.kppLabel")'
        :model-value='editsValue.organization.kpp'
        readonly disable
        dense filled
      )
      q-input(
        v-if='needs.oktmo'
        :label='$t("reports.zeroReportEditor.oktmoLabel")'
        :model-value='editsValue.organization.oktmo || ""'
        readonly disable
        dense filled
      )

    .fields-grid(v-if='needs.sfrExtras')
      q-input(
        :label='$t("reports.zeroReportEditor.okvedLabel")'
        :model-value='editsValue.organization.okved || ""'
        readonly disable
        dense filled
      )
      q-input(
        :label='$t("reports.zeroReportEditor.ogrnLabel")'
        :model-value='editsValue.organization.ogrn || ""'
        readonly disable
        dense filled
      )

  .editor-section
    h3.section-title {{ $t('reports.zeroReportEditor.signerTitle') }}
    .text-caption.t-muted.q-mb-sm {{ $t('reports.zeroReportEditor.readonlyHint') }}

    q-option-group(
      :model-value='editsValue.signer.type'
      :options='signerTypeOptions'
      disable
      inline
    )

    .fields-grid
      q-input(
        :label='$t("reports.zeroReportEditor.lastNameLabel")'
        :model-value='editsValue.signer.lastName'
        readonly disable
        dense filled
      )
      q-input(
        :label='$t("reports.zeroReportEditor.firstNameLabel")'
        :model-value='editsValue.signer.firstName'
        readonly disable
        dense filled
      )
      q-input(
        :label='$t("reports.zeroReportEditor.middleNameLabel")'
        :model-value='editsValue.signer.middleName || ""'
        readonly disable
        dense filled
      )

    q-input(
      v-if='editsValue.signer.type === "representative"'
      :label='$t("reports.zeroReportEditor.repDocLabel")'
      :model-value='editsValue.signer.repDoc || ""'
      readonly disable
      dense filled
    )

    q-input(
      v-if='needs.snils'
      :label='$t("reports.zeroReportEditor.chairmanSnilsLabel")'
      :model-value='editsValue.signer.snils || ""'
      readonly disable
      dense filled
    )

    q-input(
      v-if='needs.snils'
      :label='$t("reports.zeroReportEditor.chairmanInnLabel")'
      :model-value='editsValue.signer.inn || ""'
      readonly disable
      dense filled
    )

    q-input(
      v-if='needs.sfrExtras'
      :label='$t("reports.zeroReportEditor.pfrRegNumberLabel")'
      :model-value='editsValue.signer.pfrRegNumber || ""'
      readonly disable
      dense filled
    )

    q-input(
      v-if='needs.sfrExtras'
      :label='$t("reports.zeroReportEditor.signerPositionLabel")'
      :model-value='editsValue.signer.chairmanPosition || ""'
      readonly disable
      dense filled
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IReportType } from 'src/entities/Report'
import { t } from '../../i18n';

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
    phone: string | null
  }
  signer: {
    type: SignerType
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
    snils: string | null
    inn: string | null
    sfrRegNumber: string | null
    pfrRegNumber: string | null
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
  { label: t('reports.zeroReportEditor.signerType.chairman'), value: 'chairman' },
  { label: t('reports.zeroReportEditor.signerType.representative'), value: 'representative' },
]

const headerTitle = computed(() => {
  const titles: Record<string, string> = {
    NDFL6: t('reports.zeroReportEditor.reportTitle.ndfl6'),
    RSV: t('reports.zeroReportEditor.reportTitle.rsv'),
    PSV: t('reports.zeroReportEditor.reportTitle.psv'),
    FSS4: t('reports.zeroReportEditor.reportTitle.fss4'),
    DUSN: t('reports.zeroReportEditor.reportTitle.dusn'),
    UUSN: t('reports.zeroReportEditor.reportTitle.uusn'),
    UV_VZNOSY: t('reports.zeroReportEditor.reportTitle.uvVznosy'),
    UV_NDFL: t('reports.zeroReportEditor.reportTitle.uvNdfl'),
  }
  return titles[props.reportType] ?? props.reportType
})

// Тип периода: квартал (1..4), месяц (1..12), расчётный период НДФЛ (1..24)
// или нет. У уведомления по НДФЛ на месяц приходится два периода — с 1 по 22
// число и с 23 по последнее, — поэтому нумерация сквозная по году.
const periodKind = computed<'quarter' | 'month' | 'semi-month' | 'none'>(() => {
  switch (props.reportType) {
    case 'NDFL6':
    case 'RSV':
    case 'UUSN':
    case 'FSS4':
      return 'quarter'
    case 'PSV':
    case 'UV_VZNOSY':
      return 'month'
    case 'UV_NDFL':
      return 'semi-month'
    default:
      return 'none'
  }
})

const periodLabel = computed(() => {
  if (periodKind.value === 'quarter') return t('reports.zeroReportEditor.periodLabel.quarter')
  if (periodKind.value === 'semi-month') return t('reports.zeroReportEditor.periodLabel.semiMonth')
  return t('reports.zeroReportEditor.periodLabel.month')
})

const periodMax = computed(() => {
  if (periodKind.value === 'quarter') return 4
  if (periodKind.value === 'semi-month') return 24
  return 12
})

// Флаги опциональных полей per-форме.
const needs = computed(() => ({
  oktmo: ['NDFL6', 'DUSN', 'UUSN', 'UV_VZNOSY', 'UV_NDFL'].includes(props.reportType),
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
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-4, 16px);
}

.section-title {
  margin: 0 0 var(--p-3, 12px);
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
}

// Наименование организации — отдельная строка над сеткой ИНН/КПП/ОКТМО:
// без этого отступа поля слипаются в один блок и читаются как одна группа.
.org-name {
  margin-bottom: var(--p-3, 12px);
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}
</style>
