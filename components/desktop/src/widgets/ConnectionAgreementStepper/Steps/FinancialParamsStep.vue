<script setup lang="ts">
import { ref, watch } from 'vue'
import { BaseInput } from 'src/shared/ui/base'
import { notEmpty } from 'src/shared/lib/utils'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'

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
  connectionAgreement.setCurrentStep(CONNECTION_STEP.agreement)
}

const handleBack = () => connectionAgreement.setCurrentStep(CONNECTION_STEP.domain)
</script>

<template lang="pug">
StepFrame(
  title="Сколько платят при вступлении"
  lead="Каждый новый пайщик при вступлении вносит вступительный взнос и первый паевой. Эти суммы платформа подставит в заявление о вступлении и проверит при оплате. Для граждан и для организаций они обычно разные — задайте обе пары."
  @back="handleBack"
  @next="handleContinue"
)
  .financial-step__group
    .financial-step__group-head
      .t-h3 Граждане и ИП
      p.t-sm.t-muted.financial-step__group-note Физические лица и индивидуальные предприниматели.
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="initial"
          label="Вступительный взнос"
          type="number"
          placeholder="100"
          suffix="RUB"
          hint="Разовый, при вступлении"
          :error="errors.initial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="minimum"
          label="Минимальный паевой взнос"
          type="number"
          placeholder="300"
          suffix="RUB"
          hint="Меньше этой суммы внести нельзя"
          :error="errors.minimum || undefined"
        )

  .financial-step__group
    .financial-step__group-head
      .t-h3 Организации
      p.t-sm.t-muted.financial-step__group-note Юридические лица, вступающие в кооператив.
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseInput(
          v-model="orgInitial"
          label="Вступительный взнос"
          type="number"
          placeholder="1000"
          suffix="RUB"
          hint="Разовый, при вступлении"
          :error="errors.orgInitial || undefined"
        )
      .col-12.col-md-6
        BaseInput(
          v-model="orgMinimum"
          label="Минимальный паевой взнос"
          type="number"
          placeholder="3000"
          suffix="RUB"
          hint="Меньше этой суммы внести нельзя"
          :error="errors.orgMinimum || undefined"
        )
</template>

<style scoped>
.financial-step__group + .financial-step__group {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.financial-step__group-head {
  margin-bottom: var(--p-3);
}
.financial-step__group-note {
  margin: var(--p-1) 0 0;
}
</style>
