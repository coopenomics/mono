<template lang="pug">
q-form(ref="form")
  q-input(
    dense
    v-model="data.data.bank_name"
    standout="bg-teal text-white"
    :label="$t('bankDetailsCard.bankDetailsCard.bankNameLabel')"
    :placeholder="$t('bankDetailsCard.bankDetailsCard.bankNamePlaceholder')"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.details.corr"
    standout="bg-teal text-white"
    mask="####################"
    :label="$t('bankDetailsCard.bankDetailsCard.corrAccountLabel')"
    :placeholder="$t('bankDetailsCard.bankDetailsCard.placeholder20Digits')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('bankDetailsCard.bankDetailsCard.corrAccountLengthError')]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.details.bik"
    standout="bg-teal text-white"
    mask="#########"
    :label="$t('bankDetailsCard.bankDetailsCard.bikLabel')"
    :placeholder="$t('bankDetailsCard.bankDetailsCard.placeholder9Digits')"
    :rules="[val => notEmpty(val), val => val.length === 9 || $t('bankDetailsCard.bankDetailsCard.bikLengthError')]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.account_number"
    standout="bg-teal text-white"
    mask="####################"
    :label="$t('bankDetailsCard.bankDetailsCard.accountNumberLabel')"
    :placeholder="$t('bankDetailsCard.bankDetailsCard.placeholder20Digits')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('bankDetailsCard.bankDetailsCard.accountNumberLengthError')]"
    autocomplete="off"
  )
  q-select(
    dense
    v-model="data.data.currency"
    :label="$t('bankDetailsCard.bankDetailsCard.currencyLabel')"
    standout="bg-teal text-white"
    :options="[{ label: 'RUB', value: 'RUB' }]"
    emit-value
    :rules="[val => notEmpty(val)]"
    map-options
  )

  EditableActions(
    :isEditing="isEditing"
    :isDisabled="isDisabled"
    @save="saveChanges"
    @cancel="cancelChanges"
  )
  </template>

  <script lang="ts" setup>
import { ref } from 'vue';
import { useEditableData } from 'src/shared/lib/composables/useEditableData';
import type { Zeus } from '@coopenomics/sdk';
import { EditableActions } from 'src/shared/ui/EditableActions';
import { notEmpty } from 'src/shared/lib/utils';
import { useUpdateBranchBankAccount } from 'src/features/PaymentMethod/UpdateBankAccount/model';
import { FailAlert } from 'src/shared/api';

const props = defineProps({
  bankDetails: {
    type: Object as () => Zeus.ModelTypes['BankPaymentMethod'],
    required: true
  }
});

// Ссылка на форму
const form = ref();

// Обработка сохранения
const handleSave = async (data: Zeus.ModelTypes['BankPaymentMethod']) => {
  try {
    const { updateBankAccount } = useUpdateBranchBankAccount();
    await updateBankAccount(data);
  } catch(e){
    FailAlert(e)
  }
};

// Используем composable функцию
const { editableData: data, isEditing, isDisabled, saveChanges, cancelChanges } = useEditableData(
  props.bankDetails,
  handleSave,
  form // Передаем ссылку на форму
);
</script>

