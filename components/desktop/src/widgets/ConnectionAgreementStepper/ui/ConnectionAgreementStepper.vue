<script setup lang="ts">
import { computed, watch } from 'vue'
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper'
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper'
import UnionMembershipStep from '../Steps/UnionMembershipStep.vue'
import IntroStep from '../Steps/IntroStep.vue'
import DomainStep from '../Steps/DomainStep.vue'
import FinancialParamsStep from '../Steps/FinancialParamsStep.vue'
import AgreementStep from '../Steps/AgreementStep.vue'
import DomainValidationStep from '../Steps/DomainValidationStep.vue'
import ApprovalWaitingStep from '../Steps/ApprovalWaitingStep.vue'
import InstallationStep from '../Steps/InstallationStep.vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'

const connectionAgreement = useConnectionAgreementStore()
const system = useSystemStore()

const currentStep = computed(() => connectionAgreement.currentStep)
const selectedTariff = computed(() => connectionAgreement.selectedTariff)
const document = computed(() => connectionAgreement.document)
const signedDocument = computed(() => connectionAgreement.signedDocument)
const html = computed(() => document.value?.data?.html)

// Полный реестр шагов в порядке прохождения. Индекс в массиве = индекс в
// connectionAgreement.currentStep. Все жёсткие переходы в шагах и в
// ConnectionAgreementPage завязаны на эти числа — менять синхронно.
const ALL_STEPS: Array<StepperStep & { index: number }> = [
  { key: 'union', index: 0, label: 'Членство в союзе' },
  { key: 'intro', index: 1, label: 'Тариф подключения' },
  { key: 'domain', index: 2, label: 'Домен кооператива' },
  { key: 'financial', index: 3, label: 'Финансовые параметры' },
  { key: 'agreement', index: 4, label: 'Соглашение о подключении' },
  { key: 'dns', index: 5, label: 'Делегирование домена' },
  { key: 'approval', index: 6, label: 'Подтверждение союза' },
  { key: 'installation', index: 7, label: 'Поставка инфраструктуры' },
]

const visibleSteps = computed(() =>
  system.info.is_unioned ? ALL_STEPS : ALL_STEPS.filter((s) => s.key !== 'union'),
)

const stepperSteps = computed<StepperStep[]>(() =>
  visibleSteps.value.map(({ key, label, description }) => ({ key, label, description })),
)

const activeKey = computed(() => {
  const found = visibleSteps.value.find((s) => s.index === currentStep.value)
  return found?.key ?? visibleSteps.value[0]?.key ?? 'intro'
})

const completedKeys = computed(() =>
  visibleSteps.value.filter((s) => s.index < currentStep.value).map((s) => s.key),
)

function onStepperChange(key: string) {
  const found = ALL_STEPS.find((s) => s.key === key)
  if (!found) return
  if (found.index >= currentStep.value) return
  connectionAgreement.setCurrentStep(found.index)
}

watch(
  () => currentStep.value,
  async (newStep, oldStep) => {
    if (newStep === 4 && oldStep !== 4) {
      try {
        await connectionAgreement.generateDocument()
      } catch (error) {
        console.error('Ошибка генерации документа:', error)
      }
    }
  },
)
</script>

<template lang="pug">
.connection-stepper
  VerticalStepper(
    :steps="stepperSteps"
    :active-key="activeKey"
    :completed="completedKeys"
    @change="onStepperChange"
  )
    template(#active="{ step }")
      UnionMembershipStep(v-if="step.key === 'union'")
        template(#registration)
          slot(name="union-registration")
      IntroStep(
        v-else-if="step.key === 'intro'"
        :selected-tariff="selectedTariff"
      )
      DomainStep(v-else-if="step.key === 'domain'")
      FinancialParamsStep(v-else-if="step.key === 'financial'")
      AgreementStep(
        v-else-if="step.key === 'agreement'"
        :html="html"
        :document="document"
        :signed-document="signedDocument"
      )
      DomainValidationStep(v-else-if="step.key === 'dns'")
      ApprovalWaitingStep(v-else-if="step.key === 'approval'")
      InstallationStep(v-else-if="step.key === 'installation'")
</template>

<style scoped>
.connection-stepper {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--p-6) var(--p-4);
}
</style>
