<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseInput } from 'src/shared/ui/base'
import { isDomain, notEmpty } from 'src/shared/lib/utils'
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
  title="На каком адресе будет работать кооператив"
  lead="Ваша копия платформы откроется по этому адресу — пайщики будут заходить на него, чтобы вступать, подписывать документы и участвовать в собраниях. Домен должен принадлежать вам: на одном из следующих шагов потребуется изменить его DNS-записи."
  :can-back="canGoBack"
  @back="handleBack"
  @next="handleContinue"
)
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseInput(
        v-model="announce"
        label="Домен или поддомен"
        placeholder="coop.ru или app.coop.ru"
        hint="Без https:// и без слэша в конце"
        :error="errorMsg || undefined"
        mono
      )
    .col-12.col-md-6
      ul.domain-step__tips
        li
          strong Подойдёт и поддомен.
          |  Если сайт кооператива уже живёт на coop.ru, платформу удобно разместить на app.coop.ru — сайт останется на месте.
        li
          strong Адрес можно сменить позже
          |  в настройках подключения, но пайщикам придётся сообщить новый.
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
