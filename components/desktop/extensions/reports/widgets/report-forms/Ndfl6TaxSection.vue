<template lang="pug">
.ndfl6-tax(v-if='editsValue')
  BaseCard(:title='$t("reports.ndfl6TaxSection.taxCardTitle")')
    p.ndfl6-tax__hint
      | {{ $t('reports.ndfl6TaxSection.taxHintPart1') }}
      | {{ $t('reports.ndfl6TaxSection.taxHintPart2') }}
      | {{ $t('reports.ndfl6TaxSection.taxHintPart3') }}

    .ndfl6-tax__grid
      BaseInput(
        :label='$t("reports.ndfl6TaxSection.peopleCountLabel")'
        type='number'
        :model-value='editsValue.tax.peopleCount'
        :error='msgFor("tax.peopleCount")'
        @update:model-value='v => update("tax.peopleCount", toInt(v))'
      )
      AmountInput(
        :label='$t("reports.ndfl6TaxSection.incomeTotalLabel")'
        symbol='RUB'
        :precision='2'
        :min='0'
        :model-value='editsValue.tax.incomeTotal'
        :error='msgFor("tax.incomeTotal")'
        @update:model-value='v => update("tax.incomeTotal", toMoney(v))'
      )
      AmountInput(
        :label='$t("reports.ndfl6TaxSection.deductionsTotalLabel")'
        symbol='RUB'
        :precision='2'
        :min='0'
        :model-value='editsValue.tax.deductionsTotal'
        :error='msgFor("tax.deductionsTotal")'
        @update:model-value='v => update("tax.deductionsTotal", toMoney(v))'
      )
      AmountInput(
        :label='$t("reports.ndfl6TaxSection.taxBaseLabel")'
        symbol='RUB'
        :precision='2'
        :min='0'
        :model-value='editsValue.tax.taxBase'
        :error='msgFor("tax.taxBase")'
        @update:model-value='v => update("tax.taxBase", toMoney(v))'
      )
      BaseInput(
        :label='$t("reports.ndfl6TaxSection.taxCalculatedLabel")'
        type='number'
        :model-value='editsValue.tax.taxCalculated'
        :error='msgFor("tax.taxCalculated")'
        @update:model-value='v => update("tax.taxCalculated", toInt(v))'
      )
      BaseInput(
        :label='$t("reports.ndfl6TaxSection.withheldTotalLabel")'
        type='number'
        :model-value='editsValue.tax.withheldTotal'
        :error='msgFor("tax.withheldTotal")'
        @update:model-value='v => update("tax.withheldTotal", toInt(v))'
      )

  BaseCard(:title='$t("reports.ndfl6TaxSection.termsCardTitle")')
    p.ndfl6-tax__hint
      | {{ $t('reports.ndfl6TaxSection.termsHintPart1') }}
      | {{ $t('reports.ndfl6TaxSection.termsHintPart2') }}

    .ndfl6-tax__grid
      BaseInput(
        v-for='(label, index) in TERM_LABELS'
        :key='index'
        :label='label'
        type='number'
        :model-value='editsValue.tax.byTerm[index]'
        :error='msgFor(`tax.byTerm.${index}`)'
        @update:model-value='v => update(`tax.byTerm.${index}`, toInt(v))'
      )

    .ndfl6-tax__total(:class='{ "ndfl6-tax__total--mismatch": termsMismatch }')
      span {{ $t('reports.ndfl6TaxSection.termsSumLabel', { amount: termsSum }) }}
      span(v-if='termsMismatch') {{ $t('reports.ndfl6TaxSection.termsMismatchWarning') }}

  BaseCard(v-if='isAnnual', :title='$t("reports.ndfl6TaxSection.certificatesCardTitle")')
    p.ndfl6-tax__hint
      | {{ $t('reports.ndfl6TaxSection.certificatesHintPart1') }}
      | {{ $t('reports.ndfl6TaxSection.certificatesHintPart2') }}
      | {{ $t('reports.ndfl6TaxSection.certificatesHintPart3') }}

    EmptyState(v-if='certificates.length === 0', :title='$t("reports.ndfl6TaxSection.noPaymentsTitle")')
      template(#icon)
        q-icon(name='description', size='40px')

    .ndfl6-tax__certificate(v-for='(certificate, index) in certificates', :key='certificate.username')
      .ndfl6-tax__certificate-head
        span.ndfl6-tax__certificate-name {{ fullName(certificate) }}
        BaseBadge(v-if='!certificate.documentSerialNumber', variant='warn') {{ $t('reports.ndfl6TaxSection.noPassportBadge') }}

      .ndfl6-tax__grid
        BaseInput(
          :label='$t("reports.ndfl6TaxSection.birthDateLabel")'
          :placeholder='$t("reports.ndfl6TaxSection.birthDatePlaceholder")'
          stack-label
          :model-value='certificate.birthDate'
          :error='msgFor(`certificates.${index}.birthDate`)'
          @update:model-value='v => update(`certificates.${index}.birthDate`, String(v ?? ""))'
        )
        BaseInput(
          :label='$t("reports.ndfl6TaxSection.documentNumberLabel")'
          placeholder='0405 123456'
          stack-label
          :model-value='certificate.documentSerialNumber'
          :error='msgFor(`certificates.${index}.documentSerialNumber`)'
          @update:model-value='v => update(`certificates.${index}.documentSerialNumber`, String(v ?? ""))'
        )
        BaseInput(
          :label='$t("reports.ndfl6TaxSection.taxpayerStatusLabel")'
          :hint='$t("reports.ndfl6TaxSection.taxpayerStatusHint")'
          :model-value='certificate.taxpayerStatus'
          :error='msgFor(`certificates.${index}.taxpayerStatus`)'
          @update:model-value='v => update(`certificates.${index}.taxpayerStatus`, String(v ?? ""))'
        )
        BaseInput(
          :label='$t("reports.ndfl6TaxSection.citizenshipLabel")'
          :hint='$t("reports.ndfl6TaxSection.citizenshipHint")'
          :model-value='certificate.citizenshipCode'
          :error='msgFor(`certificates.${index}.citizenshipCode`)'
          @update:model-value='v => update(`certificates.${index}.citizenshipCode`, String(v ?? ""))'
        )
        BaseInput(
          :label='$t("reports.ndfl6TaxSection.documentTypeLabel")'
          :hint='$t("reports.ndfl6TaxSection.documentTypeHint")'
          :model-value='certificate.documentTypeCode'
          :error='msgFor(`certificates.${index}.documentTypeCode`)'
          @update:model-value='v => update(`certificates.${index}.documentTypeCode`, String(v ?? ""))'
        )

      .ndfl6-tax__certificate-sums
        span {{ $t('reports.ndfl6TaxSection.incomeTotalSummary', { amount: formatMoney(certificate.incomeTotal) }) }}
        span {{ $t('reports.ndfl6TaxSection.withheldSummary', { amount: certificate.taxWithheld }) }}
        span {{ $t('reports.ndfl6TaxSection.monthsWithPaymentsSummary', { count: certificate.monthlyIncome.length }) }}
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { uiLocale } from 'src/shared/i18n';
import { BaseCard, BaseInput, BaseBadge, EmptyState } from 'src/shared/ui/base'
import { AmountInput } from 'src/shared/ui/domain'
import type { Ndfl6Edits, Ndfl6Certificate } from './ndfl6-edits'
import { t } from '../../i18n';

/**
 * Разделы 6-НДФЛ с суммами и справки о доходах. Остальные секции формы
 * (шапка, реквизиты, подписант) общие с прочими отчётами и живут в
 * `ZeroReportEditor` — здесь только то, чего нет ни у одной другой формы.
 *
 * Персональные реквизиты получателя правятся здесь, а не в профиле пайщика:
 * статус налогоплательщика, гражданство и код вида документа система не
 * хранит — для кооператива это всегда резидент РФ с российским паспортом,
 * а редкое исключение бухгалтер закрывает руками перед отправкой.
 */

const props = defineProps<{
  edits: Ndfl6Edits | null
  /** Ошибки полей: путь → сообщения, как их отдаёт валидация формы. */
  fieldErrors?: Record<string, string[]>
  /** Годовой отчёт: только в нём схема допускает справки о доходах. */
  isAnnual: boolean
}>()

const emit = defineEmits<{
  (e: 'update:edits', value: Ndfl6Edits | null): void
  (e: 'dirty', path: string): void
}>()

const TERM_LABELS = [
  t('reports.ndfl6TaxSection.termLabel.1'),
  t('reports.ndfl6TaxSection.termLabel.2'),
  t('reports.ndfl6TaxSection.termLabel.3'),
  t('reports.ndfl6TaxSection.termLabel.4'),
  t('reports.ndfl6TaxSection.termLabel.5'),
  t('reports.ndfl6TaxSection.termLabel.6'),
]

const editsValue = computed(() => props.edits)

const certificates = computed<Ndfl6Certificate[]>(() => props.edits?.certificates ?? [])

const termsSum = computed(() =>
  (props.edits?.tax.byTerm ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0),
)

// Сроки — «в том числе» внутри годового итога, поэтому превысить его они не
// могут. Равенство допустимо: в отчёте за 1 квартал итог и есть эти шесть сроков.
const termsMismatch = computed(() => termsSum.value > (props.edits?.tax.withheldTotal ?? 0))

function msgFor(path: string): string {
  return props.fieldErrors?.[path]?.[0] ?? ''
}

function fullName(certificate: Ndfl6Certificate): string {
  const parts = [certificate.lastName, certificate.firstName, certificate.middleName]
  const name = parts.filter(Boolean).join(' ').trim()
  return name || certificate.username
}

function formatMoney(value: number): string {
  return value.toLocaleString(uiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toInt(value: unknown): number {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function toMoney(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

/**
 * Записать значение по точечному пути и пометить поле как правленое вручную.
 * Путь совпадает с тем, что бэкенд отдаёт в ошибках валидации и хранит в
 * `editedFields`, — иначе пересчёт затрёт ручную правку.
 */
function update(path: string, value: number | string): void {
  if (!props.edits) return
  const next = structuredClone(props.edits) as unknown as Record<string, unknown>
  const segments = path.split('.')
  let cursor = next
  for (const segment of segments.slice(0, -1)) {
    cursor = cursor[segment] as Record<string, unknown>
    if (!cursor) return
  }
  cursor[segments[segments.length - 1]] = value
  emit('update:edits', next as unknown as Ndfl6Edits)
  emit('dirty', path)
}
</script>

<style scoped lang="scss">
.ndfl6-tax {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);

  &__hint {
    margin: 0 0 var(--p-3, 12px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
    margin-bottom: var(--p-3, 12px);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__total {
    margin-top: var(--p-3, 12px);
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);

    &--mismatch {
      color: var(--p-warn);
    }
  }

  &__certificate {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    margin-bottom: var(--p-3, 12px);
  }

  &__certificate-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    margin-bottom: var(--p-3, 12px);
  }

  &__certificate-name {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__certificate-sums {
    margin-top: var(--p-3, 12px);
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-4, 16px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
  }
}
</style>
