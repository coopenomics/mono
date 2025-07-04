<template lang="pug">
q-form(ref='form', v-if='data')
  q-input(
    dense,
    v-model='data.email',
    standout='bg-teal text-white',
    label='Email',
    :readonly='readonly',
    :rules='[(val) => validEmail(val)]',
    autocomplete='off'
  )
  q-select(
    dense,
    v-model='data.type',
    standout='bg-teal text-white',
    label='Тип организации',
    :options='[ { label: "Потребительский Кооператив", value: Zeus.OrganizationType.COOP }, { label: "Производственный Кооператив", value: Zeus.OrganizationType.PRODCOOP }, { label: "ООО", value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options,
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly'
  )

  q-input(
    dense,
    v-model='data.short_name',
    standout='bg-teal text-white',
    label='Краткое наименование',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.full_name',
    standout='bg-teal text-white',
    label='Полное наименование',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.represented_by.last_name',
    standout='bg-teal text-white',
    label='Фамилия представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.first_name',
    standout='bg-teal text-white',
    label='Имя представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.middle_name',
    standout='bg-teal text-white',
    label='Отчество представителя',
    :rules='[(val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.based_on',
    standout='bg-teal text-white',
    label='На основании',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.position',
    standout='bg-teal text-white',
    label='Должность представителя',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.phone',
    standout='bg-teal text-white',
    label='Телефон',
    mask='+7 (###) ###-##-##',
    fill-mask,
    :rules='[(val) => notEmpty(val), (val) => notEmptyPhone(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.country',
    standout='bg-teal text-white',
    label='Страна',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.city',
    standout='bg-teal text-white',
    label='Город',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.full_address',
    standout='bg-teal text-white',
    label='Юридический адрес',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.fact_address',
    standout='bg-teal text-white',
    label='Фактический адрес',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.details.inn',
    standout='bg-teal text-white',
    mask='############',
    label='ИНН',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || "ИНН должен содержать 10 или 12 цифр"]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.details.ogrn',
    standout='bg-teal text-white',
    mask='###############',
    label='ОГРН',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || "ОГРН должен содержать 13 или 15 цифр"]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.details.kpp',
    standout='bg-teal text-white',
    mask='#########',
    label='КПП',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "КПП должен содержать 9 цифр"]',
    :readonly='readonly',
    autocomplete='off'
  )

  EditableActions(
    v-if='!readonly',
    :isEditing='isEditing',
    :isDisabled='isDisabled',
    @save='saveChanges',
    @cancel='cancelChanges'
  )
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useEditableData } from 'src/shared/lib/composables/useEditableData';
import {
  notEmpty,
  notEmptyPhone,
  validatePersonalName,
} from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { EditableActions } from 'src/shared/ui/EditableActions';
import {
  type IUpdateAccountInput,
  useUpdateAccount,
} from 'src/features/Account/UpdateAccount/model';
import { type IOrganizationData } from 'src/entities/Account/types';
import { validEmail } from 'src/shared/lib/utils/validEmailRule';
import 'src/shared/ui/InputStyles/index.scss';
import { Zeus } from '@coopenomics/sdk';
const emit = defineEmits(['update']);
const { updateAccount } = useUpdateAccount();

const props = defineProps({
  participantData: {
    type: Object as () => IOrganizationData,
    required: true,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
});

const localOrganizationData = ref(props.participantData);
const form = ref();

const handleSave = async () => {
  try {
    const account_data: IUpdateAccountInput = {
      username: props.participantData.username,
      organization_data: data.value,
    };
    await updateAccount(account_data);
    emit('update', JSON.parse(JSON.stringify(data.value)));
    SuccessAlert('Данные аккаунта обновлены');
  } catch (e) {
    console.log(e);
    FailAlert(e);
  }
};
const {
  editableData: data,
  isEditing,
  isDisabled,
  saveChanges,
  cancelChanges,
} = useEditableData(localOrganizationData.value, handleSave, form);
</script>
