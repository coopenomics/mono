<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton, BaseChip } from 'src/shared/ui/base'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'
import WaitingIcon from '../ui/WaitingIcon.vue'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)
const isApproved = computed(() => instance.value?.blockchain_status === 'active')
const isChecking = ref(false)

// До решения совета можно вернуться к домену — сверить или исправить адрес.
// К соглашению и шагам до него назад не пускает: соглашение подписано.
const handleBack = () => {
  connectionAgreement.setCurrentStep(CONNECTION_STEP.dns)
}

const refreshStatus = async () => {
  isChecking.value = true
  try {
    await connectionAgreement.loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления статуса:', error)
  } finally {
    isChecking.value = false
  }
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.approvalWaitingStep.stepTitle')"
  :lead="$t('connectionAgreementStepper.approvalWaitingStep.lead')"
  :can-back="!isApproved"
  :has-next="false"
  @back="handleBack"
)
  template(#icon)
    //- Пульсирует, пока заявка ждёт совет: страница следит за статусом сама.
    WaitingIcon(:done="isApproved")

  .approval-step__status
    BaseChip(:variant="isApproved ? 'pos' : 'warn'")
      q-icon(:name="isApproved ? 'check' : 'schedule'" size="12px").q-mr-xs
      span {{ isApproved ? $t('connectionAgreementStepper.approvalWaitingStep.statusConfirmed') : $t('connectionAgreementStepper.approvalWaitingStep.statusWaiting') }}
    BaseButton(
      v-if="!isApproved"
      variant="secondary"
      size="sm"
      type="button"
      :loading="isChecking"
      @click="refreshStatus"
    ) {{ $t('connectionAgreementStepper.approvalWaitingStep.checkNow') }}
</template>

<style scoped>
.approval-step__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
  padding-top: var(--p-2);
}
</style>
