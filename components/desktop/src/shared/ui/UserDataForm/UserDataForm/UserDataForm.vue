<template lang="pug">
div
  q-form(ref='localUserDataForm')
    slot(name='top')

    .user-data-form__type(v-if='showTypeButtons')
      p.user-data-form__type-title {{ $t('ui.userDataForm.chooseAccountTypeTitle') }}
      .user-data-form__type-list
        BaseRadioCard(
          :model-value='userData.type ?? null',
          value='individual',
          :title='$t("ui.userDataForm.individualTitle")',
          :description='$t("ui.userDataForm.individualDescription")',
          @update:model-value='selectType("individual")'
        )
        BaseRadioCard(
          :model-value='userData.type ?? null',
          value='entrepreneur',
          :title='$t("ui.userDataForm.entrepreneurTitle")',
          :description='$t("ui.userDataForm.entrepreneurDescription")',
          @update:model-value='selectType("entrepreneur")'
        )
        BaseRadioCard(
          :model-value='userData.type ?? null',
          value='organization',
          :title='$t("ui.userDataForm.organizationTitle")',
          :description='$t("ui.userDataForm.organizationDescription")',
          @update:model-value='selectType("organization")'
        )

    .user-data-form__change(v-else)
      BaseButton(variant='ghost', @click='changeAccountType')
        q-icon(name='arrow_back', size='16px').q-mr-sm
        | {{ getSelectedTypeLabel() }}

    div(v-if='userData.type === "individual"')
      IndividualDataForm(v-model:userData='userData')

    div(v-if='userData.type === "organization"')
      OrganizationDataForm(v-model:userData='userData')

    div(v-if='userData.type === "entrepreneur"')
      EntrepreneurDataForm(v-model:userData='userData')

    slot(name='bottom', :userDataForm='localUserDataForm')
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import type { IUserData } from 'src/shared/lib/types/user/IUserData';
import { IndividualDataForm } from '../IndividualDataForm';
import { OrganizationDataForm } from '../OrganizationDataForm';
import { EntrepreneurDataForm } from '../EntrepreneurDataForm';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';
import { t } from 'src/shared/i18n';

const props = defineProps<{ userData: IUserData }>();
const emit = defineEmits<{
  typeSelected: [type: 'individual' | 'entrepreneur' | 'organization'];
  typeCleared: [];
}>();

const userData = ref<IUserData>(props.userData);
const showTypeButtons = ref<boolean>(
  !userData.value.type || userData.value.type === null,
); // Показывать кнопки если тип не выбран

const selectType = (type: 'individual' | 'entrepreneur' | 'organization') => {
  userData.value.type = type;
  showTypeButtons.value = false; // Скрыть кнопки после выбора
  emit('typeSelected', type); // Сообщить родителю о выборе типа
};

const changeAccountType = () => {
  (userData.value.type as any) = undefined; // Скрыть формы путем удаления типа
  showTypeButtons.value = true; // Показать кнопки выбора типа
  emit('typeCleared'); // Сообщить родителю о сбросе типа
};

const getSelectedTypeLabel = () => {
  switch (userData.value.type) {
    case 'individual':
      return t('ui.userDataForm.individualTitle');
    case 'entrepreneur':
      return t('ui.userDataForm.entrepreneurLabel');
    case 'organization':
      return t('ui.userDataForm.organizationTitle');
    default:
      return t('ui.userDataForm.selectTypeLabel');
  }
};

const localUserDataForm = ref(null);
</script>

<style scoped>
.user-data-form__type {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  margin: var(--p-4, 16px) 0;
}
.user-data-form__type-title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  color: var(--p-ink);
  margin: 0;
  text-align: center;
}
.user-data-form__type-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.user-data-form__change {
  display: flex;
  justify-content: center;
  margin: 0 0 var(--p-3, 12px);
}
</style>
