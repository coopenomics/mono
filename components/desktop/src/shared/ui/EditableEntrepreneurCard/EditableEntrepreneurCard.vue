<template lang="pug">
q-form(ref="form")
  q-input(
    dense
    v-model="data.email"
    standout="bg-teal text-white"
    label="Email"
    :readonly="readonly"
    :rules="[val => validEmail(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.last_name"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.lastNameLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => validatePersonalName(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.first_name"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.firstNameLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => validatePersonalName(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.middle_name"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.middleNameLabel')"
    :readonly="readonly"
    :rules="[val => validatePersonalName(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.birthdate"
    standout="bg-teal text-white"
    mask="date"
    :label="$t('ui.editableEntrepreneurCard.birthDateLabel')"
    :placeholder="$t('ui.editableEntrepreneurCard.birthDatePlaceholder')"
    :readonly="readonly"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer" v-if="!readonly")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup :label="$t('common.action.close')" color="primary" flat)

  q-input(
    dense
    v-model="data.phone"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.phoneLabel')"
    mask="+7 (###) ###-##-##"
    fill-mask
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => notEmptyPhone(val)]"
    autocomplete="off"
  )

  q-select(
    dense
    v-model="data.country"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.countryLabel')"
    :options="[{ label: $t('ui.editableEntrepreneurCard.russiaOptionLabel'), value: $t('ui.editableEntrepreneurCard.russiaOptionLabel') }]"
    map-options
    emit-value
    :readonly="readonly"
    :rules="[val => notEmpty(val)]"
  )

  q-input(
    dense
    v-model="data.city"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.cityLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.full_address"
    standout="bg-teal text-white"
    :label="$t('ui.editableEntrepreneurCard.addressLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.details.inn"
    standout="bg-teal text-white"
    mask="############"
    :label="$t('ui.editableEntrepreneurCard.innLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => (val.length === 10 || val.length === 12) || $t('ui.editableEntrepreneurCard.innError')]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.details.ogrn"
    standout="bg-teal text-white"
    mask="###############"
    :label="$t('ui.editableEntrepreneurCard.ogrnipLabel')"
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => (val.length === 13 || val.length === 15) || $t('ui.editableEntrepreneurCard.ogrnipError')]"
    autocomplete="off"
  )

  EditableActions(
    v-if="!readonly"
    :isEditing="isEditing"
    :isDisabled="isDisabled"
    @save="saveChanges"
    @cancel="cancelChanges"
  )
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useEditableData } from 'src/shared/lib/composables/useEditableData';
  import { validEmail } from 'src/shared/lib/utils/validEmailRule';
  import { notEmpty, notEmptyPhone, validatePersonalName } from 'src/shared/lib/utils';
  import { FailAlert, SuccessAlert } from 'src/shared/api';
  import { EditableActions } from 'src/shared/ui/EditableActions';
  import { type IUpdateAccountInput, useUpdateAccount } from 'src/features/Account/UpdateAccount/model';
  import { type IEntrepreneurData } from 'src/entities/Account/types';
import { t } from 'src/shared/i18n';

  const emit = defineEmits(['update']);
  const { updateAccount } = useUpdateAccount();

  const props = defineProps({
    participantData: {
      type: Object as () => IEntrepreneurData,
      required: true
    },
    readonly: {
      type: Boolean,
      default: false
    }
  });

  const localEntrepreneurData = ref(props.participantData);
  const form = ref();

  const handleSave = async () => {
    try {
      const account_data: IUpdateAccountInput = {
        username: props.participantData.username,
        entrepreneur_data: data.value,
      };
      await updateAccount(account_data);
      emit('update', JSON.parse(JSON.stringify(data.value)));
      SuccessAlert(t('ui.editableEntrepreneurCard.updatedText'));
    } catch (e) {
      console.log(e);
      FailAlert(e);
    }
  };

  const { editableData: data, isEditing, isDisabled, saveChanges, cancelChanges } = useEditableData(
    localEntrepreneurData.value,
    handleSave,
    form
  );
</script>
