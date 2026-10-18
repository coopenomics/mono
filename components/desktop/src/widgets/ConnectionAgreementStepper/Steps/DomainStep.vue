<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseInput } from 'src/shared/ui/base'
import { isCoopDomain } from 'src/shared/lib/utils'
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  previousVisibleStep,
} from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
import StepFrame from '../ui/StepFrame.vue'

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
  const valid = isCoopDomain(announce.value)
  errorMsg.value = valid === true ? '' : valid
  return valid === true
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
  //- Одно поле и одна подсказка под ним: что вписать — в подписи и примере,
  //- что будет потом — строкой со значком.
  .domain-step
    BaseInput(
      v-model="announce"
      :label="$t('connectionAgreementStepper.domainStep.domainLabel')"
      stack-label
      prefix="https://"
      :placeholder="$t('connectionAgreementStepper.domainStep.domainPlaceholder')"
      :hint="$t('connectionAgreementStepper.domainStep.domainHint')"
      :error="errorMsg || undefined"
      mono
    )
    .domain-step__note
      q-icon(name="info_outline" size="18px")
      span {{ $t('connectionAgreementStepper.domainStep.changeLaterText') }}
</template>

<style scoped>
.domain-step {
  max-width: 560px;
}
.domain-step__note {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  margin-top: var(--p-3);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.domain-step__note .q-icon {
  flex: none;
  margin-top: 1px;
  color: var(--p-ink-3);
}
</style>
