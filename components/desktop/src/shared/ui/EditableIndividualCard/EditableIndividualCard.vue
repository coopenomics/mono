<template lang="pug">
q-form(ref="form" v-if="data")
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
    v-model="data.first_name"
    standout="bg-teal text-white"
    label="Имя"
    :readonly="readonly"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.middle_name"
    standout="bg-teal text-white"
    label="Отчество"
    :readonly="readonly"
    :rules="[val => validatePersonalName(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.last_name"
    standout="bg-teal text-white"
    label="Фамилия"
    :readonly="readonly"
    :rules="[val => notEmpty(val), val => validatePersonalName(val)]"
    autocomplete="off"
  )

  q-input(
    dense
    v-model="data.birthdate"
    standout="bg-teal text-white"
    mask="date"
    label="Дата рождения"
    placeholder="Формат: год/месяц/день"
    :readonly="readonly"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer" v-if="!readonly")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup label="Закрыть" color="primary" flat)

  q-input(
    dense
    v-model="data.phone"
    standout="bg-teal text-white"
    label="Телефон"
    :readonly="readonly"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  div(v-if="data.passport")
    q-input(
      dense
      v-model="data.passport.code"
      standout="bg-teal text-white"
      label="Код подразделения"
      mask="###-###"
      :readonly="readonly"
      :rules="[val => notEmpty(val), val => val.length === 7 || 'Код подразделения состоит из 6 цифр и тире (xxx-xxx)']"
      autocomplete="off"
    )

    q-input(
      dense
      :model-value="data.passport.series"
      @update:model-value="val => data.passport.series = Number(val)"
      standout="bg-teal text-white"
      label="Серия паспорта"
      mask="####"
      type="text"
      :readonly="readonly"
      :rules="[val => notEmpty(val), val => String(val).length === 4 || 'Серия должна состоять из 4 цифр']"
      autocomplete="off"
    )

    q-input(
      dense
      :model-value="data.passport.number"
      @update:model-value="val => data.passport.number = Number(val)"
      standout="bg-teal text-white"
      label="Номер паспорта"
      mask="######"
      type="text"
      :readonly="readonly"
      :rules="[val => notEmpty(val), val => String(val).length === 6 || 'Номер паспорта должен состоять из 6 цифр']"
      autocomplete="off"
    )



    q-input(
      dense
      v-model="data.passport.issued_at"
      standout="bg-teal text-white"
      mask="date"
      label="Дата выдачи"
      :readonly="readonly"
      :rules="['date', val => notEmpty(val)]"
      autocomplete="off"
    )
      template(v-slot:append)
        q-icon(name="event" class="cursor-pointer" v-if="!readonly")
          q-popup-proxy(cover transition-show="scale" transition-hide="scale")
            q-date(v-model="data.passport.issued_at")
              .row.items-center.justify-end
                q-btn(v-close-popup label="Закрыть" color="primary" flat)

    q-input(
      dense
      v-model="data.passport.issued_by"
      standout="bg-teal text-white"
      label="Кем выдан"
      :readonly="readonly"
      :rules="[val => notEmpty(val)]"
      autocomplete="off"
    )

    q-input(
      dense
      v-model="data.full_address"
      standout="bg-teal text-white"
      label="Адрес регистрации"
      :readonly="readonly"
      :rules="[val => notEmpty(val)]"
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

  <script lang="ts" setup>
  import { ref } from 'vue';
  import { useEditableData } from 'src/shared/lib/composables/useEditableData';
  import { validEmail } from 'src/shared/lib/utils/validEmailRule';
  import { validatePersonalName, notEmpty } from 'src/shared/lib/utils';
  import { FailAlert, SuccessAlert } from 'src/shared/api';
  import { type IUpdateAccountInput, useUpdateAccount } from 'src/features/Account/UpdateAccount/model';
  import { EditableActions } from 'src/shared/ui/EditableActions';
  import { type IIndividualData } from 'src/entities/Account/types';

  const { updateAccount } = useUpdateAccount()

  const props = defineProps({
    participantData: {
      type: Object as () => IIndividualData,
      required: true
    },
    readonly: {
      type: Boolean,
      default: false
    }
  });

  const localParticipantData = ref(props.participantData);
  const form = ref();
  const emit = defineEmits(['update']);

  const handleSave = async () => {
    try {
      const account_data: IUpdateAccountInput = {
        username: props.participantData.username,
        individual_data: data.value,
      }
      await updateAccount(account_data);
      emit('update', JSON.parse(JSON.stringify(data.value)))
      SuccessAlert('Данные аккаунта обновлены')
    } catch (e: any) {
      FailAlert(e);
    }
  };

  const { editableData: data, isEditing, isDisabled, saveChanges, cancelChanges } = useEditableData(
    localParticipantData.value,
    handleSave,
    form
  );
  </script>
