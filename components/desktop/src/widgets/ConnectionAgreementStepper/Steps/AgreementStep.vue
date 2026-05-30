<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton } from 'src/shared/ui/base/BaseButton'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { Loader } from 'src/shared/ui/Loader'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useAddCooperative } from 'src/features/Union/AddCooperative/model'
import { useSessionStore } from 'src/entities/Session'

defineProps<{
  html?: string
}>()

const connectionAgreement = useConnectionAgreementStore()
const isSigning = ref(false)

const isDocumentReady = computed(
  () => !!(connectionAgreement.document && connectionAgreement.document.sign),
)

const handleSign = async () => {
  if (isSigning.value || !isDocumentReady.value) return
  isSigning.value = true
  try {
    await connectionAgreement.signDocument()
    const { addCooperative } = useAddCooperative()
    const session = useSessionStore()

    const registerData = {
      coopname: session.username,
      params: {
        is_cooperative: true,
        coop_type: 'conscoop',
        announce: connectionAgreement.formData.announce,
        description: '',
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

    if (connectionAgreement.currentStep < 7) {
      connectionAgreement.setCurrentStep(connectionAgreement.currentStep + 1)
    }
  } catch (error) {
    console.error('Ошибка при подписании или отправке в блокчейн:', error)
    throw error
  } finally {
    isSigning.value = false
  }
}

const handleBack = () => {
  connectionAgreement.setDocument(null)
  connectionAgreement.setSignedDocument(null)
  if (connectionAgreement.currentStep > 0) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep - 1)
  }
}
</script>

<template lang="pug">
.agreement-step
  template(v-if="html")
    .agreement-step__doc
      DocumentHtmlReader(:html="html")
    .agreement-step__actions
      BaseButton(
        variant="ghost"
        size="sm"
        @click="handleBack"
      ) Назад
      .agreement-step__spacer
      BaseButton(
        variant="primary"
        size="sm"
        :loading="isSigning"
        :disabled="!isDocumentReady"
        @click="handleSign"
      ) Подписать
  template(v-else)
    Loader(:text="'Готовим соглашение...'")
</template>

<style scoped>
.agreement-step {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
.agreement-step__doc {
  background: var(--p-surface);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  padding: var(--p-5);
  max-height: 540px;
  overflow: auto;
}
.agreement-step__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
.agreement-step__spacer {
  flex: 1 1 auto;
}
</style>
