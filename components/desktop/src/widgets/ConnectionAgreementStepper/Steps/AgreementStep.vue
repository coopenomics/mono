<script setup lang="ts">
import { computed, ref } from 'vue'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { Loader } from 'src/shared/ui/Loader'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useAddCooperative } from 'src/features/Union/AddCooperative/model'
import { useSessionStore } from 'src/entities/Session'
import { FailAlert } from 'src/shared/api'
import StepFrame from '../ui/StepFrame.vue'

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
    FailAlert(`Не удалось подписать соглашение: ${error?.message ?? error}`)
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
  title="Соглашение о подключении"
  lead="Это договор между кооперативом и платформой: в нём зафиксированы адрес, взносы с предыдущих шагов и условия обслуживания. Прочитайте и подпишите его своим ключом — после подписи кооператив будет зарегистрирован в блокчейне, и провайдер начнёт готовить установку."
  next-label="Подписать"
  :next-disabled="!isDocumentReady"
  :loading="isSigning"
  @back="handleBack"
  @next="handleSign"
)
  .agreement-step__doc(v-if="html")
    DocumentHtmlReader(:html="html")
  Loader(v-else :text="'Готовим соглашение…'")
</template>

<style scoped>
.agreement-step__doc {
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  padding: var(--p-5);
  max-height: 60vh;
  overflow: auto;
  background: var(--p-surface-2);
}
</style>
