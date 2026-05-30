<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  BaseInput,
  BaseButton,
  BaseCard,
  BaseForm,
} from 'src/shared/ui/base'
import { isDomain, notEmpty } from 'src/shared/lib/utils'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const connectionAgreement = useConnectionAgreementStore()

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
    errorMsg.value = 'Укажите домен или поддомен'
    return false
  }
  if (isDomain(v) !== true) {
    errorMsg.value = 'Введите корректное имя домена'
    return false
  }
  errorMsg.value = ''
  return true
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({
    ...connectionAgreement.formData,
    announce: announce.value,
  })
  if (connectionAgreement.currentStep < 7) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep + 1)
  }
}

const handleBack = () => {
  if (connectionAgreement.currentStep > 1) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep - 1)
  }
}
</script>

<template lang="pug">
BaseForm.domain-form-step(@submit="handleContinue")
  BaseCard(title="Адрес кооператива в сети интернет")
    BaseInput(
      v-model="announce"
      label="Домен или поддомен"
      placeholder="domovoy.com или coop.domovoy.com"
      :error="errorMsg || undefined"
    )

  template(#footer)
    .row.items-center.q-gutter-sm
      BaseButton(variant="ghost" size="sm" type="button" @click="handleBack") Назад
      q-space
      BaseButton(variant="primary" size="sm" type="submit") Дальше
</template>

<style scoped>
.domain-form-step {
  max-width: 640px;
}
</style>
