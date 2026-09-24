<template lang="pug">
div
  Form(:handler-submit="saveData" :showCancel="true" :button-cancel-txt="$t('common.action.back')" :button-submit-txt="$t('union.cooperativeDataForm.continueLabel')" @cancel="handleBack").q-gutter-md

    //- Домен кооператива
    .form-section.q-mb-lg
      .section-header.q-mb-md
        .section-title
          q-icon(name="domain" size="20px" color="primary").q-mr-sm
          span.text-subtitle1.text-weight-medium {{ $t('union.cooperativeDataForm.domainSectionTitle') }}
        .section-description.text-body2.q-mt-sm
          | {{ $t('union.cooperativeDataForm.domainSectionDescription') }}

      q-input.form-input(
        standout="bg-teal text-white"
        :hint="$t('union.cooperativeDataForm.domainHint')"
        :label="$t('union.cooperativeDataForm.domainLabel')"
        v-model="formData.announce"
        :rules="[val => notEmpty(val), val => isDomain(val)]"
      )

    //- Финансовые параметры
    .form-section.q-mb-lg
      .section-header.q-mb-md
        .section-title
          q-icon(name="account_balance_wallet" size="20px" color="secondary").q-mr-sm
          span.text-subtitle1.text-weight-medium {{ $t('union.cooperativeDataForm.financialSectionTitle') }}
        .section-description.text-body2.q-mt-sm
          | {{ $t('union.cooperativeDataForm.financialSectionDescription') }}

      .financial-grid
        .grid-section.q-mb-md
          .subsection-title.text-body1.text-weight-medium.q-mb-sm {{ $t('union.cooperativeDataForm.individualSectionTitle') }}
          .input-row.q-mb-sm
            q-input.form-input(
              standout="bg-teal text-white"
              placeholder="100"
              :label="$t('union.cooperativeDataForm.initialIndividualLabel')"
              v-model="formData.initial"
              type="number"
              :min="0"
              :rules="[val => notEmpty(val)]"
            )
              template(#append)
                span.text-overline RUB
          .input-row
            q-input.form-input(
              standout="bg-teal text-white"
              :label="$t('union.cooperativeDataForm.minimumIndividualLabel')"
              placeholder="300"
              v-model="formData.minimum"
              type="number"
              :min="0"
              :rules="[val => notEmpty(val)]"
            )
              template(#append)
                span.text-overline RUB

        .grid-section
          .subsection-title.text-body1.text-weight-medium.q-mb-sm {{ $t('union.cooperativeDataForm.orgSectionTitle') }}
          .input-row.q-mb-sm
            q-input.form-input(
              standout="bg-teal text-white"
              placeholder="1000"
              :label="$t('union.cooperativeDataForm.initialOrgLabel')"
              v-model="formData.org_initial"
              type="number"
              :min="0"
              :rules="[val => notEmpty(val)]"
            )
              template(#append)
                span.text-overline RUB
          .input-row
            q-input.form-input(
              standout="bg-teal text-white"
              placeholder="3000"
              :label="$t('union.cooperativeDataForm.minimumOrgLabel')"
              v-model="formData.org_minimum"
              type="number"
              :min="0"
              :rules="[val => notEmpty(val)]"
            )
              template(#append)
                span.text-overline RUB
</template>
<script lang="ts" setup>
import { ref, watch } from 'vue'
import { Form } from 'src/shared/ui/Form';
import { notEmpty, isDomain } from 'src/shared/lib/utils';
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement';
import type { ICooperativeFormData } from 'src/entities/ConnectionAgreement/model/types';


const emit = defineEmits(['continue', 'back'])

const connectionAgreement = useConnectionAgreementStore()

// Локальное состояние формы для избежания проблем с реактивностью
const formData = ref<ICooperativeFormData>({
  announce: connectionAgreement.formData.announce || '',
  initial: connectionAgreement.formData.initial || '',
  minimum: connectionAgreement.formData.minimum || '',
  org_initial: connectionAgreement.formData.org_initial || '',
  org_minimum: connectionAgreement.formData.org_minimum || ''
})

// Синхронизируем локальное состояние с изменениями в store
watch(() => connectionAgreement.formData, (newFormData) => {
  formData.value = {
    announce: newFormData.announce || '',
    initial: newFormData.initial || '',
    minimum: newFormData.minimum || '',
    org_initial: newFormData.org_initial || '',
    org_minimum: newFormData.org_minimum || ''
  }
}, { deep: true })

// Синхронизируем локальное состояние с store при изменении
const syncFormData = () => {
  connectionAgreement.setFormData(formData.value)
}

const handleBack = () => {
  emit('back')
}

const saveData = async () => {
  console.log('📤 CooperativeDataForm: Данные формы:', formData.value)
  // Синхронизируем данные с store перед отправкой
  syncFormData()
  emit('continue', formData.value)
}
</script>

<style scoped>
.form-section {
  padding: 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: 1rem;
  display: block;
}

.section-title {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
}

.section-description {
  line-height: 1.5;
}

.financial-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.grid-section {
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.subsection-title {
  color: var(--q-primary);
  border-bottom: 2px solid var(--q-primary);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.input-row {
  margin-bottom: 1rem;
}

.input-row:last-child {
  margin-bottom: 0;
}

.form-input {
  margin-bottom: 0;
}

/* Разделитель между секциями */
.form-section + .form-section {
  margin-top: 2rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .financial-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .form-section {
    padding: 1.25rem;
  }
}

@media (max-width: 480px) {
  .form-section {
    padding: 1rem;
  }

  .section-title {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .section-header {
    text-align: center;
    display: block !important;
  }

  .section-description {
    display: block !important;
    width: 100% !important;
  }

  .financial-grid {
    gap: 1rem;
  }

  .grid-section {
    padding: 0.75rem;
  }

  .subsection-title {
    font-size: 1rem;
  }
}
</style>
