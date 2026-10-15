<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseInput } from 'src/shared/ui/base'
import { isDomain, isSubdomain, notEmpty } from 'src/shared/lib/utils'
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  previousVisibleStep,
} from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
const system = useSystemStore()

const announce = ref<string>(connectionAgreement.formData.announce || '')
const errorMsg = ref<string>('')

watch(
  () => connectionAgreement.formData.announce,
  (v) => {
    announce.value = v || ''
  },
)

const validate = (): boolean => {
  const v = (announce.value || '').trim()
  if (notEmpty(v) !== true) {
    errorMsg.value = t('connectionAgreementStepper.domainStep.domainRequired')
    return false
  }
  if (isDomain(v) !== true) {
    errorMsg.value = t('connectionAgreementStepper.domainStep.domainInvalid')
    return false
  }
  const subdomain = isSubdomain(v)
  if (subdomain !== true) {
    errorMsg.value = subdomain
    return false
  }
  errorMsg.value = ''
  return true
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({
    ...connectionAgreement.formData,
    announce: announce.value.trim(),
  })
  connectionAgreement.setCurrentStep(CONNECTION_STEP.financial)
}

// Назад ведёт на предыдущий ПОКАЗАННЫЙ шаг: какие из них видны, зависит от
// членства в союзе и наличия выбора тарифа.
const previousStep = computed(() =>
  previousVisibleStep(connectionAgreement.currentStep, { isUnioned: !!system.info.is_unioned }),
)
const canGoBack = computed(() => previousStep.value !== null)

const handleBack = () => {
  if (previousStep.value === null) return
  connectionAgreement.setCurrentStep(previousStep.value)
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.domainStep.title')"
  :lead="$t('connectionAgreementStepper.domainStep.lead')"
  :can-back="canGoBack"
  @back="handleBack"
  @next="handleContinue"
)
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseInput(
        v-model="announce"
        :label="$t('connectionAgreementStepper.domainStep.domainLabel')"
        :placeholder="$t('connectionAgreementStepper.domainStep.domainPlaceholder')"
        :hint="$t('connectionAgreementStepper.domainStep.domainHint')"
        :error="errorMsg || undefined"
        mono
      )
    .col-12.col-md-6
      ul.domain-step__tips
        li
          strong {{ $t('connectionAgreementStepper.domainStep.subdomainTitle') }}
          |  {{ $t('connectionAgreementStepper.domainStep.subdomainText') }}
        li
          strong {{ $t('connectionAgreementStepper.domainStep.changeLaterTitle') }}
          |  {{ $t('connectionAgreementStepper.domainStep.changeLaterText') }}
</template>

<style scoped>
.domain-step__tips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.domain-step__tips strong {
  color: var(--p-ink);
  font-weight: 600;
}
</style>
