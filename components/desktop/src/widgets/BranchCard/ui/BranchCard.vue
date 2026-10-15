<script lang="ts" setup>
import { useEditableData } from 'src/shared/lib/composables/useEditableData';
import { notEmptyPhone, notEmpty } from 'src/shared/lib/utils';
import { validEmail } from 'src/shared/lib/utils/validEmailRule';
import type { IBranch } from 'src/entities/Branch/model';
import { EditableActions } from 'src/shared/ui/EditableActions';
import { ref } from 'vue';
import { useEditBranch } from 'src/features/Branch/EditBranch';
import { FailAlert } from 'src/shared/api';

const props = defineProps({
  branch: {
    type: Object as () => IBranch,
    required: true,
  },
});

// Обработка сохранения
const handleSave = async (updatedBranch: IBranch) => {
  console.log('Сохранено:', updatedBranch);
  const {editBranch} = useEditBranch()
  try {
    await editBranch(updatedBranch)
  } catch(e){
    FailAlert(e)
  }

};

// Ссылка на форму
const form = ref();

// Используем composable функцию
const {
  editableData: data,
  isEditing,
  saveChanges,
  cancelChanges,
  isDisabled
} = useEditableData(props.branch, handleSave, form);
</script>

<template lang="pug">
q-form(ref="form")
  q-input(readonly dense v-model="data.braname" standout="bg-teal text-white" :label="$t('branchCard.branchCard.branchUsernameLabel')" hint="" autocomplete="off")
  q-input(dense v-model="data.trustee.username" standout="bg-teal text-white" :label="$t('branchCard.branchCard.trusteeUsernameLabel')" hint="" autocomplete="off")
  q-input(
    dense
    v-model="data.phone"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.phoneLabel')"
    mask="+7 (###) ###-##-##"
    fill-mask
    hint=""
    :rules="[val => notEmpty(val), val => notEmptyPhone(val)]"
    autocomplete="off"
  )
  q-input(
    dense
    v-model="data.email"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.emailLabel')"
    :rules="[val => validEmail(val)]"
  )
  q-input(
    dense
    v-model="data.short_name"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.shortNameLabel')"
    :rules="[val => notEmpty(val)]"
  )
  q-input(
    dense
    v-model="data.full_name"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.fullNameLabel')"
    :rules="[val => notEmpty(val)]"
  )
  q-input(
    dense
    v-model="data.fact_address"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.addressLabel')"
    type="textarea"
    rows="2"
    :rules="[val => notEmpty(val)]"
  )
  q-input(
    dense
    v-model="data.represented_by.based_on"
    standout="bg-teal text-white"
    :label="$t('branchCard.branchCard.basedOnLabel')"
    :rules="[val => notEmpty(val)]"
  )

  EditableActions(:isDisabled="isDisabled" :isEditing="isEditing" @save="saveChanges" @cancel="cancelChanges")
  div.q-gutter-sm


</template>
