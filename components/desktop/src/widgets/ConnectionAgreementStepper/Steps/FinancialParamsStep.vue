<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  BaseInput,
  BaseButton,
  BaseCard,
  BaseForm,
} from 'src/shared/ui/base'
import { notEmpty } from 'src/shared/lib/utils'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const connectionAgreement = useConnectionAgreementStore()

const initial = ref<string>(connectionAgreement.formData.initial || '')
const minimum = ref<string>(connectionAgreement.formData.minimum || '')
const orgInitial = ref<string>(connectionAgreement.formData.org_initial || '')
const orgMinimum = ref<string>(connectionAgreement.formData.org_minimum || '')
const errors = ref<Record<string, string>>({})

watch(
  () => connectionAgreement.formData,
  (v) => {
    initial.value = v.initial || ''
    minimum.value = v.minimum || ''
    orgInitial.value = v.org_initial || ''
    orgMinimum.value = v.org_minimum || ''
  },
  { deep: true },
)

const validate = (): boolean => {
  const e: Record<string, string> = {}
  if (notEmpty(initial.value) !== true) e.initial = 'Укажите сумму'
  if (notEmpty(minimum.value) !== true) e.minimum = 'Укажите сумму'
  if (notEmpty(orgInitial.value) !== true) e.orgInitial = 'Укажите сумму'
  if (notEmpty(orgMinimum.value) !== true) e.orgMinimum = 'Укажите сумму'
  errors.value = e
  return Object.keys(e).length === 0
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({
    ...connectionAgreement.formData,
    initial: initial.value,
    minimum: minimum.value,
    org_initial: orgInitial.value,
    org_minimum: orgMinimum.value,
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
BaseForm.financial-step(@submit="handleContinue")
  BaseCard.q-mb-md(
    title="Финансовые параметры"
    subtitle="Установите вступительные и минимальные паевые взносы для физических лиц, индивидуальных предпринимателей и организаций"
  )

  BaseCard.q-mb-md(title="Физические лица и ИП" subtitle="Применяется к пайщикам-гражданам при вступлении в кооператив")
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="initial"
          label="Вступительный взнос"
          type="number"
          placeholder="100"
          suffix="RUB"
          :error="errors.initial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="minimum"
          label="Минимальный паевый взнос"
          type="number"
          placeholder="300"
          suffix="RUB"
          :error="errors.minimum || undefined"
        )

  BaseCard(title="Организации" subtitle="Применяется к пайщикам-юрлицам при вступлении в кооператив")
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="orgInitial"
          label="Вступительный взнос"
          type="number"
          placeholder="1000"
          suffix="RUB"
          :error="errors.orgInitial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="orgMinimum"
          label="Минимальный паевый взнос"
          type="number"
          placeholder="3000"
          suffix="RUB"
          :error="errors.orgMinimum || undefined"
        )

  template(#footer)
    .row.items-center.q-gutter-sm
      BaseButton(variant="ghost" size="sm" type="button" @click="handleBack") Назад
      q-space
      BaseButton(variant="primary" size="sm" type="submit") Дальше
</template>

<style scoped>
.financial-step {
  max-width: 640px;
}
</style>
