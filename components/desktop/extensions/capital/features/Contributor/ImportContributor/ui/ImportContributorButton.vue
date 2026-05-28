<template lang="pug">
div
  //- Canon header-кнопка: на мобильном — иконка-only + tooltip.
  q-btn(
    @click='showDialog = true',
    :color='isMobile ? "accent" : "primary"',
    :flat='isMobile',
    :dense='isMobile',
    :size='isMobile ? "sm" : undefined',
    :loading='loading',
    icon='add',
    :label='isMobile ? undefined : "Добавить"',
    no-wrap
  )
    q-tooltip(v-if='isMobile') Добавить участника

  BaseDialog(
    v-model='showDialog',
    title='Импорт участника',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-md(
      :handler-submit='handleImportContributor',
      :is-submitting='isSubmitting',
      :button-submit-txt='"Импортировать"',
      :button-cancel-txt='"Отмена"',
      @cancel='clear'
      style="width: 600px; max-width: 100% !important;"
    )
      q-input(
        v-model='formData.username'
        label='Имя пользователя'
        :rules='[(val) => !!val || "Имя пользователя обязательно"]'
        outlined
      )

      q-input(
        v-model='formData.contribution_amount'
        label='Сумма взноса'
        :rules='[(val) => !!val || "Сумма взноса обязательна"]'
        outlined
      )
        template(#append)
          span.text-grey-7 {{ info.symbols.root_govern_symbol }}

      q-input(
        v-model='formData.contributor_contract_number'
        label='Номер договора'
        :rules='[(val) => !!val || "Номер договора обязателен"]'
        outlined
      )

      q-input(
        v-model='formData.contributor_contract_created_at'
        label='Дата договора (ДД.ММ.ГГГГ)'
        :rules='[(val) => !!val || "Дата договора обязательна"]'
        outlined
      )

      q-input(
        v-model='formData.blagorost_agreement_number'
        label='Номер соглашения Благорост'
        :rules='[(val) => !!val || "Номер соглашения Благорост обязателен"]'
        outlined
      )

      q-input(
        v-model='formData.blagorost_agreement_created_at'
        label='Дата соглашения Благорост (ДД.ММ.ГГГГ)'
        :rules='[(val) => !!val || "Дата соглашения Благорост обязательна"]'
        outlined
      )

      q-input(
        v-model='formData.memo'
        label='Примечание'
        outlined
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useImportContributor } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize } from 'src/shared/hooks';

const { importContributor } = useImportContributor();
const { info } = useSystemStore();
const { isMobile } = useWindowSize();

const showDialog = ref(false);
const isSubmitting = ref(false);
const loading = ref(false);

const formData = ref({
  username: '',
  contribution_amount: '',
  contributor_contract_number: '',
  contributor_contract_created_at: '',
  blagorost_agreement_number: '',
  blagorost_agreement_created_at: '',
  memo: '',
});

const clear = () => {
  showDialog.value = false;
  formData.value = {
    username: '',
    contribution_amount: '',
    contributor_contract_number: '',
    contributor_contract_created_at: '',
    blagorost_agreement_number: '',
    blagorost_agreement_created_at: '',
    memo: '',
  };
};

const handleImportContributor = async () => {
  isSubmitting.value = true;
  try {
    const data = {
      coopname: info.coopname,
      username: formData.value.username,
      contribution_amount: parseFloat(formData.value.contribution_amount).toFixed(info.symbols.root_govern_precision) +  ' ' + info.symbols.root_govern_symbol,
      contributor_contract_number: formData.value.contributor_contract_number,
      contributor_contract_created_at: formData.value.contributor_contract_created_at,
      blagorost_agreement_number: formData.value.blagorost_agreement_number,
      blagorost_agreement_created_at: formData.value.blagorost_agreement_created_at,
      memo: formData.value.memo || undefined,
    };

    await importContributor(data);
    SuccessAlert('Участник успешно импортирован');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
