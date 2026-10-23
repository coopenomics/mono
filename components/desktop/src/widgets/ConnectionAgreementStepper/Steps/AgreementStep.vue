<script setup lang="ts">
import { computed, ref } from 'vue'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { Loader } from 'src/shared/ui/Loader'
import { BaseBanner, BaseButton } from 'src/shared/ui/base'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useAddCooperative } from 'src/features/Union/AddCooperative/model'
import { selectProviderTariff } from 'src/features/Provider/api'
import { Zeus } from '@coopenomics/sdk'
import { useSessionStore } from 'src/entities/Session'
import { FailAlert } from 'src/shared/api'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

defineProps<{
  html?: string
}>()

const connectionAgreement = useConnectionAgreementStore()
const isSigning = ref(false)

const isRetrying = ref(false)

const retryDocument = async () => {
  isRetrying.value = true
  try {
    await connectionAgreement.generateDocument()
  } catch {
    // Причина уже в connectionAgreement.documentError — шаг её показывает.
  } finally {
    isRetrying.value = false
  }
}

const isDocumentReady = computed(
  () => !!(connectionAgreement.document && connectionAgreement.document.sign),
)

const handleSign = async () => {
  if (isSigning.value || !isDocumentReady.value) return
  isSigning.value = true
  try {
    // Тариф уходит провайдеру до заявки в цепь: по нему провайдер закажет
    // сервер и заведёт подписки. Отказ провайдера останавливает подписание —
    // иначе кооператив подключится не на том тарифе, который выбрал.
    const tariffCode = connectionAgreement.selectedTariff?.code
    if (tariffCode) {
      try {
        const billingPeriod =
          connectionAgreement.selectedTariff?.billingPeriod === 'year'
            ? Zeus.ProviderBillingPeriod.year
            : Zeus.ProviderBillingPeriod.month
        await selectProviderTariff({ tariff_code: tariffCode, billing_period: billingPeriod })
      } catch (error: any) {
        FailAlert(t('connectionAgreementStepper.agreementStep.tariffError', { reason: error?.message ?? error }))
        return
      }
    }
    await connectionAgreement.signDocument()
    const { addCooperative } = useAddCooperative()
    const session = useSessionStore()

    const registerData = {
      coopname: session.username,
      params: {
        is_cooperative: true,
        coop_type: 'conscoop',
        announce: connectionAgreement.formData.announce,
        // Рассказ кооператива о своей деятельности с первого шага мастера:
        // единственный on-chain слот под него — `description` записи coops,
        // из него же реестр совета показывает описание заявки.
        description: connectionAgreement.formData.description,
        initial: connectionAgreement.formData.initial,
        minimum: connectionAgreement.formData.minimum,
        org_initial: connectionAgreement.formData.org_initial,
        org_minimum: connectionAgreement.formData.org_minimum,
      },
      username: session.username,
      document: {
        ...connectionAgreement.signedDocument,
        meta: JSON.stringify(connectionAgreement.signedDocument.meta),
      },
    }

    await addCooperative(registerData)
    await connectionAgreement.reloadCooperative()
    await connectionAgreement.loadCurrentInstance()
    connectionAgreement.setCurrentStep(CONNECTION_STEP.dns)
  } catch (error: any) {
    console.error('Ошибка при подписании или отправке в блокчейн:', error)
    FailAlert(t('connectionAgreementStepper.agreementStep.signError', { reason: error?.message ?? error }))
  } finally {
    isSigning.value = false
  }
}

const handleBack = () => {
  connectionAgreement.setDocument(null)
  connectionAgreement.setSignedDocument(null)
  connectionAgreement.setCurrentStep(CONNECTION_STEP.financial)
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.agreementStep.stepTitle')"
  :lead="$t('connectionAgreementStepper.agreementStep.lead')"
  :next-label="$t('common.action.sign')"
  :next-disabled="!isDocumentReady"
  :loading="isSigning"
  @back="handleBack"
  @next="handleSign"
)
  .agreement-step__doc(v-if="html")
    DocumentHtmlReader(:html="html")
  //- Соглашение не собралось — причина и повтор вместо вечной загрузки.
  .agreement-step__error(v-else-if="connectionAgreement.documentError")
    BaseBanner(variant="neg") {{ connectionAgreement.documentError }}
    BaseButton(variant="secondary" size="sm" type="button" :loading="isRetrying" @click="retryDocument")
      | {{ $t('connectionAgreementStepper.agreementStep.retry') }}
  Loader(v-else :text="$t('connectionAgreementStepper.agreementStep.preparing')")
</template>

<style scoped>
.agreement-step__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
}
.agreement-step__doc {
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  padding: var(--p-5);
  max-height: 60vh;
  overflow: auto;
  background: var(--p-surface-2);
}
</style>
