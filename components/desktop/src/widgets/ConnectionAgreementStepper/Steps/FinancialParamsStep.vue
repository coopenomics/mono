<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { BaseInput } from 'src/shared/ui/base'
import { notEmpty } from 'src/shared/lib/utils'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
const $q = useQuasar()

type FeeKey = 'initial' | 'minimum' | 'org_initial' | 'org_minimum'

const fromStore = (): Record<FeeKey, string> => ({
  initial: connectionAgreement.formData.initial || '',
  minimum: connectionAgreement.formData.minimum || '',
  org_initial: connectionAgreement.formData.org_initial || '',
  org_minimum: connectionAgreement.formData.org_minimum || '',
})

const values = ref<Record<FeeKey, string>>(fromStore())
const errors = ref<Partial<Record<FeeKey, string>>>({})

watch(() => connectionAgreement.formData, () => { values.value = fromStore() }, { deep: true })

// Таблица «кто вступает × какой взнос»: заголовки колонок один раз сверху,
// строки — граждане и организации. Примеры сумм — в подсказке поля.
const rows: Array<{ key: string; title: string; note: string; fields: Array<{ key: FeeKey; example: string }> }> = [
  {
    key: 'individuals',
    title: t('connectionAgreementStepper.financialParamsStep.individualsTitle'),
    note: t('connectionAgreementStepper.financialParamsStep.individualsHint'),
    fields: [{ key: 'initial', example: '100' }, { key: 'minimum', example: '300' }],
  },
  {
    key: 'organizations',
    title: t('connectionAgreementStepper.financialParamsStep.organizationsTitle'),
    note: t('connectionAgreementStepper.financialParamsStep.organizationsHint'),
    fields: [{ key: 'org_initial', example: '1000' }, { key: 'org_minimum', example: '3000' }],
  },
]
const columns = [
  { label: t('connectionAgreementStepper.financialParamsStep.entranceFeeLabel'), note: t('connectionAgreementStepper.financialParamsStep.entranceFeeHint') },
  { label: t('connectionAgreementStepper.financialParamsStep.minShareLabel'), note: t('connectionAgreementStepper.financialParamsStep.minShareHint') },
]

// На узком экране таблица складывается в столбик, и подпись колонки
// возвращается к самому полю.
const narrow = computed(() => $q.screen.lt.md)

const validate = (): boolean => {
  const e: Partial<Record<FeeKey, string>> = {}
  for (const key of Object.keys(values.value) as FeeKey[]) {
    if (notEmpty(values.value[key]) !== true) e[key] = t('connectionAgreementStepper.financialParamsStep.amountRequired')
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({ ...connectionAgreement.formData, ...values.value })
  connectionAgreement.setCurrentStep(CONNECTION_STEP.agreement)
}

const handleBack = () => connectionAgreement.setCurrentStep(CONNECTION_STEP.domain)
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.financialParamsStep.title')"
  :lead="$t('connectionAgreementStepper.financialParamsStep.lead')"
  @back="handleBack"
  @next="handleContinue"
)
  .fee-grid(role="group")
    //- Шапка: пустая ячейка над подписями строк, затем две колонки взносов.
    template(v-if="!narrow")
      div
      .fee-grid__col(v-for="col in columns" :key="col.label")
        .fee-grid__col-label {{ col.label }}
        .fee-grid__col-note {{ col.note }}
    template(v-for="row in rows" :key="row.key")
      .fee-grid__row-head
        .fee-grid__row-title {{ row.title }}
        .fee-grid__row-note {{ row.note }}
      BaseInput(
        v-for="(field, idx) in row.fields"
        :key="field.key"
        v-model="values[field.key]"
        type="number"
        suffix="₽"
        :label="narrow ? columns[idx].label : undefined"
        :stack-label="narrow"
        :placeholder="field.example"
        :error="errors[field.key] || undefined"
      )
</template>

<style scoped>
.fee-grid {
  display: grid;
  grid-template-columns: minmax(160px, 0.9fr) minmax(0, 1fr) minmax(0, 1fr);
  column-gap: var(--p-4);
  row-gap: var(--p-2);
  align-items: start;
}
@media (max-width: 1023px) {
  .fee-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.fee-grid__col {
  padding-bottom: var(--p-2);
  border-bottom: 1px solid var(--p-line);
  margin-bottom: var(--p-2);
}
.fee-grid__col-label,
.fee-grid__row-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}
.fee-grid__col-note,
.fee-grid__row-note {
  margin-top: var(--p-1);
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}
/* Подпись строки выравнивается по полю, а не по его подсказке. */
.fee-grid__row-head {
  padding-top: var(--p-2);
}
</style>
