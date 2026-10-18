<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BaseButton, BaseChip, BaseInput } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { useUpdateCoop } from 'src/features/Cooperative/UpdateCoop'
import { isCoopDomain } from 'src/shared/lib/utils'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { t } from 'src/shared/i18n'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const { loadCurrentInstance } = connectionAgreement
const { CONNECTOR_HOST } = useProviderSubscriptions()
const { changeCoopDomain } = useUpdateCoop()

const coop = computed(() => connectionAgreement.coop)
const isDelegated = computed(() => connectionAgreement.isDomainDelegated)
const isChecking = ref(false)

// Правка адреса: соглашение подписано, кооператив уже в цепи, поэтому адрес
// меняется действием updatecoop, как на панели подключения. Провайдер
// подхватит новый домен из цепи и проверит делегирование заново.
const isEditing = ref(false)
const domainValue = ref('')
const domainError = ref('')
const isSaving = ref(false)

const startEdit = () => {
  domainValue.value = coop.value?.announce || ''
  domainError.value = ''
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  domainError.value = ''
}

const saveDomain = async () => {
  const valid = isCoopDomain(domainValue.value)
  if (valid !== true) {
    domainError.value = valid
    return
  }
  if (!coop.value) {
    FailAlert(t('connectionDashboard.domainCard.coopDataError'))
    return
  }
  isSaving.value = true
  try {
    await changeCoopDomain(coop.value, domainValue.value)
    await connectionAgreement.reloadCooperative()
    await loadCurrentInstance()
    isEditing.value = false
    SuccessAlert(t('connectionDashboard.domainCard.domainUpdated'))
  } catch (error: any) {
    FailAlert(t('connectionDashboard.domainCard.domainUpdateError', { errorMessage: error.message }))
  } finally {
    isSaving.value = false
  }
}

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

  //- Ошибся в адресе — исправляется здесь же, без возврата к подписанному соглашению.
  .dns-step__edit(v-if="isEditing")
    BaseInput(
      v-model="domainValue"
      :label="$t('connectionAgreementStepper.domainStep.domainLabel')"
      stack-label
      prefix="https://"
      :placeholder="$t('connectionAgreementStepper.domainStep.domainPlaceholder')"
      :hint="$t('connectionAgreementStepper.domainValidationStep.editHint')"
      :error="domainError || undefined"
      mono
    )
    .dns-step__edit-actions
      BaseButton(variant="primary" size="sm" type="button" :loading="isSaving" @click="saveDomain")
        | {{ $t('common.action.save') }}
      BaseButton(variant="ghost" size="sm" type="button" :disabled="isSaving" @click="cancelEdit")
        | {{ $t('connectionDashboard.domainCard.cancel') }}

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
    BaseButton(
      v-if="!isEditing"
      variant="ghost"
      size="sm"
      type="button"
      @click="startEdit"
    )
      q-icon(name="edit" size="14px").q-mr-xs
      | {{ $t('connectionAgreementStepper.domainValidationStep.editAddress') }}
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
.dns-step__edit {
  margin-top: var(--p-4);
}
.dns-step__edit-actions {
  display: flex;
  gap: var(--p-2);
  margin-top: var(--p-3);
}
.dns-step__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>
