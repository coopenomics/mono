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
    :label='$t("ui.editableOrganizationCard.typeLabel")',
    :options='[ { label: $t("ui.editableOrganizationCard.typeConsumerOption"), value: Zeus.OrganizationType.COOP }, { label: $t("ui.editableOrganizationCard.typeProductionOption"), value: Zeus.OrganizationType.PRODCOOP }, { label: $t("ui.editableOrganizationCard.typeLlcOption"), value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options,
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly'
  )

  q-input(
    dense,
    v-model='data.short_name',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.shortNameLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.full_name',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.fullNameLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.represented_by.last_name',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.repLastNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.first_name',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.repFirstNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.middle_name',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.repMiddleNameLabel")',
    :rules='[(val) => validatePersonalName(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.based_on',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.basisLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.represented_by.position',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.repPositionLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.phone',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.phoneLabel")',
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
    :label='$t("ui.editableOrganizationCard.countryLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.city',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.cityLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.full_address',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.legalAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.fact_address',
    standout='bg-teal text-white',
    :label='$t("ui.editableOrganizationCard.actualAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    :readonly='readonly',
    autocomplete='off'
  )

  q-input(
    dense,
    v-model='data.details.inn',
    standout='bg-teal text-white',
    mask='############',
    :label='$t("ui.editableOrganizationCard.innLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || $t("ui.editableOrganizationCard.innError")]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.details.ogrn',
    standout='bg-teal text-white',
    mask='###############',
    :label='$t("ui.editableOrganizationCard.ogrnLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || $t("ui.editableOrganizationCard.ogrnError")]',
    :readonly='readonly',
    autocomplete='off'
  )
  q-input(
    dense,
    v-model='data.details.kpp',
    standout='bg-teal text-white',
    mask='#########',
    :label='$t("ui.editableOrganizationCard.kppLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("ui.editableOrganizationCard.kppError")]',
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
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';
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
    SuccessAlert(t('ui.editableOrganizationCard.updatedText'));
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
