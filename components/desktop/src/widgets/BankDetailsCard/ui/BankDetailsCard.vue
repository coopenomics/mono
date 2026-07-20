<template lang="pug">
q-form(ref="form")
  q-input(
    dense
    v-model="data.data.bank_name"
    standout="bg-teal text-white"
    label="Наименование банка"
    placeholder="ПАО Сбербанк"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.details.corr"
    standout="bg-teal text-white"
    mask="####################"
    label="Корреспондентский счет"
    placeholder="20 цифр"
    :rules="[val => notEmpty(val), val => val.length === 20 || 'Корреспондентский счет должен содержать 20 цифр']"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.details.bik"
    standout="bg-teal text-white"
    mask="#########"
    label="БИК"
    placeholder="9 цифр"
    :rules="[val => notEmpty(val), val => val.length === 9 || 'БИК должен содержать 9 цифр']"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.data.account_number"
    standout="bg-teal text-white"
    mask="####################"
    label="Номер счета"
    placeholder="20 цифр"
    :rules="[val => notEmpty(val), val => val.length === 20 || 'Номер счета должен содержать 20 цифр']"
    autocomplete="off"
  )
  q-select(
    dense
    v-model="data.data.currency"
    label="Валюта счёта"
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

