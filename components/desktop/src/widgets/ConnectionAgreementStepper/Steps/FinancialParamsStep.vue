<script setup lang="ts">
import { ref, watch } from 'vue'
import { BaseInput } from 'src/shared/ui/base'
import { notEmpty } from 'src/shared/lib/utils'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()

const initial = ref<string>(connectionAgreement.formData.initial || '')
const minimum = ref<string>(connectionAgreement.formData.minimum || '')
const orgInitial = ref<string>(connectionAgreement.formData.org_initial || '')
const orgMinimum = ref<string>(connectionAgreement.formData.org_minimum || '')
const errors = ref<Record<string, string>>({})

watch(
  () => connectionAgreement.formData,
  (v) => {
    initial.value = v.initial || ''
    minimum.value = v.minimum || ''
    orgInitial.value = v.org_initial || ''
    orgMinimum.value = v.org_minimum || ''
  },
  { deep: true },
)

const validate = (): boolean => {
  const e: Record<string, string> = {}
  if (notEmpty(initial.value) !== true) e.initial = t('connectionAgreementStepper.financialParamsStep.amountRequired')
  if (notEmpty(minimum.value) !== true) e.minimum = t('connectionAgreementStepper.financialParamsStep.amountRequired')
  if (notEmpty(orgInitial.value) !== true) e.orgInitial = t('connectionAgreementStepper.financialParamsStep.amountRequired')
  if (notEmpty(orgMinimum.value) !== true) e.orgMinimum = t('connectionAgreementStepper.financialParamsStep.amountRequired')
  errors.value = e
  return Object.keys(e).length === 0
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({
    ...connectionAgreement.formData,
    initial: initial.value,
    minimum: minimum.value,
    org_initial: orgInitial.value,
    org_minimum: orgMinimum.value,
  })
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
  .financial-step__group
    .financial-step__group-head
      .t-h3 {{ $t('connectionAgreementStepper.financialParamsStep.individualsTitle') }}
      p.t-sm.t-muted.financial-step__group-note {{ $t('connectionAgreementStepper.financialParamsStep.individualsHint') }}
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="initial"
          :label="$t('connectionAgreementStepper.financialParamsStep.entranceFeeLabel')"
          type="number"
          placeholder="100"
          suffix="RUB"
          :hint="$t('connectionAgreementStepper.financialParamsStep.entranceFeeHint')"
          :error="errors.initial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="minimum"
          :label="$t('connectionAgreementStepper.financialParamsStep.minShareLabel')"
          type="number"
          placeholder="300"
          suffix="RUB"
          :hint="$t('connectionAgreementStepper.financialParamsStep.minShareHint')"
          :error="errors.minimum || undefined"
        )

  .financial-step__group
    .financial-step__group-head
      .t-h3 {{ $t('connectionAgreementStepper.financialParamsStep.organizationsTitle') }}
      p.t-sm.t-muted.financial-step__group-note {{ $t('connectionAgreementStepper.financialParamsStep.organizationsHint') }}
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="orgInitial"
          :label="$t('connectionAgreementStepper.financialParamsStep.entranceFeeLabel')"
          type="number"
          placeholder="1000"
          suffix="RUB"
          :hint="$t('connectionAgreementStepper.financialParamsStep.entranceFeeHint')"
          :error="errors.orgInitial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="orgMinimum"
          :label="$t('connectionAgreementStepper.financialParamsStep.minShareLabel')"
          type="number"
          placeholder="3000"
          suffix="RUB"
          :hint="$t('connectionAgreementStepper.financialParamsStep.minShareHint')"
          :error="errors.orgMinimum || undefined"
        )
</template>

<style scoped>
.financial-step__group + .financial-step__group {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.financial-step__group-head {
  margin-bottom: var(--p-3);
}
.financial-step__group-note {
  margin: var(--p-1) 0 0;
}
</style>
