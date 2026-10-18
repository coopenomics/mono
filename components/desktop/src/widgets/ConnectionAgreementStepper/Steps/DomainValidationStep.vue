<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BaseButton, BaseChip } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const { loadCurrentInstance } = connectionAgreement
const { CONNECTOR_HOST } = useProviderSubscriptions()

const coop = computed(() => connectionAgreement.coop)
const instance = computed(() => connectionAgreement.currentInstance)
const isDelegated = computed(() => !!instance.value?.is_delegated)
const isChecking = ref(false)

// realtime: нет источника — проверку домена и состояние сервера ведёт провайдер (другой узел), в ленте кооператива их нет.
onMounted(async () => {
  if (!coop.value) {
    try {
      await connectionAgreement.reloadCooperative()
    } catch (error) {
      console.error('Ошибка загрузки кооператива:', error)
    }
  }
})


const handleContinue = () => {
  if (!isDelegated.value) return
  connectionAgreement.setCurrentStep(CONNECTION_STEP.approval)
}

const handleReload = async () => {
  isChecking.value = true
  try {
    await loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления инстанса:', error)
  } finally {
    isChecking.value = false
  }
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.domainValidationStep.stepTitle')"
  :lead="$t('connectionAgreementStepper.domainValidationStep.lead')"
  :next-disabled="!isDelegated"
  :can-back="false"
  @next="handleContinue"
)
  ol.dns-step__how
    li {{ $t('connectionAgreementStepper.domainValidationStep.howOpenPanel') }}
    li {{ $t('connectionAgreementStepper.domainValidationStep.howAddRecordPrefix') }}
      |  
      span.t-mono CNAME
      |  {{ $t('connectionAgreementStepper.domainValidationStep.howAddRecordSuffix') }}
    li {{ $t('connectionAgreementStepper.domainValidationStep.howSave') }}

  .dns-step__values
    DataRow(:label="$t('connectionAgreementStepper.domainValidationStep.recordName')" :value="coop?.announce" mono copyable)
    DataRow(:label="$t('connectionAgreementStepper.domainValidationStep.recordValue')" :value="CONNECTOR_HOST" mono copyable)

  .dns-step__status
    BaseChip(:variant="isDelegated ? 'pos' : 'warn'")
      q-icon(:name="isDelegated ? 'check' : 'schedule'" size="12px").q-mr-xs
      span {{ isDelegated ? $t('connectionAgreementStepper.domainValidationStep.statusDelegated') : $t('connectionAgreementStepper.domainValidationStep.statusWaiting') }}
    BaseButton(
      v-if="!isDelegated"
      variant="secondary"
      size="sm"
      type="button"
      :loading="isChecking"
      @click="handleReload"
    ) {{ $t('connectionAgreementStepper.domainValidationStep.checkNow') }}
</template>

<style scoped>
.dns-step__how {
  margin: 0;
  padding-left: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  color: var(--p-ink-1);
}
.dns-step__values {
  margin-top: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  padding: 0 var(--p-4);
  background: var(--p-surface-2);
}
.dns-step__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>
